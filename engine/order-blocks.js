
"use strict";

// ======================================
// AI GOLD SIGNALS
// Order Block Detection Engine
// Bullish OB / Bearish OB
// ======================================

function detectOrderBlocks(candles, swingEvents, options = {}) {
  if (!Array.isArray(candles) || !Array.isArray(swingEvents)) {
    return [];
  }

  const lookback = options.lookback ?? 10;
  const atrPeriod = options.atrPeriod ?? 14;
  const displacementFactor = options.displacementFactor ?? 1.2;

  if (
    candles.length < atrPeriod + 2 ||
    !Number.isInteger(lookback) ||
    lookback < 1
  ) {
    return [];
  }

  const blocks = [];

  function getATR(index) {
    const start = Math.max(1, index - atrPeriod + 1);
    const ranges = [];

    for (let i = start; i <= index; i++) {
      const c = candles[i];
      const previousClose = candles[i - 1].close;

      ranges.push(
        Math.max(
          c.high - c.low,
          Math.abs(c.high - previousClose),
          Math.abs(c.low - previousClose)
        )
      );
    }

    if (ranges.length === 0) return null;

    return ranges.reduce((sum, value) => sum + value, 0)
      / ranges.length;
  }

  for (let i = atrPeriod; i < candles.length; i++) {
    const candle = candles[i];

    const values = [
      candle.open,
      candle.high,
      candle.low,
      candle.close
    ];

    if (!values.every(Number.isFinite)) continue;

    const atr = getATR(i);
    if (!atr || atr <= 0) continue;

    const body = Math.abs(candle.close - candle.open);

    // Require strong displacement.
    if (body < atr * displacementFactor) continue;

    const bullish = candle.close > candle.open;
    const bearish = candle.close < candle.open;

    if (!bullish && !bearish) continue;

    const previousSwings = swingEvents.filter(event =>
      event.index < i &&
      i - event.index <= lookback
    );

    let brokenSwing = null;

    if (bullish) {
      brokenSwing = previousSwings
        .filter(event =>
          event.type === "SWING_HIGH" &&
          candle.close > event.price
        )
        .sort((a, b) => b.index - a.index)[0];
    }

    if (bearish) {
      brokenSwing = previousSwings
        .filter(event =>
          event.type === "SWING_LOW" &&
          candle.close < event.price
        )
        .sort((a, b) => b.index - a.index)[0];
    }

    if (!brokenSwing) continue;

    // Find the last opposite candle before displacement.
    for (
      let j = i - 1;
      j >= Math.max(0, i - lookback);
      j--
    ) {
      const previous = candles[j];

      const opposite =
        bullish
          ? previous.close < previous.open
          : previous.close > previous.open;

      if (!opposite) continue;

      blocks.push({
        type: bullish ? "BULLISH_OB" : "BEARISH_OB",
        high: previous.high,
        low: previous.low,
        candleIndex: j,
        confirmationIndex: i,
        brokenSwingPrice: brokenSwing.price,
        status: "CANDIDATE"
      });

      break;
    }
  }

  return blocks;
}

if (typeof module !== "undefined") {
  module.exports = { detectOrderBlocks };
}
