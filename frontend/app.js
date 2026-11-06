
"use strict";

// ======================================
// AI GOLD SIGNALS
// Frontend Application
// Central SMC Analysis Integration
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
      details: document.getElementById("signal-details")
    };

    this.renderStatus();
    this.loadMarketData();
  },

  renderStatus() {
    this.elements.price.textContent =
      "Connecting to XAUS...";

    this.elements.structure.textContent =
      "Loading 1H and 5M analysis...";

    this.elements.signal.textContent =
      "NO TRADE";

    this.elements.details.textContent =
      "Waiting for verified SMC analysis.";
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

      // Run central SMC analysis
      const analysis =
        window.AnalysisEngine.analyze(result);

      this.state.analysis = analysis;

      if (!analysis.success) {
        throw new Error(
          analysis.signal?.reason ||
          "Analysis failed."
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
        (structure5M.trend || "UNCONFIRMED") +
        " | Liquidity Sweeps: " +
        analysis.liquidity.length +
        " | Order Blocks: " +
        analysis.orderBlocks.length +
        " | FVG: " +
        analysis.fvg.length +
        " | S/R Levels: " +
        analysis.supportResistance.length;

      // Trading signals remain disabled
      this.state.signal = "NO TRADE";

      this.elements.signal.textContent =
        "NO TRADE";

      this.elements.details.textContent =
        "SMC diagnostic analysis completed. " +
        "LIMIT and MARKET entry selection is not enabled yet.";

      console.log(
        "AI GOLD SIGNALS - Analysis Results:",
        analysis
      );

      this.elements.details.textContent =
  JSON.stringify(analysis, null, 2);
    } catch (error) {
      console.error(
        "AI GOLD SIGNALS Error:",
        error
      );

      this.elements.price.textContent =
        "DATA / ANALYSIS ERROR";

      this.elements.structure.textContent =
        error.message;

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
