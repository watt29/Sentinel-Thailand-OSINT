/**
 * AnalyticsEngine.js
 * Facebook Insights tracking + auto-adjust content distribution
 * เรียน AI ว่า content type ไหนได้ reach/engagement ดีที่สุด แล้วปรับ dice weights อัตโนมัติ
 */
const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const DEFAULT_WEIGHTS = {
    DEEP_INTEL: 40,
    QUICK_SHARE: 15,
    ENGAGEMENT_POST: 40,
    SYSTEM_BRANDING: 5
};

class AnalyticsEngine {
    constructor() {
        const dbPath = path.join(__dirname, '../intelligence_memory.db');
        this.db = new Database(dbPath);
        this._initTables();
        this.pageId = process.env.FACEBOOK_PAGE_ID;
        this.appId = process.env.FACEBOOK_APP_ID;
        this.appSecret = process.env.FACEBOOK_APP_SECRET;
        this._weights = { ...DEFAULT_WEIGHTS };
    }

    _initTables() {
        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS post_analytics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id TEXT UNIQUE,
                content_type TEXT,
                posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                reach INTEGER DEFAULT 0,
                impressions INTEGER DEFAULT 0,
                reactions INTEGER DEFAULT 0,
                comments INTEGER DEFAULT 0,
                shares INTEGER DEFAULT 0,
                last_checked DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS distribution_weights (
                id INTEGER PRIMARY KEY,
                deep_intel INTEGER DEFAULT 40,
                quick_share INTEGER DEFAULT 15,
                engagement_post INTEGER DEFAULT 40,
                system_branding INTEGER DEFAULT 5,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        // seed row ถ้ายังไม่มี
        const row = this.db.prepare(`SELECT id FROM distribution_weights WHERE id = 1`).get();
        if (!row) {
            this.db.prepare(`INSERT INTO distribution_weights (id, deep_intel, quick_share, engagement_post, system_branding) VALUES (1, 40, 15, 40, 5)`).run();
        }

        this._loadWeights();
    }

    _loadWeights() {
        try {
            const row = this.db.prepare(`SELECT * FROM distribution_weights WHERE id = 1`).get();
            if (row) {
                this._weights = {
                    DEEP_INTEL: row.deep_intel,
                    QUICK_SHARE: row.quick_share,
                    ENGAGEMENT_POST: row.engagement_post,
                    SYSTEM_BRANDING: row.system_branding
                };
            }
        } catch (e) { /* ใช้ default */ }
    }

    // เรียกจาก Scan-Global-News หลัง publish — บันทึก post_id ไว้ track ทีหลัง
    trackPost(postId, contentType) {
        if (!postId || postId === 'N/A') return;
        try {
            this.db.prepare(`
                INSERT OR IGNORE INTO post_analytics (post_id, content_type)
                VALUES (?, ?)
            `).run(postId, contentType);
            console.log(`   [ANALYTICS] 📊 Tracking post ${postId} (${contentType})`);
        } catch (e) { console.log(`   [ANALYTICS] track error: ${e.message}`); }
    }

    // ดึง Insights จาก Facebook API สำหรับ post ที่โพสต์ไปแล้ว
    async fetchPostInsights(postId, accessToken) {
        try {
            const metrics = 'post_impressions,post_impressions_unique,post_reactions_by_type_total,post_comments,post_shares';
            const url = `https://graph.facebook.com/v19.0/${postId}/insights?metric=${metrics}&access_token=${accessToken}`;
            const res = await axios.get(url, { timeout: 10000 });
            const data = res.data.data || [];

            const result = { reach: 0, impressions: 0, reactions: 0, comments: 0, shares: 0 };
            for (const m of data) {
                if (m.name === 'post_impressions_unique') result.reach = m.values?.[1]?.value || 0;
                if (m.name === 'post_impressions') result.impressions = m.values?.[1]?.value || 0;
                if (m.name === 'post_reactions_by_type_total') {
                    const v = m.values?.[1]?.value || {};
                    result.reactions = Object.values(v).reduce((a, b) => a + b, 0);
                }
                if (m.name === 'post_comments') result.comments = m.values?.[1]?.value || 0;
                if (m.name === 'post_shares') result.shares = m.values?.[1]?.value || 0;
            }
            return result;
        } catch (e) {
            return null;
        }
    }

    // อัปเดต metrics ของ posts ที่ยังไม่ได้ check ในช่วง 48 ชม.
    async refreshInsights(accessToken) {
        if (!accessToken) return;
        const posts = this.db.prepare(`
            SELECT post_id, content_type FROM post_analytics
            WHERE posted_at >= datetime('now', '-48 hours')
            AND last_checked <= datetime('now', '-3 hours')
            LIMIT 10
        `).all();

        if (posts.length === 0) return;
        console.log(`   [ANALYTICS] 🔄 Refreshing insights for ${posts.length} posts...`);

        for (const post of posts) {
            const insights = await this.fetchPostInsights(post.post_id, accessToken);
            if (!insights) continue;
            this.db.prepare(`
                UPDATE post_analytics SET
                    reach = ?, impressions = ?, reactions = ?,
                    comments = ?, shares = ?, last_checked = CURRENT_TIMESTAMP
                WHERE post_id = ?
            `).run(insights.reach, insights.impressions, insights.reactions,
                   insights.comments, insights.shares, post.post_id);
        }

        await this._autoAdjustWeights();
    }

    // คำนวณ engagement score เฉลี่ยต่อ content type แล้วปรับ weights
    async _autoAdjustWeights() {
        const rows = this.db.prepare(`
            SELECT content_type,
                AVG(reach) as avg_reach,
                AVG(reactions + comments * 2 + shares * 3) as avg_eng
            FROM post_analytics
            WHERE reach > 0
            AND posted_at >= datetime('now', '-7 days')
            GROUP BY content_type
        `).all();

        if (rows.length < 2) return; // ยังมีข้อมูลน้อยเกินไป

        const scores = {};
        let total = 0;
        for (const r of rows) {
            // engagement-weighted score (engagement 70%, reach 30%)
            scores[r.content_type] = (r.avg_eng * 0.7) + (r.avg_reach * 0.3);
            total += scores[r.content_type];
        }

        if (total === 0) return;

        // แปลง score เป็น weight (คงไว้ SYSTEM_BRANDING = 5 เสมอ)
        const usable = 95; // 95% แบ่งระหว่าง 3 types อื่น
        const newWeights = { SYSTEM_BRANDING: 5 };
        const types = ['DEEP_INTEL', 'QUICK_SHARE', 'ENGAGEMENT_POST'];
        const typeTotal = types.reduce((s, t) => s + (scores[t] || 0), 0);

        let allocated = 0;
        for (const t of types) {
            const raw = typeTotal > 0 ? Math.round((scores[t] || 0) / typeTotal * usable) : DEFAULT_WEIGHTS[t];
            newWeights[t] = Math.max(5, Math.min(70, raw)); // clamp 5-70%
            allocated += newWeights[t];
        }

        // normalize ให้รวม = 100
        const diff = 100 - allocated - 5;
        newWeights['ENGAGEMENT_POST'] += diff;

        this.db.prepare(`
            UPDATE distribution_weights SET
                deep_intel = ?, quick_share = ?, engagement_post = ?, system_branding = 5,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `).run(newWeights.DEEP_INTEL, newWeights.QUICK_SHARE, newWeights.ENGAGEMENT_POST);

        this._weights = newWeights;
        console.log(`   [ANALYTICS] 🧠 Auto-adjusted weights: DEEP=${newWeights.DEEP_INTEL}% | QUICK=${newWeights.QUICK_SHARE}% | ENG=${newWeights.ENGAGEMENT_POST}%`);

        // แจ้ง Telegram ถ้ามี shift ใหญ่
        const shift = Math.abs(newWeights.ENGAGEMENT_POST - DEFAULT_WEIGHTS.ENGAGEMENT_POST);
        if (shift >= 10) {
            try {
                const notifier = require('./TelegramNotifier');
                await notifier.sendMessage(
                    `🧠 <b>[ANALYTICS] Auto Weight Adjustment</b>\n` +
                    `━━━━━━━━━━━━━━━━━━\n` +
                    `📊 ข้อมูลจาก 7 วันที่ผ่านมา:\n` +
                    `🔵 DEEP_INTEL: <b>${newWeights.DEEP_INTEL}%</b>\n` +
                    `⚡ QUICK_SHARE: <b>${newWeights.QUICK_SHARE}%</b>\n` +
                    `💬 ENGAGEMENT: <b>${newWeights.ENGAGEMENT_POST}%</b>\n` +
                    `🔧 BRANDING: <b>5%</b>\n` +
                    `━━━━━━━━━━━━━━━━━━\n` +
                    `<i>ปรับตาม Engagement Score จริงของเพจ</i>`
                );
            } catch (e) { /* silent */ }
        }
    }

    // คืน content type ตาม learned weights — เรียกจาก AIScanner
    pickContentType() {
        this._loadWeights();
        const dice = Math.floor(Math.random() * 100) + 1;
        const w = this._weights;
        if (dice <= w.DEEP_INTEL) return 'DEEP_INTEL';
        if (dice <= w.DEEP_INTEL + w.QUICK_SHARE) return 'QUICK_SHARE';
        if (dice <= w.DEEP_INTEL + w.QUICK_SHARE + w.ENGAGEMENT_POST) return 'ENGAGEMENT_POST';
        return 'SYSTEM_BRANDING';
    }

    // สรุป performance ย้อนหลัง 7 วัน
    getWeeklySummary() {
        return this.db.prepare(`
            SELECT content_type,
                COUNT(*) as total_posts,
                ROUND(AVG(reach)) as avg_reach,
                ROUND(AVG(reactions + comments + shares)) as avg_eng
            FROM post_analytics
            WHERE posted_at >= datetime('now', '-7 days')
            GROUP BY content_type
            ORDER BY avg_eng DESC
        `).all();
    }
}

module.exports = new AnalyticsEngine();
