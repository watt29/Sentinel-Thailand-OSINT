/**
 * Scan-Global-News.js [SOVEREIGN GRAND MASTER EDITION]
 * ระบบควบคุมการกระจายข่าวกรองอัตโนมัติ (Autonomous Governance)
 * Telegram: แจ้งเฉพาะ error + analytics report ทุก 6 ชม.
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

const TOKEN_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TOKEN_WARN_DAYS = 7;

// Peak hours ไทย (UTC+7)
const PEAK_HOURS_TH = [7, 8, 12, 13, 15, 16, 17, 20, 21, 22];

function getNextRunDelayMs() {
    const now = new Date();
    const thHour = (now.getUTCHours() + 7) % 24;
    const isPeak = PEAK_HOURS_TH.includes(thHour);
    if (isPeak) {
        console.log(`   [SCHEDULER] 🔥 PEAK HOUR (${thHour}:00 น.) — โพสต์ทุก 60 นาที`);
        return 60 * 60 * 1000;
    } else {
        console.log(`   [SCHEDULER] 🌙 OFF-PEAK (${thHour}:00 น.) — โพสต์ทุก 3 ชั่วโมง`);
        return 3 * 60 * 60 * 1000;
    }
}

// --- Analytics Report ทุก 6 ชม. ---
async function sendAnalyticsReport() {
    if (!analytics) return;
    try {
        const token = fbPublisher.accessToken;
        if (token) await analytics.refreshInsights(token);

        const summary = analytics.getWeeklySummary();
        if (!summary || summary.length === 0) return;

        const rows = summary.map(r =>
            `${r.content_type}: ${r.total_posts} โพสต์ | Reach ~${r.avg_reach} | Eng ~${r.avg_eng}`
        ).join('\n');

        const w = analytics._weights || {};
        await notifier.sendMessage(
            `📊 <b>[ANALYTICS REPORT] 6-Hour Summary</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `<b>7 วันที่ผ่านมา:</b>\n<code>${rows}</code>\n\n` +
            `<b>⚖️ Current Weights:</b>\n` +
            `DEEP_INTEL: ${w.DEEP_INTEL}% | QUICK: ${w.QUICK_SHARE}% | ENG: ${w.ENGAGEMENT_POST}%`
        );
    } catch (e) {
        console.log(`   [ANALYTICS] Report error: ${e.message}`);
    }
}

// Refresh + report ทุก 6 ชม.
setInterval(sendAnalyticsReport, 6 * 60 * 60 * 1000);

// --- Token Health (แจ้งเฉพาะ error) ---
async function checkFacebookTokenHealth() {
    const health = await fbPublisher.checkTokenHealth();
    if (!health) return;

    if (health.isPermanent) {
        console.log(`   [TOKEN] Facebook Token เป็นแบบถาวร (Permanent Page Token) ✅`);
        return;
    }

    if (!health.valid) {
        await notifier.sendMessage(`🔑 <b>[TOKEN ERROR] Facebook Token ไม่ถูกต้อง!</b>\nกำลังลอง Auto-Refresh...`);
        const refreshed = await tokenManager.autoRefresh();
        if (!refreshed) {
            await notifier.sendMessage(
                `❌ <b>Auto-Refresh ล้มเหลว</b>\n` +
                `กรุณารัน: <code>node LongLivedTokenGenerator.js &lt;SHORT_TOKEN&gt;</code>`
            );
        }
        return;
    }

    if (health.daysLeft !== null && health.daysLeft <= TOKEN_WARN_DAYS) {
        if (health.daysLeft <= 0) {
            await tokenManager.autoRefresh();
        } else {
            await notifier.sendMessage(
                `⏳ <b>[TOKEN ALERT] Token ใกล้หมดอายุ — เหลือ ${health.daysLeft} วัน</b>\n` +
                `หมดอายุ: ${health.expiresAt?.toLocaleDateString('th-TH')}\n` +
                `ตั้ง <code>FACEBOOK_SHORT_TOKEN=xxx</code> ใน .env`
            );
        }
    } else {
        console.log(`   [TOKEN] Facebook Token ยังดีอยู่ (เหลือ ${health.daysLeft} วัน) ✅`);
    }
}

setTimeout(async () => {
    await checkFacebookTokenHealth();
    setInterval(checkFacebookTokenHealth, TOKEN_CHECK_INTERVAL_MS);
}, 10000);

async function runGovernanceBriefing() {
    console.log(`\n   >>> GOVERNANCE CYCLE START — ${new Date().toLocaleTimeString()}`);

    try {
        const result = await aiScanner.analyzeGlobalSentiment();

        if (result.status === "Error") {
            console.log(`   [API_FAILURE] Cooling down for 2 mins...`);
            await notifier.sendMessage(`⚠️ <b>[ERROR] API Failure</b> — cooling down 2 mins`);
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
                    return overlap.length > 5;
                });
                if (!isRedundant) { finalSelection = can; break; }
            }
        }

        if (!finalSelection) {
            console.log(`   [INFO] Standby. No high-fidelity news detected.`);
            setTimeout(runGovernanceBriefing, getNextRunDelayMs());
            return;
        }

        const score = parseInt(finalSelection.global_risk_score || 50);
        const meter = "■".repeat(Math.round(score/5)) + "□".repeat(20 - Math.round(score/5));
        console.log(`   [ RISK ] : [${meter}] (${score}%)`);
        console.log(`   [ STATUS]: ${finalSelection.status}`);
        console.log(`   [ SOCIAL]: Preparing Facebook Post...`);

        // --- Facebook Execution ---
        if (fbPublisher.isEnabled) {
            const draft = finalSelection.facebook_draft || '';
            const hashtagCount = (draft.match(/#\S+/g) || []).length;
            if (hashtagCount < 3) {
                console.log(`   [SKIP] ไม่มี Hashtag เพียงพอ (${hashtagCount}) — ข้ามรอบนี้`);
                setTimeout(runGovernanceBriefing, getNextRunDelayMs());
                return;
            }

            const displayImg = finalSelection.original_news?.image || '';
            const cType = finalSelection.thai_pulse?.includes('ENGAGEMENT') ? 'ENGAGEMENT_POST' :
                          finalSelection.thai_pulse?.includes('QUICK') ? 'QUICK_SHARE' : 'DEEP_INTEL';

            const fbRes = await fbPublisher.postPhotoWithCaption(displayImg, finalSelection.facebook_draft, {
                title: finalSelection.status,
                contentType: cType,
                riskScore: score,
                draft: finalSelection.facebook_draft
            });

            if (fbRes && fbRes.success) {
                console.log(`   [SOCIAL] ✅ Posted! ID: ${fbRes.postId} (${cType})`);
                if (analytics && fbRes.postId) analytics.trackPost(fbRes.postId, cType);
            } else if (fbRes?.error === 'NO_IMAGE' || fbRes?.error === 'IMAGE_BLOCKED') {
                console.log(`   [SKIP] No image — retrying immediately with next candidate`);
                setTimeout(runGovernanceBriefing, 3000);
                return;
            } else {
                const errMsg = fbRes?.error || 'Unknown error';
                console.log(`   [SOCIAL] ❌ Post failed: ${errMsg}`);
                await notifier.sendMessage(
                    `❌ <b>[POST FAILED]</b>\n` +
                    `ข่าว: ${notifier._escapeHTML(finalSelection.status.substring(0, 80))}\n` +
                    `Error: <code>${notifier._escapeHTML(errMsg)}</code>`
                );
            }
        }

        storage.saveIntel(finalSelection);
        await sheetLogger.logIntel(finalSelection);

        const nextDelay = getNextRunDelayMs();
        let timeLeft = nextDelay;
        const countdownInterval = setInterval(() => {
            timeLeft -= 60000;
            if (timeLeft > 0) {
                console.log(`   [HEARTBEAT] Next post in: ${Math.round(timeLeft/60000)} mins...`);
            } else {
                clearInterval(countdownInterval);
            }
        }, 60000);

        setTimeout(runGovernanceBriefing, nextDelay);

    } catch (err) {
        console.error(`   [SYSTEM_CRITICAL] ${err.message}`);
        await notifier.sendMessage(`🚨 <b>[SYSTEM CRITICAL]</b>\n<code>${notifier._escapeHTML(err.message)}</code>`);
        setTimeout(runGovernanceBriefing, 60 * 60 * 1000);
    }
}

runGovernanceBriefing();
