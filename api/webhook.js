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

// --- Signature Verification ---
function verifySignature(body, signature) {
  const hash = crypto
    .createHmac("SHA256", config.channelSecret)
    .update(Buffer.from(JSON.stringify(body)))
    .digest("base64");
  return hash === signature;
}

// --- Recruitment Bot Logic ---
function getReply(text) {
  const msg = text.toLowerCase().trim();

  // Thai greetings
  if (
    msg.includes("สวัสดี") ||
    msg.includes("hello") ||
    msg.includes("hi") ||
    msg === "start"
  ) {
    return (
      "สวัสดีค่ะ! Welcome to TP Thailand Recruitment 🇹🇭\n\n" +
      "ยินดีต้อนรับสู่ TP Thailand!\n\n" +
      "How can I help you? / ต้องการความช่วยเหลืออะไรคะ?\n\n" +
      "1️⃣ ดูตำแหน่งงาน / View open positions\n" +
      "2️⃣ สมัครงาน / Apply now\n" +
      "3️⃣ สอบถามข้อมูล / Ask a question\n" +
      "4️⃣ สถานที่ทำงาน / Office locations\n" +
      "5️⃣ สวัสดิการ / Benefits"
    );
  }

  // Option 1: Open positions
  if (msg === "1" || msg.includes("ตำแหน่ง") || msg.includes("position") || msg.includes("job") || msg.includes("งาน")) {
    return (
      "📋 ตำแหน่งงานที่เปิดรับ / Open Positions:\n\n" +
      "🔹 Guest Experience Specialist\n" +
      "   - Languages: Thai, English\n" +
      "   - Location: Bangkok\n\n" +
      "🔹 Customer Service Representative\n" +
      "   - Languages: Thai, English\n" +
      "   - Location: Bangkok\n\n" +
      "🔹 Content Moderator\n" +
      "   - Languages: Thai\n" +
      "   - Location: Bangkok\n\n" +
      "พิมพ์ชื่อตำแหน่งเพื่อดูรายละเอียดเพิ่มเติม\n" +
      "Type a role name for more details, or type 2 to apply!"
    );
  }

  // Option 2: Apply
  if (msg === "2" || msg.includes("สมัคร") || msg.includes("apply")) {
    return (
      "📝 สมัครงาน / Apply Now\n\n" +
      "You can apply through our careers page:\n" +
      "🔗 https://careers.tp.com\n\n" +
      "หรือส่งข้อมูลต่อไปนี้มาทาง LINE นี้:\n" +
      "Or send us the following info via this chat:\n\n" +
      "1. ชื่อ-นามสกุล / Full Name\n" +
      "2. เบอร์โทร / Phone Number\n" +
      "3. อีเมล / Email\n" +
      "4. ตำแหน่งที่สนใจ / Position interested in\n" +
      "5. ภาษาที่พูดได้ / Languages spoken"
    );
  }

  // Option 3: Questions
  if (msg === "3" || msg.includes("ถาม") || msg.includes("question") || msg.includes("info")) {
    return (
      "❓ คำถามที่พบบ่อย / FAQ:\n\n" +
      "Q: TP คืออะไร? / What is TP?\n" +
      "A: TP (Teleperformance) เป็นผู้นำระดับโลกด้าน Digital Business Services มีพนักงานกว่า 500,000 คนใน 100+ ประเทศ\n\n" +
      "Q: ต้องมีประสบการณ์ไหม? / Do I need experience?\n" +
      "A: ไม่จำเป็น! เรามีการฝึกอบรมให้ / No experience needed! We provide full training.\n\n" +
      "Q: ทำงานที่ไหน? / Where is the office?\n" +
      "A: กรุงเทพฯ / Bangkok, Thailand\n\n" +
      "มีคำถามเพิ่มเติม? พิมพ์ถามได้เลยค่ะ!\n" +
      "Have more questions? Just type and ask!"
    );
  }

  // Option 4: Locations
  if (msg === "4" || msg.includes("สถานที่") || msg.includes("location") || msg.includes("office") || msg.includes("ที่ทำงาน")) {
    return (
      "📍 สถานที่ทำงาน / Office Locations:\n\n" +
      "🏢 TP Thailand - Bangkok\n" +
      "   กรุงเทพมหานคร, ประเทศไทย\n\n" +
      "🚇 ใกล้ BTS / Near BTS station\n" +
      "🅿️ มีที่จอดรถ / Parking available\n\n" +
      "พิมพ์ 1 เพื่อดูตำแหน่งงาน หรือ 2 เพื่อสมัครงาน"
    );
  }

  // Option 5: Benefits
  if (msg === "5" || msg.includes("สวัสดิการ") || msg.includes("benefit") || msg.includes("salary") || msg.includes("เงินเดือน")) {
    return (
      "🎁 สวัสดิการ / Benefits:\n\n" +
      "✅ เงินเดือนแข่งขันได้ / Competitive salary\n" +
      "✅ ประกันสังคม + ประกันกลุ่ม / Social security + Group insurance\n" +
      "✅ โบนัสประจำปี / Annual bonus\n" +
      "✅ ฝึกอบรมฟรี / Free training provided\n" +
      "✅ โอกาสเติบโตในสายงาน / Career growth opportunities\n" +
      "✅ สภาพแวดล้อมการทำงานระดับสากล / International work environment\n\n" +
      "พร้อมสมัครแล้วหรือยัง? พิมพ์ 2 เลยค่ะ! 🚀"
    );
  }

  // Default / fallback
  return (
    "ขอบคุณสำหรับข้อความค่ะ! 🙏\n" +
    "Thank you for your message!\n\n" +
    "พิมพ์ 'Hi' เพื่อดูเมนูหลัก\n" +
    "Type 'Hi' to see the main menu.\n\n" +
    "หรือเลือกหมายเลข / Or pick a number:\n" +
    "1️⃣ ตำแหน่งงาน  2️⃣ สมัครงาน  3️⃣ FAQ\n" +
    "4️⃣ สถานที่  5️⃣ สวัสดิการ"
  );
}

// --- Webhook Handler ---
module.exports = async (req, res) => {
  // Health check
  if (req.method === "GET") {
    return res.status(200).send("TP Thailand LINE Bot is running 🇹🇭");
  }

  // Verify LINE signature
  const signature = req.headers["x-line-signature"];
  if (!signature || !verifySignature(req.body, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const events = req.body.events || [];

  // Handle webhook verification (0 events)
  if (events.length === 0) {
    return res.status(200).json({ status: "ok" });
  }

  for (const event of events) {
    try {
      if (event.type === "follow") {
        // New friend added the bot
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text:
                "สวัสดีค่ะ! Welcome to TP Thailand Recruitment 🇹🇭\n\n" +
                "ยินดีต้อนรับสู่ TP Thailand!\n\n" +
                "พิมพ์ 'Hi' เพื่อเริ่มต้น / Type 'Hi' to get started!",
            },
          ],
        });
      } else if (event.type === "message" && event.message.type === "text") {
        const reply = getReply(event.message.text);
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: reply }],
        });
      }
    } catch (err) {
      console.error("Error handling event:", err);
    }
  }

  res.status(200).json({ status: "ok" });
};
