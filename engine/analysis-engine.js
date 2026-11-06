"use strict";

// ======================================
// AI GOLD SIGNALS
// Central Analysis Engine
// Stage 1: SMC Engine Integration
// Diagnostic mode - NO TRADE SIGNALS
// ======================================

const AnalysisEngine = {

  analyze(marketData) {
    try {
      if (!marketData || !marketData.timeframes) {
        throw new Error("Market data is missing.");
      }

      const fiveM = marketData.timeframes["5M"];
      const oneH = marketData.timeframes["1H"];

      if (
        !fiveM ||
        !oneH ||
        !Array.isArray(fiveM.candles) ||
        !Array.isArray(oneH.candles)
      ) {
        throw new Error("Invalid 5M or 1H candle data.");
      }

      if (
        fiveM.candles.length < 20 ||
        oneH.candles.length < 20
      ) {
        throw new Error("Insufficient candle history.");
      }

      const nowSeconds = Math.floor(Date.now() / 1000);

      // 1. Market Structure
      if (typeof analyzeStructure !== "function") {
        throw new Error("Structure engine not loaded.");
      }

      const structure1H = analyzeStructure(
        oneH.candles,
        {
          timeframeSeconds: 3600,
          nowSeconds
        }
      );

      const structure5M = analyzeStructure(
        fiveM.candles,
        {
          timeframeSeconds: 300,
          nowSeconds
        }
      );

      // Extract confirmed swing events
      const swingEvents = (
        structure5M.events || []
      ).filter(event =>
        event.type === "SWING_HIGH" ||
        event.type === "SWING_LOW"
      );

      // 2. Liquidity
      if (typeof detectLiquiditySweeps !== "function") {
        throw new Error("Liquidity engine not loaded.");
      }

      const liquidity = detectLiquiditySweeps(
        fiveM.candles,
        swingEvents,
        {
          nowSeconds,
          timeframeSeconds: 300
        }
      );

      // 3. Order Blocks
      if (typeof detectOrderBlocks !== "function") {
        throw new Error("Order Block engine not loaded.");
      }

      const orderBlocks = detectOrderBlocks(
        fiveM.candles,
        swingEvents
      );

      // 4. Fair Value Gaps
      if (
        typeof detectFVG !== "function" ||
        typeof updateFVGStatus !== "function"
      ) {
        throw new Error("FVG engine not loaded.");
      }

      const detectedFVG = detectFVG(fiveM.candles);

      const fvg = updateFVGStatus(
        detectedFVG,
        fiveM.candles
      );

      // 5. Support and Resistance
      if (typeof detectSupportResistance !== "function") {
        throw new Error("Support/Resistance engine not loaded.");
      }

      const supportResistance = detectSupportResistance(
        fiveM.candles
      );

      // Diagnostic result only.
      // No trading signal is permitted at this stage.

      return {
        success: true,
        mode: "DIAGNOSTIC_ONLY",

        market: {
          symbol: "XAUUSD",
          fiveMCount: fiveM.candles.length,
          oneHCount: oneH.candles.length
        },

        structure: {
          oneH: structure1H,
          fiveM: structure5M
        },

        liquidity,
        orderBlocks,
        fvg,
        supportResistance,

        signal: {
          type: "NO TRADE",
          reason: "SMC integration and validation are not complete."
        }
      };

    } catch (error) {
      console.error("Analysis Engine Error:", error);

      return {
        success: false,
        mode: "DIAGNOSTIC_ONLY",
        signal: {
          type: "NO TRADE",
          reason: error.message
        }
      };
    }
  }
};

// Browser access
if (typeof window !== "undefined") {
  window.AnalysisEngine = AnalysisEngine;
}

// Node.js access
if (typeof module !== "undefined") {
  module.exports = AnalysisEngine;
}
