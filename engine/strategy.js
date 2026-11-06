
"use strict";

// ======================================
// AI GOLD SIGNALS
// Strategy Decision Engine
// XAUUSD - 1H + 5M - SMC / ICT
//
// Features:
// - BUY LIMIT / SELL LIMIT
// - BUY MARKET / SELL MARKET
// - No chasing price
// - Closed-candle confirmation required for MARKET
// - Risk/Reward validation
// - No signal when conditions are incomplete
// ======================================

const StrategyEngine = (() => {

  // ------------------------------
  // Default settings
  // ------------------------------

  const DEFAULT_OPTIONS = {
    minRiskReward: 2,
    minSupportResistanceTouches: 3,
    requireLiquiditySweep: true,
    requireOrderBlock: true,
    requireFVG: true,
    requireSupportResistance: true,
    requireBOS: true
  };

  // ------------------------------
  // Helper functions
  // ------------------------------

  function isFiniteNumber(value) {
    return (
      typeof value === "number" &&
      Number.isFinite(value)
    );
  }

  function noTrade(reason, extra = {}) {
    return {
      signal: "NO TRADE",
      direction: "NONE",
      executionType: null,
      entry: null,
      stopLoss: null,
      takeProfit: null,
      riskReward: null,
      executionReason: null,
      reasons: [reason],
      ...extra
    };
  }

  function isValidZone(zone) {
    return (
      zone &&
      isFiniteNumber(zone.low) &&
      isFiniteNumber(zone.high) &&
      zone.low <= zone.high
    );
  }

  // ------------------------------
  // Validate price levels
  // ------------------------------

  function validatePrices(
    entry,
    stopLoss,
    takeProfit,
    bullish
  ) {
    if (
      !isFiniteNumber(entry) ||
      !isFiniteNumber(stopLoss) ||
      !isFiniteNumber(takeProfit)
    ) {
      return {
        valid: false,
        reason: "Entry, Stop Loss or Take Profit is invalid."
      };
    }

    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(takeProfit - entry);

    if (risk <= 0 || reward <= 0) {
      return {
        valid: false,
        reason: "Invalid risk or reward distance."
      };
    }

    if (
      bullish &&
      stopLoss >= entry
    ) {
      return {
        valid: false,
        reason: "BUY Stop Loss must be below Entry."
      };
    }

    if (
      !bullish &&
      stopLoss <= entry
    ) {
      return {
        valid: false,
        reason: "SELL Stop Loss must be above Entry."
      };
    }

    if (
      bullish &&
      takeProfit <= entry
    ) {
      return {
        valid: false,
        reason: "BUY Take Profit must be above Entry."
      };
    }

    if (
      !bullish &&
      takeProfit >= entry
    ) {
      return {
        valid: false,
        reason: "SELL Take Profit must be below Entry."
      };
    }

    return {
      valid: true,
      risk,
      reward,
      riskReward: reward / risk
    };
  }

  // ------------------------------
  // Determine execution type
  // ------------------------------
  //
  // LIMIT:
  // BUY  -> planned entry below current price
  // SELL -> planned entry above current price
  //
  // MARKET:
  // Price must be inside the entry zone
  // AND a closed-candle confirmation is required.
  //
  // Never chase price.
  // ------------------------------

  function determineExecutionType(data, bullish) {

    const {
      currentPrice,
      entry,
      entryZone,
      marketConfirmation
    } = data;

    if (
      !isFiniteNumber(currentPrice) ||
      currentPrice <= 0
    ) {
      return {
        valid: false,
        reason: "Current market price is missing or invalid."
      };
    }

    if (
      !isFiniteNumber(entry) ||
      entry <= 0
    ) {
      return {
        valid: false,
        reason: "Planned entry price is missing or invalid."
      };
    }

    if (entryZone && !isValidZone(entryZone)) {
      return {
        valid: false,
        reason: "Entry zone boundaries are invalid."
      };
    }

    // Check whether price is currently inside the zone.
    const insideZone = isValidZone(entryZone)
      ? (
          currentPrice >= entryZone.low &&
          currentPrice <= entryZone.high
        )
      : false;

    // MARKET execution:
    // Requires price inside the zone and confirmation.
    if (
      insideZone &&
      marketConfirmation === true
    ) {
      return {
        valid: true,
        type: "MARKET",
        entry: currentPrice,
        reason:
          "Price is inside the entry zone and closed-candle confirmation is present."
      };
    }

    // LIMIT execution:
    // BUY LIMIT must be below current price.
    // SELL LIMIT must be above current price.
    const validLimit = bullish
      ? entry < currentPrice
      : entry > currentPrice;

    if (validLimit) {

      // If an entry zone is provided,
      // planned entry must be inside that zone.
      if (
        isValidZone(entryZone) &&
        (
          entry < entryZone.low ||
          entry > entryZone.high
        )
      ) {
        return {
          valid: false,
          reason: "Planned LIMIT entry is outside the entry zone."
        };
      }

      return {
        valid: true,
        type: "LIMIT",
        entry,
        reason:
          "Price has not reached the planned entry. Waiting for a LIMIT execution."
      };
    }

    return {
      valid: false,
      reason:
        "Price has already passed the planned entry. Do not chase the market."
    };
  }

  // ------------------------------
  // Main strategy evaluation
  // ------------------------------

  function evaluateStrategy(data, options = {}) {

    const config = {
      ...DEFAULT_OPTIONS,
      ...options
    };

    if (
      !data ||
      typeof data !== "object"
    ) {
      return noTrade("Missing analysis data.");
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

    // 1. Higher timeframe trend
    if (
      !["BULLISH", "BEARISH"].includes(trend1H)
    ) {
      return noTrade(
        "1H trend is not confirmed."
      );
    }

    const bullish = trend1H === "BULLISH";

    // 2. Market structure
    if (
      config.requireBOS &&
      bosConfirmed !== true
    ) {
      return noTrade(
        "5M BOS is not confirmed."
      );
    }

    const expectedSweep = bullish
      ? "SSL_SWEEP"
      : "BSL_SWEEP";

    const expectedOB = bullish
      ? "BULLISH_OB"
      : "BEARISH_OB";

    const expectedFVG = bullish
      ? "BULLISH_FVG"
      : "BEARISH_FVG";

    const expectedSR = bullish
      ? "SUPPORT"
      : "RESISTANCE";

    // 3. Liquidity sweep
    if (config.requireLiquiditySweep) {

      if (
        !liquiditySweep ||
        liquiditySweep.type !== expectedSweep ||
        liquiditySweep.confirmed !== true
      ) {
        return noTrade(
          "Required liquidity sweep is missing or unconfirmed."
        );
      }
    }

    // 4. Order Block
    if (config.requireOrderBlock) {

      if (
        !orderBlock ||
        orderBlock.type !== expectedOB ||
        orderBlock.validated !== true
      ) {
        return noTrade(
          "Validated Order Block is missing."
        );
      }
    }

    // 5. Fair Value Gap
    if (config.requireFVG) {

      if (
        !fvg ||
        fvg.type !== expectedFVG ||
        fvg.status === "FILLED" ||
        fvg.confirmed !== true
      ) {
        return noTrade(
          "Valid matching FVG is missing or unconfirmed."
        );
      }
    }

    // 6. Support / Resistance
    if (config.requireSupportResistance) {

      if (
        !supportResistance ||
        supportResistance.type !== expectedSR ||
        !isFiniteNumber(supportResistance.touches) ||
        supportResistance.touches <
          config.minSupportResistanceTouches ||
        supportResistance.reacted !== true
      ) {
        return noTrade(
          "Qualified Support/Resistance is missing."
        );
      }
    }

    // 7. Select LIMIT or MARKET
    const execution = determineExecutionType(
      data,
      bullish
    );

    if (!execution.valid) {
      return noTrade(execution.reason);
    }

    const finalEntry = execution.entry;

    // 8. Validate SL and TP against selected entry
    const priceCheck = validatePrices(
      finalEntry,
      stopLoss,
      takeProfit,
      bullish
    );

    if (!priceCheck.valid) {
      return noTrade(priceCheck.reason);
    }

    // 9. Risk / Reward
    const rr = priceCheck.riskReward;

    if (
      !isFiniteNumber(config.minRiskReward) ||
      config.minRiskReward <= 0
    ) {
      return noTrade(
        "Minimum Risk/Reward setting is invalid."
      );
    }

    if (rr < config.minRiskReward) {
      return noTrade(
        "Risk/Reward is below the required minimum.",
        {
          calculatedRiskReward: Number(rr.toFixed(2)),
          requiredRiskReward: config.minRiskReward
        }
      );
    }

    // 10. Final signal
    const direction = bullish
      ? "BULLISH"
      : "BEARISH";

    const signal = bullish
      ? "BUY"
      : "SELL";

    const executionLabel = bullish
      ? `BUY ${execution.type}`
      : `SELL ${execution.type}`;

    return {
      signal,
      direction,

      // LIMIT or MARKET
      executionType: execution.type,
      executionLabel,

      entry: finalEntry,
      plannedEntry: entry,
      currentPrice: data.currentPrice,

      stopLoss,
      takeProfit,

      riskReward: Number(rr.toFixed(2)),

      executionReason: execution.reason,

      reasons: [
        "Higher timeframe trend confirmed.",
        "Market structure conditions passed.",
        "Liquidity conditions passed.",
        "Order Block conditions passed.",
        "FVG conditions passed.",
        "Support/Resistance conditions passed.",
        `Execution selected: ${executionLabel}.`,
        "Risk/Reward requirement passed."
      ]
    };
  }

  // ------------------------------
  // Public API
  // ------------------------------

  return {
    evaluateStrategy,
    determineExecutionType,
    validatePrices
  };

})();

// Browser access
if (typeof window !== "undefined") {
  window.StrategyEngine = StrategyEngine;
  window.evaluateStrategy =
    StrategyEngine.evaluateStrategy;
}

// Node.js access
if (typeof module !== "undefined") {
  module.exports = StrategyEngine;
}
