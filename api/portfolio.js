const JSONBIN_BASE = 'https://api.jsonbin.io/v3';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.JSONBIN_API_KEY;
  const binId  = process.env.JSONBIN_BIN_ID;

  if (!apiKey || !binId) {
    return res.status(200).json({ error: 'JSONBin not configured', stocks: [], crypto: [] });
  }

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${JSONBIN_BASE}/b/${binId}/latest`, {
        headers: { 'X-Master-Key': apiKey }
      });
      const data = await r.json();
      const record = data.record || {};
      return res.status(200).json({
        stocks: record.stocks || [],
        crypto: record.crypto || []
      });
    }

    if (req.method === 'POST') {
      const { stocks, crypto } = req.body;

      // First get current data
      const r = await fetch(`${JSONBIN_BASE}/b/${binId}/latest`, {
        headers: { 'X-Master-Key': apiKey }
      });
      const current = await r.json();
      const existing = current.record || {};

      // Merge with new data
      const updated = {
        stocks: stocks !== undefined ? stocks : (existing.stocks || []),
        crypto: crypto !== undefined ? crypto : (existing.crypto || [])
      };

      // Save back
      await fetch(`${JSONBIN_BASE}/b/${binId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': apiKey
        },
        body: JSON.stringify(updated)
      });

      console.log('Portfolio saved - stocks:', updated.stocks.length, 'crypto:', updated.crypto.length);
      return res.status(200).json({ ok: true });
    }
  } catch(err) {
    console.error('Portfolio error:', err.message);
    return res.status(500).json({ error: err.message, stocks: [], crypto: [] });
  }
}
