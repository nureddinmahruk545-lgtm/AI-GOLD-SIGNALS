
"use strict";

// ======================================
// AI GOLD SIGNALS
// Frontend Application V2
// Connection Diagnostics
// SMC Diagnostic Display
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
      structure: document.getElementById("market-structure"),
      signal: document.getElementById("signal"),
      details: document.getElementById("signal-details"),
      diagnostics: document.getElementById("smc-diagnostics")
    };

    const missingElements = Object.entries(this.elements)
      .filter(([, element]) => !element)
      .map(([name]) => name);

    if (missingElements.length > 0) {
      console.error(
        "Missing HTML elements:",
        missingElements
      );
      return;
    }

    this.renderStatus();
    this.loadMarketData();
  },

  renderStatus() {
    this.elements.price.textContent =
      "Connecting to XAUS...";

    this.elements.structure.textContent =
      "Loading market structure...";

    this.elements.signal.textContent =
      "NO TRADE";

    this.elements.details.textContent =
      "Trading signals are disabled during diagnostic testing.";

    this.elements.diagnostics.textContent =
      "Waiting for SMC analysis...";
  },

  async loadMarketData() {
    try {
      if (!window.MarketData) {
        throw new Error("MarketData engine not loaded.");
      }

      if (!window.AnalysisEngine) {
        throw new Error("Analysis Engine not loaded.");
      }

      this.elements.price.textContent =
        "Requesting XAUS market data...";

      // Connection timeout protection
      const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              "XAUS request timed out after 15 seconds."
            )
          );
        }, this.config.connectionTimeout);
      });

      const result = await Promise.race([
        window.MarketData.getMarketData(),
        timeoutPromise
      ]);

      if (
        !result ||
        !result.timeframes ||
        !result.timeframes["5M"] ||
        !result.timeframes["1H"]
      ) {
        throw new Error(
          "XAUS returned an invalid market data structure."
        );
      }

      const fiveM = result.timeframes["5M"];
      const oneH = result.timeframes["1H"];

      if (
        !Array.isArray(fiveM.candles) ||
        !Array.isArray(oneH.candles) ||
        fiveM.candles.length === 0 ||
        oneH.candles.length === 0
      ) {
        throw new Error(
          "No valid market candles received."
        );
      }

      this.state.marketData = result;

      const latest5M =
        fiveM.candles[fiveM.candles.length - 1];

      const latest1H =
        oneH.candles[oneH.candles.length - 1];

      this.elements.price.textContent =
        "Latest 5M: " +
        latest5M.close.toFixed(2) +
        " | Latest 1H: " +
        latest1H.close.toFixed(2);

      this.elements.structure.textContent =
        "Market data received. Running SMC analysis...";

      // Run analysis
      const analysis =
        window.AnalysisEngine.analyze(result);

      this.state.analysis = analysis;

      if (!analysis || !analysis.success) {
        throw new Error(
          analysis?.signal?.reason ||
          "SMC analysis failed."
        );
      }

      const structure1H =
        analysis.structure.oneH;

      const structure5M =
        analysis.structure.fiveM;

      this.elements.structure.textContent =
        "1H Trend: " +
        (structure1H.trend || "UNCONFIRMED") +
        " | 5M Trend: " +
        (structure5M.trend || "UNCONFIRMED");

      const liquidityCount =
        Array.isArray(analysis.liquidity)
          ? analysis.liquidity.length : 0;

      const obCount =
        Array.isArray(analysis.orderBlocks)
          ? analysis.orderBlocks.length : 0;

      const fvgCount =
        Array.isArray(analysis.fvg)
          ? analysis.fvg.length : 0;

      const srCount =
        Array.isArray(analysis.supportResistance)
          ? analysis.supportResistance.length : 0;

      this.elements.diagnostics.textContent =
        "Analysis: SUCCESS\n" +
        "5M Candles: " + fiveM.candles.length + "\n" +
        "1H Candles: " + oneH.candles.length + "\n" +
        "5M Confirmed Swings: " +
        (structure5M.swings?.length || 0) + "\n" +
        "Liquidity Sweeps: " + liquidityCount + "\n" +
        "Order Blocks: " + obCount + "\n" +
        "FVG Zones: " + fvgCount + "\n" +
        "Support / Resistance: " + srCount;

      // Trading signals remain disabled
      this.state.signal = "NO TRADE";

      this.elements.signal.textContent =
        "NO TRADE";

      this.elements.details.textContent =
        "Diagnostic mode only. No verified trading signal.";

      console.log(
        "Market Data:",
        result
      );

      console.log(
        "SMC Diagnostic Results:",
        analysis
      );

    } catch (error) {
      console.error("AI GOLD SIGNALS:", error);

      this.elements.price.textContent =
        "XAUS CONNECTION ERROR";

      this.elements.structure.textContent =
        "Analysis unavailable";

      this.elements.diagnostics.textContent =
        "ERROR: " + error.message;

      this.elements.signal.textContent =
        "NO TRADE";

      this.elements.details.textContent =
        "No verified trading signal available.";
    }
  }
};

document.addEventListener(
  "DOMContentLoaded",
  () => App.init()
);
