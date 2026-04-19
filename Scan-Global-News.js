/**
 * Scan-Global-News.js [SOVEREIGN GRAND MASTER EDITION]
 * ระบบควบคุมการกระจายข่าวกรองอัตโนมัติ (Autonomous Governance)
 */
const aiScanner = require('./Strategy-Engine/AIScanner');
const fbPublisher = require('./Strategy-Engine/FacebookPublisher');
const notifier = require('./Strategy-Engine/TelegramNotifier');
const storage = require('./Strategy-Engine/IntelligenceStorage');
const sheetLogger = require('./Strategy-Engine/SheetLogger');
const tokenManager = require('./LongLivedTokenGenerator');
require('dotenv').config();

let analytics;
try { analytics = require('./Strategy-Engine/AnalyticsEngine'); } catch (e) { analytics = null; }

// Refresh Facebook Insights ทุก 6 ชม.
if (analytics) {
    setInterval(async () => {
        const token = fbPublisher.accessToken;
        if (token) await analytics.refreshInsights(token);
    }, 6 * 60 * 60 * 1000);
}

const TOKEN_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TOKEN_WARN_DAYS = 7;

// Peak hours ไทย (UTC+7) — โพสต์ทุก 60 นาที = 10 โพสต์
const PEAK_HOURS_TH = [7, 8, 12, 13, 15, 16, 17, 20, 21, 22];
// Off-peak — โพสต์ทุก 3 ชั่วโมง = ~5 โพสต์ รวม ~15 โพสต์/วัน

function getNextRunDelayMs() {
    const now = new Date();
    const thHour = (now.getUTCHours() + 7) % 24;
    const isPeak = PEAK_HOURS_TH.includes(thHour);

    if (isPeak) {
        console.log(`   [SCHEDULER] 🔥 PEAK HOUR (${thHour}:00 น.) — โพสต์ทุก 60 นาที`);
        return 60 * 60 * 1000; // 60 นาที
    } else {
        console.log(`   [SCHEDULER] 🌙 OFF-PEAK (${thHour}:00 น.) — โพสต์ทุก 3 ชั่วโมง`);
        return 3 * 60 * 60 * 1000; // 3 ชั่วโมง
    }
}

async function checkFacebookTokenHealth() {
    const health = await fbPublisher.checkTokenHealth();
    if (!health) return;

    if (health.isPermanent) {
        console.log(`   [TOKEN] Facebook Token เป็นแบบถาวร (Permanent Page Token) ✅`);
        return;
    }

    if (!health.valid) {
        // token ไม่ valid — ลอง auto-refresh ด้วย FACEBOOK_SHORT_TOKEN
        await notifier.sendMessage(`🔑 <b>[TOKEN HEALTH] Facebook Token ไม่ถูกต้อง!</b>\nกำลังลอง Auto-Refresh...`);
        const refreshed = await tokenManager.autoRefresh();
        if (!refreshed) {
            await notifier.sendMessage(
                `❌ <b>Auto-Refresh ล้มเหลว</b>: ไม่พบ FACEBOOK_SHORT_TOKEN ใน .env\n` +
                `กรุณารัน: <code>node LongLivedTokenGenerator.js &lt;SHORT_TOKEN&gt;</code>`
            );
        }
        return;
    }

    if (health.daysLeft !== null && health.daysLeft <= TOKEN_WARN_DAYS) {
        if (health.daysLeft <= 0) {
            // หมดอายุแล้ว ลอง auto-refresh
            await tokenManager.autoRefresh();
        } else {
            // แจ้งเตือนล่วงหน้า
            await notifier.sendMessage(
                `⏳ <b>[TOKEN ALERT] Facebook Token ใกล้หมดอายุ!</b>\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `เหลืออีก <b>${health.daysLeft} วัน</b> (หมดอายุ: ${health.expiresAt?.toLocaleDateString('th-TH')})\n\n` +
                `<b>เตรียมการ:</b>\n` +
                `1. ไปที่ Facebook Developers → รับ Short-lived Token ใหม่\n` +
                `2. ตั้ง <code>FACEBOOK_SHORT_TOKEN=xxx</code> ใน .env\n` +
                `3. ระบบจะ Auto-Refresh อัตโนมัติเมื่อถึงเวลา`
            );
        }
    } else {
        console.log(`   [TOKEN] Facebook Token ยังดีอยู่ (เหลือ ${health.daysLeft} วัน) ✅`);
    }
}

// รันตรวจ token ทันทีตอนเริ่ม และทุก 24 ชั่วโมง
setTimeout(async () => {
    await checkFacebookTokenHealth();
    setInterval(checkFacebookTokenHealth, TOKEN_CHECK_INTERVAL_MS);
}, 10000); // รอ 10 วิหลังจาก startup

async function runGovernanceBriefing() {
    console.log(`\n   >>> SOVEREIGN ENGINE STABILITY ARMORED. Starting...`);
    console.log(`   ╔══════════════════════════════════════════╗`);
    console.log(`   ║     GOVERNANCE COMMAND CENTER [ACTIVE]    ║`);
    console.log(`   ║     TIME: ${new Date().toLocaleTimeString()}  |  HEALTH: MONITORING   ║`);
    console.log(`   ╚══════════════════════════════════════════╝\n`);

    try {
        const result = await aiScanner.analyzeGlobalSentiment();
        
        if (result.status === "Error") {
            console.log(`   [API_FAILURE] Cooling down for 2 mins...`);
            setTimeout(runGovernanceBriefing, 120000); 
            return;
        }

        const reportedEventHistory = storage.getReportedHashes();
        let finalSelection = null;

        if (result.candidates && Array.isArray(result.candidates)) {
            for (const can of result.candidates) {
                const currentKeywords = (can.status + " " + can.facebook_draft).toLowerCase().split(/[ ,.-]+/).filter(w => w.length > 3);
                const isRedundant = reportedEventHistory.some(history => {
                    const historyWords = history.toLowerCase().split(/[ ,.-]+/);
                    const overlap = currentKeywords.filter(word => historyWords.includes(word));
                    return overlap.length > 5; // Deduplication logic
                });

                if (!isRedundant) {
                    finalSelection = can;
                    break;
                }
            }
        }

        if (!finalSelection) {
            console.log(`   [INFO] Standby. No high-fidelity news detected.`);
            setTimeout(runGovernanceBriefing, getNextRunDelayMs());
            return;
        }

        // --- Execute Governance Visuals ---
        const score = parseInt(finalSelection.global_risk_score || 50);
        const meter = "■".repeat(Math.round(score/5)) + "□".repeat(20 - Math.round(score/5));
        
        console.log(`   [ RISK ] : [${meter}] (${score}%)`);
        console.log(`   [ STATUS]: ${finalSelection.status}`);
        console.log(`   [ SOCIAL]: Preparing Facebook Grand Master Post...`);

        // --- Telegram Briefing ---
        const prefix = (score >= 80) ? "🚨 [CRITICAL] " : "🌍 ";
        const MAX_TG = 3800; // Telegram limit 4096 — เผื่อ buffer
        const draftPreview = notifier._escapeHTML(finalSelection.facebook_draft || 'No draft found.');
        const pulsePreview = notifier._escapeHTML(finalSelection.thai_pulse || 'Analyzing Global Impact...');
        const header = `<b>${prefix}INTEL BRIEFING: ${notifier._escapeHTML(finalSelection.status)}</b>\n` +
                       `━━━━━━━━━━━━━━━━━━\n` +
                       `RISK LVL: ${score}% | CONF: 85%\n` +
                       `🛡️ <b>PROPAGANDA RISK:</b> LOW\n` +
                       `━━━━━━━━━━━━━━━━━━\n\n` +
                       `🌏 <b>SENTINEL THAI PULSE:</b>\n${pulsePreview}\n\n` +
                       `📱 <b>SENTINEL BROADCAST DRAFT:</b>\n`;
        const remaining = MAX_TG - header.length;
        const telMsg = header + (draftPreview.length > remaining ? draftPreview.substring(0, remaining) + '...' : draftPreview);

        await notifier.sendMessage(telMsg);

        // --- Facebook Execution ---
        if (fbPublisher.isEnabled) {
            const draft = finalSelection.facebook_draft || '';
            const hashtagCount = (draft.match(/#\S+/g) || []).length;
            if (hashtagCount < 3) {
                console.log(`   [SKIP] Mission aborted: ไม่มี Hashtag ในโพสต์ (พบ ${hashtagCount}) — ข้ามเพื่อรักษาคุณภาพเพจ`);
                await notifier.sendMessage(`⚠️ <b>SKIP</b>: โพสต์ไม่มี Hashtag เพียงพอ (${hashtagCount}/8) — ข้ามรอบนี้`);
                setTimeout(runGovernanceBriefing, getNextRunDelayMs());
                return;
            }

            const displayImg = finalSelection.original_news?.image || '';
            const imgType = displayImg ? "Original News Asset" : "Generated Text Card";

            const fbRes = await fbPublisher.postPhotoWithCaption(displayImg, finalSelection.facebook_draft, {
                title: finalSelection.status,
                contentType: finalSelection.thai_pulse?.includes('ENGAGEMENT') ? 'ENGAGEMENT_POST' :
                             finalSelection.thai_pulse?.includes('QUICK') ? 'QUICK_SHARE' : 'DEEP_INTEL',
                riskScore: score,
                draft: finalSelection.facebook_draft
            });
            
            // Audit Report
            const fbId = fbRes && fbRes.postId ? fbRes.postId : "N/A";
            const fbStat = fbRes && fbRes.success ? "✅ SUCCESS" : "❌ FAILED";
            
            const auditMsg = `<b>🛡️ [SOCIAL SENTINEL AUDIT]</b>\n` +
                             `━━━━━━━━━━━━━━━━━━\n` +
                             `🚦 <b>STATUS:</b> ${fbStat}\n` +
                             `🆔 <b>ID:</b> <code>${fbId}</code>\n` +
                             `📊 <b>STYLE:</b> Sovereign Long-Form\n` +
                             `🖼️ <b>TYPE:</b> ${imgType}\n` +
                             `━━━━━━━━━━━━━━━━━━\n` +
                             `📝 <i>Audit complete. Governance verified.</i>`;
            
            await notifier.sendMessage(auditMsg);

            // Track post สำหรับ Analytics
            if (analytics && fbRes?.postId && fbRes.postId !== 'N/A') {
                const cType = finalSelection.thai_pulse?.includes('ENGAGEMENT') ? 'ENGAGEMENT_POST' :
                              finalSelection.thai_pulse?.includes('QUICK') ? 'QUICK_SHARE' : 'DEEP_INTEL';
                analytics.trackPost(fbRes.postId, cType);
            }
        }

        storage.saveIntel(finalSelection);
        await sheetLogger.logIntel(finalSelection);

        const nextDelay = getNextRunDelayMs();
        let timeLeft = nextDelay;
        const countdownInterval = setInterval(() => {
            timeLeft -= 60000;
            if (timeLeft > 0) {
                console.log(`   [HEARTBEAT] Next peak-hour post in: ${Math.round(timeLeft/60000)} mins...`);
            } else {
                clearInterval(countdownInterval);
            }
        }, 60000);

        setTimeout(runGovernanceBriefing, nextDelay);

    } catch (err) {
        console.error(`   [SYSTEM_CRITICAL] Error in Governance Loop: ${err.message}`);
        setTimeout(runGovernanceBriefing, 60 * 60 * 1000); // retry ชั่วโมงถัดไป
    }
}

runGovernanceBriefing();
