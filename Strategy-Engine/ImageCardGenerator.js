/**
 * ImageCardGenerator.js
 * สร้าง viral text card (PNG) สไตล์พื้นดำ ตัวขาวใหญ่ bold
 * เหมือนโพสต์ viral ไทย — ไม่ต้องพึ่งรูป RSS
 */
const path = require('path');
const fs = require('fs');
const https = require('https');

let Resvg;
try { Resvg = require('@resvg/resvg-js').Resvg; } catch (e) { Resvg = null; }

const FONT_DIR = path.join(__dirname, '../fonts');
const FONT_PATH = path.join(FONT_DIR, 'Sarabun-Bold.ttf');
// Sarabun Bold จาก Google Fonts (TTF)
const FONT_URL = 'https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Bold.ttf';

async function ensureFont() {
    if (fs.existsSync(FONT_PATH)) return true;
    try {
        if (!fs.existsSync(FONT_DIR)) fs.mkdirSync(FONT_DIR, { recursive: true });
        console.log(`   [IMGCARD] Downloading Sarabun font...`);
        await new Promise((resolve, reject) => {
            const file = fs.createWriteStream(FONT_PATH);
            const get = (url, redirect = 0) => {
                if (redirect > 5) { reject(new Error('Too many redirects')); return; }
                https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
                    if (res.statusCode === 301 || res.statusCode === 302) {
                        get(res.headers.location, redirect + 1);
                    } else if (res.statusCode === 200) {
                        res.pipe(file);
                        file.on('finish', () => { file.close(); resolve(); });
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                }).on('error', reject);
            };
            get(FONT_URL);
        });
        console.log(`   [IMGCARD] Font downloaded ✅`);
        return true;
    } catch (e) {
        console.log(`   [IMGCARD] Font download failed: ${e.message}`);
        if (fs.existsSync(FONT_PATH)) fs.unlinkSync(FONT_PATH);
        return false;
    }
}

function _escSVG(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// แยกข้อความออกเป็นบรรทัดตาม \n และ wrap ถ้ายาวเกิน
function _splitLines(text, maxChars) {
    const raw = text.split('\n');
    const lines = [];
    for (const line of raw) {
        if (line.trim() === '') { lines.push(''); continue; }
        // wrap ถ้ายาวเกิน maxChars
        let cur = '';
        for (const ch of line) {
            cur += ch;
            // ภาษาไทย 1 ตัว = ~1.8 char width — ใช้ length ง่ายๆ
            if (cur.length >= maxChars) { lines.push(cur.trim()); cur = ''; }
        }
        if (cur.trim()) lines.push(cur.trim());
    }
    return lines;
}

/**
 * สร้าง SVG text card สไตล์ viral ไทย
 * contentLines: string[] — บรรทัดข้อความหลัก (จาก engagement post / deep intel)
 * style: 'BLACK' | 'DARK_RED' | 'DARK_BLUE'
 */
function _getFontBase64() {
    try {
        if (fs.existsSync(FONT_PATH)) {
            return fs.readFileSync(FONT_PATH).toString('base64');
        }
    } catch (e) {}
    return null;
}

function generateViralSVG(contentLines, style = 'BLACK') {
    const W = 1080, H = 1080; // square — เหมาะ Facebook มากที่สุด

    const themes = {
        BLACK:     { bg: '#000000', text: '#ffffff', accent: '#ffffff' },
        DARK_RED:  { bg: '#1a0000', text: '#ffffff', accent: '#ff3333' },
        DARK_BLUE: { bg: '#000d1a', text: '#ffffff', accent: '#00aaff' },
    };
    const t = themes[style] || themes.BLACK;

    // คำนวณ font size ตามจำนวนบรรทัด
    const lineCount = contentLines.filter(l => l.trim()).length;
    const fontSize = lineCount <= 3 ? 90 : lineCount <= 5 ? 72 : lineCount <= 7 ? 58 : 46;
    const lineHeight = Math.round(fontSize * 1.45);

    // จัดกึ่งกลาง vertical
    const totalH = lineCount * lineHeight;
    const startY = Math.round((H - totalH) / 2) + fontSize;

    let textSVG = '';
    let yPos = startY;
    let lineIndex = 0;
    for (const line of contentLines) {
        if (line.trim() === '') { yPos += Math.round(lineHeight * 0.5); continue; }
        // สลับสี accent ที่บรรทัดสุดท้าย (CTA)
        const isLast = lineIndex === contentLines.filter(l => l.trim()).length - 1;
        const color = isLast ? t.accent : t.text;
        textSVG += `<text
            x="${W / 2}" y="${yPos}"
            font-family="'Sarabun','Arial',sans-serif"
            font-size="${fontSize}"
            font-weight="900"
            fill="${color}"
            text-anchor="middle"
            dominant-baseline="auto"
            letter-spacing="-1"
        >${_escSVG(line.trim())}</text>\n`;
        yPos += lineHeight;
        lineIndex++;
    }

    // watermark เล็กๆ ล่างขวา
    const watermark = `<text x="${W - 40}" y="${H - 30}" font-family="Arial,sans-serif" font-size="22" fill="${t.text}33" text-anchor="end" letter-spacing="2">SENTINEL THAILAND</text>`;

    const fontB64 = _getFontBase64();
    const fontFace = fontB64 ? `<defs><style>@font-face{font-family:'Sarabun';src:url('data:font/ttf;base64,${fontB64}') format('truetype');font-weight:bold;}</style></defs>` : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${fontFace}
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  ${textSVG}
  ${watermark}
</svg>`;
}

/**
 * แปลง facebook_draft → บรรทัดสำหรับ card
 * ตัด hashtag ออก (ไม่ใส่ในรูป), เหลือแค่เนื้อหา
 */
function _extractCardLines(draft, maxLines = 6) {
    const lines = draft
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#') && !l.match(/^[#＃]/));

    // ถ้ายาวเกิน wrap ให้พอดี
    const wrapped = [];
    for (const line of lines) {
        const sub = _splitLines(line, 18); // ~18 ตัวอักษรต่อบรรทัดสำหรับ font 72px
        wrapped.push(...sub);
    }
    return wrapped.slice(0, maxLines);
}

/**
 * เลือก style ตาม content type
 */
function _pickStyle(contentType) {
    if (contentType === 'ENGAGEMENT_POST') return 'BLACK';
    if (contentType === 'QUICK_SHARE') return 'DARK_RED';
    return ['BLACK', 'DARK_BLUE'][Math.floor(Math.random() * 2)];
}

async function generateCardBuffer(title, contentType = 'DEEP_INTEL', riskScore = 50, draft = '') {
    if (!Resvg) {
        console.log(`   [IMGCARD] @resvg/resvg-js ไม่ได้ติดตั้ง — ข้าม image card`);
        return null;
    }
    try {
        await ensureFont();

        const source = draft || title;
        const lines = _extractCardLines(source);
        if (lines.length === 0) lines.push(title.substring(0, 40));

        const style = _pickStyle(contentType);
        const svg = generateViralSVG(lines, style);

        const opts = { fitTo: { mode: 'width', value: 1080 } };
        const resvg = new Resvg(svg, opts);
        const pngData = resvg.render();
        return pngData.asPng();
    } catch (e) {
        console.log(`   [IMGCARD] Error: ${e.message}`);
        return null;
    }
}

async function saveCardToTemp(title, contentType, riskScore, draft) {
    const buf = await generateCardBuffer(title, contentType, riskScore, draft);
    if (!buf) return null;
    const tmpDir = path.join(__dirname, '../tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filename = `card_${Date.now()}.png`;
    const filepath = path.join(tmpDir, filename);
    fs.writeFileSync(filepath, buf);
    return filepath;
}

module.exports = { generateCardBuffer, saveCardToTemp, generateViralSVG };
