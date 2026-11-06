
"use strict";

// ======================================
// AI GOLD SIGNALS
// Liquidity Detection Engine
// BSL / SSL / Liquidity Sweeps
// ======================================

function detectLiquiditySweeps(candles, swingEvents) {
  if (!Array.isArray(candles) || !Array.isArray(swingEvents)) {
    return [];
  }

  if (candles.length < 3) {
    return [];
  }

  const sweeps = [];

  for (const level of swingEvents) {
    if (
      !Number.isInteger(level.index) ||
      level.index < 0 ||
      level.index >= candles.length
    ) {
      continue;
    }

    if (!Number.isFinite(level.price)) {
      continue;
    }

    // Search only candles after the confirmed swing.
    for (let i = level.index + 1; i < candles.length; i++) {
      const candle = candles[i];

      if (
        !Number.isFinite(candle.high) ||
        !Number.isFinite(candle.low) ||
        !Number.isFinite(candle.close)
      ) {
        continue;
      }

      // Buy-side liquidity:
      // Price breaks above a swing high,
      // then closes below that level.
      if (
        level.type === "SWING_HIGH" &&
        candle.high > level.price &&
        candle.close < level.price
      ) {
        sweeps.push({
          type: "BSL_SWEEP",
          level: level.price,
          swingIndex: level.index,
          sweepIndex: i,
          wickPrice: candle.high,
          confirmation: "CLOSE_BACK_BELOW"
        });

        break;
      }

      // Sell-side liquidity:
      // Price breaks below a swing low,
      // then closes above that level.
      if (
        level.type === "SWING_LOW" &&
        candle.low < level.price &&
        candle.close > level.price
      ) {
        sweeps.push({
          type: "SSL_SWEEP",
          level: level.price,
          swingIndex: level.index,
          sweepIndex: i,
          wickPrice: candle.low,
          confirmation: "CLOSE_BACK_ABOVE"
        });

        break;
      }
    }
  }

  return sweeps.sort(
    (a, b) => a.sweepIndex - b.sweepIndex
  );
}

if (typeof module !== "undefined") {
  module.exports = {
    detectLiquiditySweeps
  };
}
