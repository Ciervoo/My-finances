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
  if (!data.access_token) throw new Error('IOL auth failed: ' + JSON.stringify(data));

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function getPrice(token, ticker, mercado = 'bCBA') {
  try {
    const res = await fetch(
      `https://api.invertironline.com/api/v2/${mercado}/Titulos/${ticker}/CotizacionDetalleMobile`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!data || data.status === 404) return null;

    return {
      ticker,
      price:     data.ultimoPrecio || data.ultimoOperado || null,
      change24h: data.variacionDiaria || data.variacion || null,
      open:      data.apertura || null,
      high:      data.maximo || null,
      low:       data.minimo || null,
      volume:    data.volumen || null,
      currency:  data.moneda || 'ARS'
    };
  } catch (e) {
    console.error(`Error fetching ${ticker}:`, e.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { tickers } = req.body;
  if (!tickers || !tickers.length) {
    return res.status(400).json({ error: 'No tickers provided' });
  }

  if (!process.env.IOL_USERNAME || !process.env.IOL_PASSWORD) {
    return res.status(200).json({ error: 'IOL credentials not configured', prices: {} });
  }

  try {
    const token = await getIOLToken();
    console.log('IOL token obtained');

    const results = await Promise.all(
      tickers.map(async ({ ticker, mercado }) => {
        // Try BCBA first, then NYSE for CEDEARs
        let price = await getPrice(token, ticker, mercado || 'bCBA');
        if (!price && mercado !== 'nYSE') {
          price = await getPrice(token, ticker, 'nYSE');
        }
        return price;
      })
    );

    const prices = {};
    results.forEach(r => { if (r) prices[r.ticker] = r; });

    console.log('IOL prices fetched:', Object.keys(prices).length, 'tickers');
    res.status(200).json({ prices });
  } catch (err) {
    console.error('IOL handler error:', err.message);
    res.status(500).json({ error: err.message, prices: {} });
  }
}
