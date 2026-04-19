/**
 * start.js
 * Entry point + parameter preview
 */
require('dotenv').config();
const SymbolScanner = require('./SymbolScanner');
const GridBot = require('./GridBot');

async function main() {
  console.log(`\n========================================`);
  console.log(`📡 QLS Grid Bot — Initializing...`);
  console.log(`========================================`);

  const targets = await SymbolScanner.getSidewaysPairs();
  
  // กำหนด Settings ตามผลคำนวณจริงที่ผู้ใช้ระบุ
  const botConfigs = {
    'BTC/USDT': { capital: 1000, leverage: 3, numGrids: 15, rangePct: 3.75, entryPrice: 65000 },
    'ETH/USDT': { capital: 1000, leverage: 3, numGrids: 10, rangePct: 5.3,  entryPrice: 3500 },
    'SOL/USDT': { capital: 1000, leverage: 3, numGrids: 10, rangePct: 5.8,  entryPrice: 145 }
  };

  const activeBots = [];

  for (const pair of targets) {
    const config = botConfigs[pair.symbol];
    if (config) {
      const bot = new GridBot(pair.symbol, config);
      activeBots.push(bot);
      await bot.start();
    }
  }

  console.log(`\n✅ Ready! Monitoring ${activeBots.length} pairs.`);
  console.log(`ℹ️ Press Ctrl+C to stop all bots.`);
}

main().catch(err => {
  console.error("Critical error in main:", err);
});
