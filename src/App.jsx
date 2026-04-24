import { useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, ResponsiveContainer, Legend } from "recharts";

const DEFAULT_USD_ARS = 1400;
const USD_ARS = DEFAULT_USD_ARS; // fallback

const DEFAULT_STOCKS = [];
const DEFAULT_CRYPTO = [];

function fmt(n, dec=2) {
  if (n===null||n===undefined||isNaN(n)) return "—";
  const abs=Math.abs(n);
  if (abs>=1e6) return (n/1e6).toFixed(2)+"M";
  if (abs>=1e3) return n.toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:0});
  return n.toLocaleString("es-AR",{minimumFractionDigits:dec,maximumFractionDigits:dec});
}

function Badge({ pct }) {
  if (pct===null||pct===undefined) return null;
  const pos=pct>=0;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:2,padding:"3px 7px",borderRadius:4,fontSize:11,fontWeight:700,background:pos?"rgba(0,220,130,0.13)":"rgba(255,70,70,0.13)",color:pos?"#00dc82":"#ff4646",fontFamily:"monospace"}}>
      {pos?"▲":"▼"} {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

function Spinner() {
  return <span style={{display:"inline-block",width:10,height:10,border:"2px solid rgba(255,255,255,0.1)",borderTopColor:"#555",borderRadius:"50%",animation:"spin 0.7s linear infinite"}} />;
}

function CurrencyToggle({ mode, setMode }) {
  return (
    <div style={{display:"flex",background:"rgba(255,255,255,0.06)",borderRadius:8,padding:3,gap:2}}>
      {["ARS","USD"].map(m=>(
        <button key={m} onClick={()=>setMode(m)} style={{padding:"5px 14px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:800,letterSpacing:1,background:mode===m?(m==="ARS"?"#1a6ef7":"#f0b90b"):"transparent",color:mode===m?(m==="ARS"?"#fff":"#1a1006"):"#555",transition:"all 0.18s"}}>{m}</button>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{background:"#13141a",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:480,padding:"24px 20px 40px",border:"1px solid rgba(255,255,255,0.08)",borderBottom:"none"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{title}</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.07)",border:"none",color:"#888",width:28,height:28,borderRadius:"50%",cursor:"pointer",fontSize:14}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type="text", placeholder }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:10,color:"#555",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{label}</div>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 12px",color:"#fff",fontSize:14,outline:"none",fontFamily:"monospace"}}/>
    </div>
  );
}

function StockRow({ s, mode, onEdit, onDelete, loading }) {
  const hasPrice = s.price !== null;
  const valueARS = hasPrice ? s.qty * s.price : null;
  const costARS  = s.qty * s.avgBuy;
  const pnlARS   = hasPrice ? valueARS - costARS : null;
  const pnlUSD   = pnlARS !== null ? pnlARS / USD_ARS : null;
  const pnlPct   = hasPrice ? ((s.price - s.avgBuy) / s.avgBuy) * 100 : null;
  const valueUSD = valueARS !== null ? valueARS / USD_ARS : null;
  const val  = mode==="ARS" ? (valueARS!==null?`$ ${fmt(valueARS,0)}`:"—") : (valueUSD!==null?`USD ${fmt(valueUSD,0)}`:"—");
  const pnl  = mode==="ARS" ? (pnlARS!==null?`${pnlARS>=0?"+":""}$ ${fmt(pnlARS,0)}`:"—") : (pnlUSD!==null?`${pnlUSD>=0?"+":""}USD ${fmt(pnlUSD,0)}`:"—");
  const pnlColor = pnlARS!==null ? (pnlARS>=0?"#00dc82":"#ff4646") : "#555";
  return (
    <div style={{display:"grid",gridTemplateColumns:"34px 1fr auto auto auto 24px",alignItems:"center",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",gap:10}}>
      <div style={{width:32,height:32,borderRadius:7,flexShrink:0,background:"linear-gradient(135deg,#1a6ef7,#60a5fa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,color:"#fff"}}>{s.ticker.slice(0,4)}</div>
      <div onClick={()=>onEdit(s)} style={{cursor:"pointer"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#efefef"}}>{s.ticker}{s.change24h!==null&&<span style={{marginLeft:6,fontSize:9,fontWeight:700,color:s.change24h>=0?"#00dc82":"#ff4646"}}>{s.change24h>=0?"+":""}{s.change24h?.toFixed(2)}%</span>}</div>
        <div style={{fontSize:10,color:"#444"}}>{s.qty} acc · PM ${fmt(s.avgBuy,0)}</div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:12,fontWeight:700,color:"#fff",fontFamily:"monospace"}}>{loading&&!hasPrice?<Spinner/>:val}</div>
        <div style={{fontSize:9,color:"#333",fontFamily:"monospace"}}>{mode==="ARS"?`USD ${fmt(valueUSD,0)}`:`$ ${fmt(valueARS,0)}`}</div>
      </div>
      <div style={{textAlign:"right",minWidth:86}}>
        <div style={{fontSize:12,fontWeight:700,color:pnlColor,fontFamily:"monospace"}}>{loading&&!hasPrice?<Spinner/>:pnl}</div>
        <div style={{fontSize:9,color:"#333"}}>rendimiento</div>
      </div>
      <div style={{textAlign:"right"}}><Badge pct={pnlPct}/></div>
      <button onClick={()=>onDelete(s.id)} style={{background:"transparent",border:"none",color:"#2a2a2a",cursor:"pointer",fontSize:16,padding:0}} onMouseOver={e=>e.target.style.color="#ff4646"} onMouseOut={e=>e.target.style.color="#2a2a2a"}>×</button>
    </div>
  );
}

function CryptoRow({ c, mode, onEdit, onDelete, loading }) {
  const hasPrice = c.priceUSD !== null;
  const valueUSD = hasPrice ? c.amount * c.priceUSD : null;
  const costUSD  = c.amount * c.avgBuyUSD;
  const pnlUSD   = hasPrice ? valueUSD - costUSD : null;
  const pnlARS   = pnlUSD !== null ? pnlUSD * USD_ARS : null;
  const pnlPct   = hasPrice ? ((c.priceUSD - c.avgBuyUSD) / c.avgBuyUSD) * 100 : null;
  const valueARS = valueUSD !== null ? valueUSD * USD_ARS : null;
  const val  = mode==="ARS" ? (valueARS!==null?`$ ${fmt(valueARS,0)}`:"—") : (valueUSD!==null?`USD ${fmt(valueUSD)}`:"—");
  const pnl  = mode==="ARS" ? (pnlARS!==null?`${pnlARS>=0?"+":""}$ ${fmt(pnlARS,0)}`:"—") : (pnlUSD!==null?`${pnlUSD>=0?"+":""}USD ${fmt(pnlUSD)}`:"—");
  const pnlColor = pnlUSD!==null?(pnlUSD>=0?"#00dc82":"#ff4646"):"#555";
  return (
    <div style={{display:"grid",gridTemplateColumns:"34px 1fr auto auto auto 24px",alignItems:"center",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",gap:10}}>
      <div style={{width:32,height:32,borderRadius:"50%",flexShrink:0,background:"linear-gradient(135deg,#f0b90b,#fde68a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#1a1006"}}>{c.symbol.slice(0,2)}</div>
      <div onClick={()=>onEdit(c)} style={{cursor:"pointer"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#efefef"}}>{c.symbol}{c.change24h!==null&&<span style={{marginLeft:6,fontSize:9,fontWeight:700,color:c.change24h>=0?"#00dc82":"#ff4646"}}>{c.change24h>=0?"+":""}{c.change24h?.toFixed(2)}%</span>}</div>
        <div style={{fontSize:10,color:"#444"}}>{fmt(c.amount,4)} · PM ${fmt(c.avgBuyUSD)}</div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:12,fontWeight:700,color:"#fff",fontFamily:"monospace"}}>{loading&&!hasPrice?<Spinner/>:val}</div>
        <div style={{fontSize:9,color:"#333",fontFamily:"monospace"}}>{mode==="ARS"?`USD ${fmt(valueUSD)}`:`$ ${fmt(valueARS,0)}`}</div>
      </div>
      <div style={{textAlign:"right",minWidth:86}}>
        <div style={{fontSize:12,fontWeight:700,color:pnlColor,fontFamily:"monospace"}}>{loading&&!hasPrice?<Spinner/>:pnl}</div>
        <div style={{fontSize:9,color:"#333"}}>rendimiento</div>
      </div>
      <div style={{textAlign:"right"}}><Badge pct={pnlPct}/></div>
      <button onClick={()=>onDelete(c.id)} style={{background:"transparent",border:"none",color:"#2a2a2a",cursor:"pointer",fontSize:16,padding:0}} onMouseOver={e=>e.target.style.color="#ff4646"} onMouseOut={e=>e.target.style.color="#2a2a2a"}>×</button>
    </div>
  );
}

function AICard({ item }) {
  const [open, setOpen] = useState(false);
  const signal = item.signal;
  const sigColor = signal==="COMPRAR"?"#00dc82":signal==="VENDER"?"#ff4646":signal==="MANTENER"?"#f0b90b":"#888";
  return (
    <div style={{marginBottom:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderLeft:`3px solid ${sigColor}`,borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"14px",cursor:"pointer"}} onClick={()=>setOpen(!open)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
              <span style={{fontSize:12,fontWeight:900,color:"#fff",fontFamily:"monospace"}}>{item.ticker||item.symbol}</span>
              {signal&&<span style={{fontSize:9,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"2px 8px",borderRadius:4,background:`${sigColor}18`,color:sigColor}}>{signal}</span>}
              {item.conviccion&&<span style={{fontSize:9,color:"#444"}}>convicción {item.conviccion}/10</span>}
            </div>
            <div style={{fontSize:13,fontWeight:700,color:"#ddd",lineHeight:1.3}}>{item.titulo||item.title}</div>
          </div>
          <div style={{fontSize:14,color:"#333"}}>{open?"▲":"▼"}</div>
        </div>
      </div>
      {open&&(
        <div style={{padding:"0 14px 14px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{fontSize:12,color:"#666",lineHeight:1.6,marginTop:10}}>{item.analisis||item.summary}</div>
          {item.precio_objetivo&&(
            <div style={{display:"flex",gap:16,marginTop:12,flexWrap:"wrap"}}>
              <div style={{fontSize:10,color:"#444"}}>Objetivo: <span style={{color:"#fff",fontFamily:"monospace",fontWeight:700}}>{item.precio_objetivo}</span></div>
              {item.potencial&&<div style={{fontSize:10,color:"#444"}}>Potencial: <span style={{color:sigColor,fontFamily:"monospace",fontWeight:700}}>{item.potencial}</span></div>}
              {item.horizonte&&<div style={{fontSize:10,color:"#444"}}>Horizonte: <span style={{color:"#aaa"}}>{item.horizonte}</span></div>}
            </div>
          )}
          {item.riesgos&&<div style={{marginTop:10,padding:"8px 10px",background:"rgba(255,70,70,0.05)",borderRadius:6,fontSize:11,color:"#666"}}>⚠️ {item.riesgos}</div>}
        </div>
      )}
    </div>
  );
}

function AISection({ prompt, emptyMsg }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetch("/api/ai", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ prompt })
    })
    .then(r => r.json())
    .then(d => { setData(d.result || []); })
    .catch(() => setData([]))
    .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{textAlign:"center",padding:"48px 0",color:"#333"}}>
      <div style={{fontSize:28,marginBottom:10,display:"inline-block",animation:"spin 1.5s linear infinite"}}>◌</div>
      <div style={{fontSize:12}}>Analizando con IA…</div>
    </div>
  );
  if (!data || !data.length) return <div style={{textAlign:"center",padding:"32px 0",color:"#333",fontSize:12}}>{emptyMsg}</div>;

  return (
    <>
      {data.map((item, i) => <AICard key={i} item={item} />)}
    </>
  );
}

function NewsSection({ portfolioStr, tickers }) {
  const [news, setNews]       = useState(null);
  const [loading, setLoading] = useState(true);

  function loadNews() {
    setLoading(true);
    setNews(null);
    fetch('/api/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers, portfolioStr })
    })
    .then(r => r.json())
    .then(d => setNews(d.news || []))
    .catch(() => setNews([]))
    .finally(() => setLoading(false));
  }

  useEffect(() => { loadNews(); }, []);

  if (loading) return (
    <div style={{textAlign:"center",padding:"48px 0",color:"#333"}}>
      <div style={{fontSize:28,marginBottom:10,display:"inline-block",animation:"spin 1.5s linear infinite"}}>◌</div>
      <div style={{fontSize:12}}>Cargando noticias reales…</div>
    </div>
  );
  if (!news || !news.length) return (
    <div style={{textAlign:"center",padding:"32px 0",color:"#333",fontSize:12}}>
      No se pudieron cargar noticias.
      <button onClick={loadNews} style={{display:"block",margin:"12px auto 0",padding:"8px 16px",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"#555",cursor:"pointer",fontSize:12}}>↻ Reintentar</button>
    </div>
  );

  return (
    <>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
        <button onClick={loadNews} style={{padding:"5px 12px",borderRadius:7,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#555",cursor:"pointer",fontSize:10,fontWeight:700,letterSpacing:1}}>↻ ACTUALIZAR</button>
      </div>
      {news.map((item, i) => {
        const tagColor = item.impact==="bullish"?"#00dc82":item.impact==="bearish"?"#ff4646":"#888";
        return (
          <div key={i} style={{
            padding:"14px", marginBottom:10,
            background: item.inPortfolio?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.02)",
            border: item.inPortfolio?`1px solid rgba(255,255,255,0.09)`:"1px solid rgba(255,255,255,0.04)",
            borderRadius:12, borderLeft:`3px solid ${item.inPortfolio?tagColor:"transparent"}`,
            position:"relative"
          }}>
            {item.inPortfolio&&(
              <div style={{position:"absolute",top:10,right:10,fontSize:8,fontWeight:800,letterSpacing:1.5,color:tagColor,background:`${tagColor}18`,padding:"2px 6px",borderRadius:4,textTransform:"uppercase"}}>en cartera</div>
            )}
            <div style={{display:"flex",gap:7,alignItems:"flex-start"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:tagColor,flexShrink:0,marginTop:4}}/>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:5,flexWrap:"wrap"}}>
                  <span style={{fontSize:9,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",background:"rgba(255,255,255,0.07)",color:"#555",padding:"2px 6px",borderRadius:3}}>{item.source}</span>
                  {item.region&&<span style={{fontSize:8,fontWeight:700,padding:"1px 5px",borderRadius:3,background:item.region==="AR"?"rgba(26,110,247,0.2)":"rgba(240,185,11,0.2)",color:item.region==="AR"?"#5b9cff":"#f0b90b"}}>{item.region==="AR"?"🇦🇷 ARG":"🌐 INT"}</span>}
                  <span style={{fontSize:10,color:"#333"}}>{item.time}</span>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:"#e8e8e8",lineHeight:1.4,marginBottom:5}}>{item.title}</div>
                {item.description&&<div style={{fontSize:11,color:"#555",lineHeight:1.5}}>{item.description}</div>}
                {item.tickers?.length>0&&(
                  <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
                    {item.tickers.map(t=>(
                      <span key={t} style={{fontSize:9,fontWeight:700,fontFamily:"monospace",padding:"2px 7px",borderRadius:4,background:"rgba(255,255,255,0.07)",color:"#888"}}>{t}</span>
                    ))}
                  </div>
                )}
                {item.link&&<a href={item.link} target="_blank" rel="noreferrer" style={{fontSize:10,color:"#1a6ef7",marginTop:6,display:"inline-block"}}>Leer nota →</a>}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function AnalisisSection({ portfolioStr }) {
  const prompt = `Sos un analista financiero senior. Tenés estos datos REALES de la cartera del inversor: ${portfolioStr}. Usá SOLO estos precios reales para tu análisis. Para cada activo generá un JSON array con: ticker(o symbol), titulo(análisis concreto basado en precio real, máx 10 palabras), signal("COMPRAR","VENDER","MANTENER","ACUMULAR"), conviccion(1-10 basado en datos reales), analisis(3-4 oraciones usando los precios reales provistos, mencioná % de ganancia/pérdida real, contexto macro argentino actual), precio_objetivo(precio objetivo realista en la moneda del activo), potencial(upside/downside real como "+X%" o "-X%"), horizonte("corto plazo","mediano plazo","largo plazo"), riesgos(1 oración con riesgo concreto). SOLO JSON array sin markdown.`;
  return <AISection prompt={prompt} emptyMsg="No se pudo generar el análisis." />;
}

// ── Portfolio history simulation (since we don't have real historical data)
function getHistoryData(totalUSD, totalCostUSD) {
  const points = 12;
  const data = [];
  const now = new Date();
  for (let i = points; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const progress = (points - i) / points;
    const value = totalCostUSD + (totalUSD - totalCostUSD) * progress * (0.7 + Math.random() * 0.3);
    data.push({
      mes: date.toLocaleString('es-AR', { month: 'short' }),
      valor: Math.round(value)
    });
  }
  return data;
}

function ChartsSection({ stocks, crypto, mode, usdArs }) {
  const PIE_COLORS = ["#1a6ef7","#f0b90b","#00dc82","#c084fc","#f97316","#ec4899","#06b6d4"];

  // Distribution data
  const stocksTotal = stocks.reduce((s,st) => s + (st.price ? st.qty*st.price/usdArs : st.qty*st.avgBuy/usdArs), 0);
  const cryptoTotal = crypto.reduce((s,c)  => s + (c.priceUSD ? c.amount*c.priceUSD : c.amount*c.avgBuyUSD), 0);
  const totalUSD    = stocksTotal + cryptoTotal;
  const totalCostUSD = stocks.reduce((s,st)=>s+st.qty*st.avgBuy/usdArs,0) + crypto.reduce((s,c)=>s+c.amount*c.avgBuyUSD,0);

  const pieData = [
    ...stocks.filter(s=>s.price||s.avgBuy).map(s=>({
      name: s.ticker,
      value: Math.round((s.price ? s.qty*s.price/usdArs : s.qty*s.avgBuy/usdArs) * 100) / 100
    })),
    ...crypto.filter(c=>c.priceUSD||c.avgBuyUSD).map(c=>({
      name: c.symbol,
      value: Math.round((c.priceUSD ? c.amount*c.priceUSD : c.amount*c.avgBuyUSD) * 100) / 100
    }))
  ].filter(d => d.value > 0).sort((a,b) => b.value - a.value);

  // P&L bar data
  const barData = [
    ...stocks.filter(s=>s.price).map(s=>({
      name: s.ticker,
      pnl: Math.round(mode==="ARS" ? (s.price-s.avgBuy)*s.qty : (s.price-s.avgBuy)*s.qty/usdArs),
      pct: Math.round(((s.price-s.avgBuy)/s.avgBuy)*100*10)/10
    })),
    ...crypto.filter(c=>c.priceUSD).map(c=>({
      name: c.symbol,
      pnl: Math.round(mode==="ARS" ? (c.priceUSD-c.avgBuyUSD)*c.amount*usdArs : (c.priceUSD-c.avgBuyUSD)*c.amount),
      pct: Math.round(((c.priceUSD-c.avgBuyUSD)/c.avgBuyUSD)*100*10)/10
    }))
  ].filter(d => d.pnl !== 0);

  const historyData = getHistoryData(totalUSD, totalCostUSD);

  const fmtUSD = (v) => `USD ${Math.abs(v).toLocaleString('es-AR',{maximumFractionDigits:0})}`;
  const fmtARS = (v) => `$ ${Math.abs(v).toLocaleString('es-AR',{maximumFractionDigits:0})}`;

  return (
    <div style={{paddingBottom:16}}>

      {/* Pie chart */}
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"16px",marginBottom:12}}>
        <div style={{fontSize:11,color:"#555",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>Distribución de cartera</div>
        <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={0}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{flex:1,minWidth:120}}>
            {pieData.slice(0,8).map((d,i) => (
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:8,height:8,borderRadius:2,background:PIE_COLORS[i%PIE_COLORS.length]}}/>
                  <span style={{fontSize:11,color:"#aaa",fontWeight:700}}>{d.name}</span>
                </div>
                <span style={{fontSize:10,color:"#555",fontFamily:"monospace"}}>
                  {totalUSD > 0 ? Math.round(d.value/totalUSD*100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bar chart - P&L */}
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"16px",marginBottom:12}}>
        <div style={{fontSize:11,color:"#555",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16}}>
          Rendimiento por activo ({mode})
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} margin={{top:0,right:0,left:0,bottom:0}}>
            <XAxis dataKey="name" tick={{fill:"#444",fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:"#333",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>v>=0?"+"+Math.abs(v/1000).toFixed(0)+"k":"-"+Math.abs(v/1000).toFixed(0)+"k"}/>
            <Tooltip
              contentStyle={{background:"#13141a",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:11}}
              formatter={(v,n,p) => [mode==="ARS"?fmtARS(v):fmtUSD(v), "P&L"]}
              labelStyle={{color:"#aaa"}}
            />
            <Bar dataKey="pnl" radius={[4,4,0,0]}>
              {barData.map((d,i) => <Cell key={i} fill={d.pnl>=0?"#00dc82":"#ff4646"}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Line chart - history */}
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:11,color:"#555",letterSpacing:1.5,textTransform:"uppercase"}}>Evolución estimada (USD)</div>
          <div style={{fontSize:9,color:"#333"}}>basado en precio de compra → actual</div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={historyData} margin={{top:0,right:0,left:0,bottom:0}}>
            <XAxis dataKey="mes" tick={{fill:"#333",fontSize:9}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:"#333",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>Math.abs(v/1000).toFixed(0)+"k"}/>
            <Tooltip
              contentStyle={{background:"#13141a",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:11}}
              formatter={v=>[`USD ${v.toLocaleString('es-AR',{maximumFractionDigits:0})}`, "Valor"]}
              labelStyle={{color:"#aaa"}}
            />
            <Line type="monotone" dataKey="valor" stroke="#1a6ef7" strokeWidth={2} dot={false} activeDot={{r:4,fill:"#1a6ef7"}}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function App() {
  const [tab,           setTab]           = useState("acciones");
  const [mode,          setMode]          = useState("ARS");
  const [stocks,        setStocks]        = useState(null);
  const [crypto,        setCrypto]        = useState(null);
  const [modal,         setModal]         = useState(null);
  const [form,          setForm]          = useState({});
  const [saved,         setSaved]         = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [lastUpdate,    setLastUpdate]    = useState(null);
  const [usdArs,        setUsdArs]        = useState(DEFAULT_USD_ARS);

  // ── Load from localStorage ───────────────────────────────────────────────
  useEffect(() => {
    try {
      const s = localStorage.getItem("portfolio_stocks");
      const c = localStorage.getItem("portfolio_crypto");
      setStocks(s ? JSON.parse(s) : DEFAULT_STOCKS);
      setCrypto(c ? JSON.parse(c) : DEFAULT_CRYPTO);
    } catch {
      setStocks(DEFAULT_STOCKS);
      setCrypto(DEFAULT_CRYPTO);
    }
  }, []);

  // ── Fetch dolar oficial ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("https://dolarapi.com/v1/dolares/oficial")
      .then(r => r.json())
      .then(d => { if (d.venta) setUsdArs(d.venta); })
      .catch(() => {});
  }, []);

  // ── Persist ──────────────────────────────────────────────────────────────
  function persist(ns, nc) {
    try {
      if (ns !== null && ns !== undefined) {
        localStorage.setItem("portfolio_stocks", JSON.stringify(ns));
        console.log("Saved stocks:", ns.length);
      }
      if (nc !== null && nc !== undefined) {
        localStorage.setItem("portfolio_crypto", JSON.stringify(nc));
        console.log("Saved crypto:", nc.length);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch(e) { console.error("persist error:", e); }
  }

  // ── Fetch real prices ────────────────────────────────────────────────────
  async function fetchPrices() {
    if (!stocks || !crypto) return;
    setLoadingPrices(true);
    try {
      const symbols = crypto.filter(c => c.symbol !== "USDT").map(c => c.symbol + "USDT");
      const binanceRes = await Promise.allSettled(
        symbols.map(sym => fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`).then(r => r.json()))
      );
      const updatedCrypto = crypto.map(c => {
        if (c.symbol === "USDT") return {...c, priceUSD:1, change24h:0};
        const idx = symbols.indexOf(c.symbol + "USDT");
        if (idx === -1) return c;
        const res = binanceRes[idx];
        if (res.status === "fulfilled" && res.value.lastPrice) {
          return {...c, priceUSD: parseFloat(res.value.lastPrice), change24h: parseFloat(res.value.priceChangePercent)};
        }
        return c;
      });
      // Fetch stock prices from IOL
      let updatedStocks = stocks;
      try {
        const iolRes = await fetch('/api/stocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tickers: stocks.map(s => ({
              ticker: s.ticker,
              mercado: s.ticker === 'MELI' ? 'nYSE' : 'bCBA'
            }))
          })
        });
        const iolData = await iolRes.json();
        if (iolData.prices) {
          updatedStocks = stocks.map(s => {
            const p = iolData.prices[s.ticker];
            if (p && p.price) return {...s, price: p.price, change24h: p.change24h};
            return s;
          });
        }
      } catch(e) { console.error('IOL fetch error:', e); }
      // Only update crypto from prices if binance portfolio loaded it first
      // (update prices on existing items, don't replace)
      setCrypto(prev => prev ? prev.map(c => {
        const updated = updatedCrypto.find(u => u.symbol === c.symbol);
        return updated ? {...c, priceUSD: updated.priceUSD, change24h: updated.change24h} : c;
      }) : updatedCrypto);
      setStocks(updatedStocks);
      setLastUpdate(new Date().toLocaleTimeString("es-AR", {hour:"2-digit", minute:"2-digit"}));
      // Don't persist here - only persist on user edits to avoid race conditions
      // persist(updatedStocks, null);
    } catch(e) { console.error(e); }
    setLoadingPrices(false);
  }

  // ── Fetch Binance portfolio ───────────────────────────────────────────────
  async function fetchBinancePortfolio() {
    try {
      const res = await fetch("/api/binance");
      const data = await res.json();
      if (data.error || !data.balances?.length) {
        console.log('Binance:', data.error || 'no balances');
        return;
      }

      // Filter out fiat and stablecoins that aren't tradeable pairs
      const SKIP = ["USDT","BUSD","FDUSD","ARS","USD","EUR","BRL","LDBNB","LDBTC","LDETH","LDUSDT"];
      const symbols = data.balances
        .filter(b => !SKIP.includes(b.symbol))
        .map(b => b.symbol + "USDT");

      const priceRes = await Promise.allSettled(
        symbols.map(s => fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${s}`).then(r => r.json()))
      );

      const priceMap = { USDT:1, BUSD:1, FDUSD:1 };
      symbols.forEach((s, i) => {
        if (priceRes[i].status === "fulfilled" && priceRes[i].value.price) {
          priceMap[s.replace("USDT","")] = parseFloat(priceRes[i].value.price);
        }
      });

      // Merge with existing crypto — preserve avgBuyUSD if already set
      const SKIP_ASSETS = ["USDT","BUSD","FDUSD","ARS","USD","EUR","BRL","LDBNB","LDBTC","LDETH","LDUSDT"];
      setCrypto(prev => {
        const existing = prev || [];
        const newItems = data.balances.filter(b => !SKIP_ASSETS.includes(b.symbol)).map(b => {
          const old = existing.find(c => c.symbol === b.symbol);
          return {
            id: old?.id || "b" + b.symbol,
            symbol: b.symbol,
            name: old?.name || b.symbol,
            amount: b.amount,
            // Keep existing avgBuyUSD if set, otherwise use current price
            avgBuyUSD: (old?.avgBuyUSD && old.avgBuyUSD > 0) ? old.avgBuyUSD : (priceMap[b.symbol] || 0),
            priceUSD: priceMap[b.symbol] || old?.priceUSD || null,
            change24h: old?.change24h || null
          };
        });
        persist(null, newItems);
        return newItems;
      });
    } catch(e) { console.error('fetchBinancePortfolio error:', e); }
  }

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stocks && crypto) {
      fetchPrices();
      const t = setInterval(fetchPrices, 60000);
      return () => clearInterval(t);
    }
  }, [!!stocks, !!crypto]);

  const binanceLoaded = useRef(false);
  useEffect(() => {
    if (stocks !== null && crypto !== null && !binanceLoaded.current) {
      binanceLoaded.current = true;
      setTimeout(fetchBinancePortfolio, 1000); // slight delay after prices load
    }
  }, [stocks !== null, crypto !== null]);

  if (!stocks || !crypto) return (
    <div style={{minHeight:"100vh",background:"#090a0c",display:"flex",alignItems:"center",justifyContent:"center",color:"#333",fontSize:13}}>Cargando…</div>
  );

  // ── Totals ────────────────────────────────────────────────────────────────
  const stocksTotalARS = stocks.reduce((s,st) => s + (st.price ? st.qty*st.price : 0), 0);
  const cryptoTotalUSD = crypto.reduce((s,c)  => s + (c.priceUSD ? c.amount*c.priceUSD : 0), 0);
  const totalUSD       = stocksTotalARS/usdArs + cryptoTotalUSD;
  const totalARS       = totalUSD * usdArs;
  const stocksCostARS  = stocks.reduce((s,st) => s + st.qty*st.avgBuy, 0);
  const cryptoCostUSD  = crypto.reduce((s,c)  => s + c.amount*c.avgBuyUSD, 0);
  const totalCostUSD   = stocksCostARS/usdArs + cryptoCostUSD;
  const totalPnLUSD    = totalUSD - totalCostUSD;
  const totalPnLPct    = totalCostUSD ? (totalPnLUSD/totalCostUSD)*100 : 0;
  const displayTotal   = mode==="ARS" ? `$ ${fmt(totalARS,0)}` : `USD ${fmt(totalUSD)}`;
  const displayPnL     = mode==="ARS"
    ? `${totalPnLUSD>=0?"+":""}$ ${fmt(totalPnLUSD*usdArs,0)}`
    : `${totalPnLUSD>=0?"+":""}USD ${fmt(totalPnLUSD)}`;

  const portfolioStr = [
    "ACCIONES: " + stocks.map(s=>`${s.ticker}(PM:$${s.avgBuy},actual:$${s.price||"N/A"},qty:${s.qty})`).join(", "),
    "CRYPTO: "   + crypto.map(c=>`${c.symbol}(PM:$${c.avgBuyUSD},actual:$${c.priceUSD||"N/A"},cantidad:${c.amount})`).join(", ")
  ].join(" | ");

  // ── CRUD ──────────────────────────────────────────────────────────────────
  function delStock(id)  { const n=stocks.filter(s=>s.id!==id); setStocks(n); persist(n,null); }
  function delCrypto(id) { const n=crypto.filter(c=>c.id!==id); setCrypto(n); persist(null,n); }
  function openEdit(type,item) { setForm({...item}); setModal({type,item}); }
  function saveEdit() {
    if (modal.type==="stock") {
      const n=stocks.map(s=>s.id===form.id?{...form,qty:+form.qty,avgBuy:+form.avgBuy,price:s.price,change24h:s.change24h,tipo:form.tipo||s.tipo||"accion"}:s);
      setStocks(n); persist(n,null);
    } else {
      const n=crypto.map(c=>c.id===form.id?{...form,amount:+form.amount,avgBuyUSD:+form.avgBuyUSD,priceUSD:c.priceUSD,change24h:c.change24h}:c);
      setCrypto(n); persist(null,n);
    }
    setModal(null);
  }
  function addStock() {
    const newItem = {id:"s"+Date.now(),ticker:form.ticker?.toUpperCase()||"",name:form.name||"",qty:+form.qty||0,avgBuy:+form.avgBuy||0,price:null,change24h:null,tipo:form.tipo||"accion"};
    const n=[...stocks, newItem];
    setStocks(n);
    // Save immediately and verify
    localStorage.setItem("portfolio_stocks", JSON.stringify(n));
    console.log("Added stock, saved:", n.length, "items");
    setSaved(true); setTimeout(()=>setSaved(false),1800);
    setModal(null);
    setTimeout(fetchPrices, 500);
  }
  function addCrypto() {
    const n=[...crypto,{id:"c"+Date.now(),symbol:form.symbol?.toUpperCase()||"",name:form.name||"",amount:+form.amount||0,avgBuyUSD:+form.avgBuyUSD||0,priceUSD:null,change24h:null}];
    setCrypto(n); persist(null,n); setModal(null); setTimeout(fetchPrices,500);
  }

  const TABS=[
    {id:"acciones",        label:"Acciones", color:"#1a6ef7"},
    {id:"crypto",          label:"Crypto",   color:"#f0b90b"},
    {id:"noticias",        label:"Noticias", color:"#00dc82"},
    {id:"recomendaciones", label:"Análisis", color:"#c084fc"},
    {id:"charts",          label:"Charts",   color:"#f97316"},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#090a0c",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:"#f0f0f0",padding:"20px 16px 56px",backgroundImage:"radial-gradient(ellipse 80% 40% at 50% 0%,rgba(26,110,247,0.07) 0%,transparent 70%)"}}>

      {/* Header */}
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:2}}>
          <div style={{fontSize:9,color:"#2a2a2a",letterSpacing:3,textTransform:"uppercase"}}>PORTFOLIO · SANTINO</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={fetchBinancePortfolio} style={{background:"rgba(240,185,11,0.1)",border:"1px solid rgba(240,185,11,0.2)",color:"#f0b90b",fontSize:9,fontWeight:700,padding:"4px 10px",borderRadius:6,cursor:"pointer",letterSpacing:1}}>⟳ BINANCE</button>
            <button onClick={fetchPrices} disabled={loadingPrices} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:loadingPrices?"#333":"#888",fontSize:9,fontWeight:700,padding:"4px 10px",borderRadius:6,cursor:"pointer",letterSpacing:1}}>{loadingPrices?"…":"↻ ACT."}</button>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginTop:8}}>
          <div>
            <div style={{fontSize:28,fontWeight:900,color:"#fff",letterSpacing:-1}}>{displayTotal}</div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:3}}>
              <span style={{fontSize:13,fontWeight:700,color:totalPnLUSD>=0?"#00dc82":"#ff4646",fontFamily:"monospace"}}>{displayPnL}</span>
              <Badge pct={totalPnLPct}/>
            </div>
            {lastUpdate&&<div style={{fontSize:9,color:"#2a2a2a",marginTop:4}}>actualizado {lastUpdate}</div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
            <CurrencyToggle mode={mode} setMode={setMode}/>
            {saved&&<div style={{fontSize:9,color:"#00dc82",letterSpacing:1}}>✓ guardado</div>}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:18}}>
        {[
          {label:"Acciones",color:"#1a6ef7",val:mode==="ARS"?`$ ${fmt(stocksTotalARS,0)}`:`USD ${fmt(stocksTotalARS/usdArs,0)}`,count:`${stocks.length} posiciones`},
          {label:"Crypto",  color:"#f0b90b",val:mode==="ARS"?`$ ${fmt(cryptoTotalUSD*usdArs,0)}`:`USD ${fmt(cryptoTotalUSD)}`,count:`${crypto.length} activos`},
        ].map(card=>(
          <div key={card.label} style={{background:`${card.color}0f`,border:`1px solid ${card.color}22`,borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:9,color:card.color,letterSpacing:2,textTransform:"uppercase",marginBottom:5}}>{card.label}</div>
            <div style={{fontSize:15,fontWeight:800,color:"#fff"}}>{card.val}</div>
            <div style={{fontSize:10,color:"#333",marginTop:2}}>{card.count}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",marginBottom:16,background:"rgba(255,255,255,0.04)",borderRadius:10,padding:4,border:"1px solid rgba(255,255,255,0.06)"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 2px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:tab===t.id?"rgba(255,255,255,0.09)":"transparent",color:tab===t.id?"#fff":"#444",borderBottom:tab===t.id?`2px solid ${t.color}`:"2px solid transparent",transition:"all 0.15s"}}>{t.label}</button>
        ))}
      </div>

      {/* Col headers */}
      {(tab==="acciones"||tab==="crypto")&&(
        <div style={{display:"grid",gridTemplateColumns:"34px 1fr auto auto auto 24px",gap:10,padding:"0 0 8px",borderBottom:"1px solid rgba(255,255,255,0.06)",marginBottom:2}}>
          <div/><div/>
          {["Valor","Rendimiento","%",""].map((h,i)=>(
            <div key={i} style={{fontSize:8,color:"#333",letterSpacing:1.5,textTransform:"uppercase",textAlign:"right"}}>{h}</div>
          ))}
        </div>
      )}

      {tab==="acciones"&&<>
        {["accion","cedear","bono","fci","otro"].map(tipo => {
          const items = stocks.filter(s => (s.tipo||"accion") === tipo);
          if (items.length === 0) return null;
          const labels = {accion:"Acciones",cedear:"CEDEARs",bono:"Bonos",fci:"FCI",otro:"Otros"};
          const colors = {accion:"#1a6ef7",cedear:"#00dc82",bono:"#f0b90b",fci:"#c084fc",otro:"#888"};
          return (
            <div key={tipo} style={{marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 0 6px",borderBottom:`1px solid ${colors[tipo]}33`}}>
                <div style={{width:4,height:14,borderRadius:2,background:colors[tipo]}}/>
                <span style={{fontSize:10,fontWeight:800,color:colors[tipo],letterSpacing:1.5,textTransform:"uppercase"}}>{labels[tipo]}</span>
                <span style={{fontSize:9,color:"#333"}}>({items.length})</span>
              </div>
              {items.map(s=><StockRow key={s.id} s={s} mode={mode} onEdit={i=>openEdit("stock",i)} onDelete={delStock} loading={loadingPrices}/>)}
            </div>
          );
        })}
        <button onClick={()=>{setForm({tipo:"accion"});setModal("addStock");}} style={{width:"100%",marginTop:14,padding:"11px",borderRadius:10,border:"1px dashed rgba(26,110,247,0.3)",background:"rgba(26,110,247,0.05)",color:"#1a6ef7",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Agregar activo</button>
      </>}

      {tab==="crypto"&&<>
        {crypto.map(c=><CryptoRow key={c.id} c={c} mode={mode} onEdit={i=>openEdit("crypto",i)} onDelete={delCrypto} loading={loadingPrices}/>)}
        <button onClick={()=>{setForm({});setModal("addCrypto");}} style={{width:"100%",marginTop:14,padding:"11px",borderRadius:10,border:"1px dashed rgba(240,185,11,0.3)",background:"rgba(240,185,11,0.05)",color:"#f0b90b",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Agregar crypto</button>
      </>}

      {tab==="noticias"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:11,color:"#444"}}>Noticias financieras · hoy</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontSize:9,color:"#00dc82",fontWeight:700,letterSpacing:1.5,display:"flex",alignItems:"center",gap:5,textTransform:"uppercase"}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#00dc82"}}/>RSS real
              </div>
            </div>
          </div>
          <NewsSection portfolioStr={portfolioStr} tickers={stocks.map(s=>s.ticker).concat(crypto.map(c=>c.symbol))}/>
        </div>
      )}

      {tab==="recomendaciones"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:11,color:"#444"}}>Análisis de cartera · IA</div>
            <div style={{fontSize:9,color:"#c084fc",fontWeight:700,letterSpacing:1.5,display:"flex",alignItems:"center",gap:5,textTransform:"uppercase"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"#c084fc"}}/>especialista
            </div>
          </div>
          <AnalisisSection portfolioStr={portfolioStr}/>
        </div>
      )}

      {tab==="charts"&&(
        <ChartsSection stocks={stocks} crypto={crypto} mode={mode} usdArs={usdArs}/>
      )}

      <div style={{marginTop:24,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.04)",display:"flex",justifyContent:"space-between"}}>
        <div style={{fontSize:9,color:"#1e1e1e"}}>USD OF. ${fmt(usdArs,0)} · precios en tiempo real</div>
        <div style={{fontSize:9,color:"#1e1e1e"}}>💾 auto-guardado</div>
      </div>

      {/* Modals */}
      {modal&&typeof modal==="object"&&modal.type==="stock"&&(
        <Modal title={`Editar ${form.ticker}`} onClose={()=>setModal(null)}>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#555",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Tipo</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              {[{v:"accion",l:"Acción"},{v:"cedear",l:"CEDEAR"},{v:"bono",l:"Bono"},{v:"fci",l:"FCI"},{v:"otro",l:"Otro"}].map(t=>(
                <button key={t.v} onClick={()=>setForm({...form,tipo:t.v})} style={{padding:"7px",borderRadius:7,border:`1px solid ${(form.tipo||"accion")===t.v?"#1a6ef7":"rgba(255,255,255,0.08)"}`,background:(form.tipo||"accion")===t.v?"rgba(26,110,247,0.15)":"transparent",color:(form.tipo||"accion")===t.v?"#5b9cff":"#555",fontSize:11,fontWeight:700,cursor:"pointer"}}>{t.l}</button>
              ))}
            </div>
          </div>
          <Field label="Cantidad" value={form.qty} onChange={v=>setForm({...form,qty:v})} type="number"/>
          <Field label="Precio promedio ARS" value={form.avgBuy} onChange={v=>setForm({...form,avgBuy:v})} type="number"/>
          <button onClick={saveEdit} style={{width:"100%",padding:"13px",borderRadius:9,border:"none",background:"#1a6ef7",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",marginTop:6}}>Guardar</button>
        </Modal>
      )}
      {modal&&typeof modal==="object"&&modal.type==="crypto"&&(
        <Modal title={`Editar ${form.symbol}`} onClose={()=>setModal(null)}>
          <Field label="Cantidad" value={form.amount} onChange={v=>setForm({...form,amount:v})} type="number"/>
          <Field label="Precio promedio USD" value={form.avgBuyUSD} onChange={v=>setForm({...form,avgBuyUSD:v})} type="number"/>
          <button onClick={saveEdit} style={{width:"100%",padding:"13px",borderRadius:9,border:"none",background:"#f0b90b",color:"#1a1006",fontSize:14,fontWeight:800,cursor:"pointer",marginTop:6}}>Guardar</button>
        </Modal>
      )}
      {modal==="addStock"&&(
        <Modal title="Nuevo activo" onClose={()=>setModal(null)}>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#555",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Tipo</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              {[{v:"accion",l:"Acción"},{v:"cedear",l:"CEDEAR"},{v:"bono",l:"Bono"},{v:"fci",l:"FCI"},{v:"otro",l:"Otro"}].map(t=>(
                <button key={t.v} onClick={()=>setForm({...form,tipo:t.v})} style={{padding:"7px",borderRadius:7,border:`1px solid ${form.tipo===t.v?"#1a6ef7":"rgba(255,255,255,0.08)"}`,background:form.tipo===t.v?"rgba(26,110,247,0.15)":"transparent",color:form.tipo===t.v?"#5b9cff":"#555",fontSize:11,fontWeight:700,cursor:"pointer"}}>{t.l}</button>
              ))}
            </div>
          </div>
          <Field label="Ticker (ej: GGAL, AL30, AAPL)" value={form.ticker||""} onChange={v=>setForm({...form,ticker:v})} placeholder="GGAL"/>
          <Field label="Nombre" value={form.name||""} onChange={v=>setForm({...form,name:v})} placeholder="Grupo Galicia"/>
          <Field label="Cantidad" value={form.qty||""} onChange={v=>setForm({...form,qty:v})} type="number"/>
          <Field label="Precio promedio ARS" value={form.avgBuy||""} onChange={v=>setForm({...form,avgBuy:v})} type="number"/>
          <button onClick={addStock} style={{width:"100%",padding:"13px",borderRadius:9,border:"none",background:"#1a6ef7",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",marginTop:6}}>Agregar</button>
        </Modal>
      )}
      {modal==="addCrypto"&&(
        <Modal title="Nueva crypto" onClose={()=>setModal(null)}>
          <Field label="Symbol (ej: SOL)" value={form.symbol||""} onChange={v=>setForm({...form,symbol:v})} placeholder="SOL"/>
          <Field label="Nombre" value={form.name||""} onChange={v=>setForm({...form,name:v})} placeholder="Solana"/>
          <Field label="Cantidad" value={form.amount||""} onChange={v=>setForm({...form,amount:v})} type="number"/>
          <Field label="Precio promedio USD" value={form.avgBuyUSD||""} onChange={v=>setForm({...form,avgBuyUSD:v})} type="number"/>
          <button onClick={addCrypto} style={{width:"100%",padding:"13px",borderRadius:9,border:"none",background:"#f0b90b",color:"#1a1006",fontSize:14,fontWeight:800,cursor:"pointer",marginTop:6}}>Agregar</button>
        </Modal>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} button:active{opacity:0.7}`}</style>
    </div>
  );
}
