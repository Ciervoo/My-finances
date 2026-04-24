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
  console.log('IOL token obtained, expires in', data.expires_in, 's');
  return cachedToken;
}

async function getPrice(token, ticker, mercado = 'bCBA') {
  // Try multiple IOL endpoints
  const endpoints = [
    `https://api.invertironline.com/api/v2/${mercado}/Titulos/${ticker}/Cotizacion`,
    `https://api.invertironline.com/api/v2/${mercado}/Titulos/${ticker}/CotizacionDetalle`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      });

      if (!res.ok) continue;
      const text = await res.text();
      if (!text || text.length < 5) continue;

      const data = JSON.parse(text);

      // Extract price from different possible response formats
      const price =
        data.ultimoPrecio ??
        data.ultimo ??
        data.precioUltimo ??
        data.ultimoOperado ??
        data.cotizacion?.ultimoPrecio ??
        null;

      const change =
        data.variacionDiaria ??
        data.variacion ??
        data.porcentajeVariacion ??
        data.cotizacion?.variacionPorcentual ??
        null;

      if (price !== null) {
        // IOL returns bond prices multiplied by 100 (e.g. 90250 = 902.50)
        // Detect by checking if price is unreasonably high for a bond
        // Bonds typically trade between 10-200 in ARS normalized price
        // but IOL returns them as full integer * 100
        let finalPrice = price;
        if (tipo === 'bono' && price > 500) {
          finalPrice = price / 100;
        }
        console.log(`${ticker} price from IOL:`, price, '-> final:', finalPrice, 'change:', change);
        return { ticker, price: finalPrice, change24h: change, currency: data.moneda || 'ARS' };
      }
    } catch (e) {
      console.error(`Endpoint error for ${ticker}:`, e.message);
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { tickers } = req.body;
  if (!tickers || !tickers.length) {
    return res.status(400).json({ error: 'No tickers', prices: {} });
  }

  if (!process.env.IOL_USERNAME || !process.env.IOL_PASSWORD) {
    return res.status(200).json({ error: 'IOL credentials not configured', prices: {} });
  }

  try {
    const token = await getIOLToken();

    const results = await Promise.all(
      tickers.map(async ({ ticker, mercado, tipo }) => {
        // Detect correct market based on tipo
        let markets = [];

        if (tipo === 'bono') {
          markets = ['bCBA']; // Bonds always on BCBA
        } else if (tipo === 'cedear') {
          markets = ['bCBA', 'nYSE']; // CEDEARs on BCBA, fallback NYSE
        } else if (ticker === 'MELI' || ticker === 'GOOGL' || ticker === 'AAPL' || ticker === 'MSFT' || ticker === 'AMZN' || ticker === 'TSLA' || ticker === 'NVDA') {
          markets = ['nYSE', 'bCBA']; // US stocks try NYSE first
        } else {
          markets = [mercado || 'bCBA', 'nYSE'];
        }

        let price = null;
        for (const m of markets) {
          price = await getPrice(token, ticker, m);
          if (price) break;
        }
        return price;
      })
    );

    const prices = {};
    results.forEach(r => { if (r) prices[r.ticker] = r; });

    console.log('IOL prices fetched:', Object.keys(prices).length, 'of', tickers.length, 'tickers');
    res.status(200).json({ prices });
  } catch (err) {
    console.error('IOL handler error:', err.message);
    res.status(500).json({ error: err.message, prices: {} });
  }
}
