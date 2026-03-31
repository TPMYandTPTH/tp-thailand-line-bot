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

function loadData() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "jobs.json"), "utf-8"));
}

const TP_DARK = "#4B4C6A";
const TP_PINK = "#FF0082";

function verifySignature(body, signature) {
  return crypto.createHmac("SHA256", config.channelSecret)
    .update(Buffer.from(JSON.stringify(body))).digest("base64") === signature;
}

// ============================================================
// GOOGLE APPS SCRIPT API (fixed fetch with redirect handling)
// ============================================================

async function callScript(data) {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      redirect: "follow",
    });
    const text = await res.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("Script call error:", err.message);
    return { error: err.message, step: 0, answers: {} };
  }
}

async function getState(userId) {
  return await callScript({ action: "getState", userId });
}

async function processAnswer(userId, key, value, nextStep) {
  return await callScript({ action: "processAnswer", userId, key, value, nextStep });
}

async function startApply(userId) {
  return await callScript({ action: "startApply", userId });
}

async function saveCandidate(answers) {
  return await callScript({ action: "saveCandidate", answers });
}

async function clearState(userId) {
  return await callScript({ action: "clearState", userId });
}

// ============================================================
// QUICK REPLY HELPERS
// ============================================================

function qr(options, showCancel = true) {
  const items = options.map((o) => ({
    type: "action",
    action: { type: "message", label: o.length > 20 ? o.slice(0, 20) : o, text: o },
  }));
  if (showCancel) items.push({ type: "action", action: { type: "message", label: "❌ ยกเลิก/Cancel", text: "cancel" } });
  return { items };
}

const mainQR = {
  items: [
    { type: "action", action: { type: "message", label: "⚡ Quick Apply", text: "Quick Apply" } },
    { type: "action", action: { type: "message", label: "📋 Browse Jobs", text: "Browse Jobs" } },
    { type: "action", action: { type: "message", label: "✅ Already Applied", text: "Already Applied" } },
    { type: "action", action: { type: "message", label: "❓ FAQ", text: "Ask a question" } },
    { type: "action", action: { type: "message", label: "🎁 Benefits", text: "Benefits" } },
  ],
};

const langQR = {
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
// 16-QUESTION DEFINITIONS
// ============================================================

const STEP_KEYS = {
  1: "name", 2: "phone", 3: "email", 4: "lineId", 5: "language",
  6: "proficiency", 7: "position", 8: "experience", 9: "bpoExperience",
  10: "education", 11: "employmentStatus", 12: "startDate",
  13: "salary", 14: "bangkok", 15: "source", 16: "notes",
};
const TOTAL = 16;

function questionMsg(step, answers) {
  const p = (n) => `(${n}/${TOTAL})`;

  switch (step) {
    case 1: return {
      type: "text",
      text: `⚡ Quick Apply ${p(1)}\n\n👤 ชื่อ-นามสกุล / Full Name:`,
      quickReply: qr([]),
    };
    case 2: return {
      type: "text",
      text: `📱 ${p(2)}\n\n📞 เบอร์โทร / Phone Number:`,
      quickReply: qr([]),
    };
    case 3: return {
      type: "text",
      text: `📧 ${p(3)}\n\n✉️ อีเมล / Email:`,
      quickReply: qr([]),
    };
    case 4: return {
      type: "text",
      text: `💬 ${p(4)}\n\n🔗 LINE ID:`,
      quickReply: qr([]),
    };
    case 5: return {
      type: "text",
      text: `🌐 ${p(5)}\n\n🗣️ ภาษา / Language:`,
      quickReply: qr(["Japanese", "Korean", "Thai", "Vietnamese", "Bahasa Indonesia", "Mandarin", "Taiwanese", "English"]),
    };
    case 6: return {
      type: "text",
      text: `📊 ${p(6)}\n\n📈 ระดับภาษา / Proficiency:`,
      quickReply: qr(["Beginner", "Intermediate", "Advanced", "Native"]),
    };
    case 7: {
      const data = loadData();
      const lang = (answers.language || "").trim();
      const jobs = data.jobs.filter((j) => j.language.toLowerCase() === lang.toLowerCase());
      const titles = [...new Set(jobs.map((j) => j.title))].slice(0, 12);
      return {
        type: "text",
        text: `💼 ${p(7)}\n\n🎯 ตำแหน่ง / Position:`,
        quickReply: titles.length > 0 ? qr(titles) : qr(["Customer Service", "Content Moderator", "Sales Specialist", "Other"]),
      };
    }
    case 8: return {
      type: "text",
      text: `📋 ${p(8)}\n\n⏳ ประสบการณ์ / Experience:`,
      quickReply: qr(["None", "< 1 year", "1-3 years", "3-5 years", "5+ years"]),
    };
    case 9: return {
      type: "text",
      text: `🏢 ${p(9)}\n\n📞 ประสบการณ์ BPO/Contact Center?\nBPO/Contact Center experience?`,
      quickReply: qr(["Yes / เคย", "No / ไม่เคย"]),
    };
    case 10: return {
      type: "text",
      text: `🎓 ${p(10)}\n\n📚 การศึกษา / Education:`,
      quickReply: qr(["High School", "Diploma", "Bachelor's", "Master's", "PhD"]),
    };
    case 11: return {
      type: "text",
      text: `👔 ${p(11)}\n\n💼 สถานะ / Employment Status:`,
      quickReply: qr(["Employed", "Unemployed", "Student", "Freelance"]),
    };
    case 12: return {
      type: "text",
      text: `📅 ${p(12)}\n\n🗓️ เริ่มงานได้ / Start Date:`,
      quickReply: qr(["Immediately", "2 weeks", "1 month", "Other"]),
    };
    case 13: return {
      type: "text",
      text: `💰 ${p(13)}\n\n💵 เงินเดือนที่คาดหวัง (บาท)\nExpected Salary (THB):`,
      quickReply: qr(["15,000-20,000", "20,000-30,000", "30,000-40,000", "40,000-50,000", "50,000+"]),
    };
    case 14: return {
      type: "text",
      text: `📍 ${p(14)}\n\n🏙️ ทำงานในกรุงเทพฯ ได้ไหม?\nWilling to work in Bangkok?`,
      quickReply: qr(["Yes / ได้", "No / ไม่ได้"]),
    };
    case 15: return {
      type: "text",
      text: `📢 ${p(15)}\n\n📣 รู้จักเราจากไหน?\nHow did you hear about us?`,
      quickReply: qr(["LINE Bot", "Friend", "Social Media", "Job Board", "Walk-in", "Other"]),
    };
    case 16: return {
      type: "text",
      text: `📝 ${p(16)} สุดท้าย!\n\n💬 มีอะไรเพิ่มเติมไหม?\nAnything else?`,
      quickReply: qr(["None / ไม่มี"]),
    };
    default: return null;
  }
}

function summaryRow(icon, label, val) {
  return { type: "box", layout: "horizontal", margin: "sm", contents: [
    { type: "text", text: icon + " " + label + ":", size: "xs", color: "#888888", flex: 4 },
    { type: "text", text: val || "-", size: "xs", color: "#444444", flex: 6, wrap: true },
  ]};
}

function completionFlex(answers) {
  return {
    type: "flex", altText: "Application submitted!",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "✅ สมัครสำเร็จ!", weight: "bold", size: "xl", color: "#FFFFFF" },
        { type: "text", text: "Application Submitted!", size: "md", color: "#FFFFFFCC", margin: "xs" },
      ], backgroundColor: "#27AE60", paddingAll: "20px" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "ขอบคุณค่ะ " + (answers.name || "") + "! 🎉", weight: "bold", size: "md", wrap: true },
        { type: "text", text: "Thank you for applying!", size: "sm", color: "#888888", margin: "sm" },
        { type: "separator", margin: "lg" },
        summaryRow("👤", "Name", answers.name),
        summaryRow("📞", "Phone", answers.phone),
        summaryRow("✉️", "Email", answers.email),
        summaryRow("🌐", "Lang", answers.language),
        summaryRow("💼", "Position", answers.position),
        { type: "separator", margin: "lg" },
        { type: "text", text: "ทีมสรรหาจะติดต่อคุณเร็วๆ นี้ค่ะ\nOur team will contact you soon!", size: "sm", color: "#666666", margin: "lg", wrap: true },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", contents: [
        { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "🏠 Main Menu", text: "Hi" } },
      ], paddingAll: "10px" },
    },
  };
}

// ============================================================
// MENU FLEX MESSAGES
// ============================================================

function welcomeFlex() {
  return {
    type: "flex", altText: "Welcome to TP Thailand",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "🇹🇭 TP Thailand", weight: "bold", size: "xl", color: TP_DARK },
        { type: "text", text: "Recruitment Bot", size: "md", color: "#888888", margin: "xs" },
      ], paddingAll: "20px", backgroundColor: "#F8F8FF" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "สวัสดีค่ะ! Welcome!", weight: "bold", size: "lg", margin: "md" },
        { type: "text", text: "ยินดีต้อนรับสู่ TP Thailand\nHow can I help you?", size: "sm", color: "#666666", margin: "md", wrap: true },
        { type: "separator", margin: "xl" },
        { type: "text", text: "เลือกเมนูด้านล่าง / Choose below:", size: "sm", color: "#888888", margin: "lg" },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: "⚡ สมัครด่วน / Quick Apply", text: "Quick Apply" } },
        { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "📋 ดูตำแหน่งงาน / Browse Jobs", text: "Browse Jobs" } },
        { type: "button", style: "secondary", action: { type: "message", label: "✅ เคยสมัครแล้ว / Already Applied", text: "Already Applied" } },
        { type: "button", style: "secondary", action: { type: "message", label: "❓ FAQ / 📍 Info / 🎁 Benefits", text: "Info" } },
      ], paddingAll: "15px" },
    }, quickReply: mainQR,
  };
}

function langSelectFlex() {
  return {
    type: "flex", altText: "Choose language",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "📋 เลือกภาษา / Choose Language", weight: "bold", size: "lg", color: "#FFFFFF" },
      ], backgroundColor: TP_DARK, paddingAll: "20px" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "เลือกภาษาเพื่อดูตำแหน่ง\nSelect a language to view positions.", size: "sm", color: "#666666", wrap: true },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
        row("🇯🇵 Japanese", "🇰🇷 Korean"),
        row("🇹🇭 Thai", "🇻🇳 Vietnamese"),
        row("🇮🇩 Bahasa", "🇨🇳 Mandarin"),
        row("🇹🇼 Taiwanese", "🇬🇧 English"),
      ], paddingAll: "15px" },
    }, quickReply: langQR,
  };
}

function row(a, b) {
  return { type: "box", layout: "horizontal", spacing: "sm", contents: [
    { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: a, text: "Jobs " + a.replace(/[🇯🇵🇰🇷🇹🇭🇻🇳🇮🇩🇨🇳🇹🇼🇬🇧]\s?/g, "") } },
    { type: "button", style: "primary", color: TP_DARK, flex: 1, action: { type: "message", label: b, text: "Jobs " + b.replace(/[🇯🇵🇰🇷🇹🇭🇻🇳🇮🇩🇨🇳🇹🇼🇬🇧]\s?/g, "") } },
  ]};
}

function jobsByLangFlex(language) {
  const data = loadData();
  const filtered = data.jobs.filter((j) => j.language.toLowerCase() === language.toLowerCase());
  if (!filtered.length) return { type: "text", text: "Sorry, no positions for " + language + ".", quickReply: mainQR };

  const cards = filtered.slice(0, 12).map((j) => ({
    type: "bubble", size: "kilo",
    header: { type: "box", layout: "vertical", contents: [
      { type: "text", text: j.title, weight: "bold", size: "md", color: "#FFFFFF", wrap: true },
    ], backgroundColor: TP_DARK, paddingAll: "15px" },
    body: { type: "box", layout: "vertical", contents: [
      { type: "text", text: j.description, size: "sm", color: "#666666", wrap: true },
      { type: "separator", margin: "lg" },
      { type: "box", layout: "vertical", margin: "lg", spacing: "sm", contents: [
        { type: "box", layout: "horizontal", contents: [
          { type: "text", text: "🌐 " + j.language, size: "sm", color: "#444", flex: 0 },
        ]},
        { type: "box", layout: "horizontal", contents: [
          { type: "text", text: "📍 " + j.location, size: "sm", color: "#444", flex: 0 },
        ]},
      ]},
    ], paddingAll: "15px" },
    footer: { type: "box", layout: "vertical", contents: [
      { type: "button", style: "primary", color: TP_PINK, action: { type: "uri", label: "📝 Apply / สมัคร", uri: j.link } },
    ], paddingAll: "10px" },
  }));

  return { type: "flex", altText: language + " positions", contents: { type: "carousel", contents: cards },
    quickReply: { items: [
      { type: "action", action: { type: "message", label: "🔄 Change Language", text: "Browse Jobs" } },
      { type: "action", action: { type: "message", label: "⚡ Quick Apply", text: "Quick Apply" } },
      { type: "action", action: { type: "message", label: "🏠 Main Menu", text: "Hi" } },
    ]},
  };
}

function assessmentFlex() {
  const data = loadData();
  return {
    type: "flex", altText: "Language Assessment",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "📋 Language Assessment", weight: "bold", size: "lg", color: "#FFFFFF" },
      ], backgroundColor: TP_DARK, paddingAll: "20px" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "ยินดีต้อนรับกลับ! 🎉 Welcome back!", weight: "bold", size: "md", wrap: true },
        { type: "separator", margin: "lg" },
        { type: "text", text: "กรุณาทำแบบทดสอบภาษา\nPlease complete the assessment.", size: "sm", color: "#666", margin: "lg", wrap: true },
        { type: "text", text: "💻 แนะนำทำบน PC / Best on PC", weight: "bold", size: "xs", color: TP_PINK, margin: "lg" },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "uri", label: "🚀 Start Assessment", uri: data.assessment_url } },
        { type: "button", style: "secondary", action: { type: "message", label: "📋 Copy Link", text: "copy assessment link" } },
        { type: "button", style: "secondary", action: { type: "message", label: "🏠 Main Menu", text: "Hi" } },
      ], paddingAll: "15px" },
    },
  };
}

function assessmentText() {
  const data = loadData();
  return { type: "text", text: "📋 Assessment Link:\n\n💻 Best on PC:\n\n" + data.assessment_url + "\n\n👆 Long press to copy", quickReply: mainQR };
}

function infoFlex() {
  return {
    type: "flex", altText: "Info",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "ℹ️ Info", weight: "bold", size: "lg", color: "#FFFFFF" },
      ], backgroundColor: TP_DARK, paddingAll: "20px" },
      body: { type: "box", layout: "vertical", spacing: "md", contents: [
        { type: "text", text: "❓ FAQ", weight: "bold", size: "sm" },
        { type: "text", text: "• TP = Global Digital Business Services, 500K+ employees, 100+ countries\n• No experience needed — full training provided\n• Office in Bangkok, near BTS", size: "sm", color: "#666", wrap: true },
        { type: "separator", margin: "lg" },
        { type: "text", text: "🎁 Benefits", weight: "bold", size: "sm", margin: "lg" },
        { type: "text", text: "💰 Competitive salary\n🏥 Insurance\n🎯 Annual bonus\n📚 Free training\n📈 Career growth\n🌍 International environment", size: "sm", color: "#666", wrap: true },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: "⚡ Quick Apply", text: "Quick Apply" } },
      ], paddingAll: "10px" },
    }, quickReply: mainQR,
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

async function handleMessage(userId, text) {
  const msg = text.toLowerCase().trim();

  // --- Cancel (always works) ---
  if (msg === "cancel" || msg.includes("cancel") || msg.includes("ยกเลิก")) {
    await clearState(userId);
    return [{ type: "text", text: "❌ ยกเลิกแล้ว / Cancelled.\n\nพิมพ์ 'Hi' เพื่อกลับเมนู", quickReply: mainQR }];
  }

  // --- Check if in Quick Apply flow ---
  const state = await getState(userId);

  if (state.step > 0 && state.step <= TOTAL) {
    const key = STEP_KEYS[state.step];
    const nextStep = state.step + 1;

    if (state.step >= TOTAL) {
      // Last question answered — save answer + candidate
      state.answers[key] = text;
      await saveCandidate(state.answers);
      await clearState(userId);
      return [completionFlex(state.answers)];
    }

    // Save answer and advance (ONE call)
    const result = await processAnswer(userId, key, text, nextStep);
    const nextQ = questionMsg(nextStep, result.answers || state.answers);
    return nextQ ? [nextQ] : [welcomeFlex()];
  }

  // --- Menu Navigation ---
  if (msg.includes("hi") || msg.includes("hello") || msg.includes("สวัสดี") || msg === "start" || msg === "menu") {
    return [welcomeFlex()];
  }

  if (msg.includes("quick apply") || msg.includes("สมัครด่วน")) {
    await startApply(userId);
    return [
      { type: "text", text: "⚡ เริ่มสมัครด่วน! / Quick Apply!\n\n📝 16 คำถาม ~3 นาที / 16 questions ~3 min\n\nพิมพ์ 'cancel' เพื่อยกเลิก / Type 'cancel' to stop" },
      questionMsg(1, {}),
    ];
  }

  if (msg.includes("browse") || msg.includes("ตำแหน่ง") || msg.includes("position") || msg.includes("view")) {
    return [langSelectFlex()];
  }

  if (msg.startsWith("jobs ")) {
    const lang = text.replace(/^jobs\s+/i, "").trim();
    return [jobsByLangFlex(lang)];
  }

  if (msg.includes("already applied") || msg.includes("เคยสมัคร")) {
    return [assessmentFlex()];
  }

  if (msg.includes("copy assessment") || msg.includes("assessment link")) {
    return [assessmentText()];
  }

  if (msg.includes("faq") || msg.includes("question") || msg.includes("info") || msg.includes("benefit") || msg.includes("สวัสดิการ") || msg.includes("location") || msg.includes("สถานที่")) {
    return [infoFlex()];
  }

  return [welcomeFlex()];
}

// ============================================================
// WEBHOOK
// ============================================================

module.exports = async (req, res) => {
  if (req.method === "GET") return res.status(200).send("TP Thailand LINE Bot 🇹🇭");

  const sig = req.headers["x-line-signature"];
  if (!sig || !verifySignature(req.body, sig)) return res.status(401).json({ error: "Invalid" });

  const events = req.body.events || [];
  if (!events.length) return res.status(200).json({ ok: true });

  for (const event of events) {
    try {
      if (event.type === "follow") {
        await client.replyMessage({ replyToken: event.replyToken, messages: [welcomeFlex()] });
      } else if (event.type === "message" && event.message.type === "text") {
        const replies = await handleMessage(event.source.userId, event.message.text);
        await client.replyMessage({ replyToken: event.replyToken, messages: replies.slice(0, 5) });
      }
    } catch (err) {
      console.error("Event error:", err.message);
    }
  }

  res.status(200).json({ ok: true });
};
