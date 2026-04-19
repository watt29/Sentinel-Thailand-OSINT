const BaseAgent = require('./BaseAgent');
const logger = require('./Logger');
const db = require('./Database');

/**
 * GovernorAgent: The Supreme Overseer of Paperclip AI.
 * Responsibility: Budget Control, Health Monitoring, and Strategic Throttling.
 */
class GovernorAgent extends BaseAgent {
    constructor() {
        super({
            name: 'Governor',
            role: 'System Compliance & Governance Officer',
            instructions: `You are the final authority of the Paperclip AI system.
            Your job is to monitor system health and budget.
            If API costs or Token usage exceed limits, you must order a shutdown or slowdown.
            Check logs for high error rates (429/503) and adjust agent behaviors.`
        });

        this.limits = {
            dailyBudget: 5.0, // USD (if applicable)
            dailyTokens: 1000000,
            maxErrorRate: 0.1 // 10%
        };
    }

    async auditSystem() {
        const stats = db.getDailyStats();
        logger.info(`Governor: System Audit - Tokens: ${stats.token_usage}, Errors: ${stats.api_errors || 0}`);

        if (stats.token_usage > this.limits.dailyTokens) {
            this.publish('emergency_stop', { reason: 'BUDGET_EXHAUSTED' });
            return { action: 'STOP', reason: 'Out of tokens' };
        }

        return { action: 'CONTINUE', status: 'HEALTHY' };
    }
}

module.exports = new GovernorAgent();
