
"use strict";

// ======================================
// AI GOLD SIGNALS
// Frontend Application
// SMC Diagnostic Display
// ======================================

const App = {
  config: {
    symbol: "XAUUSD",
    mainTimeframe: "1H",
    entryTimeframe: "5M"
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

      const result =
        await window.MarketData.getMarketData();

      const fiveM = result.timeframes["5M"];
      const oneH = result.timeframes["1H"];

      if (
        !fiveM ||
        !oneH ||
        !fiveM.candles.length ||
        !oneH.candles.length
      ) {
        throw new Error("Invalid market candle data.");
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
        "SMC Diagnostic Results:",
        analysis
      );

    } catch (error) {
      console.error("AI GOLD SIGNALS:", error);

      this.elements.structure.textContent =
        "Analysis error";

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
