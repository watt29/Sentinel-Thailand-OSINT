/**
 * ImageCardGenerator.js
 * สร้าง text-card image (PNG) เมื่อ RSS image ถูก block
 * ใช้ SVG → sharp → PNG buffer — ไม่ต้องการ canvas native deps
 */
const path = require('path');
const fs = require('fs');

let sharp;
try { sharp = require('sharp'); } catch (e) { sharp = null; }

const CARD_PRESETS = [
    { bg: '#0a0f1e', accent: '#00d4ff', text: '#ffffff', style: 'CYBER' },
    { bg: '#1a0533', accent: '#ff6b35', text: '#ffffff', style: 'ALERT' },
    { bg: '#0d2137', accent: '#00ff88', text: '#ffffff', style: 'INTEL' },
    { bg: '#1c1c1c', accent: '#ffd700', text: '#ffffff', style: 'GOLD' },
    { bg: '#0f1923', accent: '#e63946', text: '#ffffff', style: 'CRITICAL' },
];

function _wrapText(text, maxCharsPerLine) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const w of words) {
        if ((current + ' ' + w).trim().length > maxCharsPerLine) {
            if (current) lines.push(current.trim());
            current = w;
        } else {
            current = (current + ' ' + w).trim();
        }
    }
    if (current) lines.push(current.trim());
    return lines;
}

function _escSVG(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateSVG(title, contentType = 'DEEP_INTEL', riskScore = 50) {
    const preset = CARD_PRESETS[Math.floor(Math.random() * CARD_PRESETS.length)];
    const W = 1200, H = 630;

    // wrap title ให้พอดีกับ card
    const cleanTitle = _escSVG(title.substring(0, 120));
    const titleLines = _wrapText(cleanTitle, 38);
    const titleSVG = titleLines.slice(0, 3).map((line, i) =>
        `<text x="80" y="${220 + i * 65}" font-family="Arial,sans-serif" font-size="44" font-weight="bold" fill="${preset.text}" letter-spacing="-0.5">${line}</text>`
    ).join('\n');

    const modeLabel = {
        DEEP_INTEL: '🛰️ DEEP INTEL',
        QUICK_SHARE: '⚡ BREAKING',
        ENGAGEMENT_POST: '💬 ENGAGEMENT',
        SYSTEM_BRANDING: '🔵 SENTINEL'
    }[contentType] || '🌍 NEWS';

    const barWidth = Math.round((riskScore / 100) * 460);
    const barColor = riskScore >= 80 ? '#e63946' : riskScore >= 50 ? '#ff6b35' : '#00ff88';
    const now = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${preset.bg};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${preset.bg}dd;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${preset.accent};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${preset.accent}88;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)" />

  <!-- Decorative grid lines -->
  <line x1="0" y1="100" x2="${W}" y2="100" stroke="${preset.accent}" stroke-width="0.5" stroke-opacity="0.2"/>
  <line x1="0" y1="530" x2="${W}" y2="530" stroke="${preset.accent}" stroke-width="0.5" stroke-opacity="0.2"/>
  <line x1="80" y1="0" x2="80" y2="${H}" stroke="${preset.accent}" stroke-width="0.5" stroke-opacity="0.15"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="${W}" height="6" fill="url(#accent)" />

  <!-- Mode badge -->
  <rect x="80" y="40" width="220" height="42" rx="6" fill="${preset.accent}22" stroke="${preset.accent}" stroke-width="1.5"/>
  <text x="190" y="67" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="${preset.accent}" text-anchor="middle" letter-spacing="2">${_escSVG(modeLabel)}</text>

  <!-- Sentinel logo text -->
  <text x="${W - 80}" y="67" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="${preset.accent}99" text-anchor="end" letter-spacing="3">SENTINEL THAILAND</text>

  <!-- Title lines -->
  ${titleSVG}

  <!-- Risk score bar -->
  <text x="80" y="430" font-family="Arial,sans-serif" font-size="14" fill="${preset.accent}aa" letter-spacing="2">RISK LEVEL</text>
  <rect x="80" y="445" width="460" height="8" rx="4" fill="${preset.accent}22"/>
  <rect x="80" y="445" width="${barWidth}" height="8" rx="4" fill="${barColor}"/>
  <text x="555" y="455" font-family="Arial,sans-serif" font-size="14" fill="${barColor}" font-weight="bold">${riskScore}%</text>

  <!-- Bottom divider -->
  <line x1="80" y1="490" x2="${W - 80}" y2="490" stroke="${preset.accent}" stroke-width="1" stroke-opacity="0.3"/>

  <!-- Footer -->
  <text x="80" y="520" font-family="Arial,sans-serif" font-size="14" fill="${preset.text}66">${_escSVG(now)}</text>
  <text x="${W - 80}" y="520" font-family="Arial,sans-serif" font-size="14" fill="${preset.accent}99" text-anchor="end" letter-spacing="1">OSINT INTELLIGENCE NETWORK</text>

  <!-- Corner accent -->
  <polygon points="${W},0 ${W - 120},0 ${W},120" fill="${preset.accent}15"/>
  <polygon points="0,${H} 120,${H} 0,${H - 120}" fill="${preset.accent}10"/>
</svg>`;
}

async function generateCardBuffer(title, contentType, riskScore) {
    if (!sharp) {
        console.log(`   [IMGCARD] sharp ไม่ได้ติดตั้ง — ข้าม image card`);
        return null;
    }
    try {
        const svg = generateSVG(title, contentType, riskScore);
        const buf = await sharp(Buffer.from(svg)).png().toBuffer();
        return buf;
    } catch (e) {
        console.log(`   [IMGCARD] Error: ${e.message}`);
        return null;
    }
}

async function saveCardToTemp(title, contentType, riskScore) {
    const buf = await generateCardBuffer(title, contentType, riskScore);
    if (!buf) return null;
    const tmpDir = path.join(__dirname, '../tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filename = `card_${Date.now()}.png`;
    const filepath = path.join(tmpDir, filename);
    fs.writeFileSync(filepath, buf);
    return filepath;
}

module.exports = { generateCardBuffer, saveCardToTemp, generateSVG };
