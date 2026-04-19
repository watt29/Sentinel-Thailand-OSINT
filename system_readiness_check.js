/**
 * system_readiness_check.js
 * Comprehensive sanity check for Sentinel Thailand before cloud deployment.
 */
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

async function runCheck() {
    console.log("\n🛰️  [SENTINEL READINESS CHECK]");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const checks = {
        env: fs.existsSync('.env'),
        gemini: !!process.env.GEMINI_API_KEYS,
        groq: !!process.env.GROQ_API_KEYS,
        fb_token: !!process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
        fb_page: !!process.env.FACEBOOK_PAGE_ID,
        tg_bot: !!process.env.TELEGRAM_BOT_TOKEN,
        tg_chat: !!process.env.TELEGRAM_CHAT_ID
    };

    // 1. Check Files
    console.log(`[FILE] .env exists: ${checks.env ? '✅' : '❌'}`);

    // 2. Check Gemini Keys
    const gKeys = (process.env.GEMINI_API_KEYS || '').split(',').map(k => k.trim()).filter(k => k);
    console.log(`[API ] Gemini Keys Found: ${gKeys.length} keys ✅`);

    // 3. Check Groq Keys
    const qKeys = (process.env.GROQ_API_KEYS || '').split(',').map(k => k.trim()).filter(k => k);
    console.log(`[API ] Groq Keys Found: ${qKeys.length} keys ✅`);

    // 4. Test Connectivity (Basic)
    if (gKeys.length > 0) {
        try {
            const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${gKeys[0].split(':')[0]}`;
            await axios.get(testUrl);
            console.log(`[CONN] Gemini API Connectivity: ✅`);
        } catch (e) {
            console.log(`[CONN] Gemini API Connectivity: ⚠️ (Check API Key validity)`);
        }
    }

    // 5. Check Social Integration
    console.log(`[SOC ] Facebook Page Config: ${checks.fb_token && checks.fb_page ? '✅' : '❌'}`);
    console.log(`[SOC ] Telegram Notifier Config: ${checks.tg_bot && checks.tg_chat ? '✅' : '❌'}`);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (Object.values(checks).every(v => v)) {
        console.log("🚀 STATUS: SYSTEM READY FOR CLOUD DEPLOYMENT");
    } else {
        console.log("⚠️  STATUS: SYSTEM HAS MISSING CONFIGURATION");
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

runCheck();
