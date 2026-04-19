const AI = require('./AIProvider');
const logger = require('./Logger');

/**
 * AIBrain - The Sovereign Intelligence of Paperclip Trading.
 * Specialized in market logic, risk assessment, and technical analysis.
 */
class AIBrain {
    /**
     * วิเคราะห์เทรนด์ตลาดและสุ่มหัวข้อการสแกนที่ฉลาดที่สุด
     * @returns {Promise<string>}
     */
    async generateScoutingKeywords() {
        const prompt = `System: You are a Market Sentiment Specialist.
Task: Generate 1 trending cryptocurrency pair or technical setup keyword.
Constraints: English language, max 2 words, high volatility/interest.
Output: Just the keyword string. (e.g. "BTC/USDT Breakout", "Solana Solstice")`;

        try {
            return await AI.call(prompt, { tier: 'fast' });
        } catch (e) {
            const backupKeys = ['BTC Breakout', 'ETH Consolidation', 'SOL Support', 'Altcoin Season'];
            const fallback = backupKeys[Math.floor(Math.random() * backupKeys.length)];
            logger.warn({ event: 'ai_fallback_triggered', reason: 'High demand/Service unavailable', using: fallback });
            return fallback;
        }
    }

    /**
     * ตัดสินใจว่า Setup นี้ "น่าเข้า" หรือไม่
     * @param {object} signalData 
     * @returns {Promise<object>}
     */
    async evaluateTradeSignal(signalData) {
        const prompt = `Analyze this trade setup: ${JSON.stringify(signalData)}\nReturn JSON response: {"decision": "LONG|SHORT|WAIT", "score": 0-100, "reason": "Short logic"}`;

        try {
            const response = await AI.call(prompt, { tier: 'high' });
            const match = response.match(/\{.*?\}/s);
            return match ? JSON.parse(match[0]) : { decision: 'WAIT' };
        } catch (e) {
            return { decision: 'WAIT' };
        }
    }

    /**
     * แปลงคำสั่งเสียง/ข้อความให้เป็น Logic
     * @param {string} userInput 
     */
    async parseCommand(userInput) {
        const prompt = `In: "${userInput}". Out JSON: {"act":"SCAN|STATUS|TRADE|REPLY","val":"query"}`;
        try {
            const response = await AI.call(prompt, { tier: 'balanced' });
            const match = response.match(/\{.*?\}/s);
            if (match) {
                const res = JSON.parse(match[0]);
                return { action: res.act, val: res.val };
            }
            return { action: 'UNKNOWN' };
        } catch (e) {
            return { action: 'UNKNOWN' };
        }
    }

    async callAIBrain(prompt, tier = 'balanced') {
        return await AI.call(prompt, { tier });
    }
}

module.exports = new AIBrain();
