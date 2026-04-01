const { messagingApi } = require("@line/bot-sdk");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};
const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
const client = new messagingApi.MessagingApiClient({ channelAccessToken: config.channelAccessToken });

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
// IN-MEMORY STATE
// ============================================================
const userStates = new Map();

function getState(userId) {
  const s = userStates.get(userId);
  if (s && Date.now() - s.lastActive < 30 * 60 * 1000) return s;
  userStates.delete(userId);
  return null;
}
function setState(userId, data) {
  userStates.set(userId, { ...data, lastActive: Date.now() });
}
function clearUserState(userId) { userStates.delete(userId); }

async function saveCandidate(answers) {
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "saveCandidate", answers }),
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      redirect: "follow",
    });
  } catch (err) { console.error("Save error:", err.message); }
}

// ============================================================
// HELPERS
// ============================================================
function qr(options, showCancel = true) {
  const items = options.map((o) => ({
    type: "action",
    action: { type: "message", label: o.length > 20 ? o.slice(0, 20) : o, text: o },
  }));
  if (showCancel) items.push({ type: "action", action: { type: "message", label: "❌ ยกเลิก/Cancel", text: "cancel" } });
  return { items };
}

const mainQR = { items: [
  { type: "action", action: { type: "message", label: "⚡ สมัครด่วน", text: "สมัครด่วน" } },
  { type: "action", action: { type: "message", label: "✅ เคยสมัครแล้ว", text: "เคยสมัครแล้ว" } },
  { type: "action", action: { type: "message", label: "💬 คุยกับรีครูทเตอร์", text: "คุยกับรีครูทเตอร์" } },
  { type: "action", action: { type: "message", label: "ℹ️ ข้อมูลเพิ่มเติม", text: "ข้อมูลเพิ่มเติม" } },
]};

// ============================================================
// QUESTIONS — Thai & English versions
// ============================================================
const STEP_KEYS = {
  1: "name", 2: "phone", 3: "email", 4: "lineId", 5: "language",
  6: "proficiency", 7: "experience", 8: "education", 9: "employmentStatus",
  10: "startDate", 11: "salary", 12: "bangkok", 13: "notes",
};
const TOTAL = 13;

const Q = {
  th: {
    1: { text: "👤 กรุณาพิมพ์ชื่อ-นามสกุลของคุณ", opts: [] },
    2: { text: "📞 เบอร์โทรศัพท์ของคุณ", opts: [] },
    3: { text: "✉️ อีเมลของคุณ", opts: [] },
    4: { text: "🔗 LINE ID ของคุณ", opts: [] },
    5: { text: "🗣️ คุณพูดภาษาอะไร?", opts: ["Japanese", "Korean", "Thai", "Vietnamese", "Bahasa Indonesia", "Mandarin", "Taiwanese", "English"] },
    6: { text: "📈 ระดับความสามารถทางภาษา", opts: ["เริ่มต้น", "ปานกลาง", "ขั้นสูง", "เจ้าของภาษา"] },
    7: { text: "⏳ ประสบการณ์ทำงาน", opts: ["ไม่มี", "น้อยกว่า 1 ปี", "1-3 ปี", "3-5 ปี", "มากกว่า 5 ปี"] },
    8: { text: "📚 ระดับการศึกษา", opts: ["มัธยมปลาย", "อนุปริญญา", "ปริญญาตรี", "ปริญญาโท", "ปริญญาเอก"] },
    9: { text: "💼 สถานะการทำงานปัจจุบัน", opts: ["ทำงานอยู่", "ว่างงาน", "นักศึกษา", "ฟรีแลนซ์"] },
    10: { text: "🗓️ เริ่มงานได้เมื่อไหร่?", opts: ["ทันที", "2 สัปดาห์", "1 เดือน", "อื่นๆ"] },
    11: { text: "💵 เงินเดือนที่คาดหวัง (บาท)\n\nพิมพ์จำนวนที่ต้องการ เช่น 25000", opts: [] },
    12: { text: "🏙️ สามารถทำงานในกรุงเทพฯ ได้ไหม?", opts: ["ได้", "ไม่ได้"] },
    13: { text: "💬 มีอะไรเพิ่มเติมที่อยากบอกเราไหม?", opts: ["ไม่มี"] },
  },
  en: {
    1: { text: "👤 Please type your full name", opts: [] },
    2: { text: "📞 Your phone number", opts: [] },
    3: { text: "✉️ Your email address", opts: [] },
    4: { text: "🔗 Your LINE ID", opts: [] },
    5: { text: "🗣️ What language do you speak?", opts: ["Japanese", "Korean", "Thai", "Vietnamese", "Bahasa Indonesia", "Mandarin", "Taiwanese", "English"] },
    6: { text: "📈 Language proficiency level", opts: ["Beginner", "Intermediate", "Advanced", "Native"] },
    7: { text: "⏳ Work experience", opts: ["None", "< 1 year", "1-3 years", "3-5 years", "5+ years"] },
    8: { text: "📚 Education level", opts: ["High School", "Diploma", "Bachelor's", "Master's", "PhD"] },
    9: { text: "💼 Current employment status", opts: ["Employed", "Unemployed", "Student", "Freelance"] },
    10: { text: "🗓️ When can you start?", opts: ["Immediately", "2 weeks", "1 month", "Other"] },
    11: { text: "💵 Expected salary (THB)\n\nType your expected amount e.g. 25000", opts: [] },
    12: { text: "🏙️ Willing to work in Bangkok?", opts: ["Yes", "No"] },
    13: { text: "💬 Anything else you'd like us to know?", opts: ["None"] },
  },
};

function questionMsg(step, lang) {
  const q = Q[lang][step];
  if (!q) return null;
  return {
    type: "text",
    text: `(${step}/${TOTAL}) ${q.text}`,
    quickReply: qr(q.opts),
  };
}

// ============================================================
// VALIDATION
// ============================================================
function validate(step, value, lang) {
  const v = value.trim();
  if (step === 2) { // Phone
    const digits = v.replace(/[\s\-\+\(\)]/g, "");
    if (digits.length < 8 || !/^\d+$/.test(digits)) {
      return lang === "th"
        ? "📞 \"" + v + "\" ไม่เหมือนเบอร์โทรศัพท์\nคุณแน่ใจไหม?"
        : "📞 \"" + v + "\" doesn't look like a phone number.\nAre you sure?";
    }
  }
  if (step === 3) { // Email
    if (!v.includes("@") || !v.includes(".")) {
      return lang === "th"
        ? "✉️ \"" + v + "\" ไม่เหมือนอีเมล\nคุณแน่ใจไหม?"
        : "✉️ \"" + v + "\" doesn't look like an email.\nAre you sure?";
    }
  }
  if (step === 1) { // Name
    if (v.length < 2) {
      return lang === "th"
        ? "👤 ชื่อสั้นเกินไป กรุณาพิมพ์ชื่อ-นามสกุลเต็ม"
        : "👤 Name too short. Please type your full name.";
    }
  }
  return null; // valid
}

// ============================================================
// FLEX MESSAGES
// ============================================================

function welcomeFlex() {
  return {
    type: "flex", altText: "ยินดีต้อนรับสู่ TP Thailand!",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "🇹🇭 TP Thailand", weight: "bold", size: "xl", color: TP_DARK },
        { type: "text", text: "บอทสมัครงาน / Recruitment Bot", size: "md", color: "#888888", margin: "xs" },
      ], paddingAll: "20px", backgroundColor: "#F8F8FF" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "สวัสดีค่ะ! ยินดีต้อนรับ!", weight: "bold", size: "lg", margin: "md" },
        { type: "text", text: "Welcome to TP Thailand!", size: "sm", color: "#666666", margin: "md", wrap: true },
        { type: "separator", margin: "xl" },
        { type: "text", text: "เลือกเมนูด้านล่าง / Choose below:", size: "sm", color: "#888888", margin: "lg" },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: "⚡ สมัครด่วน / Quick Apply", text: "สมัครด่วน" } },
        { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "✅ เคยสมัครแล้ว / Already Applied", text: "เคยสมัครแล้ว" } },
        { type: "button", style: "secondary", action: { type: "message", label: "💬 คุยกับรีครูทเตอร์ / Recruiter", text: "คุยกับรีครูทเตอร์" } },
        { type: "button", style: "secondary", action: { type: "message", label: "ℹ️ ข้อมูลเพิ่มเติม / More Info", text: "ข้อมูลเพิ่มเติม" } },
      ], paddingAll: "15px" },
    }, quickReply: mainQR,
  };
}

function langSelectFlex() {
  return {
    type: "flex", altText: "เลือกภาษา / Choose Language",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "⚡ สมัครด่วน / Quick Apply", weight: "bold", size: "lg", color: "#FFFFFF" },
      ], backgroundColor: TP_PINK, paddingAll: "20px" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "กรุณาเลือกภาษาสำหรับแบบฟอร์ม", weight: "bold", size: "md", wrap: true },
        { type: "text", text: "Please choose your preferred language", size: "sm", color: "#888888", margin: "sm", wrap: true },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "horizontal", spacing: "md", contents: [
        { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "🇹🇭 ภาษาไทย", text: "ภาษาไทย" } },
        { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "🇬🇧 English", text: "English form" } },
      ], paddingAll: "15px" },
    },
  };
}

function assessmentFlex() {
  const data = loadData();
  return {
    type: "flex", altText: "แบบทดสอบภาษา",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "📋 แบบทดสอบภาษา", weight: "bold", size: "lg", color: "#FFFFFF" },
        { type: "text", text: "Language Assessment", size: "md", color: "#FFFFFFCC", margin: "xs" },
      ], backgroundColor: TP_DARK, paddingAll: "20px" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "ยินดีต้อนรับกลับมาค่ะ! 🎉\nWelcome back!", weight: "bold", size: "md", wrap: true },
        { type: "separator", margin: "lg" },
        { type: "text", text: "กรุณาทำแบบทดสอบภาษาเพื่อดำเนินการต่อ\nPlease complete the assessment.", size: "sm", color: "#666", margin: "lg", wrap: true },
        { type: "text", text: "💻 แนะนำให้ทำบน PC / Best on PC", weight: "bold", size: "xs", color: TP_PINK, margin: "lg" },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "uri", label: "🚀 เริ่มทำแบบทดสอบ / Start", uri: data.assessment_url } },
        { type: "button", style: "secondary", action: { type: "message", label: "📋 คัดลอกลิงก์ / Copy Link", text: "คัดลอกลิงก์" } },
        { type: "button", style: "secondary", action: { type: "message", label: "🏠 เมนู / Menu", text: "สวัสดี" } },
      ], paddingAll: "15px" },
    },
  };
}

function assessmentLinkText() {
  const data = loadData();
  return { type: "text", text: "📋 ลิงก์แบบทดสอบภาษา:\n\n💻 แนะนำเปิดบน PC:\n\n" + data.assessment_url + "\n\n👆 กดค้างเพื่อคัดลอก / Long press to copy", quickReply: mainQR };
}

function recruiterFlex() {
  return {
    type: "flex", altText: "คุยกับรีครูทเตอร์",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "💬 คุยกับรีครูทเตอร์", weight: "bold", size: "lg", color: "#FFFFFF" },
        { type: "text", text: "Talk to a Recruiter", size: "md", color: "#FFFFFFCC", margin: "xs" },
      ], backgroundColor: "#2980B9", paddingAll: "20px" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "พิมพ์ข้อความได้เลยค่ะ รีครูทเตอร์จะตอบกลับโดยเร็วที่สุด 😊", size: "sm", color: "#666", margin: "md", wrap: true },
        { type: "text", text: "Type your message. A recruiter will reply soon.", size: "sm", color: "#888", margin: "sm", wrap: true },
        { type: "text", text: "คุณสามารถส่งเรซูเม่หรือเอกสารได้ที่นี่เลยค่ะ\nYou can also send your resume here.", size: "sm", color: "#888", margin: "md", wrap: true },
        { type: "separator", margin: "lg" },
        { type: "text", text: "⏰ จันทร์-ศุกร์ 09:00-18:00 (ICT)", size: "xs", color: "#AAA", margin: "lg" },
        { type: "text", text: "พิมพ์ 'เมนู' เพื่อกลับ / Type 'menu' to go back", size: "xs", color: "#AAA", margin: "sm" },
      ], paddingAll: "20px" },
    },
    quickReply: { items: [{ type: "action", action: { type: "message", label: "🏠 เมนู / Menu", text: "สวัสดี" } }] },
  };
}

function infoFlex() {
  return {
    type: "flex", altText: "ข้อมูลเพิ่มเติม",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "ℹ️ ข้อมูลเพิ่มเติม / More Info", weight: "bold", size: "lg", color: "#FFFFFF" },
      ], backgroundColor: TP_DARK, paddingAll: "20px" },
      body: { type: "box", layout: "vertical", spacing: "md", contents: [
        { type: "text", text: "❓ เกี่ยวกับ TP", weight: "bold", size: "sm" },
        { type: "text", text: "TP เป็นผู้นำระดับโลกด้าน Digital Business Services พนักงาน 500,000+ คน ใน 100+ ประเทศ", size: "sm", color: "#666", wrap: true },
        { type: "separator" },
        { type: "text", text: "🎓 ไม่ต้องมีประสบการณ์ มีฝึกอบรมให้", weight: "bold", size: "sm" },
        { type: "separator" },
        { type: "text", text: "📍 กรุงเทพฯ (ใกล้ BTS, มีที่จอดรถ)", weight: "bold", size: "sm" },
        { type: "separator" },
        { type: "text", text: "🎁 สวัสดิการ", weight: "bold", size: "sm" },
        { type: "text", text: "💰 เงินเดือนแข่งขันได้  🏥 ประกันกลุ่ม\n🎯 โบนัสประจำปี  📚 ฝึกอบรมฟรี\n📈 โอกาสเติบโต  🌍 สภาพแวดล้อมสากล", size: "sm", color: "#666", wrap: true },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: "⚡ สมัครด่วน / Quick Apply", text: "สมัครด่วน" } },
      ], paddingAll: "10px" },
    }, quickReply: mainQR,
  };
}

function summaryRow(icon, label, val) {
  return { type: "box", layout: "horizontal", margin: "sm", contents: [
    { type: "text", text: icon + " " + label, size: "xs", color: "#888", flex: 4 },
    { type: "text", text: val || "-", size: "xs", color: "#444", flex: 6, wrap: true },
  ]};
}

function completionFlex(answers) {
  return {
    type: "flex", altText: "สมัครสำเร็จ!",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "✅ สมัครสำเร็จ!", weight: "bold", size: "xl", color: "#FFF" },
        { type: "text", text: "Application Submitted!", size: "md", color: "#FFFFFFCC", margin: "xs" },
      ], backgroundColor: "#27AE60", paddingAll: "20px" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "ขอบคุณค่ะ " + (answers.name || "") + "! 🎉", weight: "bold", size: "md", wrap: true },
        { type: "separator", margin: "lg" },
        summaryRow("👤", "ชื่อ:", answers.name),
        summaryRow("📞", "โทร:", answers.phone),
        summaryRow("✉️", "อีเมล:", answers.email),
        summaryRow("🌐", "ภาษา:", answers.language),
        summaryRow("💰", "เงินเดือน:", answers.salary),
        { type: "separator", margin: "lg" },
        { type: "text", text: "ทีมสรรหาจะติดต่อคุณเร็วๆ นี้ค่ะ\nOur team will contact you soon!", size: "sm", color: "#666", margin: "lg", wrap: true },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", contents: [
        { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "🏠 เมนู / Menu", text: "สวัสดี" } },
      ], paddingAll: "10px" },
    },
  };
}

// ============================================================
// MENU COMMAND CHECK
// ============================================================
function isMenuCommand(msg) {
  return (
    msg.includes("สวัสดี") || msg.includes("hello") || msg.includes("hi") ||
    msg === "start" || msg === "menu" || msg.includes("เมนู") ||
    msg.includes("สมัครด่วน") || msg.includes("quick apply") ||
    msg.includes("เคยสมัคร") || msg.includes("already applied") ||
    msg.includes("คัดลอกลิงก์") || msg.includes("copy link") ||
    msg.includes("คุยกับรีครูทเตอร์") || msg.includes("talk to recruiter") ||
    msg.includes("ข้อมูลเพิ่มเติม") || msg.includes("more info") ||
    msg.includes("faq") || msg.includes("benefit") || msg.includes("สวัสดิการ") ||
    msg.includes("info") || msg.includes("location") || msg.includes("สถานที่") ||
    msg === "cancel" || msg.includes("ยกเลิก")
  );
}

// ============================================================
// MAIN HANDLER
// ============================================================
async function handleMessage(userId, text) {
  const msg = text.toLowerCase().trim();

  // --- Cancel ---
  if (msg === "cancel" || msg.includes("cancel") || msg.includes("ยกเลิก")) {
    clearUserState(userId);
    return [{ type: "text", text: "❌ ยกเลิกแล้วค่ะ / Cancelled.", quickReply: mainQR }];
  }

  const state = getState(userId);

  // --- CONFIRMATION step (after validation warning) ---
  if (state && state.mode === "confirm") {
    if (msg.includes("ใช่") || msg.includes("yes") || msg === "ใช่" || msg === "yes") {
      // Keep the answer, move to next step
      const nextStep = state.step + 1;
      if (state.step >= TOTAL) {
        await saveCandidate(state.answers);
        const a = { ...state.answers };
        clearUserState(userId);
        return [completionFlex(a)];
      }
      setState(userId, { mode: "apply", step: nextStep, answers: state.answers, lang: state.lang });
      return [questionMsg(nextStep, state.lang)];
    } else {
      // Re-ask the same question
      setState(userId, { mode: "apply", step: state.step, answers: state.answers, lang: state.lang });
      // Remove the bad answer
      delete state.answers[STEP_KEYS[state.step]];
      return [questionMsg(state.step, state.lang)];
    }
  }

  // --- QUICK APPLY flow ---
  if (state && state.mode === "apply" && state.step > 0 && state.step <= TOTAL) {
    const key = STEP_KEYS[state.step];
    state.answers[key] = text;

    // Validate
    const warning = validate(state.step, text, state.lang);
    if (warning) {
      setState(userId, { mode: "confirm", step: state.step, answers: state.answers, lang: state.lang });
      const yesNo = state.lang === "th" ? ["ใช่", "ไม่ใช่ (พิมพ์ใหม่)"] : ["Yes", "No (retype)"];
      return [{ type: "text", text: warning, quickReply: qr(yesNo, false) }];
    }

    if (state.step >= TOTAL) {
      await saveCandidate(state.answers);
      const a = { ...state.answers };
      clearUserState(userId);
      return [completionFlex(a)];
    }

    const nextStep = state.step + 1;
    setState(userId, { mode: "apply", step: nextStep, answers: state.answers, lang: state.lang });
    return [questionMsg(nextStep, state.lang)];
  }

  // --- LANGUAGE SELECTION for Quick Apply ---
  if (state && state.mode === "lang_select") {
    let lang = "th";
    if (msg.includes("english") || msg.includes("en")) lang = "en";
    setState(userId, { mode: "apply", step: 1, answers: {}, lang });
    const intro = lang === "th"
      ? "📝 13 คำถาม ใช้เวลาประมาณ 2 นาที\nพิมพ์ 'cancel' เพื่อยกเลิก"
      : "📝 13 questions, about 2 minutes\nType 'cancel' to stop";
    return [
      { type: "text", text: "⚡ " + intro },
      questionMsg(1, lang),
    ];
  }

  // --- RECRUITER mode: bot silent ---
  if (state && state.mode === "recruiter") {
    if (isMenuCommand(msg)) {
      clearUserState(userId);
    } else {
      return null; // silent
    }
  }

  // --- MENU NAVIGATION ---
  if (msg.includes("สวัสดี") || msg.includes("hello") || msg.includes("hi") || msg === "start" || msg === "menu" || msg.includes("เมนู")) {
    clearUserState(userId);
    return [welcomeFlex()];
  }

  if (msg.includes("สมัครด่วน") || msg.includes("quick apply")) {
    setState(userId, { mode: "lang_select", step: 0, answers: {} });
    return [langSelectFlex()];
  }

  if (msg.includes("เคยสมัคร") || msg.includes("already applied")) {
    return [assessmentFlex()];
  }

  if (msg.includes("คัดลอกลิงก์") || msg.includes("copy link")) {
    return [assessmentLinkText()];
  }

  if (msg.includes("คุยกับรีครูทเตอร์") || msg.includes("talk to recruiter") || msg.includes("recruiter") || msg.includes("รีครูท")) {
    setState(userId, { mode: "recruiter", step: 0, answers: {} });
    return [recruiterFlex()];
  }

  if (msg.includes("ข้อมูลเพิ่มเติม") || msg.includes("more info") || msg.includes("info") || msg.includes("faq") || msg.includes("benefit") || msg.includes("สวัสดิการ") || msg.includes("location") || msg.includes("สถานที่")) {
    return [infoFlex()];
  }

  // --- DEFAULT: stay silent (no auto-menu) ---
  return null;
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
        if (replies && replies.length > 0) {
          await client.replyMessage({ replyToken: event.replyToken, messages: replies.slice(0, 5) });
        }
      }
    } catch (err) { console.error("Error:", err.message); }
  }
  res.status(200).json({ ok: true });
};
