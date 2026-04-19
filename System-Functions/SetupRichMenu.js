const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const logger = require('./Logger');

/**
 * SetupRichMenu: สคริปต์สำหรับสร้างและติดตั้งเมนูหน้าแชท (Rich Menu)
 * สำหรับ "Paperclip Trading AI 🤖" ผ่าน LINE Messaging API
 */
async function setupRichMenu() {
    const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!TOKEN) {
        console.error("❌ ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env");
        return;
    }

    const headers = {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    };

    const richMenuArea = {
        size: { width: 2500, height: 1686 },
        selected: true,
        name: "Paperclip Trading Menu",
        chatBarText: "เมนูเทรด 📊",
        areas: [
            {
                bounds: { x: 0, y: 0, width: 1250, height: 843 },
                action: { type: "message", text: "วิเคราะห์ตลาด ⚡" }
            },
            {
                bounds: { x: 1250, y: 0, width: 1250, height: 843 },
                action: { type: "message", text: "เช็คระบบ ⚙️" }
            },
            {
                bounds: { x: 0, y: 843, width: 2500, height: 843 },
                action: { type: "message", text: "ปรึกษา Gemini AI 💬" }
            }
        ]
    };

    try {
        console.log("🚀 กำลังสร้างโครงสร้าง Rich Menu ใหม่...");
        const resCreate = await axios.post('https://api.line.me/v2/bot/richmenu', richMenuArea, { headers });
        const richMenuId = resCreate.data.richMenuId;
        console.log(`✅ สร้างสำเร็จ! ID: ${richMenuId}`);

        await axios.post(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {}, { headers });
        console.log(`⭐ ตั้งค่าเป็นเมนูเริ่มต้นเรียบร้อยแล้วครับ!`);

    } catch (e) {
        console.error("❌ การติดตั้ง Rich Menu ล้มเหลว:", e.response ? e.response.data : e.message);
    }
}

if (require.main === module) {
    setupRichMenu();
}

module.exports = setupRichMenu;
