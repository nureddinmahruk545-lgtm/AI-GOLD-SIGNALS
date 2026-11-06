
"use strict";

// ======================================
// AI GOLD SIGNALS
// Frontend Application
// Market Data Connection Test
// ======================================

const App = {
  config: {
    symbol: "XAUUSD",
    mainTimeframe: "1H",
    entryTimeframe: "5M"
  },

  state: {
    marketData: null,
    signal: "NO DATA"
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
    this.elements.price.textContent = "Connecting to XAUS...";
    this.elements.structure.textContent = "Loading 1H and 5M candles...";
    this.elements.signal.textContent = "NO DATA";
    this.elements.details.textContent =
      "Testing market data. No trading signals are enabled.";
  },

  async loadMarketData() {
    try {
      if (!window.MarketData) {
        throw new Error("MarketData engine not loaded. Check script path.");
      }

      const result = await window.MarketData.getMarketData();

      const fiveM = result.timeframes["5M"];
      const oneH = result.timeframes["1H"];

      if (!fiveM.candles.length || !oneH.candles.length) {
        throw new Error("No valid candles received.");
      }

      this.state.marketData = result;

      const latest5M = fiveM.candles[fiveM.candles.length - 1];
      const latest1H = oneH.candles[oneH.candles.length - 1];

      this.elements.price.textContent =
        "Latest 5M close: " + latest5M.close.toFixed(2) +
        " | Latest 1H close: " + latest1H.close.toFixed(2);

      this.elements.structure.textContent =
        "5M candles: " + fiveM.count +
        " | 1H candles: " + oneH.count +
        " | Data source: " + result.timeframes["5M"].source;

      this.elements.signal.textContent = "NO TRADE";

      this.elements.details.textContent =
        "Market data received successfully. " +
        "Signal generation remains disabled until SMC analysis is verified.";

      console.log("Market data test successful:", result);

    } catch (error) {
      console.error("Market data error:", error);

      this.elements.price.textContent = "DATA CONNECTION ERROR";
      this.elements.structure.textContent = error.message;
      this.elements.signal.textContent = "NO DATA";
      this.elements.details.textContent =
        "No trading signal. Check the data provider and browser console.";
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
