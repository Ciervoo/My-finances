export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { prompt } = req.body;

    // Try Anthropic first, fall back to Groq
    let text = '';

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
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
        const d = await r.json();
        if (d.content?.[0]?.text) text = d.content[0].text;
      } catch (e) {
        console.log('Anthropic failed, trying Groq:', e.message);
      }
    }

    // Fall back to Groq if Anthropic didn't work
    if (!text && process.env.GROQ_API_KEY) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          max_tokens: 2000,
          messages: [
            {
              role: 'system',
              content: 'Sos un analista financiero argentino experto. Respondés SIEMPRE con JSON válido, sin texto extra, sin markdown, sin explicaciones. Solo el JSON array.'
            },
            { role: 'user', content: prompt }
          ]
        })
      });
      const d = await r.json();
      if (d.choices?.[0]?.message?.content) text = d.choices[0].message.content;
    }

    if (!text) {
      return res.status(200).json({ result: [], error: 'no AI available' });
    }

    // Parse JSON - multiple strategies
    let parsed = [];
    const strategies = [
      () => JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()),
      () => { const m = text.match(/\[[\s\S]*\]/); return m ? JSON.parse(m[0]) : null; },
      () => { const s = text.indexOf('['), e = text.lastIndexOf(']'); return s !== -1 ? JSON.parse(text.slice(s, e+1)) : null; }
    ];

    for (const strategy of strategies) {
      try {
        const result = strategy();
        if (result && Array.isArray(result) && result.length > 0) {
          parsed = result;
          break;
        }
      } catch {}
    }

    res.status(200).json({ result: parsed });
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ result: [], error: err.message });
  }
}
