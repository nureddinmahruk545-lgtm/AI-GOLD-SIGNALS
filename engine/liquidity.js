
"use strict";

// ======================================
// AI GOLD SIGNALS
// Liquidity Detection Engine V2
// BSL / SSL / Confirmed Sweeps
// ======================================

function detectLiquiditySweeps(candles, swingEvents, options = {}) {
  if (!Array.isArray(candles) || !Array.isArray(swingEvents)) {
    return [];
  }

  if (candles.length < 5) {
    return [];
  }

  const minWickRatio = Number.isFinite(options.minWickRatio)
    ? Math.max(0, Math.min(1, options.minWickRatio))
    : 0.25;

  const maxAge = Number.isInteger(options.maxAge)
    ? Math.max(1, options.maxAge)
    : 100;

  const minSweepDistance = Number.isFinite(options.minSweepDistance)
    ? Math.max(0, options.minSweepDistance)
    : 0;

  const sweeps = [];
  const usedLevels = [];

  // Exclude the last candle because it may still be forming.
  const lastClosedIndex = candles.length - 2;

  for (const level of swingEvents) {
    if (
      !level ||
      !Number.isInteger(level.index) ||
      level.index < 0 ||
      level.index >= lastClosedIndex ||
      !Number.isFinite(level.price)
    ) {
      continue;
    }

    if (
      level.type !== "SWING_HIGH" &&
      level.type !== "SWING_LOW"
    ) {
      continue;
    }

    const age = lastClosedIndex - level.index;

    if (age > maxAge) {
      continue;
    }

    // Ignore duplicate or nearly identical levels.
    const duplicate = usedLevels.some(item =>
      item.type === level.type &&
      Math.abs(item.price - level.price) <= minSweepDistance
    );

    if (duplicate) {
      continue;
    }

    usedLevels.push({
      type: level.type,
      price: level.price
    });

    for (
      let i = level.index + 1;
      i <= lastClosedIndex;
      i++
    ) {
      const candle = candles[i];

      if (
        !candle ||
        !Number.isFinite(candle.open) ||
        !Number.isFinite(candle.high) ||
        !Number.isFinite(candle.low) ||
        !Number.isFinite(candle.close)
      ) {
        continue;
      }

      const range = candle.high - candle.low;

      if (range <= 0) {
        continue;
      }

      const upperWick =
        candle.high - Math.max(candle.open, candle.close);

      const lowerWick =
        Math.min(candle.open, candle.close) - candle.low;

      // BSL sweep
      if (level.type === "SWING_HIGH") {
        const sweptDistance = candle.high - level.price;

        const wickRatio = upperWick / range;

        if (
          sweptDistance >= minSweepDistance &&
          sweptDistance > 0 &&
          candle.close < level.price &&
          wickRatio >= minWickRatio
        ) {
          sweeps.push({
            type: "BSL_SWEEP",
            level: level.price,
            swingIndex: level.index,
            sweepIndex: i,
            wickPrice: candle.high,
            sweptDistance,
            wickRatio,
            confirmation: "CLOSE_BACK_BELOW",
            status: "CONFIRMED"
          });

          break;
        }
      }

      // SSL sweep
      if (level.type === "SWING_LOW") {
        const sweptDistance = level.price - candle.low;

        const wickRatio = lowerWick / range;

        if (
          sweptDistance >= minSweepDistance &&
          sweptDistance > 0 &&
          candle.close > level.price &&
          wickRatio >= minWickRatio
        ) {
          sweeps.push({
            type: "SSL_SWEEP",
            level: level.price,
            swingIndex: level.index,
            sweepIndex: i,
            wickPrice: candle.low,
            sweptDistance,
            wickRatio,
            confirmation: "CLOSE_BACK_ABOVE",
            status: "CONFIRMED"
          });

          break;
        }
      }
    }
  }

  return sweeps.sort(
    (a, b) => a.sweepIndex - b.sweepIndex
  );
}

if (typeof window !== "undefined") {
  window.detectLiquiditySweeps = detectLiquiditySweeps;
}

if (typeof module !== "undefined") {
  module.exports = {
    detectLiquiditySweeps
  };
}
