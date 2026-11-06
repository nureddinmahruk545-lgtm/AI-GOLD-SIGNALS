
"use strict";

// ======================================
// AI GOLD SIGNALS
// Market Data Engine V2
// XAUUSD OHLCV Provider
//
// Features:
// - 5M and 1H candles
// - Timestamp normalization
// - Duplicate removal
// - OHLC validation
// - Closed candle detection
// - Stale data detection
// - Request timeout
// - No fabricated prices
// ======================================

const MarketData = (() => {

  // ======================================
  // Configuration
  // ======================================

  const CONFIG = {
    BASE_URL: "https://xaus.com/api/v1/chart",

    SYMBOL: "xau",

    REQUEST_TIMEOUT: 15000,

    TIMEFRAMES: {
      "5M": {
        interval: "5m",
        seconds: 300,
        range: "5d"
      },

      "1H": {
        interval: "1h",
        seconds: 3600,
        range: "5d"
      }
    },

    // Warn if last completed candle is older
    // than this number of timeframe intervals.
    STALE_INTERVALS: 3,

    MIN_CANDLES: 30
  };

  // ======================================
  // Helpers
  // ======================================

  function isNumber(value) {
    return (
      typeof value === "number" &&
      Number.isFinite(value)
    );
  }

  function toNumber(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return NaN;
    }

    return Number(value);
  }

  function normalizeTimestamp(value) {
    let timestamp = toNumber(value);

    if (!isNumber(timestamp) || timestamp <= 0) {
      return NaN;
    }

    // Convert milliseconds to seconds.
    if (timestamp > 100000000000) {
      timestamp = Math.floor(timestamp / 1000);
    }

    return Math.floor(timestamp);
  }

  // ======================================
  // Extract API candle array
  // ======================================

  function extractCandles(response) {

    if (Array.isArray(response)) {
      return response;
    }

    if (
      !response ||
      typeof response !== "object"
    ) {
      throw new Error(
        "Invalid market API response."
      );
    }

    const candidates = [
      response.points,
      response.candles,
      response.data,
      response.results,
      response.chart?.points,
      response.chart?.candles
    ];

    for (const item of candidates) {

      if (Array.isArray(item)) {
        return item;
      }

    }

    throw new Error(
      "No candle array found in API response."
    );
  }

  // ======================================
  // Validate one OHLC candle
  // ======================================

  function validateCandle(candle) {

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

    if (!values.every(isNumber)) {
      return false;
    }

    if (candle.time <= 0) {
      return false;
    }

    if (candle.open <= 0 || candle.close <= 0) {
      return false;
    }

    if (candle.low <= 0) {
      return false;
    }

    if (candle.high < candle.low) {
      return false;
    }

    if (
      candle.high <
      Math.max(candle.open, candle.close)
    ) {
      return false;
    }

    if (
      candle.low >
      Math.min(candle.open, candle.close)
    ) {
      return false;
    }

    return true;
  }

  // ======================================
  // Normalize raw candles
  // ======================================

  function normalizeCandles(
    rawCandles,
    timeframe
  ) {

    const config = CONFIG.TIMEFRAMES[timeframe];

    if (!config) {
      throw new Error(
        "Unsupported timeframe: " + timeframe
      );
    }

    if (!Array.isArray(rawCandles)) {
      throw new Error(
        "Raw candle data must be an array."
      );
    }

    const now = Math.floor(Date.now() / 1000);

    const candles = rawCandles.map(item => {

      if (!item || typeof item !== "object") {
        return null;
      }

      const candle = {
        time: normalizeTimestamp(item.t),
        open: toNumber(item.o),
        high: toNumber(item.h),
        low: toNumber(item.l),
        close: toNumber(item.c),
        volume: toNumber(item.v ?? 0)
      };

      // Invalid volume is treated as unavailable.
      if (!isNumber(candle.volume) || candle.volume < 0) {
        candle.volume = null;
      }

      if (!validateCandle(candle)) {
        return null;
      }

      // Reject future candles.
      if (candle.time > now + config.seconds) {
        return null;
      }

      return candle;

    });

    return candles.filter(Boolean);
  }

  // ======================================
  // Sort and remove duplicate candles
  // ======================================

  function validateCandles(candles) {

    if (!Array.isArray(candles)) {
      throw new Error(
        "Candle collection is invalid."
      );
    }

    const sorted = [...candles]
      .filter(validateCandle)
      .sort((a, b) => a.time - b.time);

    const unique = [];

    for (const candle of sorted) {

      const previous = unique[unique.length - 1];

      if (
        previous &&
        previous.time === candle.time
      ) {
        // Keep the last received version.
        unique[unique.length - 1] = candle;
      } else {
        unique.push(candle);
      }

    }

    if (unique.length < CONFIG.MIN_CANDLES) {
      throw new Error(
        "Insufficient valid candles. Received: " +
        unique.length
      );
    }

    return unique;
  }

  // ======================================
  // Identify closed candles
  // ======================================

  function getClosedCandles(
    candles,
    timeframe,
    nowSeconds = Math.floor(Date.now() / 1000)
  ) {

    const config = CONFIG.TIMEFRAMES[timeframe];

    if (!config) {
      throw new Error(
        "Unsupported timeframe."
      );
    }

    return candles.filter(candle => {
      return (
        candle.time + config.seconds <= nowSeconds
      );
    });
  }

  // ======================================
  // Calculate candle gaps
  // ======================================

  function calculateGaps(
    candles,
    timeframe
  ) {

    const config = CONFIG.TIMEFRAMES[timeframe];

    const gaps = [];

    for (let i = 1; i < candles.length; i++) {

      const previous = candles[i - 1];
      const current = candles[i];

      const difference =
        current.time - previous.time;

      if (difference > config.seconds * 1.5) {

        gaps.push({
          from: previous.time,
          to: current.time,
          missingIntervals: Math.max(
            0,
            Math.floor(
              difference / config.seconds
            ) - 1
          )
        });

      }

    }

    return gaps;
  }

  // ======================================
  // Fetch one timeframe
  // ======================================

  async function fetchCandles(
    timeframe,
    range
  ) {

    const config = CONFIG.TIMEFRAMES[timeframe];

    if (!config) {
      throw new Error(
        "Unsupported timeframe: " + timeframe
      );
    }

    const selectedRange = range || config.range;

    const url = new URL(CONFIG.BASE_URL);

    url.searchParams.set(
      "symbol",
      CONFIG.SYMBOL
    );

    url.searchParams.set(
      "range",
      selectedRange
    );

    url.searchParams.set(
      "interval",
      config.interval
    );

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, CONFIG.REQUEST_TIMEOUT);

    let response;

    try {

      response = await fetch(url.toString(), {
        method: "GET",

        headers: {
          "Accept": "application/json"
        },

        signal: controller.signal,

        cache: "no-store"
      });

    } catch (error) {

      if (error.name === "AbortError") {
        throw new Error(
          "Market data request timed out."
        );
      }

      throw new Error(
        "Market data network error: " + error.message
      );

    } finally {

      clearTimeout(timeoutId);

    }

    if (!response.ok) {
      throw new Error(
        "Market API HTTP error: " +
        response.status
      );
    }

    let json;

    try {

      json = await response.json();

    } catch {
      throw new Error(
        "Market API returned invalid JSON."
      );
    }

    const rawCandles = extractCandles(json);

    const normalized = normalizeCandles(
      rawCandles,
      timeframe
    );

    const candles = validateCandles(normalized);

    const now = Math.floor(Date.now() / 1000);

    const closedCandles = getClosedCandles(
      candles,
      timeframe,
      now
    );

    if (!closedCandles.length) {
      throw new Error(
        "No fully closed candles received."
      );
    }

    const latestCandle =
      candles[candles.length - 1];

    const lastClosedCandle =
      closedCandles[closedCandles.length - 1];

    const latestCandleClosed =
      latestCandle.time + config.seconds <= now;

    const ageSeconds =
      now - (
        lastClosedCandle.time + config.seconds
      );

    const isStale =
      ageSeconds >
      config.seconds * CONFIG.STALE_INTERVALS;

    const gaps = calculateGaps(
      candles,
      timeframe
    );

    return {

      symbol: "XAUUSD",

      timeframe,

      provider: "XAUS",

      source: CONFIG.BASE_URL,

      fetchedAt: new Date().toISOString(),

      count: candles.length,

      closedCount: closedCandles.length,

      latestCandleClosed,

      latestCandleTime: latestCandle.time,

      lastClosedCandleTime:
        lastClosedCandle.time,

      lastClosedCandle,

      lastClosedPrice:
        lastClosedCandle.close,

      latestPrice:
        latestCandle.close,

      ageSeconds,

      isStale,

      gaps,

      candles

    };
  }

  // ======================================
  // Fetch all required timeframes
  // ======================================

  async function getMarketData() {

    const [fiveMinutes, oneHour] =
      await Promise.all([

        fetchCandles("5M"),

        fetchCandles("1H")

      ]);

    const warnings = [];

    if (fiveMinutes.isStale) {
      warnings.push(
        "5M market data may be stale."
      );
    }

    if (oneHour.isStale) {
      warnings.push(
        "1H market data may be stale."
      );
    }

    if (fiveMinutes.gaps.length > 0) {
      warnings.push(
        "5M candle gaps detected."
      );
    }

    if (oneHour.gaps.length > 0) {
      warnings.push(
        "1H candle gaps detected."
      );
    }

    return {

      symbol: "XAUUSD",

      provider: "XAUS",

      status: "DATA_RECEIVED",

      fetchedAt: new Date().toISOString(),

      warnings,

      dataQuality: {
        fiveMStale: fiveMinutes.isStale,
        oneHStale: oneHour.isStale,

        fiveMGaps: fiveMinutes.gaps.length,
        oneHGaps: oneHour.gaps.length
      },

      timeframes: {
        "5M": fiveMinutes,
        "1H": oneHour
      }

    };
  }

  // ======================================
  // Public API
  // ======================================

  return {

    fetchCandles,

    getMarketData,

    validateCandles,

    normalizeCandles,

    getClosedCandles,

    validateCandle,

    config: CONFIG

  };

})();

// ======================================
// Browser compatibility
// ======================================

if (typeof window !== "undefined") {
  window.MarketData = MarketData;
}

// ======================================
// Node.js compatibility
// ======================================

if (typeof module !== "undefined") {
  module.exports = MarketData;
}
