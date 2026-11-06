
"use strict";

// ======================================
// AI GOLD SIGNALS
// Frontend Application V3
// Connection Status + SMC Diagnostics
// ======================================

const App = {
  config: {
    symbol: "XAUUSD",
    mainTimeframe: "1H",
    entryTimeframe: "5M",
    connectionTimeout: 15000
  },

  state: {
    marketData: null,
    analysis: null,
    signal: "NO TRADE"
  },

  elements: {},

  init() {
    this.elements = {
      price: document.getElementById("gold-price"),
      connection: document.getElementById("connection-status"),
      structure: document.getElementById("market-structure"),
      signal: document.getElementById("signal"),
      details: document.getElementById("signal-details"),
      diagnostics: document.getElementById("smc-diagnostics")
    };

    const missingElements = Object.entries(this.elements)
      .filter(([, element]) => !element)
      .map(([name]) => name);

    if (missingElements.length > 0) {
      console.error("Missing HTML elements:", missingElements);
      return;
    }

    this.renderStatus();
    this.loadMarketData();
  },

  renderStatus() {
    this.elements.connection.textContent =
      "Connecting to XAUS...";

    this.elements.price.textContent =
      "Waiting for market data...";

    this.elements.structure.textContent =
      "Loading market structure...";

    this.elements.signal.textContent =
      "NO TRADE";

    this.elements.details.textContent =
      "Diagnostic mode only. Trading signals are disabled.";

    this.elements.diagnostics.textContent =
      "Waiting for SMC analysis...";
  },

  async loadMarketData() {
    let timeoutId;

    try {
      if (!window.MarketData) {
        throw new Error("MarketData engine not loaded.");
      }

      if (!window.AnalysisEngine) {
        throw new Error("Analysis Engine not loaded.");
      }

      this.elements.connection.textContent =
        "Requesting XAUS market data...";

      const timeoutPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("XAUS request timed out after 15 seconds."));
        }, this.config.connectionTimeout);
      });

      const result = await Promise.race([
        window.MarketData.getMarketData(),
        timeoutPromise
      ]);

      clearTimeout(timeoutId);

      if (
        !result ||
        !result.timeframes ||
        !result.timeframes["5M"] ||
        !result.timeframes["1H"]
      ) {
        throw new Error("Invalid XAUS market data structure.");
      }

      const fiveM = result.timeframes["5M"];
      const oneH = result.timeframes["1H"];

      if (
        !Array.isArray(fiveM.candles) ||
        !Array.isArray(oneH.candles) ||
        fiveM.candles.length === 0 ||
        oneH.candles.length === 0
      ) {
        throw new Error("No valid market candles received.");
      }

      this.state.marketData = result;

      const latest5M = fiveM.candles[fiveM.candles.length - 1];
      const latest1H = oneH.candles[oneH.candles.length - 1];

      this.elements.connection.textContent =
        "CONNECTED · XAUS data received";

      this.elements.price.textContent =
        "Latest 5M: " + latest5M.close.toFixed(2) +
        " | Latest 1H: " + latest1H.close.toFixed(2);

      this.elements.structure.textContent =
        "Market data received. Running SMC analysis...";

      const analysis = window.AnalysisEngine.analyze(result);

      this.state.analysis = analysis;

      if (!analysis || !analysis.success) {
        throw new Error(
          analysis?.signal?.reason || "SMC analysis failed."
        );
      }

      const structure1H = analysis.structure?.oneH;
      const structure5M = analysis.structure?.fiveM;

      if (!structure1H || !structure5M) {
        throw new Error("Market structure data is incomplete.");
      }

      this.elements.structure.textContent =
        "1H Trend: " + (structure1H.trend || "UNCONFIRMED") +
        " | 5M Trend: " + (structure5M.trend || "UNCONFIRMED");

      const liquidity = Array.isArray(analysis.liquidity)
        ? analysis.liquidity
        : [];

      const orderBlocks = Array.isArray(analysis.orderBlocks)
        ? analysis.orderBlocks
        : [];

      const fvg = Array.isArray(analysis.fvg)
        ? analysis.fvg
        : [];

      const supportResistance = Array.isArray(analysis.supportResistance)
        ? analysis.supportResistance
        : [];

      const recentSweeps = [...liquidity]
        .filter(sweep => Number.isInteger(sweep.sweepIndex))
        .sort((a, b) => b.sweepIndex - a.sweepIndex)
        .slice(0, 5);

      const sweepDetails = recentSweeps.map((sweep, index) => {
        const candle = fiveM.candles[sweep.sweepIndex];

        if (!candle) {
          return `${index + 1}. Invalid candle index: ${sweep.sweepIndex}`;
        }

        return [
          `${index + 1}. ${sweep.type || "UNKNOWN"}`,
          `Level: ${sweep.level}`,
          `High: ${candle.high}`,
          `Low: ${candle.low}`,
          `Close: ${candle.close}`,
          `Wick: ${sweep.wickPrice}`,
          `Wick Ratio: ${Number.isFinite(sweep.wickRatio)
            ? (sweep.wickRatio * 100).toFixed(1) + "%"
            : "N/A"}`,
          `Candle Index: ${sweep.sweepIndex}`
        ].join(" | ");
      }).join("\n");

      this.elements.diagnostics.textContent =
        "Analysis: SUCCESS\n" +
        "5M Candles: " + fiveM.candles.length + "\n" +
        "1H Candles: " + oneH.candles.length + "\n" +
        "5M Confirmed Swings: " +
        (structure5M.swings?.length || 0) + "\n" +
        "Liquidity Sweeps: " + liquidity.length + "\n" +
        "Order Blocks: " + orderBlocks.length + "\n" +
        "FVG Zones: " + fvg.length + "\n" +
        "Support / Resistance: " + supportResistance.length +
        "\n\nLAST 5 LIQUIDITY SWEEPS:\n" +
        (sweepDetails || "No confirmed sweeps");

      this.state.signal = "NO TRADE";

      this.elements.signal.textContent = "NO TRADE";

      this.elements.details.textContent =
        "Diagnostic mode only. No verified trading signal.";

      console.log("Market Data:", result);
      console.log("SMC Diagnostic Results:", analysis);
      console.table(recentSweeps);

    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      console.error("AI GOLD SIGNALS:", error);

      this.elements.connection.textContent =
        "CONNECTION / ANALYSIS ERROR";

      this.elements.price.textContent =
        "Market data unavailable";

      this.elements.structure.textContent =
        "Analysis unavailable";

      this.elements.diagnostics.textContent =
        "ERROR: " + error.message;

      this.elements.signal.textContent = "NO TRADE";

      this.elements.details.textContent =
        "No verified trading signal available.";

      this.state.signal = "NO TRADE";
    }
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());
