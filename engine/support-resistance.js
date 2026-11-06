
"use strict";

// ======================================
// AI GOLD SIGNALS
// Support & Resistance Engine
// Minimum 3 independent reactions
// ======================================

function detectSupportResistance(candles, options = {}) {
  if (!Array.isArray(candles) || candles.length < 10) {
    return [];
  }

  const tolerance = options.tolerance ?? 1.5;
  const minTouches = options.minTouches ?? 3;
  const minSeparation = options.minSeparation ?? 3;
  const swingStrength = options.swingStrength ?? 2;

  const levels = [];

  function isSwingHigh(index) {
    for (let j = 1; j <= swingStrength; j++) {
      if (
        candles[index].high <= candles[index - j].high ||
        candles[index].high <= candles[index + j].high
      ) return false;
    }
    return true;
  }

  function isSwingLow(index) {
    for (let j = 1; j <= swingStrength; j++) {
      if (
        candles[index].low >= candles[index - j].low ||
        candles[index].low >= candles[index + j].low
      ) return false;
    }
    return true;
  }

  const candidates = [];

  for (
    let i = swingStrength;
    i < candles.length - swingStrength;
    i++
  ) {
    if (isSwingHigh(i)) {
      candidates.push({
        type: "RESISTANCE",
        price: candles[i].high,
        index: i
      });
    }

    if (isSwingLow(i)) {
      candidates.push({
        type: "SUPPORT",
        price: candles[i].low,
        index: i
      });
    }
  }

  for (const candidate of candidates) {
    let level = levels.find(item =>
      item.type === candidate.type &&
      Math.abs(item.price - candidate.price) <= tolerance
    );

    if (!level) {
      level = {
        type: candidate.type,
        price: candidate.price,
        touches: [],
        strength: 0
      };

      levels.push(level);
    }

    const lastTouch = level.touches[level.touches.length - 1];

    if (
      !lastTouch ||
      candidate.index - lastTouch.index >= minSeparation
    ) {
      level.touches.push({
        index: candidate.index,
        price: candidate.price
      });

      // Update average level price.
      const sum = level.touches.reduce(
        (total, touch) => total + touch.price,
        0
      );

      level.price = sum / level.touches.length;
    }
  }

  return levels
    .filter(level => level.touches.length >= minTouches)
    .map(level => ({
      ...level,
      strength: Math.min(
        100,
        level.touches.length * 20
      ),
      status: "VALID_CANDIDATE"
    }));
}

if (typeof module !== "undefined") {
  module.exports = { detectSupportResistance };
}
