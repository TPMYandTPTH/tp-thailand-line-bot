const { messagingApi } = require("@line/bot-sdk");
const crypto = require("crypto");

// --- Config ---
const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

// --- Constants ---
const HALLO_ASSESSMENT_URL =
  "https://app.hallo.ai/teleperformance/ai-assessment/taQuestionnaire_interview_speaking-th_writing-th_listening-th_reading-th_typing-th/th?assessmentTypeId=SEozdUVBUTh0STFwdm04TXBDVE4=";

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

// --- Flex Message Builders ---

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
          {
            type: "text",
            text: "คุณเคยสมัครงานกับ TP มาก่อนหรือไม่?",
            weight: "bold",
            size: "md",
            wrap: true,
          },
          {
            type: "text",
            text: "Have you applied to TP before?",
            size: "sm",
            color: "#888888",
            margin: "sm",
            wrap: true,
          },
        ],
        paddingAll: "20px",
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "md",
        contents: [
          {
            type: "button",
            style: "primary",
            color: TP_DARK,
            action: { type: "message", label: "✅ เคย / Yes", text: "Yes I applied before" },
          },
          {
            type: "button",
            style: "primary",
            color: TP_PINK,
            action: { type: "message", label: "❌ ยังไม่เคย / No", text: "No first time applying" },
          },
        ],
        paddingAll: "15px",
      },
    },
  };
}

// --- APPLY FLOW: Step 2a — Yes → Send assessment link ---
function appliedBeforeAssessmentFlex() {
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
          {
            type: "text",
            text: "ยินดีต้อนรับกลับมาค่ะ! 🎉",
            weight: "bold",
            size: "md",
          },
          {
            type: "text",
            text: "Welcome back!",
            size: "sm",
            color: "#888888",
            margin: "xs",
          },
          { type: "separator", margin: "lg" },
          {
            type: "text",
            text: "กรุณาทำแบบทดสอบภาษาด้านล่างเพื่อดำเนินการสมัครงานต่อ",
            size: "sm",
            color: "#666666",
            margin: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: "Please complete the language assessment below to proceed with your application.",
            size: "sm",
            color: "#888888",
            margin: "sm",
            wrap: true,
          },
          { type: "separator", margin: "lg" },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              { type: "text", text: "🗣️ Speaking / การพูด", size: "sm", color: "#444444" },
              { type: "text", text: "✍️ Writing / การเขียน", size: "sm", color: "#444444" },
              { type: "text", text: "👂 Listening / การฟัง", size: "sm", color: "#444444" },
              { type: "text", text: "📖 Reading / การอ่าน", size: "sm", color: "#444444" },
              { type: "text", text: "⌨️ Typing / การพิมพ์", size: "sm", color: "#444444" },
            ],
          },
        ],
        paddingAll: "20px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: TP_PINK,
            height: "md",
            action: {
              type: "uri",
              label: "🚀 เริ่มทำแบบทดสอบ / Start Assessment",
              uri: HALLO_ASSESSMENT_URL,
            },
          },
          {
            type: "button",
            style: "secondary",
            action: { type: "message", label: "🏠 กลับเมนูหลัก / Main Menu", text: "Hi" },
          },
        ],
        paddingAll: "15px",
      },
    },
  };
}

// --- APPLY FLOW: Step 2b — No → New applicant form ---
function newApplicantFlex() {
  return {
    type: "flex",
    altText: "Apply Now - TP Thailand",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "📝 สมัครงาน / Apply Now", weight: "bold", size: "lg", color: "#FFFFFF" },
          { type: "text", text: "ผู้สมัครใหม่ / New Applicant", size: "sm", color: "#FFFFFFCC", margin: "xs" },
        ],
        backgroundColor: TP_PINK,
        paddingAll: "20px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "ยินดีต้อนรับค่ะ! เรายินดีที่คุณสนใจร่วมงานกับเรา 🎉",
            size: "sm",
            color: "#666666",
            wrap: true,
          },
          {
            type: "text",
            text: "We're glad you're interested in joining TP!",
            size: "sm",
            color: "#888888",
            margin: "xs",
            wrap: true,
          },
          { type: "separator", margin: "lg" },
          {
            type: "text",
            text: "กรุณาส่งข้อมูลต่อไปนี้:",
            weight: "bold",
            size: "sm",
            margin: "lg",
          },
          {
            type: "text",
            text: "Please send us the following:",
            size: "sm",
            color: "#888888",
            margin: "xs",
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              { type: "text", text: "1. ชื่อ-นามสกุล / Full Name", size: "sm", color: "#444444" },
              { type: "text", text: "2. เบอร์โทร / Phone Number", size: "sm", color: "#444444" },
              { type: "text", text: "3. อีเมล / Email", size: "sm", color: "#444444" },
              { type: "text", text: "4. ตำแหน่งที่สนใจ / Position", size: "sm", color: "#444444" },
              { type: "text", text: "5. ภาษาที่พูดได้ / Languages", size: "sm", color: "#444444" },
            ],
          },
        ],
        paddingAll: "20px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: TP_DARK,
            action: { type: "uri", label: "🔗 สมัครผ่านเว็บไซต์ / Apply Online", uri: "https://careers.tp.com" },
          },
          {
            type: "button",
            style: "secondary",
            action: { type: "message", label: "🏠 กลับเมนูหลัก / Main Menu", text: "Hi" },
          },
        ],
        paddingAll: "15px",
      },
    },
  };
}

// --- Positions Carousel ---
function positionsFlex() {
  return {
    type: "flex",
    altText: "Open Positions at TP Thailand",
    contents: {
      type: "carousel",
      contents: [
        jobCard("Guest Experience Specialist", "Thai, English", "Bangkok", "Deliver exceptional customer support for a global tech brand."),
        jobCard("Customer Service Representative", "Thai, English", "Bangkok", "Handle inbound inquiries and provide world-class service."),
        jobCard("Content Moderator", "Thai", "Bangkok", "Review and moderate content to keep online platforms safe."),
      ],
    },
    quickReply: backToMenuQuickReply,
  };
}

function jobCard(title, languages, location, description) {
  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: title, weight: "bold", size: "md", color: "#FFFFFF", wrap: true },
      ],
      backgroundColor: TP_DARK,
      paddingAll: "15px",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: description, size: "sm", color: "#666666", wrap: true },
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
                { type: "text", text: languages, size: "sm", color: "#444444", margin: "md" },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "📍", size: "sm", flex: 0 },
                { type: "text", text: location, size: "sm", color: "#444444", margin: "md" },
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
          action: { type: "message", label: "สมัครเลย / Apply", text: "Apply now" },
        },
      ],
      paddingAll: "10px",
    },
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

function faqItem(question, answer) {
  return {
    type: "box",
    layout: "vertical",
    contents: [
      { type: "text", text: question, weight: "bold", size: "sm", color: TP_DARK, wrap: true },
      { type: "text", text: answer, size: "sm", color: "#666666", margin: "sm", wrap: true },
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
          {
            type: "button",
            style: "primary",
            color: TP_PINK,
            action: { type: "message", label: "📝 สมัครเลย / Apply Now!", text: "Apply now" },
          },
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

// --- Route Messages ---
function getReply(text) {
  const msg = text.toLowerCase().trim();

  // Greetings / Main menu
  if (msg.includes("สวัสดี") || msg.includes("hello") || msg.includes("hi") || msg === "start" || msg.includes("menu")) {
    return welcomeFlex();
  }

  // Positions
  if (msg === "1" || msg.includes("ตำแหน่ง") || msg.includes("position") || msg.includes("job") || msg.includes("งาน") || msg.includes("view open")) {
    return positionsFlex();
  }

  // Apply → Ask if applied before
  if (msg === "2" || msg.includes("สมัคร") || msg.includes("apply now")) {
    return applyAskPreviousFlex();
  }

  // Yes — applied before → send assessment
  if (msg.includes("yes i applied") || msg.includes("เคย")) {
    return appliedBeforeAssessmentFlex();
  }

  // No — first time → new applicant form
  if (msg.includes("no first time") || msg.includes("ยังไม่เคย") || msg.includes("ไม่เคย")) {
    return newApplicantFlex();
  }

  // FAQ
  if (msg === "3" || msg.includes("ถาม") || msg.includes("question") || msg.includes("info") || msg.includes("ask")) {
    return faqFlex();
  }

  // Locations
  if (msg === "4" || msg.includes("สถานที่") || msg.includes("location") || msg.includes("office") || msg.includes("ที่ทำงาน")) {
    return locationsFlex();
  }

  // Benefits
  if (msg === "5" || msg.includes("สวัสดิการ") || msg.includes("benefit") || msg.includes("salary") || msg.includes("เงินเดือน")) {
    return benefitsFlex();
  }

  // Default
  return welcomeFlex();
}

// --- Webhook Handler ---
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
        const reply = getReply(event.message.text);
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [reply],
        });
      }
    } catch (err) {
      console.error("Error handling event:", err);
    }
  }

  res.status(200).json({ status: "ok" });
};
