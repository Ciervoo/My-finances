export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { prompt } = req.body;
    let text = '';

    // Try Groq first (free)
    if (process.env.GROQ_API_KEY) {
      try {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 2000,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: 'Sos un analista financiero argentino experto. Respondés SIEMPRE con un objeto JSON con una clave "items" que contiene un array. Sin texto extra.'
              },
              { role: 'user', content: prompt }
            ]
          })
        });
        const d = await r.json();
        console.log('Groq response:', JSON.stringify(d).slice(0, 300));
        if (d.choices?.[0]?.message?.content) {
          text = d.choices[0].message.content;
        }
      } catch (e) {
        console.log('Groq failed:', e.message);
      }
    }

    // Try Anthropic as fallback
    if (!text && process.env.ANTHROPIC_API_KEY) {
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
        console.log('Anthropic failed:', e.message);
      }
    }

    if (!text) {
      return res.status(200).json({ result: [], error: 'no AI available' });
    }

    console.log('Raw text to parse:', text.slice(0, 400));

    // Parse - handle both {items:[]} and direct [] formats
    let parsed = [];
    try {
      const obj = JSON.parse(text);
      // If it's {items: [...]} format from Groq json_object mode
      if (obj.items && Array.isArray(obj.items)) parsed = obj.items;
      // If it's direct array
      else if (Array.isArray(obj)) parsed = obj;
      // If it has any array property, use the first one
      else {
        const arrKey = Object.keys(obj).find(k => Array.isArray(obj[k]));
        if (arrKey) parsed = obj[arrKey];
      }
    } catch {
      // Try extracting array directly
      try {
        const m = text.match(/\[[\s\S]*\]/);
        if (m) parsed = JSON.parse(m[0]);
      } catch (e) {
        console.error('Parse failed:', e.message);
      }
    }

    console.log('Parsed items count:', parsed.length);
    res.status(200).json({ result: parsed });
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ result: [], error: err.message });
  }
}
