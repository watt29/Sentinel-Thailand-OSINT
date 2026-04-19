const db = require('./Database');
const fs = require('fs');
const path = require('path');
const logger = require('./Logger');

/**
 * DataArchiver: Handles price history tracking and CSV/Excel exports.
 */
class DataArchiver {
    /**
     * บันทึกข้อมูลประวัติราคาลงใน SQLite และตรวจสอบการเปลี่ยนแปลง
     * @param {Array} products 
     */
    static async archivePriceHistory(products) {
        if (!products || products.length === 0) return;

        // เตรียม Table สำหรับประวัติราคา (ถ้ายังไม่มี)
        db.db.exec(`
            CREATE TABLE IF NOT EXISTS price_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT,
                shop_id TEXT,
                title TEXT,
                price REAL,
                sold_info TEXT,
                url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_item_shop ON price_history(item_id, shop_id);
        `);

        const insertStmt = db.db.prepare(`
            INSERT INTO price_history (item_id, shop_id, title, price, sold_info, url)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const transaction = db.db.transaction((items) => {
            for (const item of items) {
                if (item.itemId && item.shopId) {
                    insertStmt.run(item.itemId, item.shopId, item.title, item.price, item.sold, item.url);
                }
            }
        });

        transaction(products);
        logger.info(`DataArchiver: Archived ${products.length} items to price_history table.`);
    }

    /**
     * ส่งออกข้อมูลเป็นไฟล์ CSV
     * @param {Array} data 
     * @param {string} filename 
     */
    static exportToCSV(data, filename = `report_${Date.now()}.csv`) {
        if (!data || data.length === 0) return;

        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(obj => 
            Object.values(obj).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
        );

        const csvContent = [headers, ...rows].join('\n');
        const filePath = path.join(__dirname, '../logs', filename);

        // ตรวจสอบโฟลเดอร์ logs
        if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath));

        fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf8'); // Add BOM for Excel Thai support
        logger.info(`DataArchiver: Report exported to ${filePath}`);
        return filePath;
    }
}

module.exports = DataArchiver;
