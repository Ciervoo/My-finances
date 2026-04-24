const RSS_FEEDS = [
  { name: "Ámbito", url: "https://www.ambito.com/rss/pages/economia.xml" },
  { name: "El Cronista", url: "https://www.cronista.com/files/rss/finanzas.xml" },
  { name: "Bloomberg Línea", url: "https://www.bloomberglinea.com/rss/argentina/" },
  { name: "Infobae Economía", url: "https://www.infobae.com/feeds/rss/economia/" },
];

async function fetchRSS(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    const text = await res.text();

    // Parse XML items
    const items = [];
    const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const match of itemMatches) {
      const item = match[1];
      const title   = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const desc    = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/)?.[1] || '';
      const link    = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';

      if (title) {
        items.push({
          source: feed.name,
          title: title.replace(/<[^>]*>/g, '').trim(),
          description: desc.replace(/<[^>]*>/g, '').slice(0, 300).trim(),
          link,
          pubDate,
          time: formatTime(pubDate)
        });
      }
    }
    return items.slice(0, 8);
  } catch (e) {
    console.error(`RSS error for ${feed.name}:`, e.message);
    return [];
  }
}

function formatTime(pubDate) {
  if (!pubDate) return 'hoy';
  try {
    const date = new Date(pubDate);
    const now  = new Date();
    const diff = Math.floor((now - date) / 60000);
    if (diff < 60) return `hace ${diff} min`;
    if (diff < 1440) return `hace ${Math.floor(diff/60)} h`;
    return `hace ${Math.floor(diff/1440)} d`;
  } catch { return 'hoy'; }
}

function matchesTickers(text, tickers) {
  const lower = text.toLowerCase();
  return tickers.filter(t => lower.includes(t.toLowerCase()));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { tickers = [], portfolioStr = '' } = req.body;

  try {
    // Fetch all RSS feeds in parallel
    const allFeeds = await Promise.all(RSS_FEEDS.map(fetchRSS));
    const allItems = allFeeds.flat();

    // Sort by recency and deduplicate
    const seen = new Set();
    const unique = allItems.filter(item => {
      if (seen.has(item.title)) return false;
      seen.add(item.title);
      return true;
    });

    // Tag items with matching tickers
    const tagged = unique.map(item => {
      const text = `${item.title} ${item.description}`;
      const matched = matchesTickers(text, tickers);
      return { ...item, tickers: matched, inPortfolio: matched.length > 0 };
    });

    // Sort: portfolio-relevant first, then by recency
    tagged.sort((a, b) => {
      if (a.inPortfolio && !b.inPortfolio) return -1;
      if (!a.inPortfolio && b.inPortfolio) return 1;
      return 0;
    });

    const news = tagged.slice(0, 15);
    console.log(`Fetched ${news.length} news items, ${news.filter(n=>n.inPortfolio).length} portfolio-relevant`);

    // If we have Groq, use it to add impact analysis to top stories
    if (process.env.GROQ_API_KEY && news.length > 0) {
      try {
        const topStories = news.slice(0, 8).map(n => `"${n.title}"`).join('\n');
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 500,
            response_format: { type: 'json_object' },
            messages: [{
              role: 'system',
              content: 'Analizá el impacto de estas noticias reales para un inversor argentino. Respondé con JSON: {"impacts": {"titulo_noticia": "bullish"|"bearish"|"neutral"}}. Solo el JSON.'
            }, {
              role: 'user',
              content: `Noticias:\n${topStories}\nCartera: ${portfolioStr}`
            }]
          })
        });
        const d = await r.json();
        const text = d.choices?.[0]?.message?.content || '{}';
        const impacts = JSON.parse(text).impacts || {};

        // Apply impacts to news items
        news.forEach(item => {
          const key = Object.keys(impacts).find(k =>
            item.title.toLowerCase().includes(k.toLowerCase().slice(0, 20))
          );
          item.impact = key ? impacts[key] : 'neutral';
        });
      } catch(e) {
        console.error('Groq impact analysis failed:', e.message);
        news.forEach(n => n.impact = 'neutral');
      }
    } else {
      news.forEach(n => n.impact = 'neutral');
    }

    res.status(200).json({ news });
  } catch (err) {
    console.error('News handler error:', err.message);
    res.status(500).json({ error: err.message, news: [] });
  }
}
