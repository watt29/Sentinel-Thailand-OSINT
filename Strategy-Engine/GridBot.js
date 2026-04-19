/**
 * GridBot.js
 * Engine หลัก ควบคุมทุกอย่าง
 */
const GridCalculator = require('./GridCalculator');
const RiskGuard = require('./RiskGuard');
const notifier = require('./TelegramNotifier');
const AIScanner = require('./AIScanner');

class GridBot {
  constructor(symbol, config) {
    this.symbol = symbol;
    this.config = config;
    this.status = 'STOPPED';
    this.guarded = new RiskGuard({ hardStopAmount: 200 });
    this.isPaper = process.env.GRID_PAPER_MODE !== 'false';
  }

  async start() {
    // ใช้ Suggestion Engine เพื่อขออนุมัติจากมนุษย์ (Human-in-the-loop)
    const suggestionEngine = require('./AISuggestionEngine');
    const hasWarning = await suggestionEngine.processMarketScan(this);
    
    if (hasWarning) {
      console.log(`⏳ [${this.symbol}] Waiting for Human Approval to proceed with AI adjustments...`);
    }

    this.status = 'RUNNING';
    
    const modeStr = this.isPaper ? '📄 PAPER MODE' : '🔥 LIVE MODE';
    console.log(`\n[${this.symbol}] Bot Started in ${modeStr}`);
    
    const params = GridCalculator.calculate(
      this.config.capital,
      this.config.leverage,
      this.config.entryPrice,
      this.config.numGrids,
      this.config.rangePct
    );

    console.log(`📊 Parameters: ${this.config.numGrids} Levels | Step ${params.stepSizePct}% | Profit/Grid $${params.profitPerGrid}`);
    console.log(`🛡️ Safety: Liq $${params.liqPrice} (${params.safetyBufferPct}% buffer)`);
    
    // แจ้งเตือนผ่าน Telegram
    notifier.notifyStart(this.symbol, this.config);

    // Simulate main loop
    this.runLoop();
  }

  runLoop() {
    if (this.status !== 'RUNNING' && !this.status.includes('DEFENSIVE')) return;
    
    // Simulate trade check every 2 seconds
    setTimeout(() => {
      if (this.guarded.isCircuitBroken) {
         return this.runLoop();
      }

      // --- SIMULATE REAL CHECK ---
      const simulatedPnl = -205; // จำลองสถานการณ์ติดลบถึงเกณฑ์

      if (this.guarded.checkSafetyThreshold(simulatedPnl)) {
        this.rebalanceGrid();
        this.adjustMode();
        // แจ้งเตือนผ่าน Telegram
        notifier.notifyRebalance(this.symbol, simulatedPnl);
      }
      
      this.runLoop();
    }, 2000);
  }

  rebalanceGrid() {
    console.log(`[${this.symbol}] 📏 ขยับกริดอัตโนมัติ: ปรับช่วงราคาใหม่รอบราคาปัจจุบัน (Re-centering Grid)`);
    // ในระบบจริง จะคำนวณราคาปัจจุบันและวาง Order ใหม่
    this.config.rangePct *= 1.5; // ขยายความกว้างกริด 50% เพื่อลดความเสี่ยง
    const params = GridCalculator.calculate(
      this.config.capital,
      this.config.leverage,
      this.config.entryPrice, // ในระบบจริงจะใช้ currentPrice
      this.config.numGrids,
      this.config.rangePct
    );
    console.log(`✨ ช่วงกริดใหม่: Step ${params.stepSizePct}% | Range ${this.config.rangePct.toFixed(2)}%`);
  }

  adjustMode() {
    console.log(`[${this.symbol}] ⚙️ ปรับโหมดอัตโนมัติ: เปลี่ยนเป็นโหมด Defensive (ลดความถี่การเทรด)`);
    this.status = 'RUNNING (DEFENSIVE)';
  }

  stop() {
    this.status = 'STOPPED';
    console.log(`[${this.symbol}] Bot Stopped.`);
  }
}

module.exports = GridBot;
