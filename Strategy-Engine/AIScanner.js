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
                draftPrompt = `Task: Create a Thai Facebook post for this news: "${target.title}". Facts: ${target.content}.
                STRICT LENGTH: Maximum 5-6 sentences total. NO bullet points. NO headers. NO sections.

                MANDATORY — OPEN WITH ONE OF THESE STORYTELLING HOOKS (pick the one that fits the emotion):
                - Shock/Surprise: "ไม่น่าเชื่อเลยครับ — [เรื่องราวในหนึ่งบรรทัด]"
                - Curiosity: "รู้ไหมครับว่า [ข้อเท็จจริงน่าแปลกใจ]?"
                - Urgency: "เพิ่งเกิดขึ้นเมื่อกี้ครับ — [หัวข้อ]"
                - Human angle: "ลองนึกภาพดูครับว่า [สถานการณ์ที่เกิดขึ้นจริง]..."
                - Bold claim: "[ตัวเลขหรือข้อเท็จจริงที่น่าตกใจ] — นี่คือสิ่งที่เกิดขึ้นจริงครับ"

                Structure:
                [HOOK — 1 บรรทัด ดึงดูดทันที ไม่ใช่หัวข้อข่าวธรรมดา]

                [เนื้อหาสรุป 3-4 ประโยค บอกเล่าเหมือนเพื่อนเล่าให้ฟัง ไม่ใช่นักข่าวอ่านข่าว]

                [ผลกระทบต่อไทยหรือชีวิตประจำวัน 1 ประโยค]`;
            } else if (contentType === "QUICK_SHARE") {
                draftPrompt = `Task: Create a rapid Thai update for: ${target.title}.
                STRICT LENGTH: Maximum 3 sentences total.
                Structure: ⚡️ BREAKING: [หัวข้อภาษาไทย]

                [สรุป 2-3 ประโยคสั้นๆ]`;
            } else if (contentType === "ENGAGEMENT_POST") {
                // เลือก format แบบสุ่ม — หลากหลายรูปแบบทำให้เพจไม่น่าเบื่อ
                const engFormat = Math.floor(Math.random() * 4);
                const engInstructions = [
                    // Format 0: Contrast dilemma (viral classic)
                    `CHOOSE ONE FORMAT — "Contrast Dilemma":
                    [สถานการณ์ A ที่เชื่อมกับข่าว]
                    กับ [สถานการณ์ B ที่ขัดแย้ง]

                    คุณเลือกแบบไหนครับ? 👇`,

                    // Format 1: Poll question
                    `CHOOSE ONE FORMAT — "Poll Question":
                    ถ้าเกิดเหตุการณ์นี้กับคุณ คุณจะทำอะไร?

                    🅰️ [ตัวเลือก A]
                    🅱️ [ตัวเลือก B]
                    🆘 [ตัวเลือก C]

                    คอมเมนต์ตัวอักษรที่คุณเลือกได้เลยครับ 👇`,

                    // Format 2: Hot take / bold opinion
                    `CHOOSE ONE FORMAT — "Hot Take":
                    ความจริงที่ใครก็ไม่อยากพูด:

                    "[ความคิดเห็นที่แหลมคม กล้าพูดตรงๆ เกี่ยวกับประเด็นข่าว]"

                    เห็นด้วยไหมครับ? 🔥`,

                    // Format 3: Relatable life scenario
                    `CHOOSE ONE FORMAT — "Relatable Scenario":
                    ถ้าวันนี้ [เหตุการณ์จากข่าวเกิดขึ้นในชีวิตคุณ]...

                    คุณจะรู้สึกยังไงครับ?
                    😤 โกรธมาก
                    😱 ตกใจ
                    😅 ช่างมันเถอะ
                    🤔 ยังไม่แน่ใจ`
                ][engFormat];

                draftPrompt = `Task: Create a SHORT viral Thai Facebook engagement post inspired by this news: "${target.title}".
                RULES:
                1. Write in Thai ONLY. Max 6 lines total.
                2. Plain text only — no markdown, no asterisks
                3. Make it DIRECTLY related to the news topic — translate the news into a Thai life situation
                4. ${engInstructions}
                5. NEVER sound like a news report — sound like a real Thai person posting on their personal Facebook
                6. NO hashtags in this draft (editor will add them)`;
            } else {
                draftPrompt = `Task: Write a SHORT Thai promotional post for Sentinel Thailand page. Theme: AI, news, intelligence.
                STRICT LENGTH: Maximum 4 sentences. NO long paragraphs.
                Structure:
                🛰️ [หัวข้อสั้นๆ]

                [2-3 ประโยคโปรโมตเพจ กระชับ น่าติดตาม]`;
            }

            let draft = await this._callGemini(draftPrompt);

            console.log(`   [EDITOR] Polishing...`);

            // ENGAGEMENT_POST ใช้ format สั้น ไม่ต้อง polish ยาว
            if (contentType === "ENGAGEMENT_POST") {
                // hashtags ตาม topic ของข่าว เหมือน DEEP_INTEL
                const engPolishPrompt = `ดูเนื้อหาข่าวนี้: "${target.title}"
                เลือก category ที่ตรงที่สุด 1 อย่าง แล้ว copy hashtag ตามนั้นมาต่อท้าย post นี้พอดีๆ:
                A (การเมือง/สงคราม) → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #การเมืองโลก #ภูมิรัฐศาสตร์ #Politics #WorldNews
                B (เศรษฐกิจ/ธุรกิจ) → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #เศรษฐกิจโลก #การเงิน #Economy #Finance
                C (กีฬา) → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #กีฬา #มอเตอร์สปอร์ต #Sports #Racing
                D (เทคโนโลยี/AI) → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #เทคโนโลยี #AI #Tech #Innovation
                E (สิ่งแวดล้อม) → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #สิ่งแวดล้อม #โลกร้อน #Climate #Environment
                F (บันเทิง/วัฒนธรรม) → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #บันเทิง #ดารา #Entertainment #Trending
                G (สุขภาพ/การแพทย์) → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #สุขภาพ #การแพทย์ #Health #Medicine
                H (ข่าวไทยโดยตรง) → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #ไทย #ข่าวไทย #Thailand #ThaiNews
                ⚠️ Output เฉพาะ post + hashtag เท่านั้น ห้ามอธิบาย ห้ามบอกว่าเลือก category อะไร ห้ามมี prefix ใดๆ:
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
            const polishPrompt = `Refine this into a SHORT punchy Thai Facebook post.
            STRICT RULES:
            1. CONTENT MUST BE IN THAI ONLY.
            2. MAXIMUM 6 SENTENCES TOTAL — cut anything longer. NO bullet points. NO headers. NO analysis sections.
            3. KEEP Emojis — they stop the scroll.
            4. HUMAN-LIKE OPENING HOOK: The FIRST LINE must grab attention immediately — write it like a real Thai person talking to a friend, not like a news anchor. Use one of these styles:
               - ตั้งคำถามที่ทุกคนสงสัย: "รู้ไหมครับว่า..." / "เคยสังเกตไหมว่า..."
               - บอกเรื่องน่าตกใจตรงๆ: "เพิ่งรู้เลยครับว่า..." / "ไม่น่าเชื่อเลยครับ..."
               - ชวนคิด: "ถ้าเป็นคุณ คุณจะทำยังไงครับ?"

            5. WRITE LIKE A REAL THAI PERSON — use natural conversational Thai:
               - ใช้ "ครับ" ลงท้ายประโยค
               - ใช้คำพูดติดปาก เช่น "จริงๆ แล้ว", "น่าสนใจมากๆ เลยครับ", "ต้องบอกเลยว่า"
               - ไม่ใช้ภาษาทางการ ไม่ใช้ศัพท์วิชาการ

            6. CREATE A UNIQUE CTA — Do NOT use a template. Read the news content deeply, feel the emotion, then WRITE A BRAND NEW CTA yourself that:
               - Sounds like a real Thai person (25-35 years old) writing to friends on Facebook
               - Uses casual Thai: "ครับ", "นะ", "เลย", "มากๆ", "แบบนี้", "จริงๆ"
               - Matches the EXACT emotion of this specific news (anger/shock/sadness/joy/curiosity/fear/pride)
               - Is MAX 1-2 sentences
               - Ends with an emoji that fits the mood
               - Makes people WANT to comment or share — ask a question or trigger a feeling
               - NEVER sounds like a robot or news anchor
               - NEVER repeat the same CTA twice — be creative every time
            7. MANDATORY HASHTAGS — Pick category by the MAIN TOPIC of the news content, NOT the country it happened in:
               A = POLITICS/WAR/GOVERNMENT → ข่าวการเมือง สงคราม ความขัดแย้งระหว่างประเทศ
               B = ECONOMY/BUSINESS → ข่าวเศรษฐกิจ ตลาดหุ้น บริษัท การลงทุน การค้า
               C = SPORTS → ข่าวกีฬาทุกประเภท ฟุตบอล มวย แบดมินตัน มอเตอร์สปอร์ต
               D = TECH/AI/SCIENCE → ข่าวเทคโนโลยี AI นวัตกรรม วิทยาศาสตร์ อวกาศ
               E = ENVIRONMENT/CLIMATE → ข่าวสิ่งแวดล้อม โลกร้อน ภัยธรรมชาติ
               F = ENTERTAINMENT/CULTURE → ข่าวดารา บันเทิง ศิลปะ ดนตรี ภาพยนตร์
               G = HEALTH/MEDICINE → ข่าวสุขภาพ โรค ยา การแพทย์ โรงพยาบาล งานวิจัยทางการแพทย์
               H = THAI NEWS → ข่าวที่เกี่ยวข้องกับประเทศไทยโดยตรงเท่านั้น

               ตัวอย่าง: ข่าวบริษัทยาจีนพัฒนายารักษาโรค = G (HEALTH) ไม่ใช่ H
               ตัวอย่าง: ข่าวตลาดหุ้นจีน = B (ECONOMY) ไม่ใช่ H

               HASHTAGS ตาม category:
                 A → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #การเมืองโลก #ภูมิรัฐศาสตร์ #Politics #WorldNews
                 B → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #เศรษฐกิจโลก #การเงิน #Economy #Finance
                 C → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #กีฬา #มอเตอร์สปอร์ต #Sports #Racing
                 D → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #เทคโนโลยี #AI #Tech #Innovation
                 E → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #สิ่งแวดล้อม #โลกร้อน #Climate #Environment
                 F → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #บันเทิง #ดารา #Entertainment #Trending
                 G → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #สุขภาพ #การแพทย์ #Health #Medicine
                 H → #ข่าววันนี้ #ข่าวด่วน #SentinelThailand #OSINT #ไทย #ข่าวไทย #Thailand #ThaiNews

               STEP: Copy exact 8 hashtags to the very last line. TOTAL = EXACTLY 8. NO MORE.
            ⚠️ OUTPUT THE POST DIRECTLY — NO explanations, NO "here is the post:", NO category reasoning, NO preamble.
            Report: ${draft}`;
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
