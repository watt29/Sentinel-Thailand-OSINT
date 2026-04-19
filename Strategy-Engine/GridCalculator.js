/**
 * GridCalculator.js
 * คำนวณ Grid parameters + safety check
 */
class GridCalculator {
  static calculate(capital, leverage, assetPrice, numGrids, gridRangePct) {
    const totalExposure = capital * leverage;
    const marginPerGrid = capital / numGrids;
    const exposurePerGrid = totalExposure / numGrids;
    
    // Step size in %
    const stepSizePct = gridRangePct / numGrids;
    
    // Safety Buffer to Liquidation
    // For 3x, Liq is approx 33% away. If range is 10%, we have 23% buffer.
    const mmr = 0.004; // Binance MMR
    const liqPrice = assetPrice * (1 - (1 / leverage) + mmr);
    const safetyBufferPct = ((assetPrice - liqPrice) / assetPrice) * 100;

    return {
      totalExposure,
      exposurePerGrid,
      stepSizePct: stepSizePct.toFixed(2),
      liqPrice: liqPrice.toFixed(2),
      safetyBufferPct: safetyBufferPct.toFixed(0),
      profitPerGrid: (exposurePerGrid * (stepSizePct / 100)).toFixed(2)
    };
  }
}

module.exports = GridCalculator;
