/**
 * main.js - PAPERCLIP AGENTIC TRADING SYSTEM [ENTERPRISE V1]
 * Automated Futures Trading & Portfolio Intelligence.
 */
require('dotenv').config({ override: true });
const path = require('path');
const logger = require('./System-Functions/Logger');
const db = require('./System-Functions/Database');
const express = require('express'); 
const LineProvider = require('./System-Functions/LineProvider'); 
const FlexBuilder = require('./System-Functions/FlexBuilder');
const AIScanner = require('./Strategy-Engine/AIScanner');

// 🏗️ System Registry & Server Init
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

async function bootstrap() {
    logger.info({ event: 'system_bootstrap', mode: 'TRADING_AGENTIC' });

    try {
        // 0. Deep Audit Gemini Keys
        const geminiKeys = (process.env.GEMINI_API_KEYS || '').split(',');
        if (geminiKeys.length === 0 || !geminiKeys[0]) {
            logger.error("SYSTEM CANNOT START: No valid Gemini API keys found. Please check .env");
            process.exit(1);
        }

        console.log("\x1b[32m[SYSTEM] PAPERCLIP AI: 100% TRADING AGENTIC MODE ACTIVE 🤖📊\x1b[0m");

    } catch (e) {
        logger.error({ event: 'system_crash', error: e.message });
    }
}

// 🚀 Bootstrap System
bootstrap();

// --- REST & Webhook API Server ---
app.listen(PORT, () => {
    logger.info(`Paperclip Intelligence Server running on port ${PORT}`);
});

// Webhook for LINE & Automation
app.post('/webhook', LineProvider.middleware, async (req, res) => {
    try {
        const events = req.body.events;
        await Promise.all(events.map(async (event) => {
            if (event.type === 'message' && event.message.type === 'text') {
                const text = event.message.text.toLowerCase();
                
                // 📊 Status Command
                if (text === 'status' || text === 'เช็คระบบ') {
                    const stats = {
                        activeKeys: (process.env.GEMINI_API_KEYS || '').split(',').length,
                        missions: db.getDailyStats().missions || 0,
                        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                        autoScout: true
                    };
                    return await LineProvider.reply(event.replyToken, [FlexBuilder.buildStatusBoard(stats)]);
                }
                
                if (text.includes("วิเคราะห์ตลาด")) {
                    await LineProvider.reply(event.replyToken, [{ type: 'text', text: "รับทราบครับ! กำลังเรียก Gemini AI วิเคราะห์ทิศทางตลาดให้สักครู่นะครับ ⚡🤖" }]);
                    const result = await AIScanner.analyzeMarket('BTCUSDT');
                    const reply = `📢 ผลวิเคราะห์ [BTC/USDT]:\n- Sentiment: ${result.sentiment}\n- Risk: ${result.risk_level}\n- คำแนะนำ: ${result.advice}`;
                    await LineProvider.reply(event.replyToken, [{ type: 'text', text: reply }]);
                    return;
                }

                if (text.startsWith("approve ")) {
                    const id = text.split(" ")[1];
                    const suggestionEngine = require('./Strategy-Engine/AISuggestionEngine');
                    const success = await suggestionEngine.applyApproval(id);
                    const msg = success ? `✅ อนุมัติคำขอ #${id} เรียบร้อยแล้ว! บอทกำลังดำเนินการปรับกลยุทธ์...` : `❌ ไม่พบคำขอหมายเลข #${id} หรือถูกจัดการไปแล้วครับ`;
                    await LineProvider.reply(event.replyToken, [{ type: 'text', text: msg }]);
                    return;
                }

                await LineProvider.reply(event.replyToken, [{ type: 'text', text: "ระบบ Paperclip AI Trading พร้อมรับคำสั่งครับ! พิมพ์ 'เช็คระบบ' เพื่อดูสถานะ หรือ 'วิเคราะห์ตลาด' เพื่อประเมินความเสี่ยงครับ" }]);
            }
        }));
        res.status(200).send('OK');
    } catch (err) {
        res.status(500).end();
    }
});
