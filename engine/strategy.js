
"use strict";

// ======================================
// AI GOLD SIGNALS
// Strategy Decision Engine
// XAUUSD - 1H + 5M - SMC
// ======================================

function evaluateStrategy(data, options = {}) {
  const minRiskReward = options.minRiskReward ?? 2;

  const result = {
    signal: "NO TRADE",
    direction: "NONE",
    entry: null,
    stopLoss: null,
    takeProfit: null,
    riskReward: null,
    reasons: []
  };

  if (!data || typeof data !== "object") {
    result.reasons.push("Missing analysis data");
    return result;
  }

  const {
    trend1H,
    bosConfirmed,
    liquiditySweep,
    orderBlock,
    fvg,
    supportResistance,
    entry,
    stopLoss,
    takeProfit
  } = data;

  // 1. Confirm higher timeframe trend.
  if (!["BULLISH", "BEARISH"].includes(trend1H)) {
    result.reasons.push("1H trend is not confirmed");
    return result;
  }

  // 2. Confirm 5M market structure break.
  if (bosConfirmed !== true) {
    result.reasons.push("5M BOS is not confirmed");
    return result;
  }

  const bullish = trend1H === "BULLISH";
  const expectedSweep = bullish ? "SSL_SWEEP" : "BSL_SWEEP";
  const expectedOB = bullish ? "BULLISH_OB" : "BEARISH_OB";
  const expectedFVG = bullish ? "BULLISH_FVG" : "BEARISH_FVG";
  const expectedSR = bullish ? "SUPPORT" : "RESISTANCE";

  // 3. Liquidity sweep.
  if (
    !liquiditySweep ||
    liquiditySweep.type !== expectedSweep ||
    liquiditySweep.confirmed !== true
  ) {
    result.reasons.push("Required liquidity sweep is missing");
    return result;
  }

  // 4. Validated Order Block.
  if (
    !orderBlock ||
    orderBlock.type !== expectedOB ||
    orderBlock.validated !== true
  ) {
    result.reasons.push("Validated Order Block is missing");
    return result;
  }

  // 5. Matching FVG.
  if (
    !fvg ||
    fvg.type !== expectedFVG ||
    fvg.status === "FILLED" ||
    fvg.confirmed !== true
  ) {
    result.reasons.push("Valid matching FVG is missing");
    return result;
  }

  // 6. Support / Resistance with at least 3 reactions.
  if (
    !supportResistance ||
    supportResistance.type !== expectedSR ||
    supportResistance.touches < 3 ||
    supportResistance.reacted !== true
  ) {
    result.reasons.push("Qualified Support/Resistance is missing");
    return result;
  }

  // 7. Validate prices.
  const prices = [entry, stopLoss, takeProfit];

  if (!prices.every(Number.isFinite)) {
    result.reasons.push("Entry, SL or TP is invalid");
    return result;
  }

  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);

  if (risk <= 0 || reward <= 0) {
    result.reasons.push("Invalid risk or reward distance");
    return result;
  }

  // 8. Stop loss must be on the correct side.
  if (
    (bullish && stopLoss >= entry) ||
    (!bullish && stopLoss <= entry)
  ) {
    result.reasons.push("Stop Loss is on the wrong side");
    return result;
  }

  // 9. Take profit must be on the correct side.
  if (
    (bullish && takeProfit <= entry) ||
    (!bullish && takeProfit >= entry)
  ) {
    result.reasons.push("Take Profit is on the wrong side");
    return result;
  }

  const rr = reward / risk;

  if (rr < minRiskReward) {
    result.reasons.push("Risk/Reward is below minimum");
    return result;
  }

  // All required conditions passed.
  result.signal = bullish ? "BUY" : "SELL";
  result.direction = bullish ? "BULLISH" : "BEARISH";
  result.entry = entry;
  result.stopLoss = stopLoss;
  result.takeProfit = takeProfit;
  result.riskReward = Number(rr.toFixed(2));
  result.reasons.push("All strategy conditions passed");

  return result;
}

if (typeof module !== "undefined") {
  module.exports = { evaluateStrategy };
}
