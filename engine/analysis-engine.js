
"use strict";

// ======================================
// AI GOLD SIGNALS
// Central Analysis Engine
// SMC / ICT Integration
// BUY LIMIT / SELL LIMIT / MARKET
// Closed-candle processing
// ======================================

const AnalysisEngine = (() => {

  const CONFIG = {
    symbol: "XAUUSD",

    timeframes: {
      "5M": 300,
      "1H": 3600
    },

    minCandles: 30,
    minRiskReward: 2,
    minSRTouches: 3,

    structureStrength: 2,
    obLookback: 10,

    // Small price buffer around the OB.
    stopBuffer: 0.5
  };

  // ======================================
  // Dependencies
  // ======================================

  function getDependencies() {
    // Browser mode
    if (typeof window !== "undefined") {
      return {
        analyzeStructure: window.analyzeStructure,
        detectLiquiditySweeps: window.detectLiquiditySweeps,
        detectOrderBlocks: window.detectOrderBlocks,
        detectFVG: window.detectFVG,
        updateFVGStatus: window.updateFVGStatus,
        detectSupportResistance:
          window.detectSupportResistance,
        StrategyEngine: window.StrategyEngine
      };
    }

    // Node.js mode
    if (typeof require === "function") {
      return {
        analyzeStructure:
          require("./structure").analyzeStructure,

        detectLiquiditySweeps:
          require("./liquidity").detectLiquiditySweeps,

        detectOrderBlocks:
          require("./order-blocks").detectOrderBlocks,

        detectFVG:
          require("./fvg").detectFVG,

        updateFVGStatus:
          require("./fvg").updateFVGStatus,

        detectSupportResistance:
          require("./support-resistance")
            .detectSupportResistance,

        StrategyEngine:
          require("./strategy")
      };
    }

    throw new Error("Engine dependencies are unavailable.");
  }

  // ======================================
  // Helpers
  // ======================================

  function isNumber(value) {
    return (
      typeof value === "number" &&
      Number.isFinite(value)
    );
  }

  function noTrade(reason, diagnostics = {}) {
    return {
      success: true,
      mode: "ANALYSIS",

      signal: {
        type: "NO TRADE",
        direction: "NONE",
        executionType: null,
        entry: null,
        stopLoss: null,
        takeProfit: null,
        riskReward: null,
        reason
      },

      diagnostics
    };
  }

  function validateCandle(candle) {
    if (!candle) return false;

    const values = [
      candle.time,
      candle.open,
      candle.high,
      candle.low,
      candle.close
    ];

    if (!values.every(isNumber)) {
      return false;
    }

    return (
      candle.high >= candle.low &&
      candle.high >= Math.max(
        candle.open,
        candle.close
      ) &&
      candle.low <= Math.min(
        candle.open,
        candle.close
      )
    );
  }

  // Keep only fully closed candles.
  function getClosedCandles(
    candles,
    timeframeSeconds,
    nowSeconds
  ) {
    if (!Array.isArray(candles)) {
      return [];
    }

    return candles.filter(candle => {
      return (
        validateCandle(candle) &&
        candle.time + timeframeSeconds <= nowSeconds
      );
    });
  }

  function getLatest(items, predicate = () => true) {
    if (!Array.isArray(items)) return null;

    const filtered = items.filter(predicate);

    if (!filtered.length) return null;

    return filtered[filtered.length - 1];
  }

  // ======================================
  // Order Block validation
  // ======================================

  function validateOrderBlock(block, candles) {
    if (
      !block ||
      !isNumber(block.high) ||
      !isNumber(block.low) ||
      !Number.isInteger(block.confirmationIndex) ||
      block.low >= block.high
    ) {
      return false;
    }

    if (
      block.confirmationIndex < 0 ||
      block.confirmationIndex >= candles.length
    ) {
      return false;
    }

    // Check whether a later candle invalidated the block.
    for (
      let i = block.confirmationIndex + 1;
      i < candles.length;
      i++
    ) {
      const candle = candles[i];

      if (block.type === "BULLISH_OB") {
        if (candle.close < block.low) {
          return false;
        }
      }

      if (block.type === "BEARISH_OB") {
        if (candle.close > block.high) {
          return false;
        }
      }
    }

    return true;
  }

  // ======================================
  // FVG selection
  // ======================================

  function selectFVG(gaps, bullish) {
    const expectedType = bullish
      ? "BULLISH_FVG"
      : "BEARISH_FVG";

    return getLatest(
      gaps,
      gap =>
        gap.type === expectedType &&
        gap.status !== "FILLED" &&
        isNumber(gap.high) &&
        isNumber(gap.low) &&
        gap.high > gap.low
    );
  }

  // ======================================
  // Entry zone calculation
  // ======================================

  function buildEntryZone(orderBlock, fvg) {
    if (!orderBlock || !fvg) {
      return null;
    }

    // Use the overlapping price range only.
    const low = Math.max(
      orderBlock.low,
      fvg.low
    );

    const high = Math.min(
      orderBlock.high,
      fvg.high
    );

    if (
      !isNumber(low) ||
      !isNumber(high) ||
      low >= high
    ) {
      return null;
    }

    return {
      low,
      high,
      midpoint: (low + high) / 2,
      source: "OB_FVG_OVERLAP"
    };
  }

  // ======================================
  // Stop Loss and Take Profit
  // ======================================

  function buildTradeLevels(
    entry,
    zone,
    bullish
  ) {
    if (
      !isNumber(entry) ||
      !zone ||
      !isNumber(zone.low) ||
      !isNumber(zone.high)
    ) {
      return null;
    }

    const buffer = CONFIG.stopBuffer;

    const stopLoss = bullish
      ? zone.low - buffer
      : zone.high + buffer;

    const risk = Math.abs(entry - stopLoss);

    if (!isNumber(risk) || risk <= 0) {
      return null;
    }

    const takeProfit = bullish
      ? entry + risk * CONFIG.minRiskReward
      : entry - risk * CONFIG.minRiskReward;

    return {
      entry,
      stopLoss,
      takeProfit,
      riskReward: CONFIG.minRiskReward
    };
  }

  // ======================================
  // Main analysis
  // ======================================

  function analyze(marketData, options = {}) {
    try {
      const dependencies = getDependencies();

      const {
        analyzeStructure,
        detectLiquiditySweeps,
        detectOrderBlocks,
        detectFVG,
        updateFVGStatus,
        detectSupportResistance,
        StrategyEngine
      } = dependencies;

      // Check dependencies.
      const requiredFunctions = [
        analyzeStructure,
        detectLiquiditySweeps,
        detectOrderBlocks,
        detectFVG,
        updateFVGStatus,
        detectSupportResistance
      ];

      if (
        requiredFunctions.some(
          fn => typeof fn !== "function"
        ) ||
        !StrategyEngine ||
        typeof StrategyEngine.evaluateStrategy !== "function"
      ) {
        throw new Error(
          "One or more analysis engines are not loaded."
        );
      }

      if (
        !marketData ||
        !marketData.timeframes
      ) {
        throw new Error("Market data is missing.");
      }

      const nowSeconds = isNumber(options.nowSeconds)
        ? options.nowSeconds
        : Math.floor(Date.now() / 1000);

      // ----------------------------------
      // 1. Closed candle data
      // ----------------------------------

      const fiveMRaw =
        marketData.timeframes["5M"]?.candles;

      const oneHRaw =
        marketData.timeframes["1H"]?.candles;

      if (
        !Array.isArray(fiveMRaw) ||
        !Array.isArray(oneHRaw)
      ) {
        throw new Error(
          "5M or 1H candle data is missing."
        );
      }

      const fiveM = getClosedCandles(
        fiveMRaw,
        CONFIG.timeframes["5M"],
        nowSeconds
      );

      const oneH = getClosedCandles(
        oneHRaw,
        CONFIG.timeframes["1H"],
        nowSeconds
      );

      if (
        fiveM.length < CONFIG.minCandles ||
        oneH.length < CONFIG.minCandles
      ) {
        return noTrade(
          "Insufficient closed candle history.",
          {
            fiveMCount: fiveM.length,
            oneHCount: oneH.length
          }
        );
      }

      const latestCandle =
        fiveM[fiveM.length - 1];

      const currentPrice = latestCandle.close;

      // ----------------------------------
      // 2. Market structure
      // ----------------------------------

      const structureOptions = {
        strength: CONFIG.structureStrength,
        timeframeSeconds: 300,
        nowSeconds
      };

      const structure5M = analyzeStructure(
        fiveM,
        structureOptions
      );

      const structure1H = analyzeStructure(
        oneH,
        {
          strength: CONFIG.structureStrength,
          timeframeSeconds: 3600,
          nowSeconds
        }
      );

      const trend1H = structure1H.trend;

      if (
        !["BULLISH", "BEARISH"].includes(trend1H)
      ) {
        return noTrade(
          "1H market trend is not confirmed.",
          {
            structure1H,
            structure5M
          }
        );
      }

      // Only confirmed swing events are passed
      // to liquidity and OB engines.
      const swingEvents = structure5M.swings || [];

      // ----------------------------------
      // 3. Liquidity sweep
      // ----------------------------------

      const liquidityResults =
        detectLiquiditySweeps(
          fiveM,
          swingEvents,
          {
            nowSeconds,
            timeframeSeconds: 300
          }
        );

      const expectedSweep =
        trend1H === "BULLISH"
          ? "SSL_SWEEP"
          : "BSL_SWEEP";

      const liquiditySweep = getLatest(
        liquidityResults,
        item =>
          item.type === expectedSweep &&
          item.status === "CONFIRMED"
      );

      if (!liquiditySweep) {
        return noTrade(
          "No matching confirmed liquidity sweep.",
          {
            trend1H,
            liquidity: liquidityResults
          }
        );
      }

      // ----------------------------------
      // 4. Order Blocks
      // ----------------------------------

      const orderBlockResults =
        detectOrderBlocks(
          fiveM,
          swingEvents,
          {
            lookback: CONFIG.obLookback
          }
        );

      const expectedOB =
        trend1H === "BULLISH"
          ? "BULLISH_OB"
          : "BEARISH_OB";

      const orderBlock = getLatest(
        orderBlockResults,
        block =>
          block.type === expectedOB &&
          validateOrderBlock(block, fiveM)
      );

      if (!orderBlock) {
        return noTrade(
          "No valid, unbroken Order Block.",
          {
            trend1H,
            orderBlocks: orderBlockResults
          }
        );
      }

      // ----------------------------------
      // 5. Fair Value Gap
      // ----------------------------------

      const detectedGaps = detectFVG(
        fiveM,
        {
          timeframeSeconds: 300,
          nowSeconds
        }
      );

      const updatedGaps = updateFVGStatus(
        detectedGaps,
        fiveM
      );

      const bullish = trend1H === "BULLISH";

      const fvg = selectFVG(
        updatedGaps,
        bullish
      );

      if (!fvg) {
        return noTrade(
          "No matching unfilled FVG.",
          {
            trend1H,
            fvg: updatedGaps
          }
        );
      }

      // ----------------------------------
      // 6. Support / Resistance
      // ----------------------------------

      const srResults =
        detectSupportResistance(
          fiveM,
          {
            minTouches: CONFIG.minSRTouches
          }
        );

      const expectedSR = bullish
        ? "SUPPORT"
        : "RESISTANCE";

      const supportResistance = getLatest(
        srResults,
        level =>
          level.type === expectedSR &&
          Array.isArray(level.touches) &&
          level.touches.length >= CONFIG.minSRTouches
      );

      if (!supportResistance) {
        return noTrade(
          "No support/resistance level with at least 3 confirmed swing reactions.",
          {
            supportResistance: srResults
          }
        );
      }

      // ----------------------------------
      // 7. Confirm market structure break
      // ----------------------------------

      const lastBreak = structure5M.lastBreak;

      const bosConfirmed = Boolean(
        lastBreak &&
        ["BOS", "CHoCH", "INITIAL_BREAK"].includes(
          lastBreak.type
        ) &&
        lastBreak.direction === trend1H &&
        lastBreak.confirmation === "CANDLE_CLOSE"
      );

      if (!bosConfirmed) {
        return noTrade(
          "No matching confirmed 5M structure break.",
          {
            lastBreak,
            trend1H
          }
        );
      }

      // ----------------------------------
      // 8. Build entry zone
      // ----------------------------------

      const entryZone = buildEntryZone(
        orderBlock,
        fvg
      );

      if (!entryZone) {
        return noTrade(
          "Order Block and FVG do not overlap. No entry zone."
        );
      }

      // ----------------------------------
      // 9. Closed-candle market confirmation
      // ----------------------------------

      const marketConfirmation =
        currentPrice >= entryZone.low &&
        currentPrice <= entryZone.high &&
        (
          bullish
            ? latestCandle.close > latestCandle.open
            : latestCandle.close < latestCandle.open
        );

      // Planned LIMIT entry = zone midpoint.
      const plannedEntry = entryZone.midpoint;

      // Determine preliminary execution type.
      const execution =
        StrategyEngine.determineExecutionType(
          {
            currentPrice,
            entry: plannedEntry,
            entryZone,
            marketConfirmation
          },
          bullish
        );

      if (!execution.valid) {
        return noTrade(
          execution.reason,
          {
            currentPrice,
            entryZone,
            marketConfirmation
          }
        );
      }

      // ----------------------------------
      // 10. Calculate SL and TP
      // ----------------------------------

      const levels = buildTradeLevels(
        execution.entry,
        entryZone,
        bullish
      );

      if (!levels) {
        return noTrade(
          "Unable to calculate valid SL and TP."
        );
      }

      // ----------------------------------
      // 11. Normalize engine outputs
      // ----------------------------------

      const normalizedLiquidity = {
        ...liquiditySweep,
        confirmed:
          liquiditySweep.status === "CONFIRMED"
      };

      const normalizedOB = {
        ...orderBlock,
        validated: true
      };

      const normalizedFVG = {
        ...fvg,
        confirmed: true
      };

      const normalizedSR = {
        ...supportResistance,
        touches: supportResistance.touches.length,
        reacted: true
      };

      // ----------------------------------
      // 12. Final strategy evaluation
      // ----------------------------------

      const strategyData = {
        trend1H,
        bosConfirmed,

        liquiditySweep: normalizedLiquidity,
        orderBlock: normalizedOB,
        fvg: normalizedFVG,
        supportResistance: normalizedSR,

        currentPrice,
        entry: plannedEntry,
        entryZone,
        marketConfirmation,

        stopLoss: levels.stopLoss,
        takeProfit: levels.takeProfit
      };

      const strategyResult =
        StrategyEngine.evaluateStrategy(
          strategyData,
          {
            minRiskReward: CONFIG.minRiskReward
          }
        );

      if (
        !strategyResult ||
        strategyResult.signal === "NO TRADE"
      ) {
        return noTrade(
          strategyResult?.reasons?.join(" ") ||
          "Strategy validation rejected the setup.",
          {
            strategyResult,
            strategyData
          }
        );
      }

      // ----------------------------------
      // 13. Final output
      // ----------------------------------

      return {
        success: true,
        mode: "LIVE_ANALYSIS",

        market: {
          symbol: marketData.symbol || CONFIG.symbol,
          currentPrice,
          lastClosedCandleTime: latestCandle.time,
          fiveMCount: fiveM.length,
          oneHCount: oneH.length
        },

        signal: {
          type: strategyResult.signal,
          direction: strategyResult.direction,

          executionType:
            strategyResult.executionType,

          executionLabel:
            strategyResult.executionLabel,

          entry: strategyResult.entry,
          stopLoss: strategyResult.stopLoss,
          takeProfit: strategyResult.takeProfit,

          riskReward:
            strategyResult.riskReward,

          executionReason:
            strategyResult.executionReason,

          reasons:
            strategyResult.reasons
        },

        diagnostics: {
          trend1H,
          lastBreak,
          liquiditySweep,
          orderBlock,
          fvg,
          supportResistance,
          entryZone,
          marketConfirmation
        }
      };

    } catch (error) {
      console.error(
        "Analysis Engine Error:",
        error
      );

      return {
        success: false,
        mode: "ERROR",

        signal: {
          type: "NO TRADE",
          direction: "NONE",
          executionType: null,
          reason: error.message
        }
      };
    }
  }

  return {
    analyze,
    config: CONFIG
  };

})();

// Browser
if (typeof window !== "undefined") {
  window.AnalysisEngine = AnalysisEngine;
}

// Node.js
if (typeof module !== "undefined") {
  module.exports = AnalysisEngine;
}
