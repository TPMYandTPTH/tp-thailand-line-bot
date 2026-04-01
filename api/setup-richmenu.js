const path = require("path");
const fs = require("fs");

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_API = "https://api.line.me/v2/bot";
const LINE_DATA = "https://api-data.line.me/v2/bot";

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).send("GET only");
  if (req.query.key !== "setup2026") return res.status(403).send("Add ?key=setup2026");

  try {
    // 1. Delete ALL existing rich menus
    const listRes = await fetch(LINE_API + "/richmenu/list", {
      headers: { Authorization: "Bearer " + TOKEN },
    });
    const list = await listRes.json();
    if (list.richmenus) {
      for (const rm of list.richmenus) {
        await fetch(LINE_API + "/richmenu/" + rm.richMenuId, {
          method: "DELETE",
          headers: { Authorization: "Bearer " + TOKEN },
        });
      }
    }

    // 2. Create rich menu definition
    const cw = Math.floor(2500 / 3), ch = Math.floor(1686 / 2);
    const menuDef = {
      size: { width: 2500, height: 1686 },
      selected: true,
      name: "TP Thailand Main Menu",
      chatBarText: "Menu",
      areas: [
        { bounds: { x: 0, y: 0, width: cw, height: ch }, action: { type: "message", text: "Quick Apply" } },
        { bounds: { x: cw, y: 0, width: cw, height: ch }, action: { type: "message", text: "Browse Jobs" } },
        { bounds: { x: cw * 2, y: 0, width: cw, height: ch }, action: { type: "message", text: "Already Applied" } },
        { bounds: { x: 0, y: ch, width: cw, height: ch }, action: { type: "message", text: "Ask a question" } },
        { bounds: { x: cw, y: ch, width: cw, height: ch }, action: { type: "message", text: "Office locations" } },
        { bounds: { x: cw * 2, y: ch, width: cw, height: ch }, action: { type: "message", text: "Benefits" } },
      ],
    };

    const createRes = await fetch(LINE_API + "/richmenu", {
      method: "POST",
      headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(menuDef),
    });
    const created = await createRes.json();
    if (!created.richMenuId) return res.status(500).json({ error: "Create failed", detail: created });
    const id = created.richMenuId;

    // 3. Read pre-made image
    const imgPath = path.join(__dirname, "..", "data", "richmenu.png");
    const png = fs.readFileSync(imgPath);

    // 4. Upload image
    const uploadRes = await fetch(LINE_DATA + "/richmenu/" + id + "/content", {
      method: "POST",
      headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "image/png" },
      body: png,
    });
    const uploaded = await uploadRes.json().catch(() => ({ ok: true }));

    // 5. Set as default
    const setRes = await fetch(LINE_API + "/user/all/richmenu/" + id, {
      method: "POST",
      headers: { Authorization: "Bearer " + TOKEN },
    });
    const setDefault = await setRes.json().catch(() => ({ ok: true }));

    return res.status(200).json({ success: true, richMenuId: id, message: "Rich menu activated!" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
