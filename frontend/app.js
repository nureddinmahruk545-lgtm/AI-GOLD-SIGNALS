
"use strict";

// ======================================
// AI GOLD SIGNALS
// Frontend Application V4
// SMC / ICT Trading Dashboard
// LIMIT + MARKET Execution
// ======================================

const App = {

  config: {
    symbol: "XAUUSD",
    mainTimeframe: "1H",
    entryTimeframe: "5M",
    connectionTimeout: 15000,
    refreshInterval: 30000
  },

  state: {
    marketData: null,
    analysis: null,
    signal: "NO TRADE",
    refreshTimer: null,
    isLoading: false
  },

  elements: {},

  // ======================================
  // Initialize
  // ======================================

  init() {

    this.elements = {
      price: document.getElementById("gold-price"),
      connection: document.getElementById("connection-status"),
      structure: document.getElementById("market-structure"),
      signal: document.getElementById("signal"),
      details: document.getElementById("signal-details"),
      diagnostics: document.getElementById("smc-diagnostics")
    };

    const missing = Object.entries(this.elements)
      .filter(([, element]) => !element)
      .map(([name]) => name);

    if (missing.length) {
      console.error(
        "Missing HTML elements:",
        missing
      );
      return;
    }

    this.renderInitialState();
    this.loadMarketData();

    // Refresh market data periodically.
    this.state.refreshTimer = setInterval(() => {
      this.loadMarketData();
    }, this.config.refreshInterval);
  },

  // ======================================
  // Initial UI
  // ======================================

  renderInitialState() {

    this.elements.connection.textContent =
      "CONNECTING...";

    this.elements.price.textContent =
      "Waiting for market data...";

    this.elements.structure.textContent =
      "Loading market structure...";

    this.elements.signal.textContent =
      "NO TRADE";

    this.elements.details.textContent =
      "Waiting for analysis...";

    this.elements.diagnostics.textContent =
      "Waiting for SMC diagnostics...";
  },

  // ======================================
  // Format helpers
  // ======================================

  formatPrice(value) {

    if (
      typeof value !== "number" ||
      !Number.isFinite(value)
    ) {
      return "N/A";
    }

    return value.toFixed(2);
  },

  formatRR(value) {

    if (
      typeof value !== "number" ||
      !Number.isFinite(value)
    ) {
      return "N/A";
    }

    return "1:" + value.toFixed(2);
  },

  formatTime(timestamp) {

    if (
      typeof timestamp !== "number" ||
      !Number.isFinite(timestamp)
    ) {
      return "N/A";
    }

    return new Date(timestamp * 1000)
      .toLocaleString();
  },

  // ======================================
  // Connection status
  // ======================================

  setConnectionStatus(message) {
    this.elements.connection.textContent = message;
  },

  // ======================================
  // Market data
  // ======================================

  async loadMarketData() {

    if (this.state.isLoading) {
      return;
    }

    this.state.isLoading = true;

    let timeoutId;

    try {

      if (!window.MarketData) {
        throw new Error(
          "MarketData engine not loaded."
        );
      }

      if (
        !window.AnalysisEngine ||
        typeof window.AnalysisEngine.analyze !== "function"
      ) {
        throw new Error(
          "AnalysisEngine not loaded."
        );
      }

      this.setConnectionStatus(
        "REQUESTING MARKET DATA..."
      );

      const timeoutPromise = new Promise(
        (resolve, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                "Market data request timed out."
              )
            );
          }, this.config.connectionTimeout);
        }
      );

      const result = await Promise.race([
        window.MarketData.getMarketData(),
        timeoutPromise
      ]);

      clearTimeout(timeoutId);

      this.validateMarketData(result);

      this.state.marketData = result;

      const fiveM = result.timeframes["5M"];
      const oneH = result.timeframes["1H"];

      const latest5M =
        fiveM.candles[fiveM.candles.length - 1];

      const latest1H =
        oneH.candles[oneH.candles.length - 1];

      this.setConnectionStatus(
        "CONNECTED · " + this.config.symbol
      );

      this.elements.price.textContent =
        "5M: " + this.formatPrice(latest5M.close) +
        " | 1H: " + this.formatPrice(latest1H.close);

      // ==================================
      // Run analysis
      // ==================================

      this.elements.structure.textContent =
        "Running SMC / ICT analysis...";

      const analysis =
        window.AnalysisEngine.analyze(result);

      this.state.analysis = analysis;

      if (!analysis) {
        throw new Error(
          "Analysis engine returned empty result."
        );
      }

      if (
        analysis.success !== true &&
        analysis.mode !== "ERROR"
      ) {
        throw new Error(
          analysis.signal?.reason ||
          "Analysis failed."
        );
      }

      if (analysis.mode === "ERROR") {
        throw new Error(
          analysis.signal?.reason ||
          "Analysis engine error."
        );
      }

      this.renderAnalysis(analysis);

      console.log(
        "Market Data:",
        result
      );

      console.log(
        "Analysis Result:",
        analysis
      );

    } catch (error) {

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      console.error(
        "AI GOLD SIGNALS:",
        error
      );

      this.renderError(error);

    } finally {

      this.state.isLoading = false;

    }
  },

  // ======================================
  // Validate market data
  // ======================================

  validateMarketData(result) {

    if (
      !result ||
      !result.timeframes ||
      !result.timeframes["5M"] ||
      !result.timeframes["1H"]
    ) {
      throw new Error(
        "Invalid market data structure."
      );
    }

    const fiveM = result.timeframes["5M"].candles;
    const oneH = result.timeframes["1H"].candles;

    if (
      !Array.isArray(fiveM) ||
      !Array.isArray(oneH) ||
      fiveM.length === 0 ||
      oneH.length === 0
    ) {
      throw new Error(
        "No market candles received."
      );
    }

    const latest5M = fiveM[fiveM.length - 1];
    const latest1H = oneH[oneH.length - 1];

    if (
      !Number.isFinite(latest5M.close) ||
      !Number.isFinite(latest1H.close)
    ) {
      throw new Error(
        "Invalid market prices."
      );
    }
  },

  // ======================================
  // Render analysis
  // ======================================

  renderAnalysis(analysis) {

    const signal = analysis.signal || {};
    const diagnostics = analysis.diagnostics || {};

    this.renderMarketStructure(
      diagnostics,
      analysis
    );

    this.renderSignal(signal);

    this.renderDiagnostics(
      diagnostics,
      analysis
    );

    this.state.signal =
      signal.type || "NO TRADE";
  },

  // ======================================
  // Market structure display
  // ======================================

  renderMarketStructure(diagnostics, analysis) {

    const trend =
      diagnostics.trend1H || "UNCONFIRMED";

    const lastBreak =
      diagnostics.lastBreak;

    const breakType =
      lastBreak?.type || "NONE";

    const breakDirection =
      lastBreak?.direction || "NONE";

    const marketPrice =
      analysis.market?.currentPrice;

    this.elements.structure.textContent =
      "1H Trend: " + trend +
      " | 5M Break: " + breakType +
      " | Break Direction: " + breakDirection +
      " | Price: " + this.formatPrice(marketPrice);
  },

  // ======================================
  // Signal display
  // ======================================

  renderSignal(signal) {

    const signalType =
      signal.type || "NO TRADE";

    this.elements.signal.textContent =
      signalType;

    // Clear old visual classes.
    this.elements.signal.classList.remove(
      "buy",
      "sell",
      "no-trade",
      "limit",
      "market"
    );

    if (signalType === "BUY") {

      this.elements.signal.classList.add("buy");

    } else if (signalType === "SELL") {

      this.elements.signal.classList.add("sell");

    } else {

      this.elements.signal.classList.add("no-trade");

    }

    if (signal.executionType === "LIMIT") {
      this.elements.signal.classList.add("limit");
    }

    if (signal.executionType === "MARKET") {
      this.elements.signal.classList.add("market");
    }

    // No trade
    if (signalType === "NO TRADE") {

      const reason =
        signal.reason ||
        "No valid trading opportunity.";

      this.elements.details.textContent =
        "STATUS: NO TRADE\n\n" +
        "Reason: " + reason;

      return;
    }

    // Valid signal
    const execution =
      signal.executionLabel ||
      signalType + " " + signal.executionType;

    const details = [
      "SIGNAL: " + signalType,
      "EXECUTION: " + execution,
      "",
      "ENTRY: " + this.formatPrice(signal.entry),
      "STOP LOSS: " + this.formatPrice(signal.stopLoss),
      "TAKE PROFIT: " + this.formatPrice(signal.takeProfit),
      "RISK / REWARD: " + this.formatRR(signal.riskReward),
      "",
      "EXECUTION REASON:",
      signal.executionReason || "N/A",
      "",
      "VALIDATION:"
    ];

    if (Array.isArray(signal.reasons)) {

      signal.reasons.forEach((reason, index) => {
        details.push(
          (index + 1) + ". " + reason
        );
      });

    }

    this.elements.details.textContent =
      details.join("\n");
  },

  // ======================================
  // SMC diagnostics
  // ======================================

  renderDiagnostics(diagnostics, analysis) {

    const lines = [];

    const market = analysis.market || {};

    lines.push(
      "ANALYSIS MODE: " + (analysis.mode || "UNKNOWN")
    );

    lines.push(
      "SYMBOL: " + (market.symbol || this.config.symbol)
    );

    lines.push(
      "CURRENT PRICE: " +
      this.formatPrice(market.currentPrice)
    );

    lines.push(
      "LAST CLOSED 5M CANDLE: " +
      this.formatTime(market.lastClosedCandleTime)
    );

    lines.push("");

    lines.push("MARKET STRUCTURE");

    lines.push(
      "1H TREND: " +
      (diagnostics.trend1H || "UNKNOWN")
    );

    lines.push(
      "5M BREAK: " +
      (diagnostics.lastBreak?.type || "NONE")
    );

    lines.push(
      "BREAK DIRECTION: " +
      (diagnostics.lastBreak?.direction || "NONE")
    );

    lines.push("");

    lines.push("LIQUIDITY");

    if (diagnostics.liquiditySweep) {

      lines.push(
        "TYPE: " +
        diagnostics.liquiditySweep.type
      );

      lines.push(
        "STATUS: " +
        (
          diagnostics.liquiditySweep.status ||
          "UNKNOWN"
        )
      );

      lines.push(
        "LEVEL: " +
        this.formatPrice(
          diagnostics.liquiditySweep.level
        )
      );

    } else {

      lines.push("No matching confirmed sweep.");

    }

    lines.push("");

    lines.push("ORDER BLOCK");

    if (diagnostics.orderBlock) {

      lines.push(
        "TYPE: " +
        diagnostics.orderBlock.type
      );

      lines.push(
        "LOW: " +
        this.formatPrice(
          diagnostics.orderBlock.low
        )
      );

      lines.push(
        "HIGH: " +
        this.formatPrice(
          diagnostics.orderBlock.high
        )
      );

    } else {

      lines.push("No valid Order Block.");

    }

    lines.push("");

    lines.push("FAIR VALUE GAP");

    if (diagnostics.fvg) {

      lines.push(
        "TYPE: " + diagnostics.fvg.type
      );

      lines.push(
        "STATUS: " + diagnostics.fvg.status
      );

      lines.push(
        "LOW: " +
        this.formatPrice(diagnostics.fvg.low)
      );

      lines.push(
        "HIGH: " +
        this.formatPrice(diagnostics.fvg.high)
      );

    } else {

      lines.push("No valid FVG.");

    }

    lines.push("");

    lines.push("SUPPORT / RESISTANCE");

    if (diagnostics.supportResistance) {

      const sr = diagnostics.supportResistance;

      lines.push(
        "TYPE: " + sr.type
      );

      lines.push(
        "LEVEL: " +
        this.formatPrice(sr.level)
      );

      lines.push(
        "TOUCHES: " +
        (
          Array.isArray(sr.touches)
            ? sr.touches.length
            : "N/A"
        )
      );

    } else {

      lines.push("No qualified level.");

    }

    lines.push("");

    lines.push("ENTRY ZONE");

    if (diagnostics.entryZone) {

      lines.push(
        "LOW: " +
        this.formatPrice(diagnostics.entryZone.low)
      );

      lines.push(
        "HIGH: " +
        this.formatPrice(diagnostics.entryZone.high)
      );

      lines.push(
        "MIDPOINT: " +
        this.formatPrice(diagnostics.entryZone.midpoint)
      );

    } else {

      lines.push("No valid entry zone.");

    }

    lines.push("");

    lines.push(
      "MARKET CONFIRMATION: " +
      (
        diagnostics.marketConfirmation === true
          ? "CONFIRMED"
          : "NOT CONFIRMED"
      )
    );

    this.elements.diagnostics.textContent =
      lines.join("\n");
  },

  // ======================================
  // Error display
  // ======================================

  renderError(error) {

    this.setConnectionStatus(
      "CONNECTION / ANALYSIS ERROR"
    );

    this.elements.price.textContent =
      "Market data unavailable.";

    this.elements.structure.textContent =
      "Analysis unavailable.";

    this.elements.signal.textContent =
      "NO TRADE";

    this.elements.signal.classList.remove(
      "buy",
      "sell",
      "limit",
      "market"
    );

    this.elements.signal.classList.add(
      "no-trade"
    );

    this.elements.details.textContent =
      "No verified trading signal available.";

    this.elements.diagnostics.textContent =
      "ERROR:\n" + error.message;

    this.state.signal = "NO TRADE";
  }
};

// ======================================
// Start application
// ======================================

document.addEventListener(
  "DOMContentLoaded",
  () => App.init()
);
