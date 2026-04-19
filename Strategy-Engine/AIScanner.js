/**
 * AIScanner.js [ULTIMATE STABILITY EDITION]
 * ระบบแชร์ความรับผิดชอบหลายแผนก (ทนทานต่ออักขระแปลกปลอมและ API Error)
 */
const axios = require('axios');
const RSSParser = require('rss-parser');
require('dotenv').config();

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
        const res = await axios.post(url, payload, { timeout: 30000, headers: { 'Content-Type': 'application/json' } });
        return res.data.candidates[0].content.parts[0].text;
    } catch (e) {
        if (e.response?.status === 404) {
            const backupUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;
            const backupRes = await axios.post(backupUrl, { contents: [{ parts: [{ text: prompt }] }] }, { timeout: 30000 });
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

      const dice = Math.floor(Math.random() * 100) + 1;
      let contentType = "DEEP_INTEL"; 
      if (dice > 70 && dice <= 90) contentType = "QUICK_SHARE"; 
      if (dice > 90) contentType = "SYSTEM_BRANDING"; 

      console.log(`   [STRATEGY] Current Cycle Mode: ${contentType}`);

      const reconItems = newsItems
        .slice(0, 40) // มองให้กว้างขึ้นถึง 40 ข่าว
        .sort(() => 0.5 - Math.random()) // สุ่มลำดับก่อนส่งให้ AI
        .slice(0, 15) // เลือกมา 15 ตัวอย่างสุ่มๆ เพื่อส่งให้ RECON คัด
        .map((n, i) => `ID:${i} ${n.title.replace(/["'\\{}]/g, '')}`);
      
      const reconPrompt = `Task: Select top 3 UNIQUE IDs for ${contentType} mode. AVOID topics already covered recently. JSON ONLY: {"indices": [...]}\nList: ${reconItems.join(' | ')}`;
      
      const reconRes = await this._callGroq(reconPrompt);
      const recon = JSON.parse(this._cleanJSON(reconRes));
      const targets = (recon.indices || []).slice(0, 3).map(idx => newsItems[idx]).filter(t => t);

      const candidates = [];
      for (const target of targets) {
        try {
            console.log(`   [WRITER] Mode: ${contentType} | News: ${target.title.substring(0, 30)}...`);
            
            let draftPrompt = "";
            if (contentType === "DEEP_INTEL") {
                draftPrompt = `Task: Create a deep Thai intelligence brief for: ${target.title}. Fact: ${target.content}. 
                Structure: 📍 TITLE (Thai)
                ---
                Comprehensive Analysis (Thai)
                #Insight #Professional #Sentinel`;
            } else if (contentType === "QUICK_SHARE") {
                draftPrompt = `Task: Create a rapid Thai update for: ${target.title}. 
                Structure: ⚡️ BREAKING: [Thai Impactful Title]
                ---
                [Thai Executive Summary 2-3 sentences]
                #QuickUpdate #News #Thailand`;
            } else {
                draftPrompt = `Task: Write a high-tech Thai promotional post for Sentinel Thailand OSINT platform. Theme: AI, Speed, Security. 
                Structure: 🛰️ SENTINEL HQ: [Title]
                ---
                [Thai Promotional Content]
                #AI #SentinelThailand`;
            }

            let draft = await this._callGemini(draftPrompt);

            console.log(`   [EDITOR] Polishing...`);
            const polishPrompt = `Refine this into a HIGH-FIDELITY Thai Facebook post designed to maximize engagement and page growth.
            STRICT RULES:
            1. CONTENT MUST BE IN THAI ONLY.
            2. KEEP ALL Emojis and Symbols — they increase engagement.
            3. Make it sound AUTHORITATIVE, ELITE, and SHAREABLE.
            4. ADD A STRONG CTA (Call-to-Action) BEFORE the hashtags. Choose the most fitting:
               - ถ้าเป็นข่าวที่น่าตกใจ: "😮 คิดว่ายังไง? คอมเมนต์บอกเลย 👇"
               - ถ้าเป็นข่าวกีฬา: "⚽ แชร์ให้เพื่อนแฟนบอลด้วยนะ! 🔥"
               - ถ้าเป็นข่าวเทคโนโลยี: "🤖 เทคโนโลยีนี้จะเปลี่ยนชีวิตคุณไหม? แชร์ความคิดเห็น 👇"
               - ถ้าเป็นข่าวทั่วไป: "📢 กดแชร์ให้คนที่คุณรักได้รู้ด้วยนะครับ 🙏"
            5. MANDATORY HASHTAGS — Analyze the news category first, then assign EXACTLY 8 hashtags on the last line using this system:

               ALWAYS INCLUDE (4 fixed):
               #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT

               THEN pick EXACTLY 4 more based on the news category below:

               🏛️ POLITICS/WAR → #การเมืองโลก #ภูมิรัฐศาสตร์ #Politics #WorldNews
               💰 ECONOMY/FINANCE → #เศรษฐกิจโลก #การเงิน #Economy #Finance
               ⚽ SPORTS/FOOTBALL → #กีฬา #ฟุตบอลโลก #Sports #Football
               🤖 TECH/AI → #เทคโนโลยี #AI #Tech #Innovation
               🌍 ENVIRONMENT/CLIMATE → #สิ่งแวดล้อม #โลกร้อน #Climate #Environment
               🎬 ENTERTAINMENT → #บันเทิง #ดารา #Entertainment #Trending
               🏥 HEALTH/SCIENCE → #สุขภาพ #วิทยาศาสตร์ #Health #Science
               🇹🇭 THAI NEWS → #ไทย #ข่าวไทย #Thailand #ThaiNews

            6. TOTAL = EXACTLY 8 hashtags. NO MORE NO LESS. Last line only.
            Report: ${draft}`;
            const finalReport = await this._callGroq(polishPrompt);

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
}

module.exports = new AIScanner();
