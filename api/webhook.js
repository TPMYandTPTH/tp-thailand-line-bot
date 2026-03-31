const { messagingApi } = require("@line/bot-sdk");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

// --- Config ---
const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};
const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

// --- Load Jobs Data ---
function loadData() {
  const dataPath = path.join(__dirname, "..", "data", "jobs.json");
  return JSON.parse(fs.readFileSync(dataPath, "utf-8"));
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

// ============================================================
// STATE MANAGEMENT (via Google Apps Script)
// ============================================================

async function getState(userId) {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getState", userId }),
    });
    return await res.json();
  } catch {
    return { step: 0, answers: {} };
  }
}

async function saveState(userId, step, answers) {
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveState", userId, step, answers }),
    });
  } catch (err) {
    console.error("saveState error:", err);
  }
}

async function saveCandidate(answers) {
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveCandidate", answers }),
    });
  } catch (err) {
    console.error("saveCandidate error:", err);
  }
}

async function clearState(userId) {
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clearState", userId }),
    });
  } catch (err) {
    console.error("clearState error:", err);
  }
}

// ============================================================
// QUICK REPLY HELPERS
// ============================================================

const cancelQuickReply = {
  items: [
    { type: "action", action: { type: "message", label: "❌ Cancel / ยกเลิก", text: "cancel application" } },
  ],
};

function buttonQuickReply(options) {
  return {
    items: [
      ...options.map((opt) => ({
        type: "action",
        action: { type: "message", label: opt, text: opt },
      })),
      { type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "cancel application" } },
    ],
  };
}

const mainMenuQuickReply = {
  items: [
    { type: "action", action: { type: "message", label: "⚡ Quick Apply", text: "Quick Apply" } },
    { type: "action", action: { type: "message", label: "📋 Browse Jobs", text: "Browse Jobs" } },
    { type: "action", action: { type: "message", label: "✅ Already Applied", text: "Already Applied" } },
    { type: "action", action: { type: "message", label: "❓ FAQ", text: "Ask a question" } },
    { type: "action", action: { type: "message", label: "🎁 Benefits", text: "Benefits" } },
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
// 16-QUESTION FLOW
// ============================================================

function questionMessage(step, answers) {
  switch (step) {
    case 1:
      return {
        type: "text",
        text: "⚡ Quick Apply — คำถามที่ 1/16\n\n👤 ชื่อ-นามสกุล / Full Name:\n\n(พิมพ์ชื่อของคุณ / Type your full name)",
        quickReply: cancelQuickReply,
      };

    case 2:
      return {
        type: "text",
        text: "📱 คำถามที่ 2/16\n\n📞 เบอร์โทรศัพท์ / Phone Number:",
        quickReply: cancelQuickReply,
      };

    case 3:
      return {
        type: "text",
        text: "📧 คำถามที่ 3/16\n\n✉️ อีเมล / Email Address:",
        quickReply: cancelQuickReply,
      };

    case 4:
      return {
        type: "text",
        text: "💬 คำถามที่ 4/16\n\n🔗 LINE ID ของคุณ / Your LINE ID:",
        quickReply: cancelQuickReply,
      };

    case 5:
      return {
        type: "text",
        text: "🌐 คำถามที่ 5/16\n\n🗣️ คุณพูดภาษาอะไร? / What language do you speak?",
        quickReply: buttonQuickReply([
          "🇯🇵 Japanese",
          "🇰🇷 Korean",
          "🇹🇭 Thai",
          "🇻🇳 Vietnamese",
          "🇮🇩 Bahasa Indonesia",
          "🇨🇳 Mandarin",
          "🇹🇼 Taiwanese",
          "🇬🇧 English",
        ]),
      };

    case 6:
      return {
        type: "text",
        text: "📊 คำถามที่ 6/16\n\n📈 ระดับความสามารถทางภาษา / Language Proficiency Level:",
        quickReply: buttonQuickReply(["Beginner", "Intermediate", "Advanced", "Native"]),
      };

    case 7: {
      // Filter positions by selected language
      const data = loadData();
      const lang = (answers.language || "").replace(/[🇯🇵🇰🇷🇹🇭🇻🇳🇮🇩🇨🇳🇹🇼🇬🇧]\s?/g, "").trim();
      const filtered = data.jobs.filter(
        (j) => j.language.toLowerCase() === lang.toLowerCase()
      );
      const positions = [...new Set(filtered.map((j) => j.title))];

      if (positions.length === 0) {
        return {
          type: "text",
          text: "💼 คำถามที่ 7/16\n\n🎯 ตำแหน่งที่สนใจ / Position interested in:\n\n(พิมพ์ตำแหน่งที่คุณสนใจ / Type the position you're interested in)",
          quickReply: cancelQuickReply,
        };
      }

      // Quick reply max is 13 items
      const positionButtons = positions.slice(0, 12);
      return {
        type: "text",
        text: "💼 คำถามที่ 7/16\n\n🎯 ตำแหน่งที่สนใจ / Position interested in:",
        quickReply: buttonQuickReply(positionButtons),
      };
    }

    case 8:
      return {
        type: "text",
        text: "📋 คำถามที่ 8/16\n\n⏳ ประสบการณ์ทำงาน / Work Experience:",
        quickReply: buttonQuickReply(["None", "< 1 year", "1-3 years", "3-5 years", "5+ years"]),
      };

    case 9:
      return {
        type: "text",
        text: "🏢 คำถามที่ 9/16\n\n📞 เคยมีประสบการณ์ BPO/Contact Center ไหม?\nPrevious BPO/Contact Center experience?",
        quickReply: buttonQuickReply(["✅ Yes / เคย", "❌ No / ไม่เคย"]),
      };

    case 10:
      return {
        type: "text",
        text: "🎓 คำถามที่ 10/16\n\n📚 ระดับการศึกษา / Education Level:",
        quickReply: buttonQuickReply(["High School", "Diploma", "Bachelor's", "Master's", "PhD"]),
      };

    case 11:
      return {
        type: "text",
        text: "👔 คำถามที่ 11/16\n\n💼 สถานะการทำงานปัจจุบัน / Current Employment Status:",
        quickReply: buttonQuickReply(["Employed", "Unemployed", "Student", "Freelance"]),
      };

    case 12:
      return {
        type: "text",
        text: "📅 คำถามที่ 12/16\n\n🗓️ วันที่สามารถเริ่มงานได้ / Available Start Date:",
        quickReply: buttonQuickReply(["Immediately", "2 weeks", "1 month", "Other"]),
      };

    case 13:
      return {
        type: "text",
        text: "💰 คำถามที่ 13/16\n\n💵 เงินเดือนที่คาดหวัง (บาท) / Expected Salary (THB):\n\n(พิมพ์จำนวน เช่น 25000 / Type amount e.g. 25000)",
        quickReply: cancelQuickReply,
      };

    case 14:
      return {
        type: "text",
        text: "📍 คำถามที่ 14/16\n\n🏙️ สามารถทำงานในกรุงเทพฯ ได้ไหม?\nWilling to work in Bangkok?",
        quickReply: buttonQuickReply(["✅ Yes / ได้", "❌ No / ไม่ได้"]),
      };

    case 15:
      return {
        type: "text",
        text: "📢 คำถามที่ 15/16\n\n📣 คุณรู้จักเราจากที่ไหน? / How did you hear about us?",
        quickReply: buttonQuickReply(["LINE Bot", "Friend / เพื่อน", "Social Media", "Job Board", "Other"]),
      };

    case 16:
      return {
        type: "text",
        text: "📝 คำถามที่ 16/16 (สุดท้าย!)\n\n💬 มีอะไรเพิ่มเติมที่อยากบอกเราไหม?\nAnything else you'd like us to know?\n\n(พิมพ์ข้อความ หรือพิมพ์ 'ไม่มี' / Type your message or 'None')",
        quickReply: buttonQuickReply(["None / ไม่มี"]),
      };

    default:
      return null;
  }
}

// Map step number to answer key
const STEP_KEYS = {
  1: "name",
  2: "phone",
  3: "email",
  4: "lineId",
  5: "language",
  6: "proficiency",
  7: "position",
  8: "experience",
  9: "bpoExperience",
  10: "education",
  11: "employmentStatus",
  12: "startDate",
  13: "salary",
  14: "bangkok",
  15: "source",
  16: "notes",
};

const TOTAL_STEPS = 16;

// --- Completion Message ---
function completionFlex(answers) {
  return {
    type: "flex",
    altText: "Application submitted!",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "✅ สมัครสำเร็จ!", weight: "bold", size: "xl", color: "#FFFFFF" },
          { type: "text", text: "Application Submitted!", size: "md", color: "#FFFFFFCC", margin: "xs" },
        ],
        backgroundColor: "#27AE60",
        paddingAll: "20px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "ขอบคุณค่ะ " + (answers.name || "") + "! 🎉", weight: "bold", size: "md", wrap: true },
          { type: "text", text: "Thank you for applying to TP Thailand!", size: "sm", color: "#888888", margin: "sm", wrap: true },
          { type: "separator", margin: "lg" },
          { type: "text", text: "📋 สรุปข้อมูล / Summary:", weight: "bold", size: "sm", margin: "lg" },
          summaryRow("👤", "Name", answers.name),
          summaryRow("📞", "Phone", answers.phone),
          summaryRow("✉️", "Email", answers.email),
          summaryRow("🌐", "Language", answers.language),
          summaryRow("💼", "Position", answers.position),
          { type: "separator", margin: "lg" },
          { type: "text", text: "ทีมสรรหาบุคลากรจะติดต่อคุณเร็วๆ นี้ค่ะ", size: "sm", color: "#666666", margin: "lg", wrap: true },
          { type: "text", text: "Our recruitment team will contact you soon!", size: "sm", color: "#888888", margin: "xs", wrap: true },
        ],
        paddingAll: "20px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "🏠 กลับเมนูหลัก / Main Menu", text: "Hi" } },
        ],
        paddingAll: "10px",
      },
    },
  };
}

function summaryRow(icon, label, value) {
  return {
    type: "box",
    layout: "horizontal",
    margin: "sm",
    contents: [
      { type: "text", text: icon + " " + label + ":", size: "xs", color: "#888888", flex: 4 },
      { type: "text", text: value || "-", size: "xs", color: "#444444", flex: 6, wrap: true },
    ],
  };
}

// ============================================================
// MENU FLEX MESSAGES (unchanged from before)
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
          { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: "⚡ สมัครด่วน / Quick Apply", text: "Quick Apply" } },
          { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "📋 ดูตำแหน่งงาน / Browse Jobs", text: "Browse Jobs" } },
          { type: "button", style: "secondary", action: { type: "message", label: "✅ เคยสมัครแล้ว / Already Applied", text: "Already Applied" } },
          { type: "button", style: "secondary", action: { type: "message", label: "❓ FAQ", text: "Ask a question" } },
          { type: "button", style: "secondary", action: { type: "message", label: "📍 สถานที่ / 🎁 สวัสดิการ", text: "Info" } },
        ],
        paddingAll: "15px",
      },
    },
    quickReply: mainMenuQuickReply,
  };
}

function languageSelectionFlex() {
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
          { type: "text", text: "📋 เลือกภาษา / Choose Language", weight: "bold", size: "lg", color: "#FFFFFF" },
        ],
        backgroundColor: TP_DARK,
        paddingAll: "20px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "เลือกภาษาเพื่อดูตำแหน่งที่เปิดรับ\nSelect a language to view positions.", size: "sm", color: "#666666", wrap: true },
        ],
        paddingAll: "20px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "box", layout: "horizontal", spacing: "sm", contents: [
            { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇯🇵 Japanese", text: "Jobs Japanese" } },
            { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇰🇷 Korean", text: "Jobs Korean" } },
          ]},
          { type: "box", layout: "horizontal", spacing: "sm", contents: [
            { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇹🇭 Thai", text: "Jobs Thai" } },
            { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇻🇳 Vietnamese", text: "Jobs Vietnamese" } },
          ]},
          { type: "box", layout: "horizontal", spacing: "sm", contents: [
            { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇮🇩 Bahasa", text: "Jobs Bahasa Indonesia" } },
            { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇨🇳 Mandarin", text: "Jobs Mandarin" } },
          ]},
          { type: "box", layout: "horizontal", spacing: "sm", contents: [
            { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇹🇼 Taiwanese", text: "Jobs Taiwanese" } },
            { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: "🇬🇧 English", text: "Jobs English" } },
          ]},
        ],
        paddingAll: "15px",
      },
    },
    quickReply: languageQuickReply,
  };
}

function jobsByLanguageFlex(language) {
  const data = loadData();
  const filtered = data.jobs.filter(
    (j) => j.language.toLowerCase() === language.toLowerCase()
  );

  if (filtered.length === 0) {
    return {
      type: "text",
      text: "ขออภัย ไม่พบตำแหน่งงานสำหรับ " + language + "\nSorry, no positions found for " + language + ".",
      quickReply: mainMenuQuickReply,
    };
  }

  const cards = filtered.slice(0, 12).map((job) => ({
    type: "bubble",
    size: "kilo",
    header: {
      type: "box", layout: "vertical", contents: [
        { type: "text", text: job.title, weight: "bold", size: "md", color: "#FFFFFF", wrap: true },
      ], backgroundColor: TP_DARK, paddingAll: "15px",
    },
    body: {
      type: "box", layout: "vertical", contents: [
        { type: "text", text: job.description, size: "sm", color: "#666666", wrap: true },
        { type: "separator", margin: "lg" },
        { type: "box", layout: "vertical", margin: "lg", spacing: "sm", contents: [
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "🌐", size: "sm", flex: 0 },
            { type: "text", text: job.language, size: "sm", color: "#444444", margin: "md" },
          ]},
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "📍", size: "sm", flex: 0 },
            { type: "text", text: job.location, size: "sm", color: "#444444", margin: "md" },
          ]},
        ]},
      ], paddingAll: "15px",
    },
    footer: {
      type: "box", layout: "vertical", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "uri", label: "📝 Apply / สมัคร", uri: job.link } },
      ], paddingAll: "10px",
    },
  }));

  return {
    type: "flex",
    altText: language + " positions at TP Thailand",
    contents: { type: "carousel", contents: cards },
    quickReply: {
      items: [
        { type: "action", action: { type: "message", label: "🔄 Change Language", text: "Browse Jobs" } },
        { type: "action", action: { type: "message", label: "⚡ Quick Apply", text: "Quick Apply" } },
        { type: "action", action: { type: "message", label: "🏠 Main Menu", text: "Hi" } },
      ],
    },
  };
}

function appliedBeforeAssessmentFlex() {
  const data = loadData();
  return {
    type: "flex",
    altText: "Take your language assessment",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box", layout: "vertical", contents: [
          { type: "text", text: "📋 Language Assessment", weight: "bold", size: "lg", color: "#FFFFFF" },
          { type: "text", text: "แบบทดสอบภาษา", size: "md", color: "#FFFFFFCC", margin: "xs" },
        ], backgroundColor: TP_DARK, paddingAll: "20px",
      },
      body: {
        type: "box", layout: "vertical", contents: [
          { type: "text", text: "ยินดีต้อนรับกลับมาค่ะ! 🎉", weight: "bold", size: "md" },
          { type: "text", text: "Welcome back!", size: "sm", color: "#888888", margin: "xs" },
          { type: "separator", margin: "lg" },
          { type: "text", text: "กรุณาทำแบบทดสอบภาษาเพื่อดำเนินการต่อ\nPlease complete the assessment to proceed.", size: "sm", color: "#666666", margin: "lg", wrap: true },
          { type: "separator", margin: "lg" },
          { type: "text", text: "💻 แนะนำให้ทำบน PC / Best on PC", weight: "bold", size: "xs", color: TP_PINK, margin: "lg" },
          { type: "text", text: "กด 'คัดลอกลิงก์' เพื่อเปิดบน PC", size: "xs", color: "#888888", margin: "sm", wrap: true },
        ], paddingAll: "20px",
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm", contents: [
          { type: "button", style: "primary", color: TP_PINK, action: { type: "uri", label: "🚀 เริ่มทำแบบทดสอบ / Start", uri: data.assessment_url } },
          { type: "button", style: "secondary", action: { type: "message", label: "📋 คัดลอกลิงก์ / Copy Link", text: "Send me the assessment link" } },
          { type: "button", style: "secondary", action: { type: "message", label: "🏠 Main Menu", text: "Hi" } },
        ], paddingAll: "15px",
      },
    },
  };
}

function assessmentLinkText() {
  const data = loadData();
  return {
    type: "text",
    text: "📋 ลิงก์แบบทดสอบภาษา / Assessment Link:\n\n💻 แนะนำให้เปิดบน PC / Best on PC:\n\n" + data.assessment_url + "\n\n👆 กดค้างเพื่อคัดลอก / Long press to copy",
    quickReply: mainMenuQuickReply,
  };
}

function faqFlex() {
  return {
    type: "flex", altText: "FAQ", contents: {
      type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "❓ FAQ / คำถามที่พบบ่อย", weight: "bold", size: "lg", color: "#FFFFFF" },
      ], backgroundColor: TP_DARK, paddingAll: "20px" },
      body: { type: "box", layout: "vertical", spacing: "lg", contents: [
        faqItem("TP คืออะไร?", "TP เป็นผู้นำระดับโลกด้าน Digital Business Services มีพนักงานกว่า 500,000 คนใน 100+ ประเทศ"),
        { type: "separator" },
        faqItem("ต้องมีประสบการณ์ไหม?", "ไม่จำเป็น! เรามีการฝึกอบรมให้\nNo experience needed! Full training."),
        { type: "separator" },
        faqItem("ทำงานที่ไหน?", "กรุงเทพฯ / Bangkok, Thailand"),
      ], paddingAll: "20px" },
    }, quickReply: mainMenuQuickReply,
  };
}

function faqItem(q, a) {
  return { type: "box", layout: "vertical", contents: [
    { type: "text", text: q, weight: "bold", size: "sm", color: TP_DARK, wrap: true },
    { type: "text", text: a, size: "sm", color: "#666666", margin: "sm", wrap: true },
  ]};
}

function infoFlex() {
  return {
    type: "flex", altText: "Info", contents: {
      type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "📍 สถานที่ & 🎁 สวัสดิการ", weight: "bold", size: "lg", color: "#FFFFFF" },
      ], backgroundColor: TP_DARK, paddingAll: "20px" },
      body: { type: "box", layout: "vertical", spacing: "md", contents: [
        { type: "text", text: "📍 Location", weight: "bold", size: "sm" },
        { type: "text", text: "🏢 Bangkok (ใกล้ BTS, มีที่จอดรถ)", size: "sm", color: "#666666", wrap: true },
        { type: "separator", margin: "lg" },
        { type: "text", text: "🎁 Benefits", weight: "bold", size: "sm", margin: "lg" },
        { type: "text", text: "💰 Competitive salary\n🏥 Insurance\n🎯 Annual bonus\n📚 Free training\n📈 Career growth\n🌍 International environment", size: "sm", color: "#666666", wrap: true },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: "⚡ Quick Apply", text: "Quick Apply" } },
      ], paddingAll: "10px" },
    }, quickReply: mainMenuQuickReply,
  };
}

// ============================================================
// MAIN ROUTING
// ============================================================

async function handleMessage(userId, text) {
  const msg = text.toLowerCase().trim();

  // --- EXIT commands (always work, even during Quick Apply) ---
  if (msg === "cancel application" || msg.includes("ยกเลิก")) {
    await clearState(userId);
    return [{ type: "text", text: "❌ ยกเลิกการสมัครแล้ว / Application cancelled.\n\nพิมพ์ 'Hi' เพื่อกลับเมนูหลัก", quickReply: mainMenuQuickReply }];
  }

  // --- Check if user is in Quick Apply flow ---
  const state = await getState(userId);

  if (state.step > 0) {
    // User is in Quick Apply — process their answer
    const key = STEP_KEYS[state.step];
    state.answers[key] = text;

    if (state.step >= TOTAL_STEPS) {
      // All questions answered — save and complete
      await saveCandidate(state.answers);
      await clearState(userId);
      return [completionFlex(state.answers)];
    }

    // Move to next question
    const nextStep = state.step + 1;
    await saveState(userId, nextStep, state.answers);
    return [questionMessage(nextStep, state.answers)];
  }

  // --- MENU NAVIGATION (user NOT in Quick Apply) ---

  // Greetings / Main menu
  if (msg.includes("สวัสดี") || msg.includes("hello") || msg.includes("hi") || msg === "start" || msg.includes("menu")) {
    return [welcomeFlex()];
  }

  // Quick Apply → Start 16-question flow
  if (msg.includes("quick apply") || msg.includes("สมัครด่วน")) {
    await saveState(userId, 1, {});
    return [
      { type: "text", text: "⚡ เริ่มสมัครด่วน! / Starting Quick Apply!\n\n📝 16 คำถาม — ใช้เวลาประมาณ 3 นาที\n16 questions — takes about 3 minutes\n\nพิมพ์ 'cancel' เพื่อยกเลิกได้ตลอด" },
      questionMessage(1, {}),
    ];
  }

  // Browse Jobs → Language selection
  if (msg.includes("browse") || msg.includes("ตำแหน่ง") || msg.includes("position") || msg.includes("view open") || msg.includes("job")) {
    return [languageSelectionFlex()];
  }

  // Jobs by language
  if (msg.startsWith("jobs ")) {
    const lang = text.replace(/^jobs\s+/i, "").trim();
    return [jobsByLanguageFlex(lang)];
  }

  // Already Applied → Assessment
  if (msg.includes("already applied") || msg.includes("เคยสมัคร")) {
    return [appliedBeforeAssessmentFlex()];
  }

  // Copyable assessment link
  if (msg.includes("send me the assessment") || msg.includes("copy link") || msg.includes("assessment link")) {
    return [assessmentLinkText()];
  }

  // FAQ
  if (msg.includes("faq") || msg.includes("question") || msg.includes("ถาม")) {
    return [faqFlex()];
  }

  // Info (locations + benefits)
  if (msg.includes("info") || msg.includes("location") || msg.includes("benefit") || msg.includes("สวัสดิการ") || msg.includes("สถานที่")) {
    return [infoFlex()];
  }

  // Default
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
        const userId = event.source.userId;
        const replies = await handleMessage(userId, event.message.text);
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: replies.slice(0, 5), // LINE max 5 messages per reply
        });
      }
    } catch (err) {
      console.error("Error:", err);
    }
  }

  res.status(200).json({ status: "ok" });
};
