/**
 * RiskGuard.js
 * Hard Stop + Circuit Breaker + Rate Limit
 */
class RiskGuard {
  constructor(config) {
    this.hardStopAmount = config.hardStopAmount || 200;
    this.liqWarningThreshold = config.liqWarningThreshold || 0.1; // 10%
    this.apiErrorCount = 0;
    this.isCircuitBroken = false;
  }

  checkSafetyThreshold(currentPnl) {
    if (Math.abs(currentPnl) >= this.hardStopAmount && currentPnl < 0) {
      console.log(`\n🔄 [RISK GUARD] SAFETY THRESHOLD REACHED (-$${Math.abs(currentPnl)}): Initializing Auto-Adjustment...`);
      return true;
    }
    return false;
  }

  checkLiquidation(currentPrice, liqPrice) {
    const distance = (currentPrice - liqPrice) / currentPrice;
    if (distance <= this.liqWarningThreshold) {
      console.log(`⚠️ [RISK GUARD] LIQUIDATION WARNING: Price is only ${(distance * 100).toFixed(2)}% above Liq!`);
      return true;
    }
    return false;
  }

  onApiError() {
    this.apiErrorCount++;
    if (this.apiErrorCount >= 3) {
      this.isCircuitBroken = true;
      console.log(`\n🔌 [RISK GUARD] CIRCUIT BREAKER TRIGGERED: Stopping for 5 minutes due to API errors.`);
      setTimeout(() => {
        this.apiErrorCount = 0;
        this.isCircuitBroken = false;
        console.log(`🚀 [RISK GUARD] Circuit Breaker Reset.`);
      }, 5 * 60 * 1000);
    }
  }

  applyAiSignal(aiResult) {
    if (aiResult.risk_level === 'High') {
      console.log(`\n🚨 [RISK GUARD] AI DETECTED FUD/HIGH RISK: Tightening safety measures...`);
      this.liqWarningThreshold = 0.2; // ขยับการเตือน Liq ให้กว้างขึ้นเป็น 20%
      return true; // แนะนำให้ปรับโหมด Defensive
    }
    return false;
  }
}

module.exports = RiskGuard;
