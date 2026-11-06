"use strict";

// ======================================
// AI GOLD SIGNALS
// Liquidity Detection Engine V3
// Confirmed Swing + Closed Candle Sweeps
// ======================================

function detectLiquiditySweeps(candles, swingEvents, options = {}) {
  if (
    !Array.isArray(candles) ||
    !Array.isArray(swingEvents) ||
    candles.length < 5
  ) {
    return [];
  }

  const nowSeconds = Number.isFinite(options.nowSeconds)
    ? options.nowSeconds
    : Math.floor(Date.now() / 1000);

  const timeframeSeconds = Number.isFinite(options.timeframeSeconds)
    ? options.timeframeSeconds
    : 300;

  const minWickRatio = Number.isFinite(options.minWickRatio)
    ? Math.max(0, Math.min(1, options.minWickRatio))
    : 0.25;

  const maxAge = Number.isInteger(options.maxAge)
    ? Math.max(1, options.maxAge)
    : 100;

  const minSweepDistance = Number.isFinite(options.minSweepDistance)
    ? Math.max(0, options.minSweepDistance)
    : 0;

  const closedIndexes = [];

  // Identify closed candles using their timestamps.
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    if (
      candle &&
      Number.isFinite(candle.time) &&
      candle.time + timeframeSeconds <= nowSeconds &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close) &&
      candle.high >= candle.low &&
      candle.high >= Math.max(candle.open, candle.close) &&
      candle.low <= Math.min(candle.open, candle.close)
    ) {
      closedIndexes.push(i);
    }
  }

  if (closedIndexes.length < 5) {
    return [];
  }

  const lastClosedIndex =
    closedIndexes[closedIndexes.length - 1];

  const sweeps = [];
  const usedLevels = new Set();

  for (const level of swingEvents) {
    if (
      !level ||
      !Number.isFinite(level.price) ||
      !Number.isInteger(level.confirmationIndex) ||
      !Number.isInteger(level.sourceIndex)
    ) {
      continue;
    }

    if (
      level.type !== "SWING_HIGH" &&
      level.type !== "SWING_LOW"
    ) {
      continue;
    }

    const confirmationIndex = level.confirmationIndex;

    if (
      confirmationIndex < 0 ||
      confirmationIndex >= lastClosedIndex
    ) {
      continue;
    }

    const levelKey =
      level.type + "_" +
      level.price.toFixed(5) + "_" +
      level.confirmationIndex;

    if (usedLevels.has(levelKey)) {
      continue;
    }

    const confirmationPosition =
      closedIndexes.indexOf(confirmationIndex);

    if (confirmationPosition < 0) {
      continue;
    }

    const age =
      closedIndexes.length - 1 - confirmationPosition;

    if (age > maxAge) {
      continue;
    }

    // Search only after the swing confirmation candle.
    for (
      let position = confirmationPosition + 1;
      position < closedIndexes.length;
      position++
    ) {
      const candleIndex = closedIndexes[position];
      const candle = candles[candleIndex];

      const range = candle.high - candle.low;

      if (range <= 0) {
        continue;
      }

      const upperWick =
        candle.high - Math.max(candle.open, candle.close);

      const lowerWick =
        Math.min(candle.open, candle.close) - candle.low;

      if (level.type === "SWING_HIGH") {
        const sweptDistance =
          candle.high - level.price;

        const wickRatio = upperWick / range;

        if (
          sweptDistance > 0 &&
          sweptDistance >= minSweepDistance &&
          candle.close < level.price &&
          wickRatio >= minWickRatio
        ) {
          sweeps.push({
            type: "BSL_SWEEP",
            level: level.price,
            swingIndex: level.sourceIndex,
            confirmationIndex,
            sweepIndex: candleIndex,
            wickPrice: candle.high,
            sweptDistance,
            wickRatio,
            confirmation: "CLOSE_BACK_BELOW",
            status: "CONFIRMED"
          });

          usedLevels.add(levelKey);
          break;
        }
      }

      if (level.type === "SWING_LOW") {
        const sweptDistance =
          level.price - candle.low;

        const wickRatio = lowerWick / range;

        if (
          sweptDistance > 0 &&
          sweptDistance >= minSweepDistance &&
          candle.close > level.price &&
          wickRatio >= minWickRatio
        ) {
          sweeps.push({
            type: "SSL_SWEEP",
            level: level.price,
            swingIndex: level.sourceIndex,
            confirmationIndex,
            sweepIndex: candleIndex,
            wickPrice: candle.low,
            sweptDistance,
            wickRatio,
            confirmation: "CLOSE_BACK_ABOVE",
            status: "CONFIRMED"
          });

          usedLevels.add(levelKey);
          break;
        }
      }
    }
  }

  return sweeps.sort(
    (a, b) => a.sweepIndex - b.sweepIndex
  );
}

// ======================================
// EXPORTS
// ======================================

if (typeof window !== "undefined") {
  window.detectLiquiditySweeps = detectLiquiditySweeps;
}

if (typeof module !== "undefined") {
  module.exports = {
    detectLiquiditySweeps
  };
}
