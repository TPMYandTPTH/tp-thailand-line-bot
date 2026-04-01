const { messagingApi } = require("@line/bot-sdk");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

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
// IN-MEMORY STATE (no Google calls during questions!)
// ============================================================
// Global Map persists while Vercel function instance is warm.
// Only 1 Google call at the very end to save completed candidate.

const userStates = new Map();

// Auto-expire states after 30 minutes of inactivity
function getState(userId) {
  const s = userStates.get(userId);
  if (s && Date.now() - s.lastActive < 30 * 60 * 1000) {
    return s;
  }
  userStates.delete(userId);
  return null;
}

function setState(userId, step, answers) {
  userStates.set(userId, { step, answers, lastActive: Date.now() });
}

function clearUserState(userId) {
  userStates.delete(userId);
}

// Save to Google Sheets — only called ONCE at the end
async function saveCandidate(answers) {
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "saveCandidate", answers }),
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      redirect: "follow",
    });
  } catch (err) {
    console.error("Save error:", err.message);
  }
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
    { type: "action", action: { type: "message", label: "⚡ สมัครด่วน", text: "สมัครด่วน" } },
    { type: "action", action: { type: "message", label: "✅ เคยสมัครแล้ว", text: "เคยสมัครแล้ว" } },
    { type: "action", action: { type: "message", label: "💬 คุยกับรีครูทเตอร์", text: "คุยกับรีครูทเตอร์" } },
    { type: "action", action: { type: "message", label: "ℹ️ ข้อมูลเพิ่มเติม", text: "ข้อมูลเพิ่มเติม" } },
  ],
};

// ============================================================
// 13-QUESTION FLOW
// ============================================================

const STEP_KEYS = {
  1: "name", 2: "phone", 3: "email", 4: "lineId", 5: "language",
  6: "proficiency", 7: "experience", 8: "education", 9: "employmentStatus",
  10: "startDate", 11: "salary", 12: "bangkok", 13: "notes",
};
const TOTAL = 13;

function questionMsg(step, answers) {
  const p = (n) => `(${n}/${TOTAL})`;

  switch (step) {
    case 1: return {
      type: "text",
      text: `⚡ สมัครด่วน ${p(1)}\n\n👤 ชื่อ-นามสกุล / Full Name:`,
      quickReply: qr([]),
    };
    case 2: return {
      type: "text",
      text: `📱 ${p(2)}\n\n📞 เบอร์โทรศัพท์ / Phone Number:`,
      quickReply: qr([]),
    };
    case 3: return {
      type: "text",
      text: `📧 ${p(3)}\n\n✉️ อีเมล / Email:`,
      quickReply: qr([]),
    };
    case 4: return {
      type: "text",
      text: `💬 ${p(4)}\n\n🔗 LINE ID ของคุณ / Your LINE ID:`,
      quickReply: qr([]),
    };
    case 5: return {
      type: "text",
      text: `🌐 ${p(5)}\n\n🗣️ คุณพูดภาษาอะไร? / What language do you speak?`,
      quickReply: qr(["Japanese", "Korean", "Thai", "Vietnamese", "Bahasa Indonesia", "Mandarin", "Taiwanese", "English"]),
    };
    case 6: return {
      type: "text",
      text: `📊 ${p(6)}\n\n📈 ระดับความสามารถทางภาษา / Language Proficiency:`,
      quickReply: qr(["Beginner", "Intermediate", "Advanced", "Native"]),
    };
    case 7: return {
      type: "text",
      text: `📋 ${p(7)}\n\n⏳ ประสบการณ์ทำงาน / Work Experience:`,
      quickReply: qr(["ไม่มี / None", "< 1 ปี / < 1 year", "1-3 ปี / 1-3 years", "3-5 ปี / 3-5 years", "5+ ปี / 5+ years"]),
    };
    case 8: return {
      type: "text",
      text: `🎓 ${p(8)}\n\n📚 ระดับการศึกษา / Education:`,
      quickReply: qr(["มัธยมปลาย / High School", "อนุปริญญา / Diploma", "ปริญญาตรี / Bachelor's", "ปริญญาโท / Master's", "ปริญญาเอก / PhD"]),
    };
    case 9: return {
      type: "text",
      text: `👔 ${p(9)}\n\n💼 สถานะการทำงานปัจจุบัน / Employment Status:`,
      quickReply: qr(["ทำงานอยู่ / Employed", "ว่างงาน / Unemployed", "นักศึกษา / Student", "ฟรีแลนซ์ / Freelance"]),
    };
    case 10: return {
      type: "text",
      text: `📅 ${p(10)}\n\n🗓️ เริ่มงานได้เมื่อไหร่? / Available Start Date:`,
      quickReply: qr(["ทันที / Immediately", "2 สัปดาห์ / 2 weeks", "1 เดือน / 1 month", "อื่นๆ / Other"]),
    };
    case 11: return {
      type: "text",
      text: `💰 ${p(11)}\n\n💵 เงินเดือนที่คาดหวัง (บาท) / Expected Salary (THB):\n\nพิมพ์จำนวนที่ต้องการ เช่น 25000\nType your expected amount e.g. 25000`,
      quickReply: qr([]),
    };
    case 12: return {
      type: "text",
      text: `📍 ${p(12)}\n\n🏙️ สามารถทำงานในกรุงเทพฯ ได้ไหม?\nWilling to work in Bangkok?`,
      quickReply: qr(["ได้ / Yes", "ไม่ได้ / No"]),
    };
    case 13: return {
      type: "text",
      text: `📝 ${p(13)} คำถามสุดท้าย!\n\n💬 มีอะไรเพิ่มเติมที่อยากบอกเราไหม?\nAnything else you'd like us to know?`,
      quickReply: qr(["ไม่มี / None"]),
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
    type: "flex", altText: "สมัครสำเร็จ! / Application submitted!",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "✅ สมัครสำเร็จ!", weight: "bold", size: "xl", color: "#FFFFFF" },
        { type: "text", text: "Application Submitted!", size: "md", color: "#FFFFFFCC", margin: "xs" },
      ], backgroundColor: "#27AE60", paddingAll: "20px" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "ขอบคุณค่ะ " + (answers.name || "") + "! 🎉", weight: "bold", size: "md", wrap: true },
        { type: "text", text: "ขอบคุณที่สนใจร่วมงานกับ TP Thailand!", size: "sm", color: "#888888", margin: "sm", wrap: true },
        { type: "separator", margin: "lg" },
        summaryRow("👤", "ชื่อ", answers.name),
        summaryRow("📞", "โทร", answers.phone),
        summaryRow("✉️", "อีเมล", answers.email),
        summaryRow("🌐", "ภาษา", answers.language),
        summaryRow("💰", "เงินเดือน", answers.salary),
        { type: "separator", margin: "lg" },
        { type: "text", text: "ทีมสรรหาจะติดต่อคุณเร็วๆ นี้ค่ะ\nOur team will contact you soon!", size: "sm", color: "#666666", margin: "lg", wrap: true },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", contents: [
        { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "🏠 กลับเมนูหลัก / Main Menu", text: "สวัสดี" } },
      ], paddingAll: "10px" },
    },
  };
}

// ============================================================
// MENU FLEX MESSAGES
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
        { type: "text", text: "ยินดีต้อนรับสู่ TP Thailand\nWelcome! How can we help you?", size: "sm", color: "#666666", margin: "md", wrap: true },
        { type: "separator", margin: "xl" },
        { type: "text", text: "เลือกเมนูด้านล่าง / Choose below:", size: "sm", color: "#888888", margin: "lg" },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: "⚡ สมัครด่วน / Quick Apply", text: "สมัครด่วน" } },
        { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "✅ เคยสมัครแล้ว / Already Applied", text: "เคยสมัครแล้ว" } },
        { type: "button", style: "secondary", action: { type: "message", label: "💬 คุยกับรีครูทเตอร์ / Talk to Recruiter", text: "คุยกับรีครูทเตอร์" } },
        { type: "button", style: "secondary", action: { type: "message", label: "ℹ️ ข้อมูลเพิ่มเติม / More Info", text: "ข้อมูลเพิ่มเติม" } },
      ], paddingAll: "15px" },
    }, quickReply: mainQR,
  };
}

function assessmentFlex() {
  const data = loadData();
  return {
    type: "flex", altText: "แบบทดสอบภาษา / Language Assessment",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "📋 แบบทดสอบภาษา", weight: "bold", size: "lg", color: "#FFFFFF" },
        { type: "text", text: "Language Assessment", size: "md", color: "#FFFFFFCC", margin: "xs" },
      ], backgroundColor: TP_DARK, paddingAll: "20px" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "ยินดีต้อนรับกลับมาค่ะ! 🎉", weight: "bold", size: "md" },
        { type: "text", text: "Welcome back!", size: "sm", color: "#888888", margin: "xs" },
        { type: "separator", margin: "lg" },
        { type: "text", text: "กรุณาทำแบบทดสอบภาษาเพื่อดำเนินการต่อ\nPlease complete the assessment to proceed.", size: "sm", color: "#666666", margin: "lg", wrap: true },
        { type: "separator", margin: "lg" },
        { type: "text", text: "💻 แนะนำให้ทำบน PC / Best on PC", weight: "bold", size: "xs", color: TP_PINK, margin: "lg" },
        { type: "text", text: "กด 'คัดลอกลิงก์' เพื่อเปิดบน PC", size: "xs", color: "#888888", margin: "sm", wrap: true },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "uri", label: "🚀 เริ่มทำแบบทดสอบ / Start", uri: data.assessment_url } },
        { type: "button", style: "secondary", action: { type: "message", label: "📋 คัดลอกลิงก์ / Copy Link", text: "คัดลอกลิงก์" } },
        { type: "button", style: "secondary", action: { type: "message", label: "🏠 กลับเมนูหลัก / Main Menu", text: "สวัสดี" } },
      ], paddingAll: "15px" },
    },
  };
}

function assessmentLinkText() {
  const data = loadData();
  return {
    type: "text",
    text: "📋 ลิงก์แบบทดสอบภาษา / Assessment Link:\n\n💻 แนะนำให้เปิดบน PC / Best on PC:\n\n" + data.assessment_url + "\n\n👆 กดค้างเพื่อคัดลอก / Long press to copy",
    quickReply: mainQR,
  };
}

function talkToRecruiterFlex() {
  return {
    type: "flex", altText: "คุยกับรีครูทเตอร์ / Talk to Recruiter",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "💬 คุยกับรีครูทเตอร์", weight: "bold", size: "lg", color: "#FFFFFF" },
        { type: "text", text: "Talk to a Recruiter", size: "md", color: "#FFFFFFCC", margin: "xs" },
      ], backgroundColor: "#2980B9", paddingAll: "20px" },
      body: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "ทีมสรรหาของเราพร้อมช่วยคุณค่ะ! 😊", weight: "bold", size: "md", wrap: true },
        { type: "text", text: "Our recruitment team is here to help!", size: "sm", color: "#888888", margin: "sm", wrap: true },
        { type: "separator", margin: "lg" },
        { type: "text", text: "คุณสามารถพิมพ์ข้อความได้เลยที่แชทนี้ รีครูทเตอร์จะตอบกลับคุณโดยเร็วที่สุดค่ะ", size: "sm", color: "#666666", margin: "lg", wrap: true },
        { type: "text", text: "Type your message here. A recruiter will reply as soon as possible.", size: "sm", color: "#888888", margin: "md", wrap: true },
        { type: "separator", margin: "lg" },
        { type: "text", text: "⏰ เวลาทำการ / Office Hours:", weight: "bold", size: "sm", margin: "lg" },
        { type: "text", text: "จันทร์-ศุกร์ 09:00 - 18:00\nMon-Fri 09:00 - 18:00 (ICT)", size: "sm", color: "#666666", margin: "sm", wrap: true },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", contents: [
        { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "🏠 กลับเมนูหลัก / Main Menu", text: "สวัสดี" } },
      ], paddingAll: "10px" },
    },
  };
}

function infoFlex() {
  return {
    type: "flex", altText: "ข้อมูลเพิ่มเติม / More Info",
    contents: { type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [
        { type: "text", text: "ℹ️ ข้อมูลเพิ่มเติม", weight: "bold", size: "lg", color: "#FFFFFF" },
        { type: "text", text: "More Information", size: "md", color: "#FFFFFFCC", margin: "xs" },
      ], backgroundColor: TP_DARK, paddingAll: "20px" },
      body: { type: "box", layout: "vertical", spacing: "md", contents: [
        { type: "text", text: "❓ เกี่ยวกับ TP / About TP", weight: "bold", size: "sm" },
        { type: "text", text: "TP เป็นผู้นำระดับโลกด้าน Digital Business Services มีพนักงานกว่า 500,000 คนใน 100+ ประเทศ", size: "sm", color: "#666", wrap: true },
        { type: "separator" },
        { type: "text", text: "🎓 ต้องมีประสบการณ์ไหม?", weight: "bold", size: "sm" },
        { type: "text", text: "ไม่จำเป็น! เรามีการฝึกอบรมให้ทุกตำแหน่ง\nNo experience needed! Full training provided.", size: "sm", color: "#666", wrap: true },
        { type: "separator" },
        { type: "text", text: "📍 สถานที่ / Location", weight: "bold", size: "sm" },
        { type: "text", text: "กรุงเทพมหานคร (ใกล้ BTS, มีที่จอดรถ)\nBangkok (near BTS, parking available)", size: "sm", color: "#666", wrap: true },
        { type: "separator" },
        { type: "text", text: "🎁 สวัสดิการ / Benefits", weight: "bold", size: "sm" },
        { type: "text", text: "💰 เงินเดือนแข่งขันได้\n🏥 ประกันสังคม + ประกันกลุ่ม\n🎯 โบนัสประจำปี\n📚 ฝึกอบรมฟรี\n📈 โอกาสเติบโต\n🌍 สภาพแวดล้อมระดับสากล", size: "sm", color: "#666", wrap: true },
      ], paddingAll: "20px" },
      footer: { type: "box", layout: "vertical", contents: [
        { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: "⚡ สมัครด่วน / Quick Apply", text: "สมัครด่วน" } },
      ], paddingAll: "10px" },
    }, quickReply: mainQR,
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

async function handleMessage(userId, text) {
  const msg = text.toLowerCase().trim();

  // --- Cancel ---
  if (msg === "cancel" || msg.includes("cancel") || msg.includes("ยกเลิก")) {
    clearUserState(userId);
    return [{ type: "text", text: "❌ ยกเลิกแล้วค่ะ / Cancelled.\n\nพิมพ์ 'สวัสดี' เพื่อกลับเมนูหลัก\nType 'Hi' for main menu", quickReply: mainQR }];
  }

  // --- Quick Apply flow (all in memory — instant!) ---
  const state = getState(userId);

  if (state && state.step > 0 && state.step <= TOTAL) {
    const key = STEP_KEYS[state.step];
    state.answers[key] = text;

    if (state.step >= TOTAL) {
      // Done! Save ALL answers to Google Sheets in ONE call
      await saveCandidate(state.answers);
      const answers = { ...state.answers };
      clearUserState(userId);
      return [completionFlex(answers)];
    }

    // Advance to next question (in memory only — instant)
    const nextStep = state.step + 1;
    setState(userId, nextStep, state.answers);
    return [questionMsg(nextStep, state.answers)];
  }

  // --- Menu ---
  if (msg.includes("สวัสดี") || msg.includes("hello") || msg.includes("hi") || msg === "start" || msg.includes("menu") || msg.includes("เมนู")) {
    return [welcomeFlex()];
  }

  if (msg.includes("สมัครด่วน") || msg.includes("quick apply")) {
    setState(userId, 1, {});
    return [
      { type: "text", text: "⚡ เริ่มสมัครด่วน!\n\n📝 13 คำถาม ใช้เวลาประมาณ 2 นาที\n13 questions, about 2 minutes\n\nพิมพ์ 'cancel' เพื่อยกเลิกได้ตลอด\nType 'cancel' to stop anytime" },
      questionMsg(1, {}),
    ];
  }

  if (msg.includes("เคยสมัคร") || msg.includes("already applied")) {
    return [assessmentFlex()];
  }

  if (msg.includes("คัดลอกลิงก์") || msg.includes("copy link") || msg.includes("assessment link")) {
    return [assessmentLinkText()];
  }

  if (msg.includes("คุยกับรีครูทเตอร์") || msg.includes("talk to recruiter") || msg.includes("recruiter") || msg.includes("รีครูท")) {
    return [talkToRecruiterFlex()];
  }

  if (msg.includes("ข้อมูลเพิ่มเติม") || msg.includes("more info") || msg.includes("info") || msg.includes("faq") || msg.includes("benefit") || msg.includes("สวัสดิการ") || msg.includes("location") || msg.includes("สถานที่")) {
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
