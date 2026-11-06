
"use strict";

// ======================================
// AI GOLD SIGNALS
// Market Data Engine
// XAUS OHLCV Provider
// ======================================

const MarketData = (() => {
  const BASE_URL = "https://xaus.com/api/v1/chart";

  const TIMEFRAMES = {
    "5M": {
      interval: "5m",
      seconds: 300
    },
    "1H": {
      interval: "1h",
      seconds: 3600
    }
  };

  function extractCandles(response) {
    if (Array.isArray(response)) return response;

    if (!response || typeof response !== "object") {
      throw new Error("Invalid API response");
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
      if (Array.isArray(item)) return item;
    }

    throw new Error("No candle array found in API response");
  }

  function normalizeCandles(rawCandles, timeframe) {
    const config = TIMEFRAMES[timeframe];

    if (!config) {
      throw new Error("Unsupported timeframe");
    }

    const candles = rawCandles.map(item => {
      const timestamp = Number(item.t);

      const candle = {
        time: timestamp,
        open: Number(item.o),
        high: Number(item.h),
        low: Number(item.l),
        close: Number(item.c),
        volume: Number(item.v ?? 0)
      };

      // Convert milliseconds to seconds if necessary.
      if (candle.time > 100000000000) {
        candle.time = Math.floor(candle.time / 1000);
      }

      return candle;
    });

    return candles.filter(candle => {
      return (
        Number.isFinite(candle.time) &&
        Number.isFinite(candle.open) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close) &&
        candle.high >= candle.low &&
        candle.high >= Math.max(candle.open, candle.close) &&
        candle.low <= Math.min(candle.open, candle.close)
      );
    });
  }

  function validateCandles(candles) {
    if (!Array.isArray(candles) || candles.length < 10) {
      throw new Error("Insufficient valid candle data");
    }

    const sorted = [...candles].sort(
      (a, b) => a.time - b.time
    );

    const unique = [];

    for (const candle of sorted) {
      const previous = unique[unique.length - 1];

      if (previous && previous.time === candle.time) {
        unique[unique.length - 1] = candle;
      } else {
        unique.push(candle);
      }
    }

    return unique;
  }

  async function fetchCandles(timeframe, range = "5d") {
    const config = TIMEFRAMES[timeframe];

    if (!config) {
      throw new Error("Unsupported timeframe: " + timeframe);
    }

    const url = new URL(BASE_URL);

    url.searchParams.set("symbol", "xau");
    url.searchParams.set("range", range);
    url.searchParams.set("interval", config.interval);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        "Market data request failed: HTTP " + response.status
      );
    }

    const json = await response.json();

    const rawCandles = extractCandles(json);
    const normalized = normalizeCandles(
      rawCandles,
      timeframe
    );

    const candles = validateCandles(normalized);

    const now = Math.floor(Date.now() / 1000);

    const latest = candles[candles.length - 1];

    const latestCandleClosed =
      latest.time + config.seconds <= now;

    return {
      symbol: "XAUUSD",
      timeframe,
      provider: "XAUS",
      source: "Yahoo Finance proxy",
      fetchedAt: new Date().toISOString(),
      count: candles.length,
      latestCandleClosed,
      candles
    };
  }

  async function getMarketData() {
    const [fiveMinutes, oneHour] = await Promise.all([
      fetchCandles("5M"),
      fetchCandles("1H")
    ]);

    return {
      symbol: "XAUUSD",
      status: "DATA_RECEIVED",
      timeframes: {
        "5M": fiveMinutes,
        "1H": oneHour
      }
    };
  }

  return {
    fetchCandles,
    getMarketData,
    validateCandles
  };
})();

// Browser and Node.js compatibility.
if (typeof window !== "undefined") {
  window.MarketData = MarketData;
}

if (typeof module !== "undefined") {
  module.exports = MarketData;
}
