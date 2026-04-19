/**
 * IntelligenceStorage.js [GRAND MASTER EDITION]
 * ระบบหน่วยความจำระยะยาวเพื่อป้องกันการรายงานข่าวซ้ำ (Cognitive Deduplication)
 */
const Database = require('better-sqlite3');
const path = require('path');

class IntelligenceStorage {
  constructor() {
    const dbPath = path.join(__dirname, '../intelligence_memory.db');
    this.db = new Database(dbPath);
    this.init();
  }

  init() {
    // สร้างตารางเก็บข้อมูลข่าวกรองแบบละเอียด
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS intel_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        risk_score INTEGER,
        status TEXT,
        event_summary TEXT,
        full_json TEXT
      )
    `).run();
  }

  saveIntel(candidate) {
    try {
      const { global_risk_score, status, facebook_draft } = candidate;
      
      this.db.prepare(`
        INSERT INTO intel_logs (risk_score, status, event_summary, full_json)
        VALUES (?, ?, ?, ?)
      `).run(
        global_risk_score || 0, 
        status || 'Unknown', 
        (facebook_draft || '').substring(0, 500), 
        JSON.stringify(candidate)
      );
      
      console.log(`   [STORAGE] Intel Saved to Brain.`);
    } catch (e) {
      console.log(`   [STORAGE ERROR] ${e.message}`);
    }
  }

  getReportedHashes() {
    try {
        // ดึงหัวข้อข่าวและสรุปเนื้อหาล่าสุด 50 รายการมาเพื่อเช็คความซ้ำ
        const rows = this.db.prepare(`
            SELECT status, event_summary FROM intel_logs 
            ORDER BY timestamp DESC LIMIT 50
        `).all();
        
        return rows.map(r => `${r.status} ${r.event_summary}`);
    } catch (e) {
        return [];
    }
  }

  getDailyPulse() {
    const rows = this.db.prepare(`
      SELECT * FROM intel_logs 
      WHERE timestamp >= datetime('now', '-24 hours')
      ORDER BY timestamp ASC
    `).all();
    return rows;
  }
}

module.exports = new IntelligenceStorage();
