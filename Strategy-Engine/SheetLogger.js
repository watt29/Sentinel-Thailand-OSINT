const axios = require('axios');
require('dotenv').config();

class SheetLogger {
    constructor() {
        this.appUrl = (process.env.GOOGLE_SHEET_APP_URL || "").trim();
    }

    async logIntel(data) {
        if (!this.appUrl) {
            console.log(`   [SHEET_LOG] ⚠️ Skipped: No Google Sheet URL configured.`);
            return;
        }

        try {
            const payload = {
                title: data.status || "No Title",
                type: data.thai_pulse || "DEEP_INTEL",
                image: data.original_news?.image || "No Image",
                content: data.facebook_draft || "No Draft"
            };

            const res = await axios.post(this.appUrl, payload, {
                timeout: 10000,
                headers: { 'Content-Type': 'text/plain' } // GAS works best with text/plain JSON
            });

            if (res.data === "SUCCESS") {
                console.log(`   [SHEET_LOG] ✅ Intelligence archived to Google Sheet.`);
            } else {
                console.log(`   [SHEET_LOG] ⚠️ Warning: ${res.data}`);
            }
        } catch (e) {
            console.log(`   [SHEET_LOG] ❌ Error: ${e.message}`);
        }
    }
}

module.exports = new SheetLogger();
