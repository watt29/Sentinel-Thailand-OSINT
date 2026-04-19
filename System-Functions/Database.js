const Database = require('better-sqlite3');
const path = require('path');
const logger = require('./Logger');

class DatabaseEngine {
    constructor() {
        const dbPath = path.join(__dirname, '../Trade-Data/v7_prod.db');
        // ตรวจสอบโฟลเดอร์ database
        const fs = require('fs');
        if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath));

        this.db = new Database(dbPath, { verbose: null });
        this.initSchema();
    }

    initSchema() {
        // Table สำหรับจัดการ State ของ Agents
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS agent_state (
                agent_name TEXT PRIMARY KEY,
                state_data TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS signals (
                id TEXT PRIMARY KEY,
                source TEXT,
                data TEXT,
                status TEXT DEFAULT 'PENDING',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT, -- BET, CLAIM, API_COST, WITHDRAW
                agent_name TEXT,
                amount REAL,
                currency TEXT,
                status TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS daily_budget (
                day DATE PRIMARY KEY,
                api_calls_count INTEGER DEFAULT 0,
                token_usage INTEGER DEFAULT 0,
                profit_loss REAL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS approvals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_name TEXT,
                action_type TEXT, -- WITHDRAW, CHANGE_STRATEGY, OVER_BUDGET
                payload TEXT,
                status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        logger.info("Database: Financial and Approval tables initialized.");
    }

    // --- Approval Methods ---
    requestApproval(agent, type, payload) {
        const stmt = this.db.prepare('INSERT INTO approvals (agent_name, action_type, payload) VALUES (?, ?, ?)');
        const info = stmt.run(agent, type, JSON.stringify(payload));
        return info.lastInsertRowid;
    }

    updateApprovalStatus(id, status) {
        const stmt = this.db.prepare('UPDATE approvals SET status = ? WHERE id = ?');
        stmt.run(status, id);
    }

    getPendingApprovals() {
        return this.db.prepare('SELECT * FROM approvals WHERE status = "PENDING"').all();
    }

    // --- Financial Methods ---
    logTransaction(agent, type, amount, currency, metadata = {}) {
        const stmt = this.db.prepare('INSERT INTO transactions (agent_name, type, amount, currency, metadata) VALUES (?, ?, ?, ?, ?)');
        stmt.run(agent, type, amount, currency, JSON.stringify(metadata));
    }

    updateDailyUsage(calls, tokens) {
        const today = new Date().toISOString().split('T')[0];
        const stmt = this.db.prepare(`
            INSERT INTO daily_budget (day, api_calls_count, token_usage) 
            VALUES (?, ?, ?)
            ON CONFLICT(day) DO UPDATE SET 
                api_calls_count = api_calls_count + excluded.api_calls_count,
                token_usage = token_usage + excluded.token_usage
        `);
        stmt.run(today, calls, tokens);
    }

    getDailyStats(day = new Date().toISOString().split('T')[0]) {
        return this.db.prepare('SELECT * FROM daily_budget WHERE day = ?').get(day) || { api_calls_count: 0, token_usage: 0, profit_loss: 0 };
    }

    // --- State Persistence ---
    saveAgentState(name, data) {
        const stmt = this.db.prepare('INSERT INTO agent_state (agent_name, state_data) VALUES (?, ?) ON CONFLICT(agent_name) DO UPDATE SET state_data = excluded.state_data, updated_at = CURRENT_TIMESTAMP');
        stmt.run(name, JSON.stringify(data));
    }

    getAgentState(name) {
        const row = this.db.prepare('SELECT state_data FROM agent_state WHERE agent_name = ?').get(name);
        return row ? JSON.parse(row.state_data) : null;
    }

    logSignal(id, source, data) {
        try {
            const stmt = this.db.prepare('INSERT INTO signals (id, source, data) VALUES (?, ?, ?)');
            stmt.run(id, source, data);
            return true;
        } catch (e) {
            return false;
        }
    }
}

module.exports = new DatabaseEngine();
