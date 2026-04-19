const fs = require('fs');
const path = require('path');
const MessageBus = require('./MessageBus');
const createLogger = require('./Logger');

class StateEngine {
    constructor() {
        this.log = createLogger('StateEngine');
        this.stateFile = path.join(__dirname, '../data.json');
        this.currentBalance = 0;
        this.initialBalance = 0;
    }

    async init() {
        this.log.info("State Engine: Loading persistence data...");
        this.loadState();
        this.setupSubscriptions();
    }

    setupSubscriptions() {
        // เมื่อได้รับ Update ยอดเงินจาก Trader หรือ Commander หรือ API
        MessageBus.subscribe('trader:metrics_updated', (data) => {
            this.saveState(data);
        });
    }

    saveState(data) {
        try {
            const payload = JSON.stringify(data, null, 2);
            fs.writeFileSync(this.stateFile, payload);
            this.log.debug("State persisting to data.json");
        } catch (e) {
            this.log.error(`Failed to save state: ${e.message}`);
        }
    }

    loadState() {
        if (fs.existsSync(this.stateFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                // ส่งค่ากลับไปให้ TraderAgent เพื่อสานต่อกลยุทธ์ (State Recovery)
                MessageBus.publish('state:recovered', data);
                this.log.info("State Recovery: Previous session data loaded.");
            } catch (e) {
                this.log.error("Failed to load state, starting fresh.");
            }
        }
    }

    updateBalance(newBalance) {
        this.currentBalance = newBalance;
        MessageBus.publish('state:balance_updated', { balance: newBalance });
    }
}

module.exports = new StateEngine();
