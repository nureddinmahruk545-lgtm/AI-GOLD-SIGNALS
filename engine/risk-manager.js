
"use strict";

// ======================================
// AI GOLD SIGNALS
// Risk Management Engine
// XAUUSD Position Sizing
// ======================================

function calculatePositionSize(config) {
  const {
    capital,
    riskPercent,
    entry,
    stopLoss,
    contractSize,
    valuePerPriceUnitPerLot,
    maxRiskPercent = 1
  } = config || {};

  const values = [
    capital,
    riskPercent,
    entry,
    stopLoss,
    contractSize,
    valuePerPriceUnitPerLot
  ];

  if (!values.every(Number.isFinite)) {
    return {
      valid: false,
      reason: "Invalid or missing inputs"
    };
  }

  if (
    capital <= 0 ||
    riskPercent <= 0 ||
    riskPercent > maxRiskPercent ||
    entry <= 0 ||
    stopLoss <= 0 ||
    contractSize <= 0 ||
    valuePerPriceUnitPerLot <= 0
  ) {
    return {
      valid: false,
      reason: "Risk settings or prices are outside allowed limits"
    };
  }

  const stopDistance = Math.abs(entry - stopLoss);

  if (stopDistance <= 0) {
    return {
      valid: false,
      reason: "Stop Loss distance must be greater than zero"
    };
  }

  const riskAmount = capital * (riskPercent / 100);

  const riskPerLot =
    stopDistance * valuePerPriceUnitPerLot;

  if (riskPerLot <= 0) {
    return {
      valid: false,
      reason: "Invalid risk per lot"
    };
  }

  const rawLot = riskAmount / riskPerLot;

  return {
    valid: true,
    capital,
    riskPercent,
    riskAmount: Number(riskAmount.toFixed(2)),
    stopDistance: Number(stopDistance.toFixed(2)),
    riskPerLot: Number(riskPerLot.toFixed(2)),
    rawLot: Number(rawLot.toFixed(4)),
    contractSize,
    note: "Verify broker contract specifications and lot limits before use."
  };
}

function calculateTradeTargets(config) {
  const {
    entry,
    stopLoss,
    direction,
    rewardRatios = [1, 2, 3]
  } = config || {};

  if (
    !Number.isFinite(entry) ||
    !Number.isFinite(stopLoss) ||
    !["BUY", "SELL"].includes(direction)
  ) {
    return {
      valid: false,
      reason: "Invalid trade target inputs"
    };
  }

  const risk = Math.abs(entry - stopLoss);

  if (risk <= 0) {
    return {
      valid: false,
      reason: "Invalid stop loss distance"
    };
  }

  if (
    !Array.isArray(rewardRatios) ||
    rewardRatios.length === 0 ||
    !rewardRatios.every(
      ratio => Number.isFinite(ratio) && ratio > 0
    )
  ) {
    return {
      valid: false,
      reason: "Invalid reward ratios"
    };
  }

  const targets = rewardRatios.map(ratio => ({
    ratio,
    price: Number(
      (
        direction === "BUY"
          ? entry + risk * ratio
          : entry - risk * ratio
      ).toFixed(2)
    )
  }));

  return {
    valid: true,
    entry,
    stopLoss,
    risk: Number(risk.toFixed(2)),
    targets
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    calculatePositionSize,
    calculateTradeTargets
  };
}
