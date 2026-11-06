
"use strict";

// ======================================
// AI GOLD SIGNALS
// Liquidity Detection Engine V4
// Confirmed Swings + Closed Candle Sweeps
// Breakout Invalidation Protection
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

  if (
    !Number.isFinite(nowSeconds) ||
    !Number.isFinite(timeframeSeconds) ||
    timeframeSeconds <= 0
  ) {
    return [];
  }

  // ======================================
  // 1. Identify valid closed candles
  // ======================================

  const closedIndexes = [];

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    if (
      !candle ||
      !Number.isFinite(candle.time) ||
      !Number.isFinite(candle.open) ||
      !Number.isFinite(candle.high) ||
      !Number.isFinite(candle.low) ||
      !Number.isFinite(candle.close)
    ) {
      continue;
    }

    const validOHLC =
      candle.high >= candle.low &&
      candle.high >= Math.max(candle.open, candle.close) &&
      candle.low <= Math.min(candle.open, candle.close);

    const isClosed =
      candle.time + timeframeSeconds <= nowSeconds;

    if (validOHLC && isClosed) {
      closedIndexes.push(i);
    }
  }

  if (closedIndexes.length < 5) {
    return [];
  }

  const lastClosedIndex =
    closedIndexes[closedIndexes.length - 1];

  // ======================================
  // 2. Process confirmed swing levels
  // ======================================

  const sweeps = [];

  // Prevent duplicate processing.
  const processedLevels = new Set();

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
      confirmationIndex >= lastClosedIndex ||
      level.sourceIndex < 0 ||
      level.sourceIndex >= candles.length
    ) {
      continue;
    }

    const levelKey = [
      level.type,
      level.price.toFixed(8),
      level.sourceIndex,
      confirmationIndex
    ].join("_");

    if (processedLevels.has(levelKey)) {
      continue;
    }

    processedLevels.add(levelKey);

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

    // ======================================
    // 3. Search after swing confirmation
    // ======================================

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

      // ======================================
      // 4. Buy-side liquidity (BSL)
      // ======================================

      if (level.type === "SWING_HIGH") {
        // A candle close above the swing high
        // permanently invalidates this liquidity level.
        if (candle.close > level.price) {
          break;
        }

        const sweptDistance =
          candle.high - level.price;

        const wickRatio =
          upperWick / range;

        const validSweep =
          sweptDistance > 0 &&
          sweptDistance >= minSweepDistance &&
          candle.close < level.price &&
          wickRatio >= minWickRatio;

        if (validSweep) {
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
            status: "CONFIRMED",
            engineVersion: "V4"
          });

          // One confirmed sweep per swing level.
          break;
        }
      }

      // ======================================
      // 5. Sell-side liquidity (SSL)
      // ======================================

      if (level.type === "SWING_LOW") {
        // A candle close below the swing low
        // permanently invalidates this liquidity level.
        if (candle.close < level.price) {
          break;
        }

        const sweptDistance =
          level.price - candle.low;

        const wickRatio =
          lowerWick / range;

        const validSweep =
          sweptDistance > 0 &&
          sweptDistance >= minSweepDistance &&
          candle.close > level.price &&
          wickRatio >= minWickRatio;

        if (validSweep) {
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
            status: "CONFIRMED",
            engineVersion: "V4"
          });

          // One confirmed sweep per swing level.
          break;
        }
      }
    }
  }

  // ======================================
  // 6. Return chronological results
  // ======================================

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
