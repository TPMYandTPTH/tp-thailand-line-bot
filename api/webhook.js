const { messagingApi } = require("@line/bot-sdk");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

// --- Config ---
const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

// --- Load Jobs Data ---
function loadData() {
  const dataPath = path.join(__dirname, "..", "data", "jobs.json");
  const raw = fs.readFileSync(dataPath, "utf-8");
  return JSON.parse(raw);
}

// --- Constants ---
const TP_DARK = "#4B4C6A";
const TP_PINK = "#FF0082";

// --- Signature Verification ---
function verifySignature(body, signature) {
  const hash = crypto
    .createHmac("SHA256", config.channelSecret)
    .update(Buffer.from(JSON.stringify(body)))
    .digest("base64");
  return hash === signature;
}

// --- Quick Reply Buttons ---
const mainMenuQuickReply = {
  items: [
    { type: "action", action: { type: "message", label: "📋 Open Positions", text: "View open positions" } },
    { type: "action", action: { type: "message", label: "📝 Apply Now", text: "Apply now" } },
    { type: "action", action: { type: "message", label: "❓ FAQ", text: "Ask a question" } },
    { type: "action", action: { type: "message", label: "📍 Locations", text: "Office locations" } },
    { type: "action", action: { type: "message", label: "🎁 Benefits", text: "Benefits" } },
  ],
};

const backToMenuQuickReply = {
  items: [
    { type: "action", action: { type: "message", label: "🏠 Main Menu", text: "Hi" } },
    { type: "action", action: { type: "message", label: "📝 Apply Now", text: "Apply now" } },
  ],
};

const languageQuickReply = {
  items: [
    { type: "action", action: { type: "message", label: "🇯🇵 Japanese", text: "Jobs Japanese" } },
    { type: "action", action: { type: "message", label: "🇰🇷 Korean", text: "Jobs Korean" } },
    { type: "action", action: { type: "message", label: "🇹🇭 Thai", text: "Jobs Thai" } },
    { type: "action", action: { type: "message", label: "🇻🇳 Vietnamese", text: "Jobs Vietnamese" } },
    { type: "action", action: { type: "message", label: "🇮🇩 Bahasa", text: "Jobs Bahasa Indonesia" } },
    { type: "action", action: { type: "message", label: "🇨🇳 Mandarin", text: "Jobs Mandarin" } },
    { type: "action", action: { type: "message", label: "🇹🇼 Taiwanese", text: "Jobs Taiwanese" } },
    { type: "action", action: { type: "message", label: "🇬🇧 English", text: "Jobs English" } },
  ],
};

// ============================================================
// FLEX MESSAGE BUILDERS
// ============================================================

function welcomeFlex() {
  return {
    type: "flex",
    altText: "Welcome to TP Thailand Recruitment",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "🇹🇭 TP Thailand", weight: "bold", size: "xl", color: TP_DARK },
          { type: "text", text: "Recruitment Bot", size: "md", color: "#888888", margin: "xs" },
        ],
        paddingAll: "20px",
        backgroundColor: "#F8F8FF",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "สวัสดีค่ะ! Welcome!", weight: "bold", size: "lg", margin: "md" },
          { type: "text", text: "ยินดีต้อนรับสู่ TP Thailand\nHow can I help you?", size: "sm", color: "#666666", margin: "md", wrap: true },
          { type: "separator", margin: "xl" },
          { type: "text", text: "เลือกเมนูด้านล่าง / Choose below:", size: "sm", color: "#888888", margin: "lg" },
        ],
        paddingAll: "20px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "📋 ดูตำแหน่งงาน / View Positions", text: "View open positions" } },
          { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: "📝 สมัครงาน / Apply Now", text: "Apply now" } },
          { type: "button", style: "secondary", action: { type: "message", label: "❓ FAQ / คำถามที่พบบ่อย", text: "Ask a question" } },
          { type: "button", style: "secondary", action: { type: "message", label: "📍 สถานที่ / Locations", text: "Office locations" } },
          { type: "button", style: "secondary", action: { type: "message", label: "🎁 สวัสดิการ / Benefits", text: "Benefits" } },
        ],
        paddingAll: "15px",
      },
    },
    quickReply: mainMenuQuickReply,
  };
}

// --- LANGUAGE SELECTION (for both View Positions and New Applicant) ---
function languageSelectionFlex(context) {
  const headerText = context === "apply"
    ? "📝 เลือกภาษา / Choose Language"
    : "📋 เลือกภาษา / Choose Language";
  const bodyText = context === "apply"
    ? "คุณพูดภาษาอะไร? เราจะแสดงตำแหน่งที่เหมาะกับคุณ\nWhat language do you speak? We'll show matching positions."
    : "เลือกภาษาเพื่อดูตำแหน่งที่เปิดรับ\nSelect a language to view open positions.";

  return {
    type: "flex",
    altText: "Choose your language",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: headerText, weight: "bold", size: "lg", color: "#FFFFFF" },
        ],
        backgroundColor: context === "apply" ? TP_PINK : TP_DARK,
        paddingAll: "20px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: bodyText, size: "sm", color: "#666666", wrap: true },
        ],
        paddingAll: "20px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇯🇵 Japanese", text: "Jobs Japanese" } },
              { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇰🇷 Korean", text: "Jobs Korean" } },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇹🇭 Thai", text: "Jobs Thai" } },
              { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇻🇳 Vietnamese", text: "Jobs Vietnamese" } },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇮🇩 Bahasa", text: "Jobs Bahasa Indonesia" } },
              { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇨🇳 Mandarin", text: "Jobs Mandarin" } },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇹🇼 Taiwanese", text: "Jobs Taiwanese" } },
              { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇬🇧 English", text: "Jobs English" } },
            ],
          },
        ],
        paddingAll: "15px",
      },
    },
    quickReply: languageQuickReply,
  };
}

// --- JOB CARDS BY LANGUAGE (carousel with iCIMS Apply links) ---
function jobsByLanguageFlex(language) {
  const data = loadData();
  const filtered = data.jobs.filter(
    (j) => j.language.toLowerCase() === language.toLowerCase()
  );

  if (filtered.length === 0) {
    return {
      type: "text",
      text: "ขออภัย ไม่พบตำแหน่งงานสำหรับภาษา " + language + " ในขณะนี้\nSorry, no positions found for " + language + " at this time.",
      quickReply: backToMenuQuickReply,
    };
  }

  const cards = filtered.slice(0, 12).map((job) => ({
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: job.title, weight: "bold", size: "md", color: "#FFFFFF", wrap: true },
      ],
      backgroundColor: TP_DARK,
      paddingAll: "15px",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: job.description, size: "sm", color: "#666666", wrap: true },
        { type: "separator", margin: "lg" },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "🌐", size: "sm", flex: 0 },
                { type: "text", text: job.language, size: "sm", color: "#444444", margin: "md" },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "📍", size: "sm", flex: 0 },
                { type: "text", text: job.location, size: "sm", color: "#444444", margin: "md" },
              ],
            },
          ],
        },
      ],
      paddingAll: "15px",
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: TP_PINK,
          action: { type: "uri", label: "📝 สมัครเลย / Apply", uri: job.link },
        },
      ],
      paddingAll: "10px",
    },
  }));

  return {
    type: "flex",
    altText: language + " positions at TP Thailand",
    contents: { type: "carousel", contents: cards },
    quickReply: {
      items: [
        { type: "action", action: { type: "message", label: "🔄 เปลี่ยนภาษา / Change", text: "View open positions" } },
        { type: "action", action: { type: "message", label: "🏠 Main Menu", text: "Hi" } },
      ],
    },
  };
}

// --- APPLY FLOW: Step 1 — Ask if applied before ---
function applyAskPreviousFlex() {
  return {
    type: "flex",
    altText: "Have you applied to TP before?",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "📝 สมัครงาน / Apply", weight: "bold", size: "lg", color: "#FFFFFF" },
        ],
        backgroundColor: TP_PINK,
        paddingAll: "20px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "คุณเคยสมัครงานกับ TP มาก่อนหรือไม่?", weight: "bold", size: "md", wrap: true },
          { type: "text", text: "Have you applied to TP before?", size: "sm", color: "#888888", margin: "sm", wrap: true },
        ],
        paddingAll: "20px",
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "md",
        contents: [
          { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "✅ เคย / Yes", text: "Yes I applied before" } },
          { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: "❌ ยังไม่เคย / No", text: "No first time applying" } },
        ],
        paddingAll: "15px",
      },
    },
  };
}

// --- APPLY FLOW: Step 2a — Yes → Assessment link (copyable) ---
function appliedBeforeAssessmentFlex() {
  const data = loadData();
  return {
    type: "flex",
    altText: "Take your language assessment",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "📋 Language Assessment", weight: "bold", size: "lg", color: "#FFFFFF" },
          { type: "text", text: "แบบทดสอบภาษา", size: "md", color: "#FFFFFFCC", margin: "xs" },
        ],
        backgroundColor: TP_DARK,
        paddingAll: "20px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "ยินดีต้อนรับกลับมาค่ะ! 🎉", weight: "bold", size: "md" },
          { type: "text", text: "Welcome back!", size: "sm", color: "#888888", margin: "xs" },
          { type: "separator", margin: "lg" },
          { type: "text", text: "กรุณาทำแบบทดสอบภาษาเพื่อดำเนินการต่อ\nPlease complete the assessment to proceed.", size: "sm", color: "#666666", margin: "lg", wrap: true },
          { type: "separator", margin: "lg" },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              { type: "text", text: "🗣️ Speaking  ✍️ Writing  👂 Listening", size: "sm", color: "#444444" },
              { type: "text", text: "📖 Reading  ⌨️ Typing", size: "sm", color: "#444444" },
            ],
          },
          { type: "separator", margin: "lg" },
          { type: "text", text: "💻 แนะนำให้ทำบน PC / Best on PC", weight: "bold", size: "xs", color: TP_PINK, margin: "lg", wrap: true },
          { type: "text", text: "กดปุ่ม 'คัดลอกลิงก์' เพื่อคัดลอกแล้วเปิดบน PC", size: "xs", color: "#888888", margin: "sm", wrap: true },
        ],
        paddingAll: "20px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "button", style: "primary", color: TP_PINK, action: { type: "uri", label: "🚀 เริ่มทำแบบทดสอบ / Start", uri: data.assessment_url } },
          { type: "button", style: "secondary", action: { type: "message", label: "📋 คัดลอกลิงก์ / Copy Link", text: "Send me the assessment link" } },
          { type: "button", style: "secondary", action: { type: "message", label: "🏠 กลับเมนูหลัก / Main Menu", text: "Hi" } },
        ],
        paddingAll: "15px",
      },
    },
  };
}

// --- Send copyable assessment link as plain text ---
function assessmentLinkText() {
  const data = loadData();
  return {
    type: "text",
    text:
      "📋 ลิงก์แบบทดสอบภาษา / Assessment Link:\n\n" +
      "💻 แนะนำให้เปิดบน PC / Best on PC:\n\n" +
      data.assessment_url +
      "\n\n" +
      "👆 กดค้างเพื่อคัดลอก / Long press to copy",
    quickReply: backToMenuQuickReply,
  };
}

// --- FAQ ---
function faqFlex() {
  return {
    type: "flex",
    altText: "FAQ - TP Thailand",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "❓ คำถามที่พบบ่อย / FAQ", weight: "bold", size: "lg", color: "#FFFFFF" },
        ],
        backgroundColor: TP_DARK,
        paddingAll: "20px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "lg",
        contents: [
          faqItem("TP คืออะไร? / What is TP?", "TP เป็นผู้นำระดับโลกด้าน Digital Business Services มีพนักงานกว่า 500,000 คนใน 100+ ประเทศ"),
          { type: "separator" },
          faqItem("ต้องมีประสบการณ์ไหม?", "ไม่จำเป็น! เรามีการฝึกอบรมให้ทุกตำแหน่ง\nNo experience needed! Full training provided."),
          { type: "separator" },
          faqItem("ทำงานที่ไหน? / Where?", "กรุงเทพฯ, ประเทศไทย\nBangkok, Thailand"),
        ],
        paddingAll: "20px",
      },
    },
    quickReply: backToMenuQuickReply,
  };
}

function faqItem(q, a) {
  return {
    type: "box",
    layout: "vertical",
    contents: [
      { type: "text", text: q, weight: "bold", size: "sm", color: TP_DARK, wrap: true },
      { type: "text", text: a, size: "sm", color: "#666666", margin: "sm", wrap: true },
    ],
  };
}

// --- Locations ---
function locationsFlex() {
  return {
    type: "flex",
    altText: "TP Thailand Office Locations",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "📍 สถานที่ทำงาน", weight: "bold", size: "lg", color: "#FFFFFF" },
          { type: "text", text: "Office Locations", size: "md", color: "#FFFFFFCC" },
        ],
        backgroundColor: TP_DARK,
        paddingAll: "20px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "🏢 TP Thailand - Bangkok", weight: "bold", size: "md" },
          { type: "text", text: "กรุงเทพมหานคร, ประเทศไทย", size: "sm", color: "#888888", margin: "sm" },
          { type: "separator", margin: "xl" },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              { type: "text", text: "🚇 ใกล้ BTS / Near BTS station", size: "sm", color: "#444444" },
              { type: "text", text: "🅿️ มีที่จอดรถ / Parking available", size: "sm", color: "#444444" },
              { type: "text", text: "🏙️ ย่านธุรกิจ / Business district", size: "sm", color: "#444444" },
            ],
          },
        ],
        paddingAll: "20px",
      },
    },
    quickReply: backToMenuQuickReply,
  };
}

// --- Benefits ---
function benefitsFlex() {
  return {
    type: "flex",
    altText: "Benefits at TP Thailand",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "🎁 สวัสดิการ / Benefits", weight: "bold", size: "lg", color: "#FFFFFF" },
        ],
        backgroundColor: TP_PINK,
        paddingAll: "20px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          benefitRow("💰", "เงินเดือนแข่งขันได้ / Competitive salary"),
          benefitRow("🏥", "ประกันสังคม + ประกันกลุ่ม / Insurance"),
          benefitRow("🎯", "โบนัสประจำปี / Annual bonus"),
          benefitRow("📚", "ฝึกอบรมฟรี / Free training"),
          benefitRow("📈", "โอกาสเติบโต / Career growth"),
          benefitRow("🌍", "สภาพแวดล้อมระดับสากล / International environment"),
        ],
        paddingAll: "20px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: "📝 สมัครเลย / Apply Now!", text: "Apply now" } },
        ],
        paddingAll: "10px",
      },
    },
    quickReply: backToMenuQuickReply,
  };
}

function benefitRow(icon, text) {
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: icon, size: "md", flex: 0 },
      { type: "text", text: text, size: "sm", color: "#444444", margin: "md", wrap: true },
    ],
  };
}

// ============================================================
// ROUTE MESSAGES
// ============================================================
function getReply(text) {
  const msg = text.toLowerCase().trim();

  // --- Greetings / Main menu ---
  if (msg.includes("สวัสดี") || msg.includes("hello") || msg.includes("hi") || msg === "start" || msg.includes("menu")) {
    return [welcomeFlex()];
  }

  // --- View Positions → Language selection ---
  if (msg === "1" || msg.includes("ตำแหน่ง") || msg.includes("position") || msg.includes("view open")) {
    return [languageSelectionFlex("view")];
  }

  // --- Jobs by language ---
  if (msg.startsWith("jobs ")) {
    const lang = text.replace(/^jobs\s+/i, "").trim();
    return [jobsByLanguageFlex(lang)];
  }

  // --- Apply → Ask if applied before ---
  if (msg === "2" || msg.includes("สมัคร") || msg.includes("apply now")) {
    return [applyAskPreviousFlex()];
  }

  // --- Yes → Assessment ---
  if (msg.includes("yes i applied") || msg.includes("เคย")) {
    return [appliedBeforeAssessmentFlex()];
  }

  // --- Copyable assessment link ---
  if (msg.includes("send me the assessment") || msg.includes("copy link") || msg.includes("assessment link")) {
    return [assessmentLinkText()];
  }

  // --- No → Language selection for job application ---
  if (msg.includes("no first time") || msg.includes("ยังไม่เคย") || msg.includes("ไม่เคย")) {
    return [languageSelectionFlex("apply")];
  }

  // --- FAQ ---
  if (msg === "3" || msg.includes("ถาม") || msg.includes("question") || msg.includes("faq")) {
    return [faqFlex()];
  }

  // --- Locations ---
  if (msg === "4" || msg.includes("สถานที่") || msg.includes("location") || msg.includes("office") || msg.includes("ที่ทำงาน")) {
    return [locationsFlex()];
  }

  // --- Benefits ---
  if (msg === "5" || msg.includes("สวัสดิการ") || msg.includes("benefit") || msg.includes("salary") || msg.includes("เงินเดือน")) {
    return [benefitsFlex()];
  }

  // --- Default ---
  return [welcomeFlex()];
}

// ============================================================
// WEBHOOK HANDLER
// ============================================================
module.exports = async (req, res) => {
  if (req.method === "GET") {
    return res.status(200).send("TP Thailand LINE Bot is running 🇹🇭");
  }

  const signature = req.headers["x-line-signature"];
  if (!signature || !verifySignature(req.body, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const events = req.body.events || [];
  if (events.length === 0) {
    return res.status(200).json({ status: "ok" });
  }

  for (const event of events) {
    try {
      if (event.type === "follow") {
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [welcomeFlex()],
        });
      } else if (event.type === "message" && event.message.type === "text") {
        const replies = getReply(event.message.text);
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: replies,
        });
      }
    } catch (err) {
      console.error("Error handling event:", err);
    }
  }

  res.status(200).json({ status: "ok" });
};
