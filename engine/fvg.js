
"use strict";

// ======================================
// AI GOLD SIGNALS
// Fair Value Gap Detection
// Three-Candle Imbalance
// ======================================

function detectFVG(candles, options = {}) {
  if (!Array.isArray(candles) || candles.length < 3) {
    return [];
  }

  const minGap = options.minGap ?? 0;
  const gaps = [];

  for (let i = 2; i < candles.length; i++) {
    const first = candles[i - 2];
    const middle = candles[i - 1];
    const third = candles[i];

    const values = [
      first.high,
      first.low,
      middle.open,
      middle.close,
      third.high,
      third.low
    ];

    if (!values.every(Number.isFinite)) continue;

    const middleBullish = middle.close > middle.open;
    const middleBearish = middle.close < middle.open;

    // Bullish FVG:
    // Third candle low is above first candle high.
    if (
      middleBullish &&
      third.low > first.high
    ) {
      const gapSize = third.low - first.high;

      if (gapSize >= minGap) {
        gaps.push({
          type: "BULLISH_FVG",
          high: third.low,
          low: first.high,
          size: gapSize,
          candleIndex: i,
          status: "OPEN"
        });
      }
    }

    // Bearish FVG:
    // Third candle high is below first candle low.
    if (
      middleBearish &&
      third.high < first.low
    ) {
      const gapSize = first.low - third.high;

      if (gapSize >= minGap) {
        gaps.push({
          type: "BEARISH_FVG",
          high: first.low,
          low: third.high,
          size: gapSize,
          candleIndex: i,
          status: "OPEN"
        });
      }
    }
  }

  return gaps;
}

function updateFVGStatus(gaps, candles) {
  if (!Array.isArray(gaps) || !Array.isArray(candles)) {
    return [];
  }

  return gaps.map(gap => {
    let touched = false;
    let filled = false;

    for (
      let i = gap.candleIndex + 1;
      i < candles.length;
      i++
    ) {
      const candle = candles[i];

      if (
        !Number.isFinite(candle.high) ||
        !Number.isFinite(candle.low)
      ) continue;

      if (
        candle.low <= gap.high &&
        candle.high >= gap.low
      ) {
        touched = true;
      }

      if (gap.type === "BULLISH_FVG" && candle.low <= gap.low) {
        filled = true;
      }

      if (gap.type === "BEARISH_FVG" && candle.high >= gap.high) {
        filled = true;
      }

      if (filled) break;
    }

    return {
      ...gap,
      status: filled ? "FILLED" : touched ? "TOUCHED" : "OPEN"
    };
  });
}

if (typeof module !== "undefined") {
  module.exports = {
    detectFVG,
    updateFVGStatus
  };
}
