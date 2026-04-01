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

function verifySignature(body, sig) {
  return crypto.createHmac("SHA256", config.channelSecret)
    .update(Buffer.from(JSON.stringify(body))).digest("base64") === sig;
}

// ============================================================
// STATE
// ============================================================
const userStates = new Map();
const userLangs = new Map(); // persists language preference

function getState(uid) {
  const s = userStates.get(uid);
  if (s && Date.now() - s.lastActive < 30 * 60 * 1000) return s;
  userStates.delete(uid);
  return null;
}
function setState(uid, data) {
  userStates.set(uid, { ...data, lastActive: Date.now() });
}
function clearState(uid) { userStates.delete(uid); }
function getLang(uid) { return userLangs.get(uid) || null; }
function setLang(uid, lang) { userLangs.set(uid, lang); }

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
function qr(opts, showCancel = true) {
  const items = opts.map(o => ({
    type: "action",
    action: { type: "message", label: o.length > 20 ? o.slice(0, 20) : o, text: o },
  }));
  if (showCancel) items.push({ type: "action", action: { type: "message", label: "❌ ยกเลิก/Cancel", text: "cancel" } });
  return { items };
}

function menuQR(lang) {
  if (lang === "th") return { items: [
    { type: "action", action: { type: "message", label: "⚡ สมัครด่วน", text: "สมัครด่วน" } },
    { type: "action", action: { type: "message", label: "✅ เคยสมัครแล้ว", text: "เคยสมัครแล้ว" } },
    { type: "action", action: { type: "message", label: "💬 คุยกับรีครูทเตอร์", text: "คุยกับรีครูทเตอร์" } },
    { type: "action", action: { type: "message", label: "ℹ️ ข้อมูลเพิ่มเติม", text: "ข้อมูลเพิ่มเติม" } },
  ]};
  return { items: [
    { type: "action", action: { type: "message", label: "⚡ Quick Apply", text: "Quick Apply" } },
    { type: "action", action: { type: "message", label: "✅ Already Applied", text: "Already Applied" } },
    { type: "action", action: { type: "message", label: "💬 Talk to Recruiter", text: "Talk to Recruiter" } },
    { type: "action", action: { type: "message", label: "ℹ️ More Info", text: "More Info" } },
  ]};
}

// ============================================================
// QUESTIONS
// ============================================================
const KEYS = {
  1: "name", 2: "phone", 3: "email", 4: "lineId", 5: "language",
  6: "proficiency", 7: "experience", 8: "education", 9: "employmentStatus",
  10: "startDate", 11: "salary", 12: "bangkok", 13: "notes",
};
const TOTAL = 13;

const Q = {
  th: {
    1: { t: "👤 กรุณาพิมพ์ชื่อ-นามสกุล", o: [] },
    2: { t: "📞 เบอร์โทรศัพท์", o: [] },
    3: { t: "✉️ อีเมล", o: [] },
    4: { t: "🔗 LINE ID", o: [] },
    5: { t: "🗣️ คุณพูดภาษาอะไร?", o: ["Japanese","Korean","Thai","Vietnamese","Bahasa Indonesia","Mandarin","Taiwanese","English"] },
    6: { t: "📈 ระดับความสามารถทางภาษา", o: ["เริ่มต้น","ปานกลาง","ขั้นสูง","เจ้าของภาษา"] },
    7: { t: "⏳ ประสบการณ์ทำงาน", o: ["ไม่มี","น้อยกว่า 1 ปี","1-3 ปี","3-5 ปี","มากกว่า 5 ปี"] },
    8: { t: "📚 ระดับการศึกษา", o: ["มัธยมปลาย","อนุปริญญา","ปริญญาตรี","ปริญญาโท","ปริญญาเอก"] },
    9: { t: "💼 สถานะการทำงาน", o: ["ทำงานอยู่","ว่างงาน","นักศึกษา","ฟรีแลนซ์"] },
    10: { t: "🗓️ เริ่มงานได้เมื่อไหร่?", o: ["ทันที","2 สัปดาห์","1 เดือน","อื่นๆ"] },
    11: { t: "💵 เงินเดือนที่คาดหวัง (บาท)\nพิมพ์จำนวน เช่น 25000", o: [] },
    12: { t: "🏙️ ทำงานในกรุงเทพฯ ได้ไหม?", o: ["ได้","ไม่ได้"] },
    13: { t: "💬 มีอะไรเพิ่มเติมไหม?", o: ["ไม่มี"] },
  },
  en: {
    1: { t: "👤 Please type your full name", o: [] },
    2: { t: "📞 Phone number", o: [] },
    3: { t: "✉️ Email address", o: [] },
    4: { t: "🔗 LINE ID", o: [] },
    5: { t: "🗣️ What language do you speak?", o: ["Japanese","Korean","Thai","Vietnamese","Bahasa Indonesia","Mandarin","Taiwanese","English"] },
    6: { t: "📈 Language proficiency", o: ["Beginner","Intermediate","Advanced","Native"] },
    7: { t: "⏳ Work experience", o: ["None","< 1 year","1-3 years","3-5 years","5+ years"] },
    8: { t: "📚 Education level", o: ["High School","Diploma","Bachelor's","Master's","PhD"] },
    9: { t: "💼 Employment status", o: ["Employed","Unemployed","Student","Freelance"] },
    10: { t: "🗓️ When can you start?", o: ["Immediately","2 weeks","1 month","Other"] },
    11: { t: "💵 Expected salary (THB)\nType amount e.g. 25000", o: [] },
    12: { t: "🏙️ Work in Bangkok?", o: ["Yes","No"] },
    13: { t: "💬 Anything else?", o: ["None"] },
  },
};

function qMsg(step, lang) {
  const q = Q[lang][step];
  if (!q) return null;
  return { type: "text", text: `(${step}/${TOTAL}) ${q.t}`, quickReply: qr(q.o) };
}

// ============================================================
// VALIDATION
// ============================================================
function validate(step, val, lang) {
  const v = val.trim();
  if (step === 1 && v.length < 2)
    return lang === "th" ? "👤 ชื่อสั้นเกินไป กรุณาพิมพ์ใหม่" : "👤 Too short. Please type your full name.";
  if (step === 2) {
    const d = v.replace(/[\s\-\+\(\)]/g, "");
    if (d.length < 8 || !/^\d+$/.test(d))
      return lang === "th" ? '📞 "'+v+'" ไม่เหมือนเบอร์โทร\nคุณแน่ใจไหม?' : '📞 "'+v+'" doesn\'t look like a phone number.\nAre you sure?';
  }
  if (step === 3 && (!v.includes("@") || !v.includes(".")))
    return lang === "th" ? '✉️ "'+v+'" ไม่เหมือนอีเมล\nคุณแน่ใจไหม?' : '✉️ "'+v+'" doesn\'t look like an email.\nAre you sure?';
  return null;
}

// ============================================================
// FLEX MESSAGES
// ============================================================

function firstMessageFlex() {
  return {
    type: "flex", altText: "TP Thailand",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "🇹🇭 TP Thailand", weight: "bold", size: "xl", color: TP_DARK },
        { type: "text", text: "Recruitment Bot", size: "md", color: "#888", margin: "xs" },
      ], paddingAll: "20px", backgroundColor: "#F8F8FF" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "สวัสดีค่ะ! ยินดีต้อนรับสู่ TP Thailand! 🎉", weight: "bold", size: "md", wrap: true },
        { type: "text", text: "Welcome to TP Thailand!", size: "sm", color: "#888", margin: "sm" },
        { type: "separator", margin: "xl" },
        { type: "text", text: "พิมพ์ 'สวัสดี' เพื่อดูเมนู\nType 'Hi' to see the menu", size: "sm", color: "#666", margin: "lg", wrap: true },
      ], paddingAll: "20px" },
    },
  };
}

function langPickerFlex() {
  return {
    type: "flex", altText: "เลือกภาษา / Choose Language",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "🇹🇭 TP Thailand", weight: "bold", size: "xl", color: TP_DARK },
      ], paddingAll: "20px", backgroundColor: "#F8F8FF" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "กรุณาเลือกภาษา", weight: "bold", size: "lg" },
        { type: "text", text: "Please choose your language", size: "sm", color: "#888", margin: "sm" },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "horizontal", spacing: "md", contents: [
        { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "🇹🇭 ภาษาไทย", text: "ภาษาไทย" } },
        { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "🇬🇧 English", text: "English" } },
      ], paddingAll: "15px" },
    },
  };
}

function welcomeFlex(lang) {
  if (lang === "th") return {
    type: "flex", altText: "เมนูหลัก",
    contents: { type: "bubble", size: "mega",
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "สวัสดีค่ะ! ยินดีต้อนรับ! 😊", weight: "bold", size: "lg" },
        { type: "text", text: "เลือกเมนูด้านล่าง:", size: "sm", color: "#888", margin: "md" },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: "⚡ สมัครด่วน", text: "สมัครด่วน" } },
        { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "✅ เคยสมัครแล้ว", text: "เคยสมัครแล้ว" } },
        { type: "button", style: "secondary", action: { type: "message", label: "💬 คุยกับรีครูทเตอร์", text: "คุยกับรีครูทเตอร์" } },
        { type: "button", style: "secondary", action: { type: "message", label: "ℹ️ ข้อมูลเพิ่มเติม", text: "ข้อมูลเพิ่มเติม" } },
      ], paddingAll: "15px" },
    }, quickReply: menuQR("th"),
  };

  return {
    type: "flex", altText: "Main Menu",
    contents: { type: "bubble", size: "mega",
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "Welcome! How can we help? 😊", weight: "bold", size: "lg", wrap: true },
        { type: "text", text: "Choose from the menu below:", size: "sm", color: "#888", margin: "md" },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: "⚡ Quick Apply", text: "Quick Apply" } },
        { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "✅ Already Applied", text: "Already Applied" } },
        { type: "button", style: "secondary", action: { type: "message", label: "💬 Talk to Recruiter", text: "Talk to Recruiter" } },
        { type: "button", style: "secondary", action: { type: "message", label: "ℹ️ More Info", text: "More Info" } },
      ], paddingAll: "15px" },
    }, quickReply: menuQR("en"),
  };
}

function assessmentFlex(lang) {
  const data = loadData();
  const t = lang === "th";
  return {
    type: "flex", altText: t ? "แบบทดสอบภาษา" : "Language Assessment",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: t ? "📋 แบบทดสอบภาษา" : "📋 Language Assessment", weight: "bold", size: "lg", color: "#FFF" },
      ], backgroundColor: TP_DARK, paddingAll: "20px" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: t ? "ยินดีต้อนรับกลับมาค่ะ! 🎉" : "Welcome back! 🎉", weight: "bold", size: "md" },
        { type: "separator", margin: "lg" },
        { type: "text", text: t ? "กรุณาทำแบบทดสอบภาษาเพื่อดำเนินการต่อ" : "Please complete the assessment to proceed.", size: "sm", color: "#666", margin: "lg", wrap: true },
        { type: "text", text: t ? "💻 แนะนำให้ทำบน PC" : "💻 Best on PC", weight: "bold", size: "xs", color: TP_PINK, margin: "lg" },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "uri", label: t ? "🚀 เริ่มทำแบบทดสอบ" : "🚀 Start Assessment", uri: data.assessment_url } },
        { type: "button", style: "secondary", action: { type: "message", label: t ? "📋 คัดลอกลิงก์" : "📋 Copy Link", text: t ? "คัดลอกลิงก์" : "copy link" } },
        { type: "button", style: "secondary", action: { type: "message", label: t ? "🏠 เมนู" : "🏠 Menu", text: t ? "สวัสดี" : "hi" } },
      ], paddingAll: "15px" },
    },
  };
}

function assessmentLinkText(lang) {
  const data = loadData();
  const t = lang === "th";
  return { type: "text",
    text: (t ? "📋 ลิงก์แบบทดสอบภาษา:\n\n💻 แนะนำเปิดบน PC:\n\n" : "📋 Assessment Link:\n\n💻 Best on PC:\n\n") + data.assessment_url + (t ? "\n\n👆 กดค้างเพื่อคัดลอก" : "\n\n👆 Long press to copy"),
    quickReply: menuQR(lang),
  };
}

function recruiterFlex(lang) {
  const t = lang === "th";
  return {
    type: "flex", altText: t ? "คุยกับรีครูทเตอร์" : "Talk to Recruiter",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: t ? "💬 คุยกับรีครูทเตอร์" : "💬 Talk to a Recruiter", weight: "bold", size: "lg", color: "#FFF" },
      ], backgroundColor: "#2980B9", paddingAll: "20px" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: t ? "พิมพ์ข้อความได้เลยค่ะ รีครูทเตอร์จะตอบกลับโดยเร็วที่สุด 😊" : "Type your message. A recruiter will reply soon. 😊", size: "sm", color: "#666", wrap: true },
        { type: "text", text: t ? "คุณสามารถส่งเรซูเม่ได้ที่นี่เลยค่ะ" : "You can also send your resume here.", size: "sm", color: "#888", margin: "md", wrap: true },
        { type: "separator", margin: "lg" },
        { type: "text", text: t ? "⏰ จันทร์-ศุกร์ 09:00-18:00" : "⏰ Mon-Fri 09:00-18:00 (ICT)", size: "xs", color: "#AAA", margin: "lg" },
        { type: "text", text: t ? "พิมพ์ 'สวัสดี' เพื่อกลับเมนู" : "Type 'Hi' for menu", size: "xs", color: "#AAA", margin: "sm" },
      ], paddingAll: "20px" },
    },
    quickReply: { items: [{ type: "action", action: { type: "message", label: t ? "🏠 เมนู" : "🏠 Menu", text: t ? "สวัสดี" : "hi" } }] },
  };
}

function infoFlex(lang) {
  const t = lang === "th";
  return {
    type: "flex", altText: t ? "ข้อมูลเพิ่มเติม" : "More Info",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: t ? "ℹ️ ข้อมูลเพิ่มเติม" : "ℹ️ More Information", weight: "bold", size: "lg", color: "#FFF" },
      ], backgroundColor: TP_DARK, paddingAll: "20px" },
      body: { type: "box", layout: "vertical", spacing: "md", contents: [
        { type: "text", text: t ? "❓ เกี่ยวกับ TP" : "❓ About TP", weight: "bold", size: "sm" },
        { type: "text", text: t ? "TP เป็นผู้นำระดับโลกด้าน Digital Business Services พนักงาน 500,000+ คน 100+ ประเทศ" : "Global leader in Digital Business Services. 500K+ employees, 100+ countries.", size: "sm", color: "#666", wrap: true },
        { type: "separator" },
        { type: "text", text: t ? "🎓 ไม่ต้องมีประสบการณ์ มีฝึกอบรมให้" : "🎓 No experience needed. Full training provided.", size: "sm", color: "#666", wrap: true },
        { type: "separator" },
        { type: "text", text: t ? "📍 กรุงเทพฯ (ใกล้ BTS, มีที่จอดรถ)" : "📍 Bangkok (near BTS, parking available)", size: "sm", color: "#666", wrap: true },
        { type: "separator" },
        { type: "text", text: t ? "🎁 สวัสดิการ" : "🎁 Benefits", weight: "bold", size: "sm" },
        { type: "text", text: t
          ? "💰 เงินเดือนแข่งขันได้  🏥 ประกันกลุ่ม\n🎯 โบนัสประจำปี  📚 ฝึกอบรมฟรี\n📈 โอกาสเติบโต  🌍 สภาพแวดล้อมสากล"
          : "💰 Competitive salary  🏥 Group insurance\n🎯 Annual bonus  📚 Free training\n📈 Career growth  🌍 International environment",
          size: "sm", color: "#666", wrap: true },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: t ? "⚡ สมัครด่วน" : "⚡ Quick Apply", text: t ? "สมัครด่วน" : "Quick Apply" } },
      ], paddingAll: "10px" },
    }, quickReply: menuQR(lang),
  };
}

function sRow(icon, label, val) {
  return { type: "box", layout: "horizontal", margin: "sm", contents: [
    { type: "text", text: icon+" "+label, size: "xs", color: "#888", flex: 4 },
    { type: "text", text: val||"-", size: "xs", color: "#444", flex: 6, wrap: true },
  ]};
}

function doneFlex(a, lang) {
  const t = lang === "th";
  return {
    type: "flex", altText: t ? "สมัครสำเร็จ!" : "Application submitted!",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: t ? "✅ สมัครสำเร็จ!" : "✅ Application Submitted!", weight: "bold", size: "xl", color: "#FFF" },
      ], backgroundColor: "#27AE60", paddingAll: "20px" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: (t?"ขอบคุณค่ะ ":"Thank you ") + (a.name||"") + "! 🎉", weight: "bold", size: "md", wrap: true },
        { type: "separator", margin: "lg" },
        sRow("👤", t?"ชื่อ:":"Name:", a.name),
        sRow("📞", t?"โทร:":"Phone:", a.phone),
        sRow("✉️", t?"อีเมล:":"Email:", a.email),
        sRow("🌐", t?"ภาษา:":"Language:", a.language),
        sRow("💰", t?"เงินเดือน:":"Salary:", a.salary),
        { type: "separator", margin: "lg" },
        { type: "text", text: t ? "ทีมสรรหาจะติดต่อคุณเร็วๆ นี้ค่ะ" : "Our team will contact you soon!", size: "sm", color: "#666", margin: "lg", wrap: true },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", contents: [
        { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: t?"🏠 เมนู":"🏠 Menu", text: t?"สวัสดี":"hi" } },
      ], paddingAll: "10px" },
    },
  };
}

// ============================================================
// GREETING CHECK
// ============================================================
function isGreeting(msg) {
  return /^(hi|hey|hello|สวัสดี|สวัสดีค่ะ|สวัสดีครับ)$/i.test(msg.trim()) ||
    msg.trim() === "hi" || msg.trim() === "hey" || msg.trim() === "hello" ||
    msg.includes("สวัสดี");
}

function isMenuCmd(msg) {
  return (
    msg.includes("สมัครด่วน") || msg.includes("quick apply") ||
    msg.includes("เคยสมัคร") || msg.includes("already applied") ||
    msg.includes("คัดลอกลิงก์") || msg.includes("copy link") ||
    msg.includes("คุยกับรีครูทเตอร์") || msg.includes("talk to recruiter") || msg.includes("recruiter") ||
    msg.includes("ข้อมูลเพิ่มเติม") || msg.includes("more info") || msg.includes("info") ||
    msg.includes("faq") || msg.includes("benefit") || msg.includes("สวัสดิการ") ||
    msg === "cancel" || msg.includes("ยกเลิก") ||
    isGreeting(msg)
  );
}

// ============================================================
// MAIN
// ============================================================
async function handle(uid, text) {
  const msg = text.toLowerCase().trim();
  const lang = getLang(uid) || "th";

  // --- Cancel ---
  if (msg === "cancel" || msg.includes("ยกเลิก")) {
    clearState(uid);
    return [{ type: "text", text: lang === "th" ? "❌ ยกเลิกแล้วค่ะ" : "❌ Cancelled.", quickReply: menuQR(lang) }];
  }

  const state = getState(uid);

  // --- Confirm validation ---
  if (state && state.mode === "confirm") {
    const sl = state.lang;
    if (msg.includes("ใช่") || msg.includes("yes") || msg === "yes" || msg === "ใช่") {
      const ns = state.step + 1;
      if (state.step >= TOTAL) {
        await saveCandidate(state.answers);
        const a = {...state.answers}; clearState(uid);
        return [doneFlex(a, sl)];
      }
      setState(uid, { mode: "apply", step: ns, answers: state.answers, lang: sl });
      return [qMsg(ns, sl)];
    }
    delete state.answers[KEYS[state.step]];
    setState(uid, { mode: "apply", step: state.step, answers: state.answers, lang: sl });
    return [qMsg(state.step, sl)];
  }

  // --- Quick Apply ---
  if (state && state.mode === "apply" && state.step > 0) {
    const sl = state.lang;
    const key = KEYS[state.step];
    state.answers[key] = text;

    const warn = validate(state.step, text, sl);
    if (warn) {
      setState(uid, { mode: "confirm", step: state.step, answers: state.answers, lang: sl });
      const yn = sl === "th" ? ["ใช่","ไม่ใช่ (พิมพ์ใหม่)"] : ["Yes","No (retype)"];
      return [{ type: "text", text: warn, quickReply: qr(yn, false) }];
    }

    if (state.step >= TOTAL) {
      await saveCandidate(state.answers);
      const a = {...state.answers}; clearState(uid);
      return [doneFlex(a, sl)];
    }

    const ns = state.step + 1;
    setState(uid, { mode: "apply", step: ns, answers: state.answers, lang: sl });
    return [qMsg(ns, sl)];
  }

  // --- Recruiter mode ---
  if (state && state.mode === "recruiter") {
    if (isMenuCmd(msg)) { clearState(uid); } else return null;
  }

  // --- Language picker response ---
  if (state && state.mode === "lang_select") {
    if (msg.includes("english") || msg === "english") {
      setLang(uid, "en"); clearState(uid);
      return [welcomeFlex("en")];
    }
    setLang(uid, "th"); clearState(uid);
    return [welcomeFlex("th")];
  }

  // --- GREETING → Language picker ---
  if (isGreeting(msg)) {
    setState(uid, { mode: "lang_select", step: 0, answers: {} });
    return [langPickerFlex()];
  }

  // --- Menu commands (use stored language) ---
  if (msg.includes("สมัครด่วน") || msg.includes("quick apply")) {
    const l = getLang(uid) || (msg.includes("สมัครด่วน") ? "th" : "en");
    setState(uid, { mode: "apply", step: 1, answers: {}, lang: l });
    const intro = l === "th"
      ? "📝 13 คำถาม ใช้เวลาประมาณ 2 นาที\nพิมพ์ 'cancel' เพื่อยกเลิก"
      : "📝 13 questions, about 2 minutes\nType 'cancel' to stop";
    return [{ type: "text", text: "⚡ "+intro }, qMsg(1, l)];
  }

  if (msg.includes("เคยสมัคร") || msg.includes("already applied")) {
    return [assessmentFlex(lang)];
  }

  if (msg.includes("คัดลอกลิงก์") || msg.includes("copy link")) {
    return [assessmentLinkText(lang)];
  }

  if (msg.includes("คุยกับรีครูทเตอร์") || msg.includes("talk to recruiter") || msg.includes("recruiter") || msg.includes("รีครูท")) {
    setState(uid, { mode: "recruiter", step: 0, answers: {} });
    return [recruiterFlex(lang)];
  }

  if (msg.includes("ข้อมูลเพิ่มเติม") || msg.includes("more info") || msg.includes("info") || msg.includes("faq") || msg.includes("benefit") || msg.includes("สวัสดิการ")) {
    return [infoFlex(lang)];
  }

  // --- DEFAULT: stay silent ---
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

  for (const ev of events) {
    try {
      if (ev.type === "follow") {
        await client.replyMessage({ replyToken: ev.replyToken, messages: [firstMessageFlex()] });
      } else if (ev.type === "message" && ev.message.type === "text") {
        const r = await handle(ev.source.userId, ev.message.text);
        if (r && r.length > 0) {
          await client.replyMessage({ replyToken: ev.replyToken, messages: r.slice(0, 5) });
        }
      }
    } catch (err) { console.error("Error:", err.message); }
  }
  res.status(200).json({ ok: true });
};
