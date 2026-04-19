/**
 * TelegramNotifier.js
 * [IRON-SAFE VERSION] - อ่านไฟล์ตรง ไม่ผ่าน Middleware
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class TelegramNotifier {
  constructor() {
    this.token = "";
    this.chatId = "";
    this._loadSecurely();
  }

  /**
   * ระบบอ่านไฟล์ .env โดยตรงเพื่อ By-pass ปัญหา Middleware
   */
  _loadSecurely() {
    try {
      const envPath = process.env.ENV_PATH || path.resolve(__dirname, '../.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach(line => {
          const [key, ...valueParts] = line.split('=');
          const value = valueParts.join('=').trim();
          if (key === 'TELEGRAM_BOT_TOKEN') this.token = value;
          if (key === 'TELEGRAM_CHAT_ID') this.chatId = value;
        });
      }
    } catch (e) {
      console.error("[TELEGRAM] Internal Load Error:", e.message);
    }
  }

  _escapeHTML(text) {
    if (!text) return "";
    const str = String(text); 
    return str.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;");
  }

  async sendMessage(message) {
    if (!this.token || !this.chatId) return;
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    try {
      // สำหรับข้อความส่วนที่มาจาก AI เราจะกรอง HTML ออกก่อนเพื่อความชัวร์ หรือใช้แคปชันแบบเดิมถ้าเป็น static
      await axios.post(url, { 
        chat_id: this.chatId, 
        text: message, 
        parse_mode: 'HTML' 
      });
    } catch (error) { 
      console.error(`[TELEGRAM] Send Error:`, error.response?.data || error.message); 
    }
  }

  /**
   * แจ้งเตือนเมื่อ GridBot เริ่มทำงาน
   */
  notifyStart(symbol, config) {
    const msg = `🚀 <b>GridBot Started</b>\nSymbol: <b>${this._escapeHTML(symbol)}</b>\nCapital: $${config.capital || '-'} | Grids: ${config.numGrids || '-'} | Leverage: ${config.leverage || '-'}x\nMode: ${process.env.GRID_PAPER_MODE !== 'false' ? '📄 PAPER' : '🔥 LIVE'}`;
    this.sendMessage(msg);
  }

  /**
   * แจ้งเตือนเมื่อ GridBot ปรับ Grid ใหม่
   */
  notifyRebalance(symbol, pnl) {
    const sign = pnl >= 0 ? '+' : '';
    const msg = `📏 <b>Grid Rebalanced</b>\nSymbol: <b>${this._escapeHTML(symbol)}</b>\nPnL Trigger: ${sign}$${pnl}\nระบบปรับช่วง Grid อัตโนมัติเพื่อลดความเสี่ยง`;
    this.sendMessage(msg);
  }

  /**
   * ระบบดักฟังข้อความล่าสุด (Long-polling Lite)
   */
  async listenForMessages(callback) {
    let offset = 0;
    console.log(`[TELEGRAM] Listener Active...`);
    
    setInterval(async () => {
      try {
        const url = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${offset + 1}&timeout=30`;
        const res = await axios.get(url);
        const updates = res.data.result;

        for (const update of updates) {
          offset = update.update_id;
          if (update.message && update.message.text) {
            console.log(`[TELEGRAM] Received: ${update.message.text}`);
            // ส่ง Typing Action เพื่อบอกว่ากำลังคิด
            await axios.post(`https://api.telegram.org/bot${this.token}/sendChatAction`, {
                chat_id: this.chatId,
                action: 'typing'
            });
            callback(update.message.text);
          }
        }
      } catch (e) { /* Silent retry */ }
    }, 5000); // เช็คทุก 5 วินาที
  }
}

module.exports = new TelegramNotifier();
