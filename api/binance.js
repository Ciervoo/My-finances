import { createHmac } from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey    = process.env.BINANCE_API_KEY;
  const secretKey = process.env.BINANCE_SECRET_KEY;

  if (!apiKey || !secretKey) {
    return res.status(200).json({ error: 'Missing keys', balances: [] });
  }

  try {
    const timestamp   = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature   = createHmac('sha256', secretKey)
      .update(queryString)
      .digest('hex');

    const url = `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`;
    const response = await fetch(url, {
      headers: { 'X-MBX-APIKEY': apiKey }
    });

    const data = await response.json();
    console.log('Binance response code:', data.code);
    console.log('Binance response msg:', data.msg);
    console.log('Has balances:', !!data.balances);

    if (data.code) {
      // Binance returned an error
      console.error('Binance error:', data.code, data.msg);
      return res.status(200).json({ error: `Binance: ${data.msg}`, balances: [] });
    }

    if (!data.balances) {
      console.error('No balances in response:', JSON.stringify(data).slice(0, 200));
      return res.status(200).json({ error: 'No balances', balances: [] });
    }

    const balances = data.balances
      .filter(b => parseFloat(b.free) + parseFloat(b.locked) > 0.00001)
      .map(b => ({
        symbol: b.asset,
        amount: parseFloat(b.free) + parseFloat(b.locked),
        free:   parseFloat(b.free),
        locked: parseFloat(b.locked)
      }));

    console.log('Filtered balances count:', balances.length);
    res.status(200).json({ balances });
  } catch (err) {
    console.error('Binance handler error:', err.message);
    res.status(500).json({ error: err.message, balances: [] });
  }
}
