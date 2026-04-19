/**
 * SymbolScanner.js
 * scan + เลือกคู่เหรียญ Sideways อัตโนมัติ
 */
class SymbolScanner {
  static async getSidewaysPairs() {
    // ในระบบจริง จะดึงข้อมูลจาก Binance API มาคำนวณ ATR หรือ ADX
    // จำลองผลลัพธ์ตามที่ผู้ใช้กำหนด
    return [
      { symbol: 'BTC/USDT', price: 65000, volatility: 'Low', trend: 'Sideways' },
      { symbol: 'ETH/USDT', price: 3500,  volatility: 'Medium', trend: 'Sideways' },
      { symbol: 'SOL/USDT', price: 145,   volatility: 'High', trend: 'Sideways' }
    ];
  }
}

module.exports = SymbolScanner;
