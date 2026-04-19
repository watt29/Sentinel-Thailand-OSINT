const https = require('https');
const logger = require('./Logger');

/**
 * AIProvider Class: Multi-Model Gateway (Gemini & Groq).
 * Supports Google AI Studio (Free Tier 2026) & Groq LPU.
 */
class AIProvider {
    constructor() {
        // Load Groq Keys
        this.groqKeys = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '').split(',').filter(Boolean);
        this.groqIndex = 0;

        // Load Gemini Keys (From Google AI Studio)
        this.geminiKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',').filter(Boolean);
        this.geminiIndex = 0;

        this.maxRetries = 3;
        this.usageTrack = { tokens: 0, calls: 0, errors: 0 };
        
        // 🛡️ CIRCUIT BREAKER STATE
        this.circuitOpen = false;
        this.consecutiveErrors = 0;
        this.circuitResetTime = 0;
    }

    /**
     * @param {string} prompt 
     * @param {object} options 
     */
    async call(prompt, options = {}) {
        if (this.circuitOpen && Date.now() < this.circuitResetTime) {
            throw new Error("CIRCUIT_OPEN: AI service temporarily offline.");
        }

        // ⚡ 2026 BATTLE-TESTED CLUSTER: ใช้รุ่นที่เสถียรที่สุดในปีนี้
        let fallbackQueue = [
            'gemini-flash-latest', // ✅ Verified working in 2026
            'gemini-pro-latest',
            'gemini-1.5-flash-latest'
        ];

        // 🎯 Tier Optimization: เลือกจุดเริ่มต้นตามความเหมาะสมของงาน
        if (options.tier === 'fast') {
            fallbackQueue = ['gemini-flash-latest', 'gemini-1.5-flash-8b-latest'];
        } else if (options.tier === 'balanced') {
            fallbackQueue = ['gemini-pro-latest', 'gemini-flash-latest'];
        }
        
        let lastError = null;

        for (const selectedModel of fallbackQueue) {
            // 🔄 ROUND-ROBIN: สลับคีย์ไปตัวถัดไปทุกครั้งที่เรียก (Proactive Rotation) เพื่อกระจาย Load
            this.geminiIndex = (this.geminiIndex + 1) % this.geminiKeys.length;

            for (let k = 0; k < this.geminiKeys.length; k++) {
                const currentKeyIndex = (this.geminiIndex + k) % this.geminiKeys.length;
                const key = this.geminiKeys[currentKeyIndex];

                try {
                    logger.info(`AIProvider: Attempting request with Brain #${currentKeyIndex + 1}/${this.geminiKeys.length}`);
                    const response = await this._requestGemini(prompt, { ...options, model: selectedModel, keyIndex: currentKeyIndex });
                    this.consecutiveErrors = 0;
                    
                    // 🔄 Backward Compatibility: หากเรียกแบบปกติ (ไม่มี tools) ให้คืนค่าเป็น string
                    if (typeof response === 'object' && response.type === 'text' && !options.full_response) {
                        return response.content;
                    }
                    return response;
                } catch (err) {
                    lastError = err;

                    // 🚦 0. ถ้า Error รุนแรง (401/403 - คีย์ผิด/โดนแบน) -> ลบออกถาวรใน Session นี้
                    if (err.status === 401 || err.status === 403) {
                        logger.error(`AIProvider: [${err.status}] ❌ คีย์ลำดับที่ ${currentKeyIndex} พัง! กำลังตัดออกจากสารบบ...`);
                        this.geminiKeys.splice(currentKeyIndex, 1);
                        if (this.geminiKeys.length === 0) throw new Error("ALL_KEYS_DEAD");
                        continue; // ลองคีย์ถัดไปใน Index ใหม่
                    }

                    // 🚦 1. ถ้าโควตาเต็ม (429) -> ข้ามไปตัวถัดไปทันที
                    if (err.status === 429) {
                        const backoffTime = Math.floor(Math.random() * 1000) + 500;
                        logger.warn(`AIProvider: [429] 🛑 คีย์ลำดับที่ ${currentKeyIndex} เต็ม! กำลังข้ามไปตัวถัดไป...`);
                        await new Promise(r => setTimeout(r, backoffTime));
                        continue; 
                    }

                    // 🚦 2. ถ้าเซิร์ฟเวอร์ล่ม (503/500) -> ลองโมเดลถัดไป
                    if (err.status === 503 || err.status === 500) {
                        logger.error(`AIProvider: [${err.status}] ⚠️ โมเดล ${selectedModel} มีปัญหา กำลังสลับโมเดล...`);
                        break; // ออกจากลูปคีย์ เพื่อไปโมเดลถัดไป
                    }

                    throw err; // Error อื่นๆ (400, 401) ให้หยุด
                }
            }
        }

        // 🛰️ แผนสำรองสุดท้ายหากหมุนคีย์จนครบแล้วยังไม่ได้
        if (process.env.RELAY_API_KEY) {
            logger.info("AIProvider: ALL KEYS & MODELS EXHAUSTED. Activating RELAY PROXY...");
            return await this._requestRelay(prompt, options);
        }

        throw lastError;
    }

    /**
     * 🛰️ RELAY REQUEST: สำหรับเชื่อมต่อผ่าน APIYI / laozhang.ai
     */
    _requestRelay(prompt, options) {
        return new Promise((resolve, reject) => {
            const body = JSON.stringify({
                model: options.model || "gemini-1.5-flash",
                messages: [{ role: "user", content: prompt }]
            });
            const req = https.request({
                hostname: process.env.RELAY_BASE_URL || 'api.apiyi.com',
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RELAY_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }, (res) => {
                let data = '';
                res.on('data', d => data += d);
                res.on('end', () => res.statusCode < 400 ? resolve(JSON.parse(data).choices[0].message.content) : reject(new Error("Relay Fail")));
            });
            req.write(body);
            req.end();
        });
    }

    _requestGemini(prompt, options) {
        return new Promise((resolve, reject) => {
            const key = this.geminiKeys[options.keyIndex || this.geminiIndex];
            const model = options.model || 'gemini-2.0-flash';
            
            const contents = options.history || [];
            if (prompt) {
                const userPart = { text: prompt };
                if (options.image) {
                    contents.push({
                        role: 'user',
                        parts: [
                            userPart,
                            {
                                inline_data: {
                                    mime_type: "image/png",
                                    data: options.image
                                }
                            }
                        ]
                    });
                } else {
                    contents.push({ role: 'user', parts: [userPart] });
                }
            }

            const bodyObj = {
                contents: contents,
                generationConfig: {
                    temperature: options.temperature || 0.4,
                    maxOutputTokens: options.max_tokens || 2048
                }
            };

            // 🛠️ Add Tools (Function Calling) support
            if (options.tools && options.tools.length > 0) {
                bodyObj.tools = [{
                    function_declarations: options.tools
                }];
            }

            const body = JSON.stringify(bodyObj);

            const req = https.request({
                hostname: 'generativelanguage.googleapis.com',
                path: `/v1beta/models/${model}:generateContent?key=${key}`,
                method: 'POST',
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            }, (res) => {
                let data = '';
                res.on('data', d => data += d);
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        let errorDetail = '';
                        try { errorDetail = JSON.parse(data).error.message; } catch(e) {}
                        const err = new Error(`Gemini API Error: ${res.statusCode} - ${errorDetail}`);
                        err.status = res.statusCode;
                        logger.error(`AIProvider: API Error - ${errorDetail}`);
                        if (res.headers['retry-after']) err.retryAfter = parseInt(res.headers['retry-after'], 10);
                        else if (res.statusCode === 429) err.retryAfter = 30;
                        return reject(err);
                    }
                    try {
                        const json = JSON.parse(data);
                        if (!json.candidates || !json.candidates[0]) {
                            throw new Error("No candidates in Gemini response");
                        }
                        
                        const candidate = json.candidates[0];
                        const part = candidate.content.parts[0];
                        
                        // Handle Function Calls
                        if (part.functionCall) {
                            resolve({
                                type: 'tool_call',
                                function_call: part.functionCall,
                                content: null
                            });
                        } else {
                            resolve({
                                type: 'text',
                                content: part.text.trim(),
                                function_call: null
                            });
                        }
                    } catch (e) {
                        reject(new Error("Malformed JSON response from Gemini: " + e.message));
                    }
                });
            });

            req.on('timeout', () => { req.destroy(); const err = new Error("ETIMEDOUT"); err.code = "ETIMEDOUT"; reject(err); });
            req.on('error', (e) => { e.code = e.code || "ECONNRESET"; reject(e); });
            req.write(body);
            req.end();
        });
    }

    _requestGroq(prompt, options) {
        return new Promise((resolve, reject) => {
            const key = this.groqKeys[this.groqIndex];
            const model = options.model || "llama-3.1-8b-instant";
            
            const body = JSON.stringify({
                model: model,
                messages: [{ role: "user", content: prompt }],
                temperature: options.temperature || 0,
                max_tokens: options.max_tokens || 500
            });

            const req = https.request({
                hostname: 'api.groq.com',
                path: '/openai/v1/chat/completions',
                method: 'POST',
                timeout: 15000,
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            }, (res) => {
                let data = '';
                res.on('data', d => data += d);
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        const err = new Error(`Groq API Error: ${res.statusCode}`);
                        err.status = res.statusCode;
                        if (res.headers['retry-after']) err.retryAfter = parseInt(res.headers['retry-after'], 10);
                        return reject(err);
                    }
                    try {
                        const json = JSON.parse(data);
                        resolve(json.choices[0].message.content.trim());
                    } catch (e) {
                        reject(new Error("Malformed JSON response from Groq"));
                    }
                });
            });

            req.on('timeout', () => { req.destroy(); const err = new Error("ETIMEDOUT"); err.code = "ETIMEDOUT"; reject(err); });
            req.on('error', (e) => { e.code = e.code || "ECONNRESET"; reject(e); });
            req.write(body);
            req.end();
        });
    }
}

module.exports = new AIProvider();
