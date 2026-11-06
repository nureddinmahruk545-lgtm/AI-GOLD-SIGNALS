
"use strict";

// ======================================
// AI GOLD SIGNALS
// Market Structure Engine
// BOS / CHoCH / Swing High / Swing Low
// ======================================

function detectSwingHigh(candles, index, strength = 2) {
  if (index < strength || index + strength >= candles.length) {
    return false;
  }

  const current = candles[index].high;

  for (let i = 1; i <= strength; i++) {
    if (
      current <= candles[index - i].high ||
      current <= candles[index + i].high
    ) {
      return false;
    }
  }

  return true;
}

function detectSwingLow(candles, index, strength = 2) {
  if (index < strength || index + strength >= candles.length) {
    return false;
  }

  const current = candles[index].low;

  for (let i = 1; i <= strength; i++) {
    if (
      current >= candles[index - i].low ||
      current >= candles[index + i].low
    ) {
      return false;
    }
  }

  return true;
}

function analyzeStructure(candles) {
  if (!Array.isArray(candles) || candles.length < 10) {
    return {
      status: "INSUFFICIENT_DATA",
      trend: "UNKNOWN",
      events: []
    };
  }

  const events = [];

  for (let i = 2; i < candles.length - 2; i++) {
    if (detectSwingHigh(candles, i)) {
      events.push({
        type: "SWING_HIGH",
        price: candles[i].high,
        index: i
      });
    }

    if (detectSwingLow(candles, i)) {
      events.push({
        type: "SWING_LOW",
        price: candles[i].low,
        index: i
      });
    }
  }

  return {
    status: "ANALYZED",
    trend: "UNCONFIRMED",
    events
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    detectSwingHigh,
    detectSwingLow,
    analyzeStructure
  };
}
