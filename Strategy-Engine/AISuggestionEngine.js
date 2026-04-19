/**
 * AISuggestionEngine.js
 * ระบบวิเคราะห์กลยุทธ์เทรด เชื่อมโยงกับ Global Intelligence (MCP-Driven)
 */
const fs = require('fs');
const path = require('path');

class AISuggestionEngine {
  constructor() {
    this.sentimentPath = path.join(__dirname, '../data/global_sentiment.json');
  }

  /**
   * ดึงข้อมูลข่าวกรองล่าสุดจาก AIScanner
   */
  getGlobalContext() {
    try {
      if (fs.existsSync(this.sentimentPath)) {
        return JSON.parse(fs.readFileSync(this.sentimentPath, 'utf8'));
      }
    } catch (e) { return null; }
    return null;
  }

  /**
   * วิเคราะห์กลยุทธ์การวาง Grid โดยใช้ Intel จากโลกและไทย
   */
  calculateStrategy(currentPrice, userConfig) {
    const intel = this.getGlobalContext();
    let riskFactor = intel ? intel.global_risk_score : 0;
    
    // --- ตรรกะประสิทธิภาพสูงสุด (Dynamic Grid) ---
    let gridSpacing = userConfig.defaultSpacing || 0.01; // ปกติ 1%
    let mode = "NORMAL";
    
    // 1. กรณีวิกฤต (Critical/High Risk) 🚨
    if (riskFactor > 0.6) {
      gridSpacing *= 2.5; // ขยายกริดให้กว้างขึ้น 2.5 เท่าเพื่อความปลอดภัย
      mode = "DEFENSIVE (INTEL TRIGGERED)";
    } 
    // 2. กรณีตลาดปกติ/ข่าวดี (Low Risk) 🟢
    else if (riskFactor < -0.2) {
      gridSpacing *= 0.8; // บีบกริดให้แคบลงเพื่อเก็บกำไรถี่ขึ้น
      mode = "AGGRESSIVE (INTEL TRIGGERED)";
    }

    return {
      suggestedSpacing: gridSpacing,
      mode: mode,
      intelSummary: intel ? `Impact: ${intel.projected_btc_impact_percent}% | Mood: ${intel.market_mood}` : "Waiting for Intel..."
    };
  }
}

module.exports = new AISuggestionEngine();
