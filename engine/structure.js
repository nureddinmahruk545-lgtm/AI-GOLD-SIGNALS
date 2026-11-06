"use strict";

// ======================================
// AI GOLD SIGNALS
// Market Structure Engine
// Swing High / Swing Low / BOS / CHoCH
// ======================================

function detectSwingHigh(candles, index, strength = 2) {
  if (
    !Array.isArray(candles) ||
    index < strength ||
    index + strength >= candles.length
  ) {
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
  if (
    !Array.isArray(candles) ||
    index < strength ||
    index + strength >= candles.length
  ) {
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

function analyzeStructure(candles, options = {}) {
  const strength = options.strength ?? 2;
  const timeframeSeconds = options.timeframeSeconds ?? 3600;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (
    !Array.isArray(candles) ||
    candles.length < strength * 2 + 5
  ) {
    return {
      status: "INSUFFICIENT_DATA",
      trend: "UNKNOWN",
      events: [],
      swings: []
    };
  }

  if (
    !Number.isInteger(strength) ||
    strength < 1 ||
    !Number.isFinite(timeframeSeconds) ||
    timeframeSeconds <= 0
  ) {
    throw new Error("Invalid structure analysis options");
  }

  // Use closed candles only.
  // Assumes candle.time is the candle opening timestamp in seconds.
  const closedCandles = candles.filter(candle => {
    return (
      Number.isFinite(candle.time) &&
      candle.time + timeframeSeconds <= now &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close) &&
      candle.high >= candle.low &&
      candle.high >= Math.max(candle.open, candle.close) &&
      candle.low <= Math.min(candle.open, candle.close)
    );
  });

  if (closedCandles.length < strength * 2 + 5) {
    return {
      status: "INSUFFICIENT_CLOSED_DATA",
      trend: "UNKNOWN",
      events: [],
      swings: [],
      closedCandleCount: closedCandles.length
    };
  }

  const swings = [];
  const events = [];
  const brokenLevels = new Set();

  let trend = "UNKNOWN";
  let lastBreak = null;

  // A swing is confirmed only after the required candles
  // to its right have closed.
  for (let i = strength; i < closedCandles.length; i++) {
    const pivotIndex = i - strength;
    const pivot = closedCandles[pivotIndex];

    if (detectSwingHigh(closedCandles, pivotIndex, strength)) {
      const swing = {
        id: "HIGH_" + pivotIndex,
        type: "SWING_HIGH",
        price: pivot.high,
        index: pivotIndex,
        confirmedAt: i,
        time: pivot.time
      };

      swings.push(swing);
      events.push({ ...swing });
    }

    if (detectSwingLow(closedCandles, pivotIndex, strength)) {
      const swing = {
        id: "LOW_" + pivotIndex,
        type: "SWING_LOW",
        price: pivot.low,
        index: pivotIndex,
        confirmedAt: i,
        time: pivot.time
      };

      swings.push(swing);
      events.push({ ...swing });
    }
  }

  // Process confirmed swing levels chronologically.
  let activeHigh = null;
  let activeLow = null;

  const swingsByConfirmation = new Map();

  for (const swing of swings) {
    if (!swingsByConfirmation.has(swing.confirmedAt)) {
      swingsByConfirmation.set(swing.confirmedAt, []);
    }

    swingsByConfirmation.get(swing.confirmedAt).push(swing);
  }

  for (let i = strength; i < closedCandles.length; i++) {
    const candle = closedCandles[i];
    const previous = closedCandles[i - 1];

    const newlyConfirmed = swingsByConfirmation.get(i) || [];

    for (const swing of newlyConfirmed) {
      if (swing.type === "SWING_HIGH") {
        activeHigh = swing;
      }

      if (swing.type === "SWING_LOW") {
        activeLow = swing;
      }
    }

    const brokeHigh =
      activeHigh &&
      !brokenLevels.has(activeHigh.id) &&
      previous.close <= activeHigh.price &&
      candle.close > activeHigh.price;

    const brokeLow =
      activeLow &&
      !brokenLevels.has(activeLow.id) &&
      previous.close >= activeLow.price &&
      candle.close < activeLow.price;

    // If both sides break on the same candle,
    // do not guess the market direction.
    if (brokeHigh && brokeLow) {
      events.push({
        type: "AMBIGUOUS_BREAK",
        index: i,
        time: candle.time,
        close: candle.close
      });

      continue;
    }

    let direction = null;
    let brokenSwing = null;

    if (brokeHigh) {
      direction = "BULLISH";
      brokenSwing = activeHigh;
    } else if (brokeLow) {
      direction = "BEARISH";
      brokenSwing = activeLow;
    }

    if (!direction || !brokenSwing) {
      continue;
    }

    brokenLevels.add(brokenSwing.id);

    let eventType;

    if (trend === "UNKNOWN") {
      eventType = "INITIAL_BREAK";
    } else if (trend === direction) {
      eventType = "BOS";
    } else {
      eventType = "CHoCH";
    }

    const previousTrend = trend;

    trend = direction;

    const structureEvent = {
      type: eventType,
      direction,
      previousTrend,
      level: brokenSwing.price,
      brokenSwingId: brokenSwing.id,
      index: i,
      time: candle.time,
      close: candle.close,
      confirmation: "CANDLE_CLOSE"
    };

    events.push(structureEvent);
    lastBreak = structureEvent;
  }

  events.sort((a, b) => a.index - b.index);

  return {
    status: "ANALYZED",
    trend,
    events,
    swings,
    lastBreak,
    closedCandleCount: closedCandles.length,
    settings: {
      strength,
      timeframeSeconds
    }
  };
}

// ======================================
// EXPORTS
// ======================================

if (typeof module !== "undefined") {
  module.exports = {
    detectSwingHigh,
    detectSwingLow,
    analyzeStructure
  };
}
