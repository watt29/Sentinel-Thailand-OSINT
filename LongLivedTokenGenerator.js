const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Sentinel Token Automation [ULTIMATE EDITION]
 * กระบวนการแลกเปลี่ยนกุญแจถาวร (Permanent Page Access Token)
 */

async function getPermanentToken(shortUserToken) {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const pageId = process.env.FACEBOOK_PAGE_ID;

    if (!appId || !appSecret || !pageId) {
        console.error("❌ ข้อมูลใน .env ไม่ครบ (ต้องการ APP_ID, APP_SECRET, PAGE_ID)");
        return;
    }

    try {
        console.log("🛰️ sentinel-system: เริ่มกระบวนการแลกเปลี่ยนกุญแจถาวร...");

        // 1. แลกเปลี่ยนเป็น Long-lived User Token (60 วัน)
        const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortUserToken}`;
        const exchangeRes = await axios.get(exchangeUrl);
        const longUserToken = exchangeRes.data.access_token;
        console.log("✅ STEP 1: ได้รับ Long-lived User Token เรียบร้อย");

        // 2. ใช้ Long-lived User Token เพื่อขอ Page Access Token (แบบถาวร)
        const accountsUrl = `https://graph.facebook.com/v19.0/me/accounts?access_token=${longUserToken}`;
        const accountsRes = await axios.get(accountsUrl);
        const accounts = accountsRes.data.data;
        const targetPage = accounts.find(acc => acc.id === pageId);

        if (!targetPage) {
            console.error(`❌ ไม่พบเพจ ID: ${pageId} ในรายการที่คุณดูแล`);
            return;
        }

        const permanentPageToken = targetPage.access_token;
        console.log("✅ STEP 2: ได้รับ PERMANENT PAGE TOKEN สำเร็จ!");

        // 3. เขียนทับลงใน .env โดยอัตโนมัติ
        const envPath = path.join(__dirname, '.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        const newTokenLine = `FACEBOOK_PAGE_ACCESS_TOKEN=${permanentPageToken}`;
        const regex = /^FACEBOOK_PAGE_ACCESS_TOKEN=.*$/m;
        
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, newTokenLine);
        } else {
            envContent += `\n${newTokenLine}`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log("💾 STEP 3: บันทึกกุญแจถาวรลงไฟล์ .env เรียบร้อยแล้ว");
        console.log("🚀 ระบบพร้อมทำงานแบบ 24/7 โดยไม่ต้องเปลี่ยน Token อีก!");

    } catch (error) {
        console.error("❌ ERROR:", error.response ? error.response.data.error.message : error.message);
    }
}

/**
 * autoRefresh() — เรียกจากโค้ดอื่นได้โดยตรง (ไม่ต้องใช้ CLI)
 * ใช้ FACEBOOK_SHORT_TOKEN จาก .env ถ้ามี
 */
async function autoRefresh() {
    const shortToken = process.env.FACEBOOK_SHORT_TOKEN;
    if (!shortToken) {
        console.warn("[TOKEN] FACEBOOK_SHORT_TOKEN ไม่พบใน .env — ข้าม auto-refresh");
        return false;
    }
    console.log("[TOKEN] เริ่ม Auto-Refresh Facebook Token...");
    await getPermanentToken(shortToken);

    // reload token เข้า FacebookPublisher โดยไม่ต้อง restart pm2
    try {
        const fb = require('./Strategy-Engine/FacebookPublisher');
        fb._loadToken();
        fb.tokenExpired = false;
        fb.isEnabled = !!(fb.accessToken && fb.pageId);
        console.log("[TOKEN] FacebookPublisher โหลด Token ใหม่เรียบร้อย — ไม่ต้อง restart pm2");
    } catch (e) { /* silent if called standalone */ }

    return true;
}

// รับ Token จาก Argument หรือให้ผู้ใช้ใส่
const inputToken = process.argv[2];
if (!inputToken) {
    console.log("💡 วิธีใช้: node LongLivedTokenGenerator.js <SHORT_USER_TOKEN>");
    console.log("💡 หรือตั้ง FACEBOOK_SHORT_TOKEN ใน .env แล้วระบบจะ refresh อัตโนมัติ");
} else {
    getPermanentToken(inputToken);
}

module.exports = { getPermanentToken, autoRefresh };
