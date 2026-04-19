/**
 * AIScanner.js [ULTIMATE STABILITY EDITION]
 * ระบบแชร์ความรับผิดชอบหลายแผนก (ทนทานต่ออักขระแปลกปลอมและ API Error)
 */
const axios = require('axios');
const RSSParser = require('rss-parser');
require('dotenv').config();

let analytics;
try { analytics = require('./AnalyticsEngine'); } catch (e) { analytics = null; }

const GLOBAL_RSS_TABLE = [
  // --- GLOBAL POWERHOUSES ---
  { url: 'http://p.apnews.com/rss/world-news', region: 'GLOBAL' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', region: 'GLOBAL' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', region: 'EUROPE' },
  { url: 'http://rss.cnn.com/rss/edition_world.rss', region: 'USA' },
  { url: 'https://www.dw.com/xml/rss-en-all', region: 'EUROPE' },
  { url: 'https://www3.nhk.or.jp/nhkworld/rss/world.xml', region: 'ASIA-PACIFIC' },
  { url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms', region: 'SOUTH-ASIA' },
  { url: 'https://www.scmp.com/rss/91/feed', region: 'CHINA-ASIA' },

  // --- THAI NEWS & SOCIAL ---
  { url: 'https://www.thestandard.co/feed/', region: 'THAI-SOCIAL' },
  { url: 'https://workpointtoday.com/feed/', region: 'THAI-SOCIAL' },
  { url: 'https://www.bangkokpost.com/rss/data/topstories.xml', region: 'THAI-INT' },
  { url: 'https://prachatai.com/feed', region: 'THAI-SOCIAL' },
  { url: 'https://thematter.co/feed/', region: 'THAI-SOCIAL' },

  // --- THAI SPORTS ---
  { url: 'https://www.smmsport.com/feed/', region: 'THAI-SPORT' },
  { url: 'https://www.siamsport.co.th/feed/', region: 'THAI-SPORT' },
  { url: 'https://feeds.bbci.co.uk/sport/rss.xml', region: 'SPORT-GLOBAL' },
  { url: 'https://www.goal.com/feeds/en/news', region: 'SPORT-FOOTBALL' },

  // --- TECH & TREND ---
  { url: 'https://feeds.feedburner.com/TechCrunch', region: 'TECH' },
  { url: 'https://www.theverge.com/rss/index.xml', region: 'TECH' },
];

class AIScanner {
  constructor() {
    this.geminiKeys = (process.env.GEMINI_API_KEYS || '').split(',')
        .map(k => k.split(':')[0].trim())
        .filter(k => k && k.startsWith('AIza'));
        
    this.groqKeys = (process.env.GROQ_API_KEYS || '').split(',')
        .map(k => k.trim())
        .filter(k => k && k.startsWith('gsk'));
        
    this.groqModel = (process.env.GROQ_MODEL || "llama3-70b-8192").trim();
    this.parser = new RSSParser();
    this.tgBotToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    this.tgChatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
  }

  async sendAlert(msg) {
    if (!this.tgBotToken || !this.tgChatId) return;
    try {
        await axios.post(`https://api.telegram.org/bot${this.tgBotToken}/sendMessage`, {
            chat_id: this.tgChatId,
            text: `🛰️ [SENTINEL ALERT]\n${msg}`,
            parse_mode: 'Markdown'
        }, { timeout: 10000 });
    } catch (e) { console.log(`   [ALERT_FAILED] ${e.message}`); }
  }

  async _callGemini(prompt, attempt = 1) {
    if (attempt > 3) throw new Error("GEMINI_POOL_EXHAUSTED");
    const key = this.geminiKeys[Math.floor(Math.random() * this.geminiKeys.length)];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    try {
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        const res = await axios.post(url, payload, { timeout: 60000, headers: { 'Content-Type': 'application/json' } });
        return res.data.candidates[0].content.parts[0].text;
    } catch (e) {
        if (e.response?.status === 404) {
            const backupUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;
            const backupRes = await axios.post(backupUrl, { contents: [{ parts: [{ text: prompt }] }] }, { timeout: 60000 });
            return backupRes.data.candidates[0].content.parts[0].text;
        }
        if (e.response?.status === 429) {
            await new Promise(r => setTimeout(r, 3000));
            return this._callGemini(prompt, attempt + 1);
        }
        throw new Error(`Gemini Error ${e.response?.status || 'Network'}: ${e.message}`);
    }
  }

  async _callGroq(prompt, attempt = 1) {
    if (attempt > 3) throw new Error("GROQ_POOL_EXHAUSTED");
    const key = this.groqKeys[Math.floor(Math.random() * this.groqKeys.length)];
    try {
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: this.groqModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2
        }, { headers: { Authorization: `Bearer ${key}` }, timeout: 30000 });
        return res.data.choices[0].message.content;
    } catch (e) {
        if (e.response?.status === 429) {
            await new Promise(r => setTimeout(r, 3000));
            return this._callGroq(prompt, attempt + 1);
        }
        throw new Error(`Groq Error ${e.response?.status || 'Network'}: ${e.message}`);
    }
  }

  async analyzeGlobalSentiment() {
    try {
      console.log(`   [OFFICE] Content Distribution Manager active...`);
      const newsItems = await this._fetchNews();
      if (!newsItems || newsItems.length === 0) return { status: "No News" };

      // ใช้ AnalyticsEngine ถ้ามี (ปรับ weight อัตโนมัติตาม Insights จริง) ไม่งั้นใช้ dice static
      let contentType;
      if (analytics) {
          contentType = analytics.pickContentType();
      } else {
          const dice = Math.floor(Math.random() * 100) + 1;
          contentType = "DEEP_INTEL";
          if (dice > 40 && dice <= 55) contentType = "QUICK_SHARE";
          if (dice > 55 && dice <= 95) contentType = "ENGAGEMENT_POST";
          if (dice > 95) contentType = "SYSTEM_BRANDING";
      }

      console.log(`   [STRATEGY] Current Cycle Mode: ${contentType}`);

      const reconItems = newsItems
        .slice(0, 40) // มองให้กว้างขึ้นถึง 40 ข่าว
        .sort(() => 0.5 - Math.random()) // สุ่มลำดับก่อนส่งให้ AI
        .slice(0, 15) // เลือกมา 15 ตัวอย่างสุ่มๆ เพื่อส่งให้ RECON คัด
        .map((n, i) => `ID:${i} ${n.title.replace(/["'\\{}]/g, '')}`);
      
      const reconPrompt = `Task: Select top 5 UNIQUE IDs for ${contentType} mode. AVOID topics already covered recently. JSON ONLY: {"indices": [...]}\nList: ${reconItems.join(' | ')}`;
      
      const reconRes = await this._callGroq(reconPrompt);
      const recon = JSON.parse(this._cleanJSON(reconRes));
      const targets = (recon.indices || []).slice(0, 5).map(idx => newsItems[idx]).filter(t => t);

      const candidates = [];
      for (const target of targets) {
        try {
            console.log(`   [WRITER] Mode: ${contentType} | News: ${target.title.substring(0, 30)}...`);
            
            let draftPrompt = "";
            if (contentType === "DEEP_INTEL") {
                draftPrompt = `เขียนโพสต์ Facebook ภาษาไทย จากข่าว: "${target.title}"
ข้อมูล: ${target.content}
- เริ่มด้วย hook ดึงดูด 1 บรรทัด (ตกใจ / สงสัย / น่าเป็นห่วง)
- เนื้อหา 3-4 ประโยค เล่าเหมือนเพื่อนคุย ไม่ใช่รายงานข่าว
- จบด้วยผลกระทบต่อคนไทย 1 ประโยค
- รวมทั้งหมดไม่เกิน 6 ประโยค ไม่มี bullet ไม่มี header`;
            } else if (contentType === "QUICK_SHARE") {
                draftPrompt = `เขียนโพสต์ Facebook ภาษาไทย จากข่าว: "${target.title}"
- ขึ้นต้นด้วย ⚡️ แล้วสรุปข่าวสั้นๆ
- รวม 2-3 ประโยคเท่านั้น`;
            } else if (contentType === "ENGAGEMENT_POST") {
                const styles = [
                    `เปรียบเทียบ 2 ตัวเลือกที่ขัดแย้งกันจากข่าว แล้วถามว่า "คุณเลือกแบบไหนครับ? 👇"`,
                    `ตั้ง poll 3 ตัวเลือก 🅰️ 🅱️ 🆘 เกี่ยวกับข่าว แล้วบอกให้ comment ตัวอักษร`,
                    `พูดความจริงที่คนไม่กล้าพูดเกี่ยวกับข่าวนี้ แล้วถามว่า "เห็นด้วยไหมครับ? 🔥"`,
                    `สมมุติให้คนอ่านอยู่ในสถานการณ์ของข่าว แล้วให้เลือก 😤😱😅🤔`
                ][Math.floor(Math.random() * 4)];
                draftPrompt = `ข่าว: "${target.title}"
เขียนโพสต์ Facebook ภาษาไทยสั้นๆ: ${styles}
ไม่มี hashtag ไม่สรุปข่าว เขียนเหมือนคนไทยทั่วไปโพสต์เอง`;
            } else {
                draftPrompt = `เขียนโพสต์ Facebook ภาษาไทยโปรโมตเพจ Sentinel Thailand
- หัวข้อ: AI วิเคราะห์ข่าวโลก อัตโนมัติ 24/7
- 3-4 ประโยค กระชับ น่าติดตาม
- ขึ้นต้นด้วย 🛰️`;
            }

            let draft = await this._callGemini(draftPrompt);

            console.log(`   [EDITOR] Polishing...`);

            // ENGAGEMENT_POST ใช้ format สั้น ไม่ต้อง polish ยาว
            if (contentType === "ENGAGEMENT_POST") {
                const engPolishPrompt = `ข่าว: "${target.title}"
โพสต์นี้เกี่ยวกับหัวข้ออะไร? เลือก 1 category แล้วต่อ hashtag ท้ายโพสต์ด้านล่างเลย:
A=การเมือง → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #การเมืองโลก #ภูมิรัฐศาสตร์ #Politics #WorldNews
B=เศรษฐกิจ → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #เศรษฐกิจโลก #การเงิน #Economy #Finance
C=กีฬา → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #กีฬา #มอเตอร์สปอร์ต #Sports #Racing
D=เทคโนโลยี → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #เทคโนโลยี #AI #Tech #Innovation
E=สิ่งแวดล้อม → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #สิ่งแวดล้อม #โลกร้อน #Climate #Environment
F=บันเทิง → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #บันเทิง #ดารา #Entertainment #Trending
G=สุขภาพ → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #สุขภาพ #การแพทย์ #Health #Medicine
H=ข่าวไทย → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #ไทย #ข่าวไทย #Thailand #ThaiNews
Output: โพสต์เดิม + hashtag ที่เลือก ห้ามเพิ่มข้อความอื่น:
${draft.trim()}`;
                const engWithHashtags = await this._callGroq(engPolishPrompt);
                const finalDraft = this._cleanDraft(engWithHashtags);
                candidates.push({
                    status: target.title,
                    original_news: target,
                    facebook_draft: finalDraft,
                    global_risk_score: 50,
                    thai_pulse: `โพสต์กระตุ้น Engagement`
                });
                continue;
            }
            const polishPrompt = `โพสต์นี้เกี่ยวกับข่าว: "${target.title}"
ทำ 3 ขั้นตอนตามลำดับ:

ขั้นที่ 1 — ปรับภาษาให้เป็นธรรมชาติ:
- ภาษาไทย ไม่เกิน 6 ประโยค
- เขียนเหมือนคนไทยอายุ 25-35 คุยกับเพื่อน ใช้ "ครับ" "นะ" "เลย"
- บรรทัดแรกต้องดึงดูด (ตกใจ / สงสัย / น่าเป็นห่วง)
- จบด้วย CTA 1 ประโยค ตามอารมณ์ของข่าว

ขั้นที่ 2 — เลือก category ตามเนื้อหาหลักของข่าว (ไม่ใช่ประเทศ):
A=การเมือง B=เศรษฐกิจ C=กีฬา D=เทคโนโลยี E=สิ่งแวดล้อม F=บันเทิง G=สุขภาพ H=ข่าวไทย

ขั้นที่ 3 — ต่อ hashtag บรรทัดสุดท้าย (copy ตรงๆ 8 อัน):
A → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #การเมืองโลก #ภูมิรัฐศาสตร์ #Politics #WorldNews
B → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #เศรษฐกิจโลก #การเงิน #Economy #Finance
C → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #กีฬา #มอเตอร์สปอร์ต #Sports #Racing
D → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #เทคโนโลยี #AI #Tech #Innovation
E → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #สิ่งแวดล้อม #โลกร้อน #Climate #Environment
F → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #บันเทิง #ดารา #Entertainment #Trending
G → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #สุขภาพ #การแพทย์ #Health #Medicine
H → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #ไทย #ข่าวไทย #Thailand #ThaiNews

Output: โพสต์ที่แก้แล้ว + hashtag เท่านั้น ห้ามอธิบายขั้นตอน:
${draft}`;
            const rawReport = await this._callGroq(polishPrompt);
            const finalReport = this._cleanDraft(rawReport);

            if (finalReport && !finalReport.includes("ชายแดนไทย-รัสเซีย")) {
                candidates.push({
                    status: target.title,
                    original_news: target,
                    facebook_draft: finalReport,
                    global_risk_score: 50,
                    thai_pulse: `ประมวลผลในโหมด ${contentType}`
                });
            }
        } catch (e) { console.log(`   [SKIP] Error: ${e.message}`); }
      }

      return { candidates: candidates, global_risk_score: 50 };
    } catch (err) { 
      console.log(`   [CRITICAL] Room failure: ${err.message}`);
      return { status: "Error" }; 
    }
  }

  async _fetchNews() {
    const tasks = GLOBAL_RSS_TABLE.map(async (source) => {
        try {
          const feed = await this.parser.parseURL(source.url);
          const processedItems = await Promise.all(feed.items.map(async (item) => {
            let imageUrl = "";
            if (item.enclosure?.url) imageUrl = item.enclosure.url;
            else if (item['media:content']?.$?.url) imageUrl = item['media:content'].$.url;
            
            if (!imageUrl && item.link) {
                try {
                    const webRes = await axios.get(item.link, { timeout: 4000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const ogMatch = webRes.data.match(/property="og:image"\s+content="([^"]+)"/i);
                    if (ogMatch) imageUrl = ogMatch[1];
                } catch (e) {}
            }

            return {
                title: (item.title || "").substring(0, 300),
                link: item.link,
                content: (item.description || item.contentSnippet || "").substring(0, 500),
                image: imageUrl,
                source: (feed.title || "Elite Intelligence"),
                region: source.region
            };
          }));
          return processedItems;
        } catch (e) { return []; }
    });
    const results = await Promise.all(tasks);
    return results.flat().sort(() => 0.5 - Math.random());
  }

  _cleanJSON(text) {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : text;
  }

  // ตัด AI reasoning/explanation ออกจาก draft ก่อนโพสต์
  _cleanDraft(text) {
    if (!text) return text;
    // ตัดบรรทัดที่เป็น reasoning เช่น "เนื่องจาก...", "ข้อความทั้งหมด:", "category X", "Output:"
    const reasoningPatterns = [
      /^เนื่องจาก.{0,200}$/gim,
      /^ข้อความทั้งหมด\s*:?\s*$/gim,
      /^.*category\s+[A-H].*$/gim,
      /^.*เหมาะสมที่สุด.*$/gim,
      /^Output\s*:?\s*$/gim,
      /^ดังนั้น.{0,200}$/gim,
      /^ฉันจะ.{0,200}$/gim,
      /^นี่คือ.{0,200}$/gim,
      /^โพสต์\s*:?\s*$/gim,
    ];
    let cleaned = text;
    for (const pat of reasoningPatterns) {
      cleaned = cleaned.replace(pat, '');
    }
    // ตัดบรรทัดว่างซ้ำๆ
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    return cleaned;
  }
}

module.exports = new AIScanner();
