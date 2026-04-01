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

function getState(uid) {
  const s = userStates.get(uid);
  if (s && Date.now() - s.lastActive < 30 * 60 * 1000) return s;
  userStates.delete(uid);
  return null;
}
function setState(uid, data) { userStates.set(uid, { ...data, lastActive: Date.now() }); }
function clearState(uid) { userStates.delete(uid); }

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
// QUICK REPLY
// ============================================================
function qr(opts) {
  const items = opts.map(o => ({
    type: "action",
    action: { type: "message", label: o.length > 20 ? o.slice(0, 20) : o, text: o },
  }));
  items.push({ type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "cancel" } });
  return { items };
}

const mainQR = { items: [
  { type: "action", action: { type: "message", label: "⚡ สมัครด่วน", text: "สมัครด่วน" } },
  { type: "action", action: { type: "message", label: "🤖 AI Assessment", text: "AI Assessment" } },
  { type: "action", action: { type: "message", label: "💬 คุยกับรีครูทเตอร์", text: "คุยกับรีครูทเตอร์" } },
  { type: "action", action: { type: "message", label: "ℹ️ ข้อมูลเพิ่มเติม", text: "ข้อมูลเพิ่มเติม" } },
]};

// ============================================================
// 13 QUESTIONS
// ============================================================
const KEYS = {
  1:"name",2:"phone",3:"email",4:"lineId",5:"language",
  6:"proficiency",7:"experience",8:"education",9:"employmentStatus",
  10:"startDate",11:"salary",12:"bangkok",13:"notes"
};
const TOTAL = 13;

function qMsg(step) {
  const p = `(${step}/${TOTAL})`;
  switch(step) {
    case 1: return { type:"text", text:`${p} 👤 ชื่อ-นามสกุล / Full Name:`, quickReply:qr([]) };
    case 2: return { type:"text", text:`${p} 📞 เบอร์โทร / Phone:`, quickReply:qr([]) };
    case 3: return { type:"text", text:`${p} ✉️ อีเมล / Email:`, quickReply:qr([]) };
    case 4: return { type:"text", text:`${p} 🔗 LINE ID:`, quickReply:qr([]) };
    case 5: return { type:"text", text:`${p} 🗣️ ภาษา / Language:`, quickReply:qr(["Japanese","Korean","Thai","Vietnamese","Bahasa Indonesia","Mandarin","Taiwanese","English"]) };
    case 6: return { type:"text", text:`${p} 📈 ระดับภาษา / Proficiency:`, quickReply:qr(["เริ่มต้น/Beginner","ปานกลาง/Intermediate","ขั้นสูง/Advanced","เจ้าของภาษา/Native"]) };
    case 7: return { type:"text", text:`${p} ⏳ ประสบการณ์ / Experience:`, quickReply:qr(["ไม่มี/None","<1 ปี/<1 yr","1-3 ปี/1-3 yrs","3-5 ปี/3-5 yrs","5+ ปี/5+ yrs"]) };
    case 8: return { type:"text", text:`${p} 📚 การศึกษา / Education:`, quickReply:qr(["มัธยมปลาย/High School","อนุปริญญา/Diploma","ปริญญาตรี/Bachelor","ปริญญาโท/Master","ปริญญาเอก/PhD"]) };
    case 9: return { type:"text", text:`${p} 💼 สถานะ / Status:`, quickReply:qr(["ทำงานอยู่/Employed","ว่างงาน/Unemployed","นักศึกษา/Student","ฟรีแลนซ์/Freelance"]) };
    case 10: return { type:"text", text:`${p} 🗓️ เริ่มงานได้ / Start:`, quickReply:qr(["ทันที/Immediately","2 สัปดาห์/2 weeks","1 เดือน/1 month","อื่นๆ/Other"]) };
    case 11: return { type:"text", text:`${p} 💵 เงินเดือนที่คาดหวัง (บาท)\nExpected Salary (THB)\n\nพิมพ์จำนวน เช่น 25000`, quickReply:qr([]) };
    case 12: return { type:"text", text:`${p} 🏙️ ทำงานกรุงเทพฯ ได้ไหม?\nWork in Bangkok?`, quickReply:qr(["ได้/Yes","ไม่ได้/No"]) };
    case 13: return { type:"text", text:`${p} 💬 สุดท้าย! มีอะไรเพิ่มเติมไหม?\nLast! Anything else?`, quickReply:qr(["ไม่มี/None"]) };
    default: return null;
  }
}

function validate(step, val) {
  const v = val.trim();
  if (step === 1 && v.length < 2) return "👤 ชื่อสั้นเกินไป กรุณาพิมพ์ใหม่\nToo short, please retype.";
  if (step === 2) {
    const d = v.replace(/[\s\-\+\(\)]/g,"");
    if (d.length < 8 || !/^\d+$/.test(d)) return "📞 \""+v+"\" ไม่เหมือนเบอร์โทร คุณแน่ใจไหม?\nDoesn't look like a phone. Are you sure?";
  }
  if (step === 3 && (!v.includes("@") || !v.includes(".")))
    return "✉️ \""+v+"\" ไม่เหมือนอีเมล คุณแน่ใจไหม?\nDoesn't look like an email. Are you sure?";
  return null;
}

// ============================================================
// FLEX MESSAGES (simple text messages to avoid 400 errors)
// ============================================================

function firstMsg() {
  return { type: "text", text: "🇹🇭 TP Thailand Recruitment Bot\n\nสวัสดีค่ะ! ยินดีต้อนรับ!\nWelcome!\n\nพิมพ์ 'สวัสดี' หรือ 'Hi' เพื่อดูเมนู\nType 'สวัสดี' or 'Hi' to see the menu" };
}

function welcomeMsg() {
  return {
    type: "flex", altText: "TP Thailand Menu",
    contents: {
      type: "bubble",
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          { type: "text", text: "🇹🇭 TP Thailand", weight: "bold", size: "xl", color: TP_DARK },
          { type: "text", text: "สวัสดีค่ะ! ยินดีต้อนรับ!\nWelcome! How can we help?", size: "sm", color: "#666666", wrap: true },
          { type: "separator", margin: "lg" },
          { type: "text", text: "เลือกด้านล่าง / Choose below:", size: "xs", color: "#AAAAAA", margin: "md" },
        ],
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          { type: "button", style: "primary", color: TP_PINK, action: { type: "message", label: "⚡ สมัครด่วน / Quick Apply", text: "สมัครด่วน" } },
          { type: "button", style: "primary", color: TP_DARK, action: { type: "message", label: "🤖 AI Assessment", text: "AI Assessment" } },
          { type: "button", style: "secondary", action: { type: "message", label: "💬 รีครูทเตอร์ / Recruiter", text: "คุยกับรีครูทเตอร์" } },
          { type: "button", style: "secondary", action: { type: "message", label: "ℹ️ เพิ่มเติม / More Info", text: "ข้อมูลเพิ่มเติม" } },
        ],
      },
    },
    quickReply: mainQR,
  };
}

function assessmentMsg() {
  const data = loadData();
  return {
    type: "text",
    text: "🤖 AI Assessment\nแบบทดสอบภาษา / Language Assessment\n\n💻 แนะนำทำบน PC / Best on PC\n\nกดลิงก์ด้านล่างหรือคัดลอกไปเปิดบน PC:\nClick the link or copy to open on PC:\n\n" + data.assessment_url + "\n\n👆 กดค้างเพื่อคัดลอก / Long press to copy\n\nพิมพ์ 'สวัสดี' เพื่อกลับเมนู",
    quickReply: mainQR,
  };
}

function copyLinkMsg() {
  const data = loadData();
  return { type: "text", text: "📋 ลิงก์แบบทดสอบ / Assessment Link:\n\n💻 เปิดบน PC / Open on PC:\n\n" + data.assessment_url + "\n\n👆 กดค้างเพื่อคัดลอก / Long press to copy", quickReply: mainQR };
}

function recruiterMsg() {
  return { type: "text", text: "💬 คุยกับรีครูทเตอร์ / Talk to Recruiter\n\nพิมพ์ข้อความได้เลยค่ะ รีครูทเตอร์จะตอบกลับโดยเร็วที่สุด 😊\nType your message. A recruiter will reply soon.\n\nส่งเรซูเม่ได้ที่นี่เลย / Send resume here too.\n\n⏰ จันทร์-ศุกร์ 09:00-18:00\n\nพิมพ์ 'สวัสดี' หรือ 'Hi' เพื่อกลับเมนู\nType 'สวัสดี' or 'Hi' for menu" };
}

function infoMsg() {
  return {
    type: "text",
    text: "ℹ️ ข้อมูลเพิ่มเติม / More Info\n\n❓ TP คืออะไร?\nผู้นำระดับโลก Digital Business Services\nพนักงาน 500,000+ คน ใน 100+ ประเทศ\n\n🎓 ไม่ต้องมีประสบการณ์ มีฝึกอบรมให้\n\n📍 กรุงเทพฯ (ใกล้ BTS, มีที่จอดรถ)\n\n🎁 สวัสดิการ:\n💰 เงินเดือนแข่งขันได้\n🏥 ประกันกลุ่ม\n🎯 โบนัสประจำปี\n📚 ฝึกอบรมฟรี\n📈 โอกาสเติบโต\n🌍 สภาพแวดล้อมสากล\n\nพิมพ์ 'สวัสดี' เพื่อดูเมนู",
    quickReply: mainQR,
  };
}

function doneMsg(a) {
  return { type: "text", text: "✅ สมัครสำเร็จ! / Submitted!\n\nขอบคุณค่ะ " + (a.name||"") + "! 🎉\n\n👤 " + (a.name||"-") + "\n📞 " + (a.phone||"-") + "\n✉️ " + (a.email||"-") + "\n🌐 " + (a.language||"-") + "\n💰 " + (a.salary||"-") + "\n\nทีมสรรหาจะติดต่อเร็วๆ นี้ค่ะ\nOur team will contact you soon!\n\nพิมพ์ 'สวัสดี' เพื่อดูเมนู", quickReply: mainQR };
}

// ============================================================
// GREETING CHECK
// ============================================================
function isGreeting(msg) {
  const m = msg.trim().toLowerCase();
  return m === "hi" || m === "hey" || m === "hello" || m.includes("สวัสดี") || m === "menu" || m === "เมนู";
}

function isMenuCmd(msg) {
  return isGreeting(msg) || msg.includes("สมัครด่วน") || msg.includes("quick apply") ||
    msg.includes("เคยสมัคร") || msg.includes("already") || msg.includes("assessment") || msg.includes("คุยกับ") ||
    msg.includes("recruiter") || msg.includes("ข้อมูล") || msg.includes("info") ||
    msg.includes("cancel") || msg.includes("ยกเลิก");
}

// ============================================================
// MAIN
// ============================================================
async function handle(uid, text) {
  const msg = text.toLowerCase().trim();

  // Cancel
  if (msg === "cancel" || msg.includes("ยกเลิก")) {
    clearState(uid);
    return [{ type:"text", text:"❌ ยกเลิกแล้ว / Cancelled.\n\nพิมพ์ 'สวัสดี' หรือ 'Hi' เพื่อดูเมนู", quickReply:mainQR }];
  }

  const state = getState(uid);

  // Confirm validation
  if (state && state.mode === "confirm") {
    if (msg.includes("ใช่") || msg.includes("yes")) {
      const ns = state.step + 1;
      if (state.step >= TOTAL) {
        await saveCandidate(state.answers);
        const a = {...state.answers}; clearState(uid);
        return [doneMsg(a)];
      }
      setState(uid, { mode:"apply", step:ns, answers:state.answers });
      return [qMsg(ns)];
    }
    delete state.answers[KEYS[state.step]];
    setState(uid, { mode:"apply", step:state.step, answers:state.answers });
    return [qMsg(state.step)];
  }

  // Quick Apply flow
  if (state && state.mode === "apply" && state.step > 0) {
    state.answers[KEYS[state.step]] = text;
    const warn = validate(state.step, text);
    if (warn) {
      setState(uid, { mode:"confirm", step:state.step, answers:state.answers });
      return [{ type:"text", text:warn, quickReply:qr(["ใช่/Yes","ไม่ใช่/No"]) }];
    }
    if (state.step >= TOTAL) {
      await saveCandidate(state.answers);
      const a = {...state.answers}; clearState(uid);
      return [doneMsg(a)];
    }
    const ns = state.step + 1;
    setState(uid, { mode:"apply", step:ns, answers:state.answers });
    return [qMsg(ns)];
  }

  // Recruiter mode — silent
  if (state && state.mode === "recruiter") {
    if (isMenuCmd(msg)) { clearState(uid); }
    else return null;
  }

  // Menu
  if (isGreeting(msg)) return [welcomeMsg()];

  if (msg.includes("สมัครด่วน") || msg.includes("quick apply")) {
    setState(uid, { mode:"apply", step:1, answers:{} });
    return [{ type:"text", text:"⚡ เริ่มสมัครด่วน!\n📝 13 คำถาม ~2 นาที\n13 questions ~2 min\n\nพิมพ์ 'cancel' เพื่อยกเลิก" }, qMsg(1)];
  }

  if (msg.includes("เคยสมัคร") || msg.includes("already") || msg.includes("assessment")) return [assessmentMsg()];
  if (msg.includes("คัดลอกลิงก์") || msg.includes("copy")) return [copyLinkMsg()];

  if (msg.includes("คุยกับ") || msg.includes("recruiter") || msg.includes("รีครูท")) {
    setState(uid, { mode:"recruiter", step:0, answers:{} });
    return [recruiterMsg()];
  }

  if (msg.includes("ข้อมูล") || msg.includes("info") || msg.includes("faq") || msg.includes("benefit") || msg.includes("สวัสดิการ")) return [infoMsg()];

  // Default: SILENT
  return null;
}

// ============================================================
// WEBHOOK
// ============================================================
module.exports = async (req, res) => {
  if (req.method === "GET") return res.status(200).send("TP Thailand LINE Bot");
  const sig = req.headers["x-line-signature"];
  if (!sig || !verifySignature(req.body, sig)) return res.status(401).json({ error: "Invalid" });
  const events = req.body.events || [];
  if (!events.length) return res.status(200).json({ ok: true });

  for (const ev of events) {
    try {
      if (ev.type === "follow") {
        await client.replyMessage({ replyToken: ev.replyToken, messages: [firstMsg()] });
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
