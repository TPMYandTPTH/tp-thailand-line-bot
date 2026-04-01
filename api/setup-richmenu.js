const sharp = require("sharp");

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_API = "https://api.line.me/v2/bot";
const LINE_DATA = "https://api-data.line.me/v2/bot";

function createMenuSVG() {
  const w = 2500, h = 1686;
  const cw = Math.floor(w / 3), ch = Math.floor(h / 2);
  const gap = 6;

  const cells = [
    { x: 0, y: 0, bg: "#FF0082", en: "QUICK APPLY", th: "สมัครด่วน", icon: "star" },
    { x: cw, y: 0, bg: "#4B4C6A", en: "BROWSE JOBS", th: "ดูตำแหน่งงาน", icon: "list" },
    { x: cw*2, y: 0, bg: "#5C5D7A", en: "ALREADY APPLIED", th: "เคยสมัครแล้ว", icon: "check" },
    { x: 0, y: ch, bg: "#3A3B55", en: "FAQ", th: "คำถามที่พบบ่อย", icon: "question" },
    { x: cw, y: ch, bg: "#3A3B55", en: "LOCATION", th: "สถานที่ทำงาน", icon: "pin" },
    { x: cw*2, y: ch, bg: "#3A3B55", en: "BENEFITS", th: "สวัสดิการ", icon: "gift" },
  ];

  function iconSVG(type, cx, cy) {
    const s = 70;
    switch(type) {
      case "star":
        return `<polygon points="${cx},${cy-s} ${cx+s*0.22},${cy-s*0.31} ${cx+s*0.95},${cy-s*0.31} ${cx+s*0.36},${cy+s*0.12} ${cx+s*0.59},${cy+s*0.81} ${cx},${cy+s*0.38} ${cx-s*0.59},${cy+s*0.81} ${cx-s*0.36},${cy+s*0.12} ${cx-s*0.95},${cy-s*0.31} ${cx-s*0.22},${cy-s*0.31}" fill="rgba(255,255,255,0.9)"/>`;
      case "list":
        return `
          <rect x="${cx-45}" y="${cy-50}" width="90" height="16" rx="4" fill="rgba(255,255,255,0.9)"/>
          <rect x="${cx-45}" y="${cy-18}" width="70" height="16" rx="4" fill="rgba(255,255,255,0.7)"/>
          <rect x="${cx-45}" y="${cy+14}" width="90" height="16" rx="4" fill="rgba(255,255,255,0.9)"/>
          <rect x="${cx-45}" y="${cy+46}" width="55" height="16" rx="4" fill="rgba(255,255,255,0.7)"/>`;
      case "check":
        return `<polyline points="${cx-40},${cy} ${cx-8},${cy+35} ${cx+45},${cy-35}" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`;
      case "question":
        return `<text x="${cx}" y="${cy+30}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="120" font-weight="bold" fill="rgba(255,255,255,0.9)">?</text>`;
      case "pin":
        return `<circle cx="${cx}" cy="${cy-15}" r="28" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="12"/>
                <line x1="${cx}" y1="${cy+13}" x2="${cx}" y2="${cy+55}" stroke="rgba(255,255,255,0.9)" stroke-width="12" stroke-linecap="round"/>`;
      case "gift":
        return `
          <rect x="${cx-45}" y="${cy-10}" width="90" height="60" rx="8" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="10"/>
          <rect x="${cx-55}" y="${cy-30}" width="110" height="30" rx="6" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="10"/>
          <line x1="${cx}" y1="${cy-30}" x2="${cx}" y2="${cy+50}" stroke="rgba(255,255,255,0.9)" stroke-width="8"/>`;
      default: return "";
    }
  }

  const rects = cells.map(c => {
    const cx = c.x + cw/2;
    const cy = c.y + ch/2;
    return `
      <rect x="${c.x + gap/2}" y="${c.y + gap/2}" width="${cw - gap}" height="${ch - gap}" rx="16" fill="${c.bg}"/>
      ${iconSVG(c.icon, cx, cy - 130)}
      <text x="${cx}" y="${cy + 80}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="bold" fill="white" letter-spacing="3">${c.en}</text>
      <text x="${cx}" y="${cy + 175}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="64" fill="rgba(255,255,255,0.75)">${c.th}</text>
    `;
  }).join("");

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#1a1a2e"/>
    ${rects}
  </svg>`;
}

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
          method: "DELETE", headers: { Authorization: "Bearer " + TOKEN },
        });
      }
    }

    // 2. Create rich menu definition
    const cw = Math.floor(2500 / 3), ch = Math.floor(1686 / 2);
    const menuDef = {
      size: { width: 2500, height: 1686 },
      selected: true,
      name: "TP Thailand Main Menu",
      chatBarText: "Menu / เมนู",
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

    // 3. Generate PNG from SVG
    const svg = createMenuSVG();
    const png = await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();

    // 4. Upload image
    await fetch(LINE_DATA + "/richmenu/" + id + "/content", {
      method: "POST",
      headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "image/png" },
      body: png,
    });

    // 5. Set as default
    await fetch(LINE_API + "/user/all/richmenu/" + id, {
      method: "POST",
      headers: { Authorization: "Bearer " + TOKEN },
    });

    return res.status(200).json({
      success: true,
      richMenuId: id,
      message: "Rich menu created! Open LINE to see it.",
      imageSize: png.length + " bytes",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
