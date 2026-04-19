const axios = require('axios');
require('dotenv').config();

class SheetLogger {
    constructor() {
        this.appUrl = (process.env.GOOGLE_SHEET_APP_URL || "").trim();
    }

    async _post(payload) {
        if (!this.appUrl) return;
        try {
            const res = await axios.post(this.appUrl, payload, {
                timeout: 10000,
                headers: { 'Content-Type': 'text/plain' }
            });
            const resText = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data);
            return resText.includes("SUCCESS") || res.status === 200;
        } catch (e) {
            console.log(`   [SHEET_LOG] ❌ Error: ${e.message}`);
            return false;
        }
    }

    async logIntel(data) {
        if (!this.appUrl) {
            console.log(`   [SHEET_LOG] ⚠️ Skipped: No Google Sheet URL configured.`);
            return;
        }
        const payload = {
            action: "log_intel",
            title: data.status || "No Title",
            type: data.thai_pulse || "DEEP_INTEL",
            image: data.original_news?.image || "No Image",
            content: data.facebook_draft || "No Draft"
        };
        const ok = await this._post(payload);
        if (ok) console.log(`   [SHEET_LOG] ✅ Intel archived to Google Sheet.`);
        else console.log(`   [SHEET_LOG] ⚠️ Sheet log may have failed.`);
    }

    async logAnalytics(postId, contentType, insights = {}) {
        if (!this.appUrl || !postId) return;
        const payload = {
            action: "log_analytics",
            post_id: postId,
            content_type: contentType,
            reach: insights.reach || 0,
            impressions: insights.impressions || 0,
            reactions: insights.reactions || 0,
            comments: insights.comments || 0,
            shares: insights.shares || 0
        };
        const ok = await this._post(payload);
        if (ok) console.log(`   [SHEET_LOG] 📊 Analytics logged for ${postId}`);
    }
}

module.exports = new SheetLogger();
