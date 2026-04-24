const RSS_FEEDS = [
  // Argentina
  { name: "Ámbito",          url: "https://www.ambito.com/rss/pages/economia.xml",          region: "AR" },
  { name: "Infobae",         url: "https://www.infobae.com/feeds/rss/economia/",             region: "AR" },
  { name: "El Cronista",     url: "https://www.cronista.com/files/rss/finanzas.xml",         region: "AR" },
  { name: "Bloomberg Línea", url: "https://www.bloomberglinea.com/arc/outboundfeeds/rss/category/economia/?outputType=xml", region: "AR" },
  { name: "iProfesional",    url: "https://www.iprofesional.com/rss/home.xml",               region: "AR" },
  // Internacional
  { name: "Reuters",         url: "https://feeds.reuters.com/reuters/businessNews",           region: "INT" },
  { name: "CNBC",            url: "https://www.cnbc.com/id/10000664/device/rss/rss.html",    region: "INT" },
  { name: "CoinDesk",        url: "https://www.coindesk.com/arc/outboundfeeds/rss/",         region: "INT" },
  { name: "MarketWatch",     url: "https://feeds.marketwatch.com/marketwatch/topstories/",   region: "INT" },
];

function parseXML(text) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(text)) !== null) {
    const item = match[1];
    const getTag = (tag) => {
      const m = item.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's'));
      return m ? m[1].replace(/<[^>]*>/g, '').trim() : '';
    };
    const title   = getTag('title');
    const desc    = getTag('description').slice(0, 250);
    const link    = getTag('link') || item.match(/<link\s*\/?>([^<]+)/)?.[1] || '';
    const pubDate = getTag('pubDate');
    if (title && title.length > 10) {
      items.push({ title, desc, link, pubDate });
    }
  }
  return items;
}

function timeAgo(pubDate) {
  try {
    const diff = Math.floor((Date.now() - new Date(pubDate)) / 60000);
    if (diff < 1)   return 'ahora';
    if (diff < 60)  return `hace ${diff} min`;
    if (diff < 1440) return `hace ${Math.floor(diff/60)} h`;
    return `hace ${Math.floor(diff/1440)} d`;
  } catch { return 'hoy'; }
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) { console.log(`${feed.name}: HTTP ${res.status}`); return []; }
    const text = await res.text();
    const parsed = parseXML(text);
    console.log(`${feed.name}: ${parsed.length} items`);
    return parsed.slice(0, 6).map(i => ({ ...i, source: feed.name }));
  } catch(e) {
    console.log(`${feed.name} failed:`, e.message);
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { tickers = [], portfolioStr = '' } = req.body || {};

  // Fetch all RSS in parallel
  const allFeeds = await Promise.all(RSS_FEEDS.map(fetchFeed));
  const allItems = allFeeds.flat();
  console.log('Total RSS items:', allItems.length);

  if (allItems.length === 0) {
    return res.status(200).json({ news: [], error: 'All RSS feeds failed' });
  }

  // Deduplicate
  const seen = new Set();
  const unique = allItems.filter(i => {
    const key = i.title.slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Tag with portfolio tickers
  const feedRegion = {};
  RSS_FEEDS.forEach(f => { feedRegion[f.name] = f.region; });

  const tagged = unique.map(item => {
    const text = `${item.title} ${item.desc}`.toLowerCase();
    const matched = tickers.filter(t => text.includes(t.toLowerCase()));
    return {
      source:      item.source,
      region:      feedRegion[item.source] || 'INT',
      title:       item.title,
      description: item.desc,
      link:        item.link,
      time:        timeAgo(item.pubDate),
      tickers:     matched,
      inPortfolio: matched.length > 0,
      impact:      'neutral'
    };
  });

  // Sort portfolio-relevant first
  tagged.sort((a, b) => (b.inPortfolio ? 1 : 0) - (a.inPortfolio ? 1 : 0));
  const news = tagged.slice(0, 20);

  // Use Groq to classify impact of top stories
  if (process.env.GROQ_API_KEY && news.length > 0) {
    try {
      const topTitles = news.slice(0, 10).map((n, i) => `${i}. ${n.title}`).join('\n');
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 300,
          response_format: { type: 'json_object' },
          messages: [{
            role: 'system',
            content: 'Clasificá el impacto de estas noticias reales para inversores argentinos. Respondé con JSON: {"impacts": [{"index": 0, "impact": "bullish|bearish|neutral"}]}'
          }, {
            role: 'user',
            content: `Noticias:\n${topTitles}\nCartera del inversor: ${portfolioStr}`
          }]
        })
      });
      const d = await r.json();
      const obj = JSON.parse(d.choices?.[0]?.message?.content || '{}');
      (obj.impacts || []).forEach(({ index, impact }) => {
        if (news[index]) news[index].impact = impact;
      });
    } catch(e) { console.log('Groq impact failed:', e.message); }
  }

  console.log(`Returning ${news.length} news, ${news.filter(n=>n.inPortfolio).length} portfolio-relevant`);
  res.status(200).json({ news });
}
