let cachedToken = null;
let tokenExpiry = 0;

async function getIOLToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch('https://api.invertironline.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: process.env.IOL_USERNAME,
      password: process.env.IOL_PASSWORD,
      grant_type: 'password'
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('IOL auth failed');
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function getHistoricalData(token, ticker, mercado = 'bCBA') {
  try {
    // Get 1 year of daily data
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 365*24*60*60*1000).toISOString().split('T')[0];
    const url = `https://api.invertironline.com/api/v2/${mercado}/Titulos/${ticker}/Cotizacion/seriehistorica/${from}/${to}/ajustada`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data) || data.length === 0) return null;

    const prices = data.map(d => d.ultimoPrecio || d.apertura || 0).filter(p => p > 0);
    if (prices.length === 0) return null;

    const ath = Math.max(...prices);
    const atl = Math.min(...prices);
    const current = prices[prices.length - 1];
    const weekAgo = prices[Math.max(0, prices.length - 6)];
    const monthAgo = prices[Math.max(0, prices.length - 22)];

    return {
      ticker,
      ath,
      atl,
      distanceFromATH: ((current - ath) / ath * 100).toFixed(1),
      weekChange: ((current - weekAgo) / weekAgo * 100).toFixed(1),
      monthChange: ((current - monthAgo) / monthAgo * 100).toFixed(1),
      trend: current > monthAgo ? 'alcista' : 'bajista',
      dataPoints: prices.length
    };
  } catch(e) {
    console.error(`Historical data error for ${ticker}:`, e.message);
    return null;
  }
}

// Get crypto historical data from Binance
async function getCryptoHistorical(symbol) {
  try {
    if (symbol === 'USDT') return null;
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1w&limit=52`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const closes = data.map(k => parseFloat(k[4]));
    const ath = Math.max(...closes);
    const current = closes[closes.length - 1];
    const monthAgo = closes[Math.max(0, closes.length - 5)];
    const weekAgo = closes[Math.max(0, closes.length - 2)];

    return {
      symbol,
      ath,
      distanceFromATH: ((current - ath) / ath * 100).toFixed(1),
      weekChange: ((current - weekAgo) / weekAgo * 100).toFixed(1),
      monthChange: ((current - monthAgo) / monthAgo * 100).toFixed(1),
      trend: current > monthAgo ? 'alcista' : 'bajista'
    };
  } catch(e) {
    console.error(`Crypto historical error for ${symbol}:`, e.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { stocks = [], crypto = [] } = req.body || {};
  const results = {};

  // Get stock historical data from IOL
  if (stocks.length > 0 && process.env.IOL_USERNAME) {
    try {
      const token = await getIOLToken();
      await Promise.all(stocks.map(async ({ ticker, tipo }) => {
        const mercado = tipo === 'cedear' ? 'nYSE' : 'bCBA';
        const data = await getHistoricalData(token, ticker, mercado);
        if (!data) {
          // Try other market
          const alt = await getHistoricalData(token, ticker, mercado === 'bCBA' ? 'nYSE' : 'bCBA');
          if (alt) results[ticker] = alt;
        } else {
          results[ticker] = data;
        }
      }));
    } catch(e) {
      console.error('IOL historical error:', e.message);
    }
  }

  // Get crypto historical from Binance
  await Promise.all(crypto.map(async ({ symbol }) => {
    const data = await getCryptoHistorical(symbol);
    if (data) results[symbol] = data;
  }));

  console.log('Market data fetched for:', Object.keys(results).length, 'assets');
  res.status(200).json({ market: results });
}
