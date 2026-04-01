const sharp = require("sharp");

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_API = "https://api.line.me/v2/bot";
const LINE_DATA = "https://api-data.line.me/v2/bot";

function createMenuSVG() {
  const w = 2500, h = 1686;
  const cw = Math.floor(w / 3), ch = Math.floor(h / 2);

  const cells = [
    { x: 0, y: 0, bg: "#FF0082", icon: "⚡", line1: "Quick Apply", line2: "สมัครด่วน" },
    { x: cw, y: 0, bg: "#4B4C6A", icon: "📋", line1: "Browse Jobs", line2: "ดูตำแหน่งงาน" },
    { x: cw*2, y: 0, bg: "#3D3E5C", icon: "✅", line1: "Already Applied", line2: "เคยสมัครแล้ว" },
    { x: 0, y: ch, bg: "#2E2F4A", icon: "❓", line1: "FAQ", line2: "คำถามที่พบบ่อย" },
    { x: cw, y: ch, bg: "#2E2F4A", icon: "📍", line1: "Location", line2: "สถานที่ทำงาน" },
    { x: cw*2, y: ch, bg: "#2E2F4A", icon: "🎁", line1: "Benefits", line2: "สวัสดิการ" },
  ];

  const rects = cells.map(c => `
    <rect x="${c.x}" y="${c.y}" width="${cw}" height="${ch}" fill="${c.bg}"/>
    <text x="${c.x + cw/2}" y="${c.y + ch/2 - 80}" text-anchor="middle" font-size="120" fill="white">${c.icon}</text>
    <text x="${c.x + cw/2}" y="${c.y + ch/2 + 40}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="bold" fill="white">${c.line1}</text>
    <text x="${c.x + cw/2}" y="${c.y + ch/2 + 130}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="56" fill="rgba(255,255,255,0.7)">${c.line2}</text>
  `).join("");

  // Add thin grid lines between cells
  const lines = `
    <line x1="${cw}" y1="0" x2="${cw}" y2="${h}" stroke="rgba(255,255,255,0.15)" stroke-width="4"/>
    <line x1="${cw*2}" y1="0" x2="${cw*2}" y2="${h}" stroke="rgba(255,255,255,0.15)" stroke-width="4"/>
    <line x1="0" y1="${ch}" x2="${w}" y2="${ch}" stroke="rgba(255,255,255,0.15)" stroke-width="4"/>
  `;

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${rects}${lines}</svg>`;
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).send("GET only");
  if (req.query.key !== "setup2026") return res.status(403).send("Add ?key=setup2026");

  try {
    // 1. Delete existing rich menus
    const listRes = await fetch(LINE_API + "/richmenu/list", {
      headers: { Authorization: "Bearer " + TOKEN },
    });
    const list = await listRes.json();
    if (list.richmenus) {
      for (const rm of list.richmenus) {
        await fetch(LINE_API + "/richmenu/" + rm.richMenuId, {
          method: "DELETE", headers: { Authorization: "Bearer " + TOKEN },
        });
      }
    }

    // 2. Create rich menu
    const cw = Math.floor(2500 / 3), ch = Math.floor(1686 / 2);
    const menuDef = {
      size: { width: 2500, height: 1686 },
      selected: true,
      name: "TP Thailand Main Menu",
      chatBarText: "📋 เมนู / Menu",
      areas: [
        { bounds: { x: 0, y: 0, width: cw, height: ch }, action: { type: "message", text: "Quick Apply" } },
        { bounds: { x: cw, y: 0, width: cw, height: ch }, action: { type: "message", text: "Browse Jobs" } },
        { bounds: { x: cw*2, y: 0, width: cw, height: ch }, action: { type: "message", text: "Already Applied" } },
        { bounds: { x: 0, y: ch, width: cw, height: ch }, action: { type: "message", text: "Ask a question" } },
        { bounds: { x: cw, y: ch, width: cw, height: ch }, action: { type: "message", text: "Office locations" } },
        { bounds: { x: cw*2, y: ch, width: cw, height: ch }, action: { type: "message", text: "Benefits" } },
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

    // 3. Generate image
    const svg = createMenuSVG();
    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    // 4. Upload image
    const uploadRes = await fetch(LINE_DATA + "/richmenu/" + id + "/content", {
      method: "POST",
      headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "image/png" },
      body: png,
    });
    const uploaded = await uploadRes.json().catch(() => ({ ok: true }));

    // 5. Set as default for all users
    const setRes = await fetch(LINE_API + "/user/all/richmenu/" + id, {
      method: "POST",
      headers: { Authorization: "Bearer " + TOKEN },
    });
    const setDefault = await setRes.json().catch(() => ({ ok: true }));

    return res.status(200).json({
      success: true,
      richMenuId: id,
      uploaded,
      setDefault,
      message: "Rich menu created and activated! Open LINE to see it.",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};
