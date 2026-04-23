export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { prompt } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Data preview:', JSON.stringify(data).slice(0, 500));

    if (!data.content || !data.content.length) {
      return res.status(200).json({ result: [], error: 'no content' });
    }

    const text = data.content.find(b => b.type === 'text')?.text || '';

    // Try multiple parsing strategies
    let parsed = [];

    try {
      const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      try {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
      } catch {
        try {
          const start = text.indexOf('[');
          const end = text.lastIndexOf(']');
          if (start !== -1 && end !== -1) {
            parsed = JSON.parse(text.slice(start, end + 1));
          }
        } catch (e) {
          console.error('All parse strategies failed:', e.message, 'text was:', text.slice(0, 200));
        }
      }
    }

    res.status(200).json({ result: parsed });
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ result: [], error: err.message });
  }
}
