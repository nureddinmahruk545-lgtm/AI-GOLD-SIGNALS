"use strict";

// ======================================
// AI GOLD SIGNALS
// Central Analysis Engine
// XAUUSD | 1H + 5M
// Fail-Closed Signal Validation
// ======================================

const AnalysisEngine = (() => {

  const CONFIG = Object.freeze({
    symbol: "XAUUSD",
    timeframes: {
      "1H": 3600,
      "5M": 300
    },
    minCandles: 20,
    minRiskReward: 2,
    maxRiskPercent: 1
  });

  function isValidCandle(candle) {
    if (!candle || typeof candle !== "object") {
      return false;
    }

    const values = [
      candle.time,
      candle.open,
      candle.high,
      candle.low,
      candle.close
    ];

    if (!values.every(Number.isFinite)) {
      return false;
    }

    return (
      candle.time > 0 &&
      candle.high >= candle.low &&
      candle.high >= Math.max(candle.open, candle.close) &&
      candle.low <= Math.min(candle.open, candle.close)
    );
  }

  function getClosedCandles(candles, timeframeSeconds, nowSeconds) {
    if (!Array.isArray(candles)) {
      throw new Error("Candles must be an array.");
    }

    const result = [];

    let previousTime = -Infinity;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];

      if (!isValidCandle(candle)) {
        throw new Error("Invalid candle at index " + i);
      }

      if (candle.time <= previousTime) {
        throw new Error("Candle timestamps are not strictly increasing.");
      }

      previousTime = candle.time;

      if (candle.time + timeframeSeconds <= nowSeconds) {
        result.push({
          ...candle,
          sourceIndex: i
        });
      }
    }

    if (result.length < CONFIG.minCandles) {
      throw new Error(
        "Insufficient closed candles. Required: " +
        CONFIG.minCandles +
        ", received: " +
        result.length
      );
    }

    return result;
  }

  function getLatest(items, predicate = () => true) {
    if (!Array.isArray(items)) return null;

    const filtered = items.filter(predicate);

    return filtered.length
      ? filtered[filtered.length - 1]
      : null;
  }

  function getLatestPrice(candles) {
    return candles[candles.length - 1].close;
  }

  function getNearestLevel(levels, type, price) {
    if (!Array.isArray(levels)) return null;

    const candidates = levels.filter(level =>
      level &&
      level.type === type &&
      Number.isFinite(level.price) &&
      Number.isFinite(level.touchCount) &&
      level.touchCount >= 3 &&
      level.confirmed === true &&
      level.reacted === true
    );

    if (!candidates.length) return null;

    return candidates.sort((a, b) =>
      Math.abs(a.price - price) -
      Math.abs(b.price - price)
    )[0];
  }

  function requireFunction(name) {
    const fn = globalThis[name];

    if (typeof fn !== "function") {
      throw new Error(name + " engine is not loaded.");
    }

    return fn;
  }

  function buildStrategyInput(analysis, tradePlan) {
    const trend = analysis.structure.oneH.trend;

    const bullish = trend === "BULLISH";

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

    const latestBreak = getLatest(
      analysis.structure.fiveM.events,
      event =>
        (event.type === "BOS" || event.type === "CHoCH") &&
        event.direction === trend &&
        event.confirmation === "CANDLE_CLOSE"
    );

    const latestSweep = getLatest(
      analysis.liquidity,
      sweep =>
        sweep.type === expectedSweep &&
        sweep.status === "CONFIRMED"
    );

    const latestOB = getLatest(
      analysis.orderBlocks,
      block =>
        block.type === expectedOB &&
        block.status === "CONFIRMED" &&
        block.validated === true
    );

    const latestFVG = getLatest(
      analysis.fvg,
      gap =>
        gap.type === expectedFVG &&
        gap.status !== "FILLED" &&
        Number.isFinite(gap.high) &&
        Number.isFinite(gap.low)
    );

    const currentPrice = analysis.market.currentPrice;

    const qualifiedSR = getNearestLevel(
      analysis.supportResistance,
      expectedSR,
      currentPrice
    );

    return {
      trend1H: trend,

      bosConfirmed: Boolean(latestBreak),

      liquiditySweep: latestSweep
        ? {
            ...latestSweep,
            confirmed: true
          }
        : null,

      orderBlock: latestOB,

      fvg: latestFVG
        ? {
            ...latestFVG,
            confirmed: true
          }
        : null,

      supportResistance: qualifiedSR
        ? {
            ...qualifiedSR,
            touches: qualifiedSR.touchCount,
            reacted: true
          }
        : null,

      entry: tradePlan?.entry,
      stopLoss: tradePlan?.stopLoss,
      takeProfit: tradePlan?.takeProfit
    };
  }

  function validateRisk(strategyResult, riskConfig) {
    if (strategyResult.signal === "NO TRADE") {
      return {
        approved: false,
        reason: "Strategy conditions were not satisfied."
      };
    }

    if (!riskConfig || typeof riskConfig !== "object") {
      return {
        approved: false,
        reason: "Risk configuration is missing."
      };
    }

    const calculatePositionSize =
      requireFunction("calculatePositionSize");

    const sizing = calculatePositionSize({
      ...riskConfig,
      entry: strategyResult.entry,
      stopLoss: strategyResult.stopLoss,
      maxRiskPercent: CONFIG.maxRiskPercent
    });

    if (!sizing.valid) {
      return {
        approved: false,
        reason: sizing.reason || "Risk validation failed.",
        sizing
      };
    }

    return {
      approved: true,
      sizing
    };
  }

  function analyze(marketData, options = {}) {
    try {
      if (!marketData || !marketData.timeframes) {
        throw new Error("Market data is missing.");
      }

      const nowSeconds = Number.isFinite(options.nowSeconds)
        ? options.nowSeconds
        : Math.floor(Date.now() / 1000);

      const fiveMData = marketData.timeframes["5M"];
      const oneHData = marketData.timeframes["1H"];

      if (
        !fiveMData ||
        !oneHData ||
        !Array.isArray(fiveMData.candles) ||
        !Array.isArray(oneHData.candles)
      ) {
        throw new Error("5M or 1H candle data is invalid.");
      }

      // 1. Validate closed candles.
      const fiveMCandles = getClosedCandles(
        fiveMData.candles,
        CONFIG.timeframes["5M"],
        nowSeconds
      );

      const oneHCandles = getClosedCandles(
        oneHData.candles,
        CONFIG.timeframes["1H"],
        nowSeconds
      );

      // 2. Market structure.
      const analyzeStructure =
        requireFunction("analyzeStructure");

      const structure1H = analyzeStructure(
        oneHData.candles,
        {
          timeframeSeconds: CONFIG.timeframes["1H"],
          nowSeconds
        }
      );

      const structure5M = analyzeStructure(
        fiveMData.candles,
        {
          timeframeSeconds: CONFIG.timeframes["5M"],
          nowSeconds
        }
      );

      // 3. Confirmed swing events.
      const swingEvents = structure5M.events.filter(event =>
        (
          event.type === "SWING_HIGH" ||
          event.type === "SWING_LOW"
        ) &&
        Number.isInteger(event.confirmationIndex) &&
        Number.isInteger(event.sourceIndex)
      );

      // 4. Liquidity.
      const detectLiquiditySweeps =
        requireFunction("detectLiquiditySweeps");

      const liquidity = detectLiquiditySweeps(
        fiveMData.candles,
        swingEvents,
        {
          nowSeconds,
          timeframeSeconds: CONFIG.timeframes["5M"]
        }
      );

      // 5. Order Blocks.
      const detectOrderBlocks =
        requireFunction("detectOrderBlocks");

      const orderBlocks = detectOrderBlocks(
        fiveMData.candles,
        swingEvents
      );

      // 6. Fair Value Gaps.
      const detectFVG = requireFunction("detectFVG");
      const updateFVGStatus =
        requireFunction("updateFVGStatus");

      const detectedFVG = detectFVG(
        fiveMCandles,
        {
          timeframeSeconds: CONFIG.timeframes["5M"],
          nowSeconds
        }
      );

      const fvg = updateFVGStatus(
        detectedFVG,
        fiveMCandles
      );

      // 7. Support and Resistance.
      const detectSupportResistance =
        requireFunction("detectSupportResistance");

      const supportResistance = detectSupportResistance(
        fiveMData.candles,
        {
          timeframeSeconds: CONFIG.timeframes["5M"],
          nowSeconds,
          minTouches: 3
        }
      );

      const analysis = {
        success: true,
        mode: "VALIDATED_ANALYSIS",

        market: {
          symbol: marketData.symbol || CONFIG.symbol,
          currentPrice: getLatestPrice(fiveMCandles),
          fiveMClosedCandles: fiveMCandles.length,
          oneHClosedCandles: oneHCandles.length,
          analyzedAt: new Date(nowSeconds * 1000).toISOString()
        },

        structure: {
          oneH: structure1H,
          fiveM: structure5M
        },

        liquidity,
        orderBlocks,
        fvg,
        supportResistance
      };

      // 8. Strategy evaluation.
      const evaluateStrategy =
        requireFunction("evaluateStrategy");

      const tradePlan =
        marketData.tradePlan || null;

      const strategyInput = buildStrategyInput(
        analysis,
        tradePlan
      );

      const strategyResult = evaluateStrategy(
        strategyInput,
        {
          minRiskReward: CONFIG.minRiskReward
        }
      );

      // 9. Risk validation.
      const risk = validateRisk(
        strategyResult,
        marketData.riskConfig
      );

      // 10. Final signal. Fail closed.
      if (
        strategyResult.signal === "NO TRADE" ||
        !risk.approved
      ) {
        analysis.signal = {
          type: "NO TRADE",
          direction: "NONE",
          reason: !risk.approved
            ? risk.reason
            : strategyResult.reasons.join("; "),
          strategyReasons: strategyResult.reasons,
          riskApproved: false
        };

        return analysis;
      }

      analysis.signal = {
        type: strategyResult.signal,
        direction: strategyResult.direction,
        entry: strategyResult.entry,
        stopLoss: strategyResult.stopLoss,
        takeProfit: strategyResult.takeProfit,
        riskReward: strategyResult.riskReward,
        riskApproved: true,
        positionSize: risk.sizing,
        reasons: strategyResult.reasons
      };

      return analysis;

    } catch (error) {
      console.error("Analysis Engine Error:", error);

      return {
        success: false,
        mode: "ERROR",
        signal: {
          type: "NO TRADE",
          direction: "NONE",
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

// Browser access.
if (typeof window !== "undefined") {
  window.AnalysisEngine = AnalysisEngine;
}

// Node.js access.
if (typeof module !== "undefined") {
  module.exports = AnalysisEngine;
}
