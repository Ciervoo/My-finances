import { createHmac } from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey   = process.env.BINANCE_API_KEY;
  const secretKey = process.env.BINANCE_SECRET_KEY;

  if (!apiKey || !secretKey) {
    return res.status(200).json({ error: 'No Binance keys configured', balances: [] });
  }

  try {
    const timestamp   = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature   = createHmac('sha256', secretKey)
      .update(queryString)
      .digest('hex');

    const response = await fetch(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
      { headers: { 'X-MBX-APIKEY': apiKey } }
    );

    const data = await response.json();

    if (data.code) {
      console.error('Binance API error:', data.msg);
      return res.status(200).json({ error: data.msg, balances: [] });
    }

    const balances = data.balances
      .filter(b => parseFloat(b.free) + parseFloat(b.locked) > 0.00001)
      .map(b => ({
        symbol: b.asset,
        amount: parseFloat(b.free) + parseFloat(b.locked),
        free:   parseFloat(b.free),
        locked: parseFloat(b.locked)
      }));

    res.status(200).json({ balances });
  } catch (err) {
    console.error('Binance handler error:', err.message);
    res.status(500).json({ error: err.message, balances: [] });
  }
}
