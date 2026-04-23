import { useState, useEffect, useCallback, useRef } from "react";

const USD_ARS = 1115;

const DEFAULT_STOCKS = [
  { id:"s1", ticker:"GGAL", name:"Grupo Galicia", qty:200, avgBuy:1820,    price:null, change24h:null },
  { id:"s2", ticker:"YPF",  name:"YPF S.A.",      qty:50,  avgBuy:18500,   price:null, change24h:null },
  { id:"s3", ticker:"MELI", name:"MercadoLibre",  qty:2,   avgBuy:1850000, price:null, change24h:null },
  { id:"s4", ticker:"BMA",  name:"Banco Macro",   qty:300, avgBuy:920,     price:null, change24h:null },
];
const DEFAULT_CRYPTO = [
  { id:"c1", symbol:"BTC",  name:"Bitcoin",  amount:0.045, avgBuyUSD:52000, priceUSD:null, change24h:null },
  { id:"c2", symbol:"ETH",  name:"Ethereum", amount:0.8,   avgBuyUSD:2800,  priceUSD:null, change24h:null },
  { id:"c3", symbol:"USDT", name:"Tether",   amount:420,   avgBuyUSD:1,     priceUSD:null, change24h:null },
  { id:"c4", symbol:"BNB",  name:"BNB",      amount:1.2,   avgBuyUSD:480,   priceUSD:null, change24h:null },
];

function fmt(n, dec=2) {
  if (n===null||n===undefined||isNaN(n)) return "—";
  const abs=Math.abs(n);
  if (abs>=1e6) return (n/1e6).toFixed(2)+"M";
  if (abs>=1e3) return n.toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:0});
  return n.toLocaleString("es-AR",{minimumFractionDigits:dec,maximumFractionDigits:dec});
}

function Badge({ pct, size="md" }) {
  if (pct===null||pct===undefined) return null;
  const pos=pct>=0, fs=size==="sm"?9:11;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:2,padding:"3px 7px",borderRadius:4,fontSize:fs,fontWeight:700,background:pos?"rgba(0,220,130,0.13)":"rgba(255,70,70,0.13)",color:pos?"#00dc82":"#ff4646",fontFamily:"monospace"}}>
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

function PriceCell({ val, sub, loading }) {
  return (
    <div style={{textAlign:"right"}}>
      <div style={{fontSize:12,fontWeight:700,color:"#fff",fontFamily:"monospace"}}>
        {loading ? <Spinner/> : val}
      </div>
      <div style={{fontSize:9,color:"#333",fontFamily:"monospace"}}>{sub}</div>
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
        <div style={{fontSize:13,fontWeight:700,color:"#efefef"}}>{s.ticker}
          {s.change24h!==null&&<span style={{marginLeft:6,fontSize:9,fontWeight:700,color:s.change24h>=0?"#00dc82":"#ff4646"}}>{s.change24h>=0?"+":""}{s.change24h?.toFixed(2)}%</span>}
        </div>
        <div style={{fontSize:10,color:"#444"}}>{s.qty} acc · PM ${fmt(s.avgBuy,0)}</div>
      </div>
      <PriceCell val={val} sub={mode==="ARS"?`USD ${fmt(valueUSD,0)}`:`$ ${fmt(valueARS,0)}`} loading={loading&&!hasPrice}/>
      <div style={{textAlign:"right",minWidth:86}}>
        <div style={{fontSize:12,fontWeight:700,color:pnlColor,fontFamily:"monospace"}}>{loading&&!hasPrice?<Spinner/>:pnl}</div>
        <div style={{fontSize:9,color:"#333"}}>rendimiento</div>
      </div>
      <div style={{textAlign:"right"}}><Badge pct={pnlPct}/></div>
      <button onClick={()=>onDelete(s.id)} style={{background:"transparent",border:"none",color:"#2a2a2a",cursor:"pointer",fontSize:16,padding:0,lineHeight:1,transition:"color 0.1s"}} onMouseOver={e=>e.target.style.color="#ff4646"} onMouseOut={e=>e.target.style.color="#2a2a2a"}>×</button>
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
        <div style={{fontSize:13,fontWeight:700,color:"#efefef"}}>{c.symbol}
          {c.change24h!==null&&<span style={{marginLeft:6,fontSize:9,fontWeight:700,color:c.change24h>=0?"#00dc82":"#ff4646"}}>{c.change24h>=0?"+":""}{c.change24h?.toFixed(2)}%</span>}
        </div>
        <div style={{fontSize:10,color:"#444"}}>{fmt(c.amount,4)} · PM ${fmt(c.avgBuyUSD)}</div>
      </div>
      <PriceCell val={val} sub={mode==="ARS"?`USD ${fmt(valueUSD)}`:`$ ${fmt(valueARS,0)}`} loading={loading&&!hasPrice}/>
      <div style={{textAlign:"right",minWidth:86}}>
        <div style={{fontSize:12,fontWeight:700,color:pnlColor,fontFamily:"monospace"}}>{loading&&!hasPrice?<Spinner/>:pnl}</div>
        <div style={{fontSize:9,color:"#333"}}>rendimiento</div>
      </div>
      <div style={{textAlign:"right"}}><Badge pct={pnlPct}/></div>
      <button onClick={()=>onDelete(c.id)} style={{background:"transparent",border:"none",color:"#2a2a2a",cursor:"pointer",fontSize:16,padding:0,lineHeight:1,transition:"color 0.1s"}} onMouseOver={e=>e.target.style.color="#ff4646"} onMouseOut={e=>e.target.style.color="#2a2a2a"}>×</button>
    </div>
  );
}

function AISection({ prompt, color, emptyMsg }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{role:"user",content:prompt}] })
    })
    .then(r=>r.json())
    .then(d=>{
      const text = d.content?.find(b=>b.type==="text")?.text||"[]";
      setData(JSON.parse(text.replace(/```json|```/g,"").trim()));
    })
    .catch(()=>setError(true))
    .finally(()=>setLoading(false));
  },[]);

  if (loading) return (
    <div style={{textAlign:"center",padding:"48px 0",color:"#333"}}>
      <div style={{fontSize:28,marginBottom:10,animation:"spin 1.5s linear infinite",display:"inline-block"}}>◌</div>
      <div style={{fontSize:12}}>Analizando con IA…</div>
    </div>
  );
  if (error||!data?.length) return <div style={{textAlign:"center",padding:"32px 0",color:"#333",fontSize:12}}>{emptyMsg}</div>;
  return <>{data.map((item,i)=><AICard key={i} item={item} color={color}/>)}</>;
}

function AICard({ item, color }) {
  const [open, setOpen] = useState(false);
  const signalColor = item.signal==="COMPRAR"?"#00dc82":item.signal==="VENDER"?"#ff4646":item.signal==="MANTENER"?"#f0b90b":"#888";

  return (
    <div style={{marginBottom:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderLeft:`3px solid ${signalColor}`,borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"14px 14px 12px",cursor:"pointer"}} onClick={()=>setOpen(!open)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
              <span style={{fontSize:12,fontWeight:900,color:"#fff",fontFamily:"monospace"}}>{item.ticker||item.symbol}</span>
              {item.signal&&(
                <span style={{fontSize:9,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"2px 8px",borderRadius:4,background:`${signalColor}18`,color:signalColor}}>{item.signal}</span>
              )}
              {item.conviccion&&(
                <span style={{fontSize:9,color:"#444",letterSpacing:1}}>convicción {item.conviccion}/10</span>
              )}
            </div>
            <div style={{fontSize:13,fontWeight:700,color:"#ddd",lineHeight:1.3}}>{item.titulo||item.title}</div>
          </div>
          <div style={{fontSize:14,color:"#333",flexShrink:0}}>{open?"▲":"▼"}</div>
        </div>
      </div>
      {open&&(
        <div style={{padding:"0 14px 14px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{fontSize:12,color:"#666",lineHeight:1.6,marginTop:10}}>{item.analisis||item.summary||item.descripcion}</div>
          {item.precio_objetivo&&(
            <div style={{display:"flex",gap:16,marginTop:12,flexWrap:"wrap"}}>
              <div style={{fontSize:10,color:"#444"}}>Precio objetivo: <span style={{color:"#fff",fontFamily:"monospace",fontWeight:700}}>{item.precio_objetivo}</span></div>
              {item.potencial&&<div style={{fontSize:10,color:"#444"}}>Potencial: <span style={{color:signalColor,fontFamily:"monospace",fontWeight:700}}>{item.potencial}</span></div>}
              {item.horizonte&&<div style={{fontSize:10,color:"#444"}}>Horizonte: <span style={{color:"#aaa"}}>{item.horizonte}</span></div>}
            </div>
          )}
          {item.riesgos&&(
            <div style={{marginTop:10,padding:"8px 10px",background:"rgba(255,70,70,0.05)",borderRadius:6,fontSize:11,color:"#666"}}>
              ⚠️ {item.riesgos}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [tab,      setTab]      = useState("acciones");
  const [mode,     setMode]     = useState("ARS");
  const [stocks,   setStocks]   = useState(null);
  const [crypto,   setCrypto]   = useState(null);
  const [modal,    setModal]    = useState(null);
  const [form,     setForm]     = useState({});
  const [saved,    setSaved]    = useState(false);
  const [apiKey,   setApiKey]   = useState("");
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [lastUpdate,    setLastUpdate]    = useState(null);
  const [showApiModal,  setShowApiModal]  = useState(false);

  // ── Persist ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    async function load() {
      try {
        const s  = localStorage.getItem("portfolio_stocks");
        const c  = localStorage.getItem("portfolio_crypto");
        const ak = localStorage.getItem("binance_apikey");
        setStocks(s ? JSON.parse(s) : DEFAULT_STOCKS);
        setCrypto(c ? JSON.parse(c) : DEFAULT_CRYPTO);
        if (ak) setApiKey(ak);
      } catch {
        setStocks(DEFAULT_STOCKS);
        setCrypto(DEFAULT_CRYPTO);
      }
    }
    load();
  },[]);

  const persist = useCallback(async(ns,nc)=>{
    try {
      if(ns) localStorage.setItem("portfolio_stocks", JSON.stringify(ns));
      if(nc) localStorage.setItem("portfolio_crypto",  JSON.stringify(nc));
      setSaved(true); setTimeout(()=>setSaved(false),1800);
    } catch {}
  },[]);

  // ── Fetch real prices ────────────────────────────────────────────────────
  const fetchPrices = useCallback(async()=>{
    if (!stocks||!crypto) return;
    setLoadingPrices(true);
    try {
      // Crypto prices via Binance public API
      const symbols = crypto.filter(c=>c.symbol!=="USDT").map(c=>c.symbol+"USDT");
      const binanceRes = await Promise.allSettled(
        symbols.map(sym => fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`).then(r=>r.json()))
      );

      const updatedCrypto = crypto.map(c=>{
        if (c.symbol==="USDT") return {...c,priceUSD:1,change24h:0};
        const idx = symbols.indexOf(c.symbol+"USDT");
        if (idx===-1) return c;
        const res = binanceRes[idx];
        if (res.status==="fulfilled"&&res.value.lastPrice) {
          return {...c, priceUSD:parseFloat(res.value.lastPrice), change24h:parseFloat(res.value.priceChangePercent)};
        }
        return c;
      });

      // Stock prices via Yahoo Finance proxy (using cors-anywhere or yfinance equivalent)
      // Using allorigins as proxy for Yahoo Finance
      const updatedStocks = await Promise.all(stocks.map(async s=>{
        try {
          // Yahoo Finance API
          const suffix = s.ticker==="MELI"?"":"BA"; // MELI trades on NASDAQ, others on BCBA
          const ySymbol = s.ticker==="MELI" ? "MELI" : `${s.ticker}.BA`;
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ySymbol}?interval=1d&range=1d`;
          const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
          const res = await fetch(proxy);
          const json = await res.json();
          const parsed = JSON.parse(json.contents);
          const meta = parsed?.chart?.result?.[0]?.meta;
          if (meta?.regularMarketPrice) {
            const price = meta.regularMarketPrice;
            const prevClose = meta.chartPreviousClose || meta.previousClose || price;
            const change = ((price - prevClose)/prevClose)*100;
            return {...s, price, change24h:change};
          }
        } catch {}
        return s;
      }));

      setCrypto(updatedCrypto);
      setStocks(updatedStocks);
      setLastUpdate(new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}));
      await persist(updatedStocks, updatedCrypto);
    } catch(e){ console.error(e); }
    setLoadingPrices(false);
  },[stocks,crypto,persist]);

  // Fetch prices on mount and every 60s
  useEffect(()=>{
    if (stocks&&crypto) {
      fetchPrices();
      const t = setInterval(fetchPrices, 60000);
      return ()=>clearInterval(t);
    }
  },[!!stocks,!!crypto]);

  if (!stocks||!crypto) return (
    <div style={{minHeight:"100vh",background:"#090a0c",display:"flex",alignItems:"center",justifyContent:"center",color:"#333",fontSize:13}}>Cargando…</div>
  );

  // ── Totals ────────────────────────────────────────────────────────────────
  const stocksTotalARS = stocks.reduce((s,st)=>s+(st.price?st.qty*st.price:0),0);
  const cryptoTotalUSD = crypto.reduce((s,c)=>s+(c.priceUSD?c.amount*c.priceUSD:0),0);
  const totalUSD = stocksTotalARS/USD_ARS + cryptoTotalUSD;
  const totalARS = totalUSD * USD_ARS;
  const stocksCostARS = stocks.reduce((s,st)=>s+st.qty*st.avgBuy,0);
  const cryptoCostUSD = crypto.reduce((s,c)=>s+c.amount*c.avgBuyUSD,0);
  const totalCostUSD  = stocksCostARS/USD_ARS + cryptoCostUSD;
  const totalPnLUSD   = totalUSD - totalCostUSD;
  const totalPnLPct   = totalCostUSD ? (totalPnLUSD/totalCostUSD)*100 : 0;
  const displayTotal  = mode==="ARS" ? `$ ${fmt(totalARS,0)}` : `USD ${fmt(totalUSD)}`;
  const displayPnL    = mode==="ARS"
    ? `${totalPnLUSD>=0?"+":""}$ ${fmt(totalPnLUSD*USD_ARS,0)}`
    : `${totalPnLUSD>=0?"+":""}USD ${fmt(totalPnLUSD)}`;

  const myTickers = [...stocks.map(s=>s.ticker),...crypto.map(c=>c.symbol)];

  // ── Portfolio state string for AI ────────────────────────────────────────
  const portfolioStr = [
    "ACCIONES: " + stocks.map(s=>`${s.ticker}(PM:$${s.avgBuy},actual:$${s.price||"N/A"},qty:${s.qty})`).join(", "),
    "CRYPTO: "   + crypto.map(c=>`${c.symbol}(PM:$${c.avgBuyUSD},actual:$${c.priceUSD||"N/A"},cantidad:${c.amount})`).join(", ")
  ].join(" | ");

  // ── CRUD ─────────────────────────────────────────────────────────────────
  function delStock(id)  { const n=stocks.filter(s=>s.id!==id); setStocks(n); persist(n,null); }
  function delCrypto(id) { const n=crypto.filter(c=>c.id!==id); setCrypto(n); persist(null,n); }
  function openEdit(type,item){ setForm({...item}); setModal({type,item}); }
  function saveEdit(){
    if(modal.type==="stock"){
      const n=stocks.map(s=>s.id===form.id?{...form,qty:+form.qty,avgBuy:+form.avgBuy,price:s.price,change24h:s.change24h}:s);
      setStocks(n); persist(n,null);
    } else {
      const n=crypto.map(c=>c.id===form.id?{...form,amount:+form.amount,avgBuyUSD:+form.avgBuyUSD,priceUSD:c.priceUSD,change24h:c.change24h}:c);
      setCrypto(n); persist(null,n);
    }
    setModal(null);
  }
  function addStock(){
    const id="s"+Date.now();
    const n=[...stocks,{id,ticker:form.ticker?.toUpperCase()||"",name:form.name||"",qty:+form.qty||0,avgBuy:+form.avgBuy||0,price:null,change24h:null}];
    setStocks(n); persist(n,null); setModal(null); setTimeout(fetchPrices,500);
  }
  function addCrypto(){
    const id="c"+Date.now();
    const n=[...crypto,{id,symbol:form.symbol?.toUpperCase()||"",name:form.name||"",amount:+form.amount||0,avgBuyUSD:+form.avgBuyUSD||0,priceUSD:null,change24h:null}];
    setCrypto(n); persist(null,n); setModal(null); setTimeout(fetchPrices,500);
  }

  const TABS=[
    {id:"acciones",   label:"Acciones",        color:"#1a6ef7"},
    {id:"crypto",     label:"Crypto",           color:"#f0b90b"},
    {id:"noticias",   label:"Noticias",         color:"#00dc82"},
    {id:"recomendaciones", label:"Análisis",    color:"#c084fc"},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#090a0c",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:"#f0f0f0",padding:"20px 16px 56px",backgroundImage:"radial-gradient(ellipse 80% 40% at 50% 0%,rgba(26,110,247,0.07) 0%,transparent 70%)"}}>

      {/* Header */}
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:2}}>
          <div style={{fontSize:9,color:"#2a2a2a",letterSpacing:3,textTransform:"uppercase"}}>PORTFOLIO · SANTINO</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setShowApiModal(true)} style={{background:"rgba(240,185,11,0.1)",border:"1px solid rgba(240,185,11,0.2)",color:"#f0b90b",fontSize:9,fontWeight:700,padding:"4px 10px",borderRadius:6,cursor:"pointer",letterSpacing:1}}>
              {apiKey?"BINANCE ✓":"+ BINANCE API"}
            </button>
            <button onClick={fetchPrices} disabled={loadingPrices} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:loadingPrices?"#333":"#888",fontSize:9,fontWeight:700,padding:"4px 10px",borderRadius:6,cursor:"pointer",letterSpacing:1}}>
              {loadingPrices?"…":"↻ ACT."}
            </button>
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
          {label:"Acciones",color:"#1a6ef7",val:mode==="ARS"?`$ ${fmt(stocksTotalARS,0)}`:`USD ${fmt(stocksTotalARS/USD_ARS,0)}`,count:`${stocks.length} posiciones`},
          {label:"Crypto",  color:"#f0b90b",val:mode==="ARS"?`$ ${fmt(cryptoTotalUSD*USD_ARS,0)}`:`USD ${fmt(cryptoTotalUSD)}`,count:`${crypto.length} activos`},
        ].map(card=>(
          <div key={card.label} style={{background:`${card.color}0f`,border:`1px solid ${card.color}22`,borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:9,color:card.color,letterSpacing:2,textTransform:"uppercase",marginBottom:5}}>{card.label}</div>
            <div style={{fontSize:15,fontWeight:800,color:"#fff"}}>{card.val}</div>
            <div style={{fontSize:10,color:"#333",marginTop:2}}>{card.count}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:0,marginBottom:16,background:"rgba(255,255,255,0.04)",borderRadius:10,padding:4,border:"1px solid rgba(255,255,255,0.06)"}}>
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

      {/* Acciones */}
      {tab==="acciones"&&<>
        {stocks.map(s=><StockRow key={s.id} s={s} mode={mode} onEdit={i=>openEdit("stock",i)} onDelete={delStock} loading={loadingPrices}/>)}
        <button onClick={()=>{setForm({});setModal("addStock");}} style={{width:"100%",marginTop:14,padding:"11px",borderRadius:10,border:"1px dashed rgba(26,110,247,0.3)",background:"rgba(26,110,247,0.05)",color:"#1a6ef7",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Agregar acción</button>
      </>}

      {/* Crypto */}
      {tab==="crypto"&&<>
        {crypto.map(c=><CryptoRow key={c.id} c={c} mode={mode} onEdit={i=>openEdit("crypto",i)} onDelete={delCrypto} loading={loadingPrices}/>)}
        <button onClick={()=>{setForm({});setModal("addCrypto");}} style={{width:"100%",marginTop:14,padding:"11px",borderRadius:10,border:"1px dashed rgba(240,185,11,0.3)",background:"rgba(240,185,11,0.05)",color:"#f0b90b",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Agregar crypto</button>
      </>}

      {/* Noticias */}
      {tab==="noticias"&&(
        <AISection
          color="#00dc82"
          emptyMsg="No se pudieron cargar noticias."
          prompt={`Generá un JSON array con 5 noticias financieras importantes de HOY para un inversor argentino con esta cartera: ${portfolioStr}. Cada noticia: id(número), source(medio concreto), time("hace X min" o "hace X h"), tag(categoría 1-2 palabras MAYÚSCULAS), titulo(título concreto y realista), analisis(2-3 oraciones de contexto e impacto), impact("bullish","bearish","neutral"), tickers(array de tickers de cartera afectados, puede ser vacío), signal(null). SOLO JSON array sin markdown.`}
        />
      )}

      {/* Recomendaciones */}
      {tab==="recomendaciones"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:11,color:"#444"}}>Análisis de tu cartera · IA</div>
            <div style={{fontSize:9,color:"#c084fc",fontWeight:700,letterSpacing:1.5,display:"flex",alignItems:"center",gap:5,textTransform:"uppercase"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"#c084fc"}}/>especialista
            </div>
          </div>
          <AISection
            color="#c084fc"
            emptyMsg="No se pudo generar el análisis."
            prompt={`Sos un analista financiero senior especializado en mercados argentinos y crypto. Analizá esta cartera: ${portfolioStr}. Para cada activo generá un JSON array donde cada objeto tiene: ticker(o symbol), titulo(título del análisis, máx 10 palabras), signal("COMPRAR","VENDER","MANTENER","ACUMULAR"), conviccion(número 1-10), analisis(párrafo de 3-4 oraciones como especialista: menciona distancia al máximo histórico, tendencia reciente, contexto macro, catalizadores), precio_objetivo(precio objetivo en la moneda del activo, como string), potencial(upside/downside como "+X%" o "-X%"), horizonte("corto plazo","mediano plazo","largo plazo"), riesgos(1 oración sobre el principal riesgo). Sé específico, usa datos reales conocidos. SOLO JSON array sin markdown.`}
          />
        </div>
      )}

      {/* Footer */}
      <div style={{marginTop:24,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.04)",display:"flex",justifyContent:"space-between"}}>
        <div style={{fontSize:9,color:"#1e1e1e"}}>USD OF. ${fmt(USD_ARS,0)} · precios en tiempo real</div>
        <div style={{fontSize:9,color:"#1e1e1e"}}>💾 auto-guardado</div>
      </div>

      {/* ── Binance API Modal ── */}
      {showApiModal&&(
        <Modal title="Conectar Binance" onClose={()=>setShowApiModal(false)}>
          <div style={{fontSize:12,color:"#555",lineHeight:1.6,marginBottom:16}}>
            Para ver tu cartera real de Binance:<br/>
            1. Abrí Binance → Gestión de API<br/>
            2. Creá una API Key con permiso <strong style={{color:"#f0b90b"}}>solo lectura</strong><br/>
            3. Pegá tu API Key abajo
          </div>
          <Field label="API Key (read-only)" value={apiKey} onChange={setApiKey} placeholder="xxxxxxxxxxxxxxxx"/>
          <button onClick={async()=>{
            localStorage.setItem("binance_apikey", apiKey);
            setShowApiModal(false); setSaved(true); setTimeout(()=>setSaved(false),1800);
          }} style={{width:"100%",padding:"13px",borderRadius:9,border:"none",background:"#f0b90b",color:"#1a1006",fontSize:14,fontWeight:800,cursor:"pointer"}}>Guardar API Key</button>
          <div style={{fontSize:10,color:"#333",textAlign:"center",marginTop:10}}>La API Key se guarda solo en tu dispositivo</div>
        </Modal>
      )}

      {/* Edit modals */}
      {modal&&typeof modal==="object"&&modal.type==="stock"&&(
        <Modal title={`Editar ${form.ticker}`} onClose={()=>setModal(null)}>
          <Field label="Cantidad (acciones)" value={form.qty} onChange={v=>setForm({...form,qty:v})} type="number"/>
          <Field label="Precio promedio ARS"  value={form.avgBuy} onChange={v=>setForm({...form,avgBuy:v})} type="number"/>
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
        <Modal title="Nueva acción" onClose={()=>setModal(null)}>
          <Field label="Ticker (ej: GGAL)" value={form.ticker||""} onChange={v=>setForm({...form,ticker:v})} placeholder="GGAL"/>
          <Field label="Nombre" value={form.name||""} onChange={v=>setForm({...form,name:v})} placeholder="Grupo Galicia"/>
          <Field label="Cantidad de acciones" value={form.qty||""} onChange={v=>setForm({...form,qty:v})} type="number"/>
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

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        button:active{opacity:0.7}
      `}</style>
    </div>
  );
}
