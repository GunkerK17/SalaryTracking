import { useState, useEffect, useMemo, useCallback, useRef } from "react";

const STORAGE_KEY = "slt_items";
const RATE_KEY = "slt_rate";
const THEME_KEY = "slt_theme";
const DEFAULT_RATE = 25000;

const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const toVND = (usd, rate) => usd * rate;
const toUSD = (vnd, rate) => vnd / rate;
const fmtUSD = (n) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtVND = (n) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Math.round(n));
const fmtDateDisplay = (s) => { if (!s) return ""; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const sumUSD = (items) => items.reduce((s, i) => s + (i.totalUSD || 0), 0);

const getWeekBounds = () => {
  const d = new Date(); const day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999);
  return [mon, sun];
};

const toUSDval = (val, cur, rate) => cur === "VND" ? toUSD(+val, rate) : +val;

const MONTHS = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];
const DAYS_HDR = ["T2","T3","T4","T5","T6","T7","CN"];

const TH = {
  light: {
    bg:"#f1f5f9", surface:"#ffffff", surfaceHover:"#f8fafc",
    border:"#e2e8f0", borderFocus:"#3b82f6",
    text:"#0f172a", textSub:"#475569", textMuted:"#94a3b8",
    accent:"#3b82f6", accentHover:"#2563eb", accentBg:"#eff6ff", accentTxt:"#1d4ed8",
    green:"#10b981", greenBg:"#ecfdf5", greenTxt:"#065f46",
    amber:"#f59e0b", amberBg:"#fffbeb", amberTxt:"#92400e",
    red:"#ef4444", redBg:"#fef2f2", redTxt:"#991b1b",
    pink:"#db2777", pinkBg:"#fdf2f8", pinkTxt:"#9d174d",
    purple:"#7c3aed", purpleBg:"#f5f3ff", purpleTxt:"#5b21b6",
    navBg:"#ffffff", navActiveBg:"#3b82f6", navActiveTxt:"#ffffff", navTxt:"#64748b",
    headerStart:"#1e40af", headerEnd:"#3b82f6",
    inputBg:"#f8fafc",
    toastOkBg:"#ecfdf5", toastOkTxt:"#065f46",
    toastErrBg:"#fef2f2", toastErrTxt:"#991b1b",
    shadow:"0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)"
  },
  dark: {
    bg:"#0d1117", surface:"#161b22", surfaceHover:"#1c2333",
    border:"#30363d", borderFocus:"#58a6ff",
    text:"#e6edf3", textSub:"#8b949e", textMuted:"#484f58",
    accent:"#58a6ff", accentHover:"#79b8ff", accentBg:"#0c1a26", accentTxt:"#79b8ff",
    green:"#3fb950", greenBg:"#0d2618", greenTxt:"#56d364",
    amber:"#d29922", amberBg:"#271d00", amberTxt:"#e3b341",
    red:"#f85149", redBg:"#1f0e0e", redTxt:"#ff7b72",
    pink:"#f778ba", pinkBg:"#1f0c18", pinkTxt:"#faa7d4",
    purple:"#bc8cff", purpleBg:"#1b1226", purpleTxt:"#d2a8ff",
    navBg:"#161b22", navActiveBg:"#1f6feb", navActiveTxt:"#ffffff", navTxt:"#8b949e",
    headerStart:"#0d1117", headerEnd:"#1f2937",
    inputBg:"#0d1117",
    toastOkBg:"#0d2618", toastOkTxt:"#56d364",
    toastErrBg:"#1f0e0e", toastErrTxt:"#ff7b72",
    shadow:"0 1px 3px rgba(0,0,0,0.4),0 4px 16px rgba(0,0,0,0.3)"
  }
};

const Icon = ({ name, size = 18, color, style = {} }) => (
  <i className={`ti ti-${name}`} aria-hidden="true" style={{ fontSize: size, color, lineHeight: 1, display:"inline-block", ...style }} />
);

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose, t }) => {
  useEffect(() => { const x = setTimeout(onClose, 3000); return () => clearTimeout(x); }, [onClose]);
  const bg = type === "error" ? t.toastErrBg : t.toastOkBg;
  const col = type === "error" ? t.toastErrTxt : t.toastOkTxt;
  return (
    <div style={{
      position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", zIndex:9999,
      background:bg, color:col, padding:"12px 22px", borderRadius:14,
      fontWeight:700, fontSize:14, boxShadow:"0 8px 32px rgba(0,0,0,0.22)",
      display:"flex", alignItems:"center", gap:8, animation:"fadeUp .22s ease",
      whiteSpace:"nowrap", border:`1px solid ${col}40`
    }}>
      <Icon name={type==="error"?"alert-circle":"check-circle"} size={17} color={col} />
      {msg}
    </div>
  );
};

// ─── Date Picker ──────────────────────────────────────────────────────────────
const DatePicker = ({ value, onChange, t }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const [viewY, setViewY] = useState(() => value ? +value.slice(0,4) : new Date().getFullYear());
  const [viewM, setViewM] = useState(() => value ? +value.slice(5,7)-1 : new Date().getMonth());

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const dim = new Date(viewY, viewM + 1, 0).getDate();
  const fdow = (() => { const d = new Date(viewY, viewM, 1).getDay(); return d === 0 ? 6 : d - 1; })();
  const todayS = todayStr();

  const pick = (day) => {
    onChange(`${viewY}-${String(viewM+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(o=>!o)} style={{
        width:"100%", padding:"11px 14px", borderRadius:12,
        border:`1.5px solid ${open ? t.borderFocus : t.border}`,
        background:t.inputBg, color:t.text, fontSize:15, cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        fontFamily:"inherit", transition:"border .15s"
      }}>
        <span style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Icon name="calendar" size={16} color={t.textSub} />
          {value ? fmtDateDisplay(value) : "Chọn ngày"}
        </span>
        <Icon name={open?"chevron-up":"chevron-down"} size={15} color={t.textMuted} />
      </button>

      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 8px)", left:0, right:0, zIndex:300,
          background:t.surface, border:`1px solid ${t.border}`, borderRadius:16,
          padding:14, boxShadow:"0 16px 48px rgba(0,0,0,0.18)"
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <button onClick={() => { viewM===0?(setViewM(11),setViewY(y=>y-1)):setViewM(m=>m-1); }}
              style={{ background:"none", border:"none", cursor:"pointer", color:t.textSub, padding:"4px 8px", borderRadius:8, fontSize:18 }}>‹</button>
            <span style={{ fontWeight:800, fontSize:13, color:t.text }}>{MONTHS[viewM]} {viewY}</span>
            <button onClick={() => { viewM===11?(setViewM(0),setViewY(y=>y+1)):setViewM(m=>m+1); }}
              style={{ background:"none", border:"none", cursor:"pointer", color:t.textSub, padding:"4px 8px", borderRadius:8, fontSize:18 }}>›</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:4 }}>
            {DAYS_HDR.map(d=><div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:t.textMuted, padding:"2px 0" }}>{d}</div>)}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
            {Array(fdow).fill(null).map((_,i)=><div key={`e${i}`}/>)}
            {Array.from({length:dim},(_,i)=>{
              const day=i+1;
              const ds=`${viewY}-${String(viewM+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isSel=ds===value; const isToday=ds===todayS;
              return (
                <button key={day} onClick={()=>pick(day)} style={{
                  padding:"7px 0", border:"none", borderRadius:8, cursor:"pointer",
                  background:isSel?t.accent:isToday?t.accentBg:"transparent",
                  color:isSel?"#fff":isToday?t.accentTxt:t.text,
                  fontSize:12, fontWeight:isSel||isToday?800:400, fontFamily:"inherit"
                }}>{day}</button>
              );
            })}
          </div>
          <div style={{ marginTop:10, borderTop:`1px solid ${t.border}`, paddingTop:8 }}>
            <button onClick={()=>{onChange(todayS);setOpen(false);}} style={{
              width:"100%", padding:"8px", background:t.accentBg, color:t.accentTxt,
              border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
            }}>Hôm nay</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Currency Toggle ──────────────────────────────────────────────────────────
const CurrencyToggle = ({ value, onChange, t }) => (
  <div style={{ display:"flex", background:t.surfaceHover, borderRadius:10, padding:3, border:`1px solid ${t.border}`, gap:2, flexShrink:0 }}>
    {["USD","VND"].map(c=>(
      <button key={c} onClick={()=>onChange(c)} style={{
        padding:"7px 12px", borderRadius:8, border:"none", cursor:"pointer",
        background:value===c?t.accent:"transparent",
        color:value===c?"#fff":t.textSub,
        fontSize:12, fontWeight:700, fontFamily:"inherit", transition:"all .15s"
      }}>{c}</button>
    ))}
  </div>
);

// ─── Amount Input ─────────────────────────────────────────────────────────────
const AmountInput = ({ value, onChange, currency, err, t, placeholder="0.00" }) => (
  <div style={{ position:"relative" }}>
    <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:t.textMuted, fontSize:15, fontWeight:700, pointerEvents:"none", userSelect:"none" }}>
      {currency==="USD"?"$":"₫"}
    </span>
    <input type="number" placeholder={placeholder} min="0" step="0.01" value={value}
      onChange={e=>onChange(e.target.value)}
      style={{
        width:"100%", padding:"11px 14px 11px 26px", borderRadius:12, outline:"none",
        border:`1.5px solid ${err?t.red:t.border}`, background:t.inputBg,
        color:t.text, fontSize:15, fontFamily:"inherit", boxSizing:"border-box",
        transition:"border .15s"
      }}
    />
  </div>
);

// ─── Edit Modal ───────────────────────────────────────────────────────────────
const EditModal = ({ item, rate, onSave, onClose, t }) => {
  const [date, setDate] = useState(item.date);
  const [wage, setWage] = useState(String(item.wageOrig ?? item.wageUSD));
  const [wageCur, setWageCur] = useState(item.wageCur || "USD");
  const [showTip, setShowTip] = useState((item.tipUSD || 0) > 0);
  const [tip, setTip] = useState(String(item.tipOrig ?? item.tipUSD ?? ""));
  const [tipCur, setTipCur] = useState(item.tipCur || "USD");
  const [note, setNote] = useState(item.note || "");
  const [err, setErr] = useState({});

  const wageUSD = +wage > 0 ? toUSDval(wage, wageCur, rate) : 0;
  const tipUSD = showTip && +tip > 0 ? toUSDval(tip, tipCur, rate) : 0;
  const totalUSD = wageUSD + tipUSD;

  const save = () => {
    const errs = {};
    if (!date) errs.date = "Chọn ngày";
    if (!wage || isNaN(+wage) || +wage <= 0) errs.wage = "Nhập số tiền hợp lệ";
    if (showTip && tip && (isNaN(+tip) || +tip < 0)) errs.tip = "Tip không hợp lệ";
    if (Object.keys(errs).length) { setErr(errs); return; }
    onSave({
      ...item,
      date,
      wageUSD: toUSDval(wage, wageCur, rate),
      wageCur, wageOrig: +wage,
      tipUSD: showTip && +tip > 0 ? toUSDval(tip, tipCur, rate) : 0,
      tipCur, tipOrig: tip ? +tip : 0,
      totalUSD,
      exchangeRate: rate,
      note: note.trim(),
    });
  };

  const lbl = { fontSize:11, fontWeight:700, color:t.textSub, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:.4 };
  const overlay = { position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:500, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 0 0 0" };

  return (
    <div style={overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{
        background:t.surface, borderRadius:"20px 20px 0 0", padding:"20px 16px 32px",
        width:"100%", maxWidth:520, border:`1px solid ${t.border}`,
        boxShadow:"0 -8px 40px rgba(0,0,0,0.25)", animation:"slideUp .25s ease",
        maxHeight:"90vh", overflowY:"auto"
      }}>
        {/* Handle bar */}
        <div style={{ width:40, height:4, background:t.border, borderRadius:4, margin:"0 auto 16px" }} />

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:900, color:t.text, display:"flex", alignItems:"center", gap:8 }}>
            <Icon name="edit" size={17} color={t.accent} />Chỉnh sửa thu nhập
          </h3>
          <button onClick={onClose} style={{ background:t.surfaceHover, border:`1px solid ${t.border}`, borderRadius:10, padding:"6px 8px", cursor:"pointer", color:t.textSub }}>
            <Icon name="x" size={16} color={t.textSub} />
          </button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
          {/* Date */}
          <div>
            <label style={lbl}>Ngày làm việc</label>
            <DatePicker value={date} onChange={setDate} t={t} />
            {err.date && <p style={{ color:t.red, fontSize:12, margin:"4px 0 0" }}>{err.date}</p>}
          </div>

          {/* Wage */}
          <div>
            <label style={lbl}>Lương / Thu nhập</label>
            <div style={{ display:"flex", gap:8 }}>
              <div style={{ flex:1 }}>
                <AmountInput value={wage} onChange={v=>{setWage(v);setErr(e=>({...e,wage:""}));}} currency={wageCur} err={err.wage} t={t} />
              </div>
              <CurrencyToggle value={wageCur} onChange={setWageCur} t={t} />
            </div>
            {err.wage && <p style={{ color:t.red, fontSize:12, margin:"4px 0 0" }}>{err.wage}</p>}
            {wage && +wage > 0 && (
              <p style={{ color:t.textMuted, fontSize:12, margin:"4px 0 0" }}>
                ≈ {wageCur==="USD" ? fmtVND(toVND(+wage, rate)) : fmtUSD(toUSD(+wage, rate))}
              </p>
            )}
          </div>

          {/* Tip */}
          <div>
            <button onClick={()=>{setShowTip(s=>!s); setTip("");}} style={{
              display:"flex", alignItems:"center", gap:8, border:`1.5px solid ${showTip?t.pink:t.border}`,
              cursor:"pointer", color:showTip?t.pink:t.textSub, fontSize:13, fontWeight:700,
              padding:"9px 14px", borderRadius:12, fontFamily:"inherit", width:"100%",
              transition:"all .15s", justifyContent:"center",
              background:showTip?t.pinkBg:"transparent"
            }}>
              <Icon name={showTip?"coin":"circle-plus"} size={15} color={showTip?t.pink:t.textMuted} />
              {showTip ? "Ẩn ô tip" : "Thêm tiền tip (tùy chọn)"}
            </button>
            {showTip && (
              <div style={{ marginTop:10, padding:"12px 14px", background:t.pinkBg, borderRadius:12, border:`1.5px solid ${t.pink}50` }}>
                <label style={{ ...lbl, color:t.pink }}>Tiền tip nhận được</label>
                <div style={{ display:"flex", gap:8 }}>
                  <div style={{ flex:1 }}>
                    <AmountInput value={tip} onChange={v=>{setTip(v);setErr(e=>({...e,tip:""}));}} currency={tipCur} err={err.tip} t={t} />
                  </div>
                  <CurrencyToggle value={tipCur} onChange={setTipCur} t={t} />
                </div>
                {err.tip && <p style={{ color:t.red, fontSize:12, margin:"4px 0 0" }}>{err.tip}</p>}
                {tip && +tip > 0 && (
                  <p style={{ color:t.pink, fontSize:12, margin:"4px 0 0", fontWeight:600 }}>
                    ≈ {tipCur==="USD" ? fmtVND(toVND(+tip, rate)) : fmtUSD(toUSD(+tip, rate))}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <label style={lbl}>Ghi chú</label>
            <input type="text" placeholder="ca sáng, bonus, thêm giờ..." value={note}
              onChange={e=>setNote(e.target.value)}
              style={{ width:"100%", padding:"11px 14px", borderRadius:12, border:`1.5px solid ${t.border}`,
                background:t.inputBg, color:t.text, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
          </div>

          {/* Preview */}
          {totalUSD > 0 && (
            <div style={{ padding:"11px 14px", background:t.greenBg, borderRadius:12, border:`1.5px solid ${t.green}40`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12, color:t.greenTxt, fontWeight:700 }}>Tổng sau chỉnh sửa</span>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:16, fontWeight:900, color:t.green }}>{fmtUSD(totalUSD)}</div>
                <div style={{ fontSize:11, color:t.greenTxt, fontWeight:600 }}>{fmtVND(toVND(totalUSD, rate))}</div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button onClick={onClose} style={{
              flex:1, padding:"12px", background:t.surfaceHover, color:t.textSub,
              border:`1.5px solid ${t.border}`, borderRadius:12, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
            }}>Huỷ</button>
            <button onClick={save} style={{
              flex:2, padding:"12px", background:t.accent, color:"#fff",
              border:"none", borderRadius:12, fontSize:14, fontWeight:800, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontFamily:"inherit"
            }}>
              <Icon name="check" size={16} color="#fff" />Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Income Card (shared between History & Calendar) ──────────────────────────
const IncomeCard = ({ item, rate, onEdit, onDelete, t, compact = false }) => (
  <div style={{
    padding: compact ? "10px 12px" : "12px 14px",
    background:t.surfaceHover, borderRadius:12,
    border:`1px solid ${t.border}`,
    display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8
  }}>
    <div style={{ flex:1, minWidth:0 }}>
      {!compact && (
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, flexWrap:"wrap" }}>
          <span style={{ fontSize:11, fontWeight:700, color:t.accentTxt, background:t.accentBg, padding:"2px 8px", borderRadius:6 }}>
            {fmtDateDisplay(item.date)}
          </span>
          {item.tipUSD > 0 && (
            <span style={{ fontSize:11, fontWeight:700, color:t.pinkTxt, background:t.pinkBg, padding:"2px 8px", borderRadius:6 }}>💰 tip</span>
          )}
        </div>
      )}
      <div style={{ fontSize: compact ? 13 : 15, fontWeight:900, color:t.text }}>{fmtUSD(item.totalUSD)}</div>
      <div style={{ fontSize:11, color:t.textMuted, fontWeight:600 }}>{fmtVND(toVND(item.totalUSD, rate))}</div>
      {item.tipUSD > 0 && (
        <div style={{ fontSize:11, color:t.pink, marginTop:2, fontWeight:700 }}>
          lương {fmtUSD(item.wageUSD)} + tip {fmtUSD(item.tipUSD)}
        </div>
      )}
      {item.note && <div style={{ fontSize:12, color:t.textSub, marginTop:3 }}>{item.note}</div>}
    </div>
    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
      <button
        onClick={() => onEdit(item)}
        title="Chỉnh sửa"
        style={{ background:t.accentBg, color:t.accent, border:"none", borderRadius:8, padding:"7px 8px", cursor:"pointer" }}>
        <Icon name="edit" size={14} color={t.accent} />
      </button>
      <button
        onClick={() => onDelete(item.id)}
        title="Xoá"
        style={{ background:t.redBg, color:t.red, border:"none", borderRadius:8, padding:"7px 8px", cursor:"pointer" }}>
        <Icon name="trash" size={14} color={t.red} />
      </button>
    </div>
  </div>
);

// ─── Dashboard ────────────────────────────────────────────────────────────────
const StatCard = ({ label, usd, rate, icon, col, bg }) => (
  <div style={{ background:"var(--surface,#fff)", borderRadius:16, padding:"16px 18px", border:"1px solid var(--border,#e2e8f0)", display:"flex", flexDirection:"column", gap:6 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <span style={{ fontSize:11, color:col, fontWeight:700, textTransform:"uppercase", letterSpacing:.6 }}>{label}</span>
      <span style={{ background:bg, borderRadius:8, width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <Icon name={icon} size={15} color={col} />
      </span>
    </div>
    <div style={{ fontSize:18, fontWeight:900, color:"var(--text,#0f172a)", letterSpacing:-.5 }}>{fmtUSD(usd)}</div>
    <div style={{ fontSize:11, color:"var(--textMuted,#94a3b8)", fontWeight:600 }}>{fmtVND(toVND(usd, rate))}</div>
  </div>
);

const DashboardCards = ({ items, rate, t }) => {
  const now = new Date(); const tday = todayStr();
  const [wS, wE] = getWeekBounds();
  const todayItems = items.filter(i=>i.date===tday);
  const weekItems = items.filter(i=>{ const d=new Date(i.date+"T00:00:00"); return d>=wS&&d<=wE; });
  const monthItems = items.filter(i=>{ const [y,m]=i.date.split("-"); return +y===now.getFullYear()&&+m===now.getMonth()+1; });
  const days = [...new Set(items.map(i=>i.date))].length;
  const avg = days > 0 ? sumUSD(items)/days : 0;
  const totalTip = items.reduce((s,i)=>s+(i.tipUSD||0), 0);
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))", gap:10 }}>
      <StatCard label="Hôm nay" usd={sumUSD(todayItems)} rate={rate} icon="sun" col={t.amber} bg={t.amberBg} />
      <StatCard label="Tuần này" usd={sumUSD(weekItems)} rate={rate} icon="calendar-week" col={t.green} bg={t.greenBg} />
      <StatCard label="Tháng này" usd={sumUSD(monthItems)} rate={rate} icon="calendar-month" col={t.accent} bg={t.accentBg} />
      <StatCard label="TB / ngày" usd={avg} rate={rate} icon="trending-up" col={t.purple} bg={t.purpleBg} />
      <StatCard label="Tổng tip" usd={totalTip} rate={rate} icon="coin" col={t.pink} bg={t.pinkBg} />
      <StatCard label="Tổng tất cả" usd={sumUSD(items)} rate={rate} icon="wallet" col={t.red} bg={t.redBg} />
    </div>
  );
};

// ─── Income Form ──────────────────────────────────────────────────────────────
const IncomeForm = ({ onAdd, rate, toast, t }) => {
  const [date, setDate] = useState(todayStr());
  const [wage, setWage] = useState("");
  const [wageCur, setWageCur] = useState("USD");
  const [showTip, setShowTip] = useState(false);
  const [tip, setTip] = useState("");
  const [tipCur, setTipCur] = useState("USD");
  const [note, setNote] = useState("");
  const [err, setErr] = useState({});

  const wageUSDprev = +wage > 0 ? toUSDval(wage, wageCur, rate) : 0;
  const tipUSDprev = showTip && +tip > 0 ? toUSDval(tip, tipCur, rate) : 0;
  const totalUSD = wageUSDprev + tipUSDprev;

  const submit = () => {
    const errs = {};
    if (!date) errs.date = "Chọn ngày";
    if (!wage || isNaN(+wage) || +wage <= 0) errs.wage = "Nhập số tiền hợp lệ";
    if (showTip && tip && (isNaN(+tip) || +tip < 0)) errs.tip = "Tip không hợp lệ";
    if (Object.keys(errs).length) { setErr(errs); return; }
    const wU = toUSDval(wage, wageCur, rate);
    const tU = showTip && tip ? toUSDval(tip, tipCur, rate) : 0;
    onAdd({ id:uid(), date, wageUSD:wU, wageCur, wageOrig:+wage, tipUSD:tU, tipCur, tipOrig:tip?+tip:0,
      totalUSD:wU+tU, exchangeRate:rate, note:note.trim(), createdAt:new Date().toISOString() });
    setWage(""); setTip(""); setNote(""); setShowTip(false); setErr({});
    toast("Đã thêm thu nhập thành công!");
  };

  const lbl = { fontSize:12, fontWeight:700, color:t.textSub, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:.4 };

  return (
    <div style={{ background:t.surface, borderRadius:20, padding:"20px 16px", border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
      <h2 style={{ margin:"0 0 18px", fontSize:16, fontWeight:900, color:t.text, display:"flex", alignItems:"center", gap:8 }}>
        <Icon name="plus-circle" size={18} color={t.accent} />Thêm thu nhập
      </h2>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div>
          <label style={lbl}>Ngày làm việc</label>
          <DatePicker value={date} onChange={setDate} t={t} />
          {err.date && <p style={{ color:t.red, fontSize:12, margin:"4px 0 0" }}>{err.date}</p>}
        </div>
        <div>
          <label style={lbl}>Lương / Thu nhập</label>
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ flex:1 }}>
              <AmountInput value={wage} onChange={v=>{setWage(v);setErr(e=>({...e,wage:""}));}} currency={wageCur} err={err.wage} t={t} />
            </div>
            <CurrencyToggle value={wageCur} onChange={setWageCur} t={t} />
          </div>
          {err.wage && <p style={{ color:t.red, fontSize:12, margin:"4px 0 0" }}>{err.wage}</p>}
          {wage && +wage > 0 && <p style={{ color:t.textMuted, fontSize:12, margin:"4px 0 0" }}>
            ≈ {wageCur==="USD" ? fmtVND(toVND(+wage, rate)) : fmtUSD(toUSD(+wage, rate))}
          </p>}
        </div>
        <div>
          <button onClick={()=>{setShowTip(s=>!s);setTip("");}} style={{
            display:"flex", alignItems:"center", gap:8, background:"none", border:`1.5px solid ${showTip?t.pink:t.border}`,
            cursor:"pointer", color:showTip?t.pink:t.textSub, fontSize:13, fontWeight:700,
            padding:"10px 14px", borderRadius:12, fontFamily:"inherit", width:"100%",
            transition:"all .15s", justifyContent:"center", backgroundColor:showTip?t.pinkBg:"transparent"
          }}>
            <Icon name={showTip?"coin":"circle-plus"} size={16} color={showTip?t.pink:t.textMuted} />
            {showTip ? "Ẩn ô tip" : "Thêm tiền tip (tùy chọn)"}
          </button>
          {showTip && (
            <div style={{ marginTop:10, padding:"14px", background:t.pinkBg, borderRadius:14, border:`1.5px solid ${t.pink}50` }}>
              <label style={{ ...lbl, color:t.pink }}>Tiền tip nhận được</label>
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1 }}>
                  <AmountInput value={tip} onChange={v=>{setTip(v);setErr(e=>({...e,tip:""}));}} currency={tipCur} err={err.tip} t={t} />
                </div>
                <CurrencyToggle value={tipCur} onChange={setTipCur} t={t} />
              </div>
              {err.tip && <p style={{ color:t.red, fontSize:12, margin:"4px 0 0" }}>{err.tip}</p>}
              {tip && +tip > 0 && <p style={{ color:t.pink, fontSize:12, margin:"4px 0 0", fontWeight:600 }}>
                ≈ {tipCur==="USD" ? fmtVND(toVND(+tip, rate)) : fmtUSD(toUSD(+tip, rate))}
              </p>}
            </div>
          )}
        </div>
        <div>
          <label style={lbl}>Ghi chú (không bắt buộc)</label>
          <input type="text" placeholder="ca sáng, bonus, thêm giờ..." value={note}
            onChange={e=>setNote(e.target.value)}
            style={{ width:"100%", padding:"11px 14px", borderRadius:12, border:`1.5px solid ${t.border}`,
              background:t.inputBg, color:t.text, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
        </div>
        {totalUSD > 0 && (
          <div style={{ padding:"12px 14px", background:t.greenBg, borderRadius:12, border:`1.5px solid ${t.green}40`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:12, color:t.greenTxt, fontWeight:700 }}>Tổng sẽ thêm</span>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:16, fontWeight:900, color:t.green }}>{fmtUSD(totalUSD)}</div>
              <div style={{ fontSize:11, color:t.greenTxt, fontWeight:600 }}>{fmtVND(toVND(totalUSD, rate))}</div>
            </div>
          </div>
        )}
        <button onClick={submit} style={{
          padding:"13px", background:t.accent, color:"#fff", border:"none",
          borderRadius:12, fontSize:15, fontWeight:800, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontFamily:"inherit"
        }}>
          <Icon name="plus" size={18} color="#fff" />Thêm thu nhập
        </button>
      </div>
    </div>
  );
};

// ─── Calendar ─────────────────────────────────────────────────────────────────
const IncomeCalendar = ({ items, rate, onEdit, onDelete, t }) => {
  const [sel, setSel] = useState(todayStr());
  const now = new Date();
  const [viewY, setViewY] = useState(now.getFullYear());
  const [viewM, setViewM] = useState(now.getMonth());

  const byDate = useMemo(()=>{ const m={}; items.forEach(i=>{ if(!m[i.date])m[i.date]=[]; m[i.date].push(i); }); return m; }, [items]);
  const dim = new Date(viewY, viewM+1, 0).getDate();
  const fdow = (() => { const d=new Date(viewY,viewM,1).getDay(); return d===0?6:d-1; })();
  const todayS = todayStr();
  const selItems = byDate[sel] || [];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ background:t.surface, borderRadius:20, padding:"16px 14px", border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <button onClick={()=>{viewM===0?(setViewM(11),setViewY(y=>y-1)):setViewM(m=>m-1);}}
            style={{ background:t.surfaceHover, border:`1px solid ${t.border}`, color:t.textSub, borderRadius:10, padding:"6px 10px", cursor:"pointer", fontSize:18, lineHeight:1 }}>‹</button>
          <span style={{ fontWeight:800, fontSize:14, color:t.text }}>{MONTHS[viewM]} {viewY}</span>
          <button onClick={()=>{viewM===11?(setViewM(0),setViewY(y=>y+1)):setViewM(m=>m+1);}}
            style={{ background:t.surfaceHover, border:`1px solid ${t.border}`, color:t.textSub, borderRadius:10, padding:"6px 10px", cursor:"pointer", fontSize:18, lineHeight:1 }}>›</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:4 }}>
          {DAYS_HDR.map(d=><div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:t.textMuted }}>{d}</div>)}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
          {Array(fdow).fill(null).map((_,i)=><div key={`e${i}`}/>)}
          {Array.from({length:dim},(_,i)=>{
            const day=i+1;
            const ds=`${viewY}-${String(viewM+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const has=byDate[ds]; const isSel=ds===sel; const isToday=ds===todayS;
            return (
              <button key={day} onClick={()=>setSel(ds)} style={{
                padding:"7px 0", border:"none", borderRadius:8, cursor:"pointer",
                background:isSel?t.accent:isToday?t.accentBg:"transparent",
                color:isSel?"#fff":isToday?t.accentTxt:t.text,
                fontSize:12, fontWeight:has?800:400, position:"relative", fontFamily:"inherit"
              }}>
                {day}
                {has&&!isSel&&<span style={{ position:"absolute", bottom:1, left:"50%", transform:"translateX(-50%)", width:4, height:4, borderRadius:"50%", background:t.green, display:"block" }}/>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ background:t.surface, borderRadius:20, padding:"16px 14px", border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
        <div style={{ fontWeight:800, fontSize:13, color:t.textSub, marginBottom:10 }}>{fmtDateDisplay(sel)}</div>
        {selItems.length === 0 ? (
          <div style={{ textAlign:"center", padding:"28px 0", color:t.textMuted }}>
            <Icon name="inbox" size={28} style={{ display:"block", margin:"0 auto 8px" }} />
            Không có thu nhập ngày này
          </div>
        ) : (
          <>
            <div style={{ padding:"10px 12px", background:t.greenBg, borderRadius:10, marginBottom:10, display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:t.greenTxt, fontWeight:700 }}>Tổng ngày này</span>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:15, fontWeight:900, color:t.green }}>{fmtUSD(sumUSD(selItems))}</div>
                <div style={{ fontSize:11, color:t.greenTxt }}>{fmtVND(toVND(sumUSD(selItems), rate))}</div>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {selItems.map(item => (
                <IncomeCard key={item.id} item={item} rate={rate} onEdit={onEdit} onDelete={onDelete} t={t} compact />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── History ──────────────────────────────────────────────────────────────────
const IncomeTable = ({ items, rate, onEdit, onDelete, onDeleteAll, toast, t }) => {
  const [search, setSearch] = useState("");
  const filtered = items
    .filter(i => i.note?.toLowerCase().includes(search.toLowerCase()) || i.date.includes(search))
    .sort((a,b) => b.date.localeCompare(a.date));

  return (
    <div style={{ background:t.surface, borderRadius:20, padding:"18px 14px", border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
      <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom:14 }}>
        <h2 style={{ margin:0, fontSize:16, fontWeight:900, color:t.text, display:"flex", alignItems:"center", gap:8 }}>
          <Icon name="list" size={17} color={t.accent} />Lịch sử ({items.length})
        </h2>
        <div style={{ display:"flex", gap:8 }}>
          <div style={{ position:"relative" }}>
            <Icon name="search" size={13} color={t.textMuted} style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)" }} />
            <input placeholder="Tìm..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{ padding:"7px 10px 7px 27px", borderRadius:10, border:`1.5px solid ${t.border}`, background:t.inputBg, color:t.text, fontSize:12, outline:"none", width:110, fontFamily:"inherit" }} />
          </div>
          {items.length > 0 && (
            <button onClick={()=>{if(confirm("Xoá TOÀN BỘ dữ liệu?")){onDeleteAll();toast("Đã xoá toàn bộ","error");}}}
              style={{ padding:"7px 10px", background:t.redBg, color:t.red, border:"none", borderRadius:10, fontSize:12, cursor:"pointer", fontWeight:700, fontFamily:"inherit" }}>
              <Icon name="trash" size={13} />
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"44px 0", color:t.textMuted }}>
          <Icon name="inbox" size={32} style={{ display:"block", margin:"0 auto 10px" }} />
          Chưa có dữ liệu
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(item => (
            <IncomeCard key={item.id} item={item} rate={rate} onEdit={onEdit} onDelete={onDelete} t={t} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Stats ────────────────────────────────────────────────────────────────────
const StatisticsChart = ({ items, rate, t }) => {
  const now = new Date();
  const [filterY, setFilterY] = useState(now.getFullYear());

  const last7 = useMemo(()=>Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-(6-i));
    const ds=d.toISOString().slice(0,10);
    return { label:`${d.getDate()}/${d.getMonth()+1}`, total:sumUSD(items.filter(x=>x.date===ds)) };
  }),[items]);

  const monthly = useMemo(()=>Array.from({length:12},(_,m)=>({
    label:`T${m+1}`, total:sumUSD(items.filter(i=>{ const [y,mo]=i.date.split("-"); return +y===filterY&&+mo===m+1; }))
  })),[items,filterY]);

  const BarChart = ({ data, accent }) => {
    const max=Math.max(...data.map(d=>d.total),0.01);
    return (
      <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:110 }}>
        {data.map((d,i)=>(
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", height:"100%", justifyContent:"flex-end" }}>
            {d.total>0&&<div style={{ fontSize:8, color:t.textMuted, marginBottom:2 }}>${d.total.toFixed(0)}</div>}
            <div style={{ width:"100%", borderRadius:"3px 3px 0 0", height:`${Math.max((d.total/max)*100,1)}%`, background:d.total>0?accent:t.border, transition:"height .4s" }}/>
            <div style={{ fontSize:9, color:t.textMuted, marginTop:3 }}>{d.label}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ background:t.surface, borderRadius:20, padding:"18px 14px", border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
        <h3 style={{ margin:"0 0 14px", fontSize:13, fontWeight:800, color:t.textSub, textTransform:"uppercase", letterSpacing:.4 }}>7 ngày gần nhất</h3>
        <BarChart data={last7} accent={t.green} />
      </div>
      <div style={{ background:t.surface, borderRadius:20, padding:"18px 14px", border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ margin:0, fontSize:13, fontWeight:800, color:t.textSub, textTransform:"uppercase", letterSpacing:.4 }}>Theo tháng</h3>
          <select value={filterY} onChange={e=>setFilterY(+e.target.value)}
            style={{ padding:"5px 10px", borderRadius:8, border:`1px solid ${t.border}`, background:t.inputBg, color:t.text, fontSize:12, fontFamily:"inherit" }}>
            {[now.getFullYear()-1, now.getFullYear()].map(y=><option key={y}>{y}</option>)}
          </select>
        </div>
        <BarChart data={monthly} accent={t.accent} />
      </div>
    </div>
  );
};

// ─── Settings ─────────────────────────────────────────────────────────────────
const Settings = ({ rate, setRate, items, setItems, toast, t }) => {
  const [rateInput, setRateInput] = useState(rate);
  const saveRate = () => { const r=+rateInput; if(!r||r<=0)return; setRate(r); localStorage.setItem(RATE_KEY,String(r)); toast("Đã lưu tỷ giá!"); };
  const exportData = () => {
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify({items,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"}));
    a.download=`salary-${todayStr()}.json`; a.click(); toast("Đã export!");
  };
  const importData = (e) => {
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=ev=>{
      try {
        const d=JSON.parse(ev.target.result);
        if(Array.isArray(d.items)){
          if(confirm(`Import ${d.items.length} khoản? Dữ liệu cũ sẽ bị GHI ĐÈ.`)){ setItems(d.items); localStorage.setItem(STORAGE_KEY,JSON.stringify(d.items)); toast("Import thành công!"); }
        } else toast("File không hợp lệ","error");
      } catch { toast("Lỗi đọc file","error"); }
    }; r.readAsText(f); e.target.value="";
  };
  const box = { background:t.surface, borderRadius:20, padding:"18px 14px", border:`1px solid ${t.border}`, marginBottom:12, boxShadow:t.shadow };

  return (
    <div>
      <div style={box}>
        <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:800, color:t.text }}>
          <Icon name="currency-dollar" size={15} color={t.amber} style={{ marginRight:6 }} />Tỷ giá USD ↔ VND
        </h3>
        <p style={{ fontSize:13, color:t.textSub, margin:"0 0 10px" }}>Hiện tại: 1 USD = {rate.toLocaleString("vi-VN")} ₫</p>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:13, color:t.textSub, whiteSpace:"nowrap" }}>1 USD =</span>
          <input type="number" value={rateInput} onChange={e=>setRateInput(e.target.value)}
            style={{ flex:1, minWidth:80, padding:"10px 12px", borderRadius:10, border:`1.5px solid ${t.border}`, background:t.inputBg, color:t.text, fontSize:14, fontFamily:"inherit", outline:"none" }} />
          <span style={{ fontSize:13, color:t.textSub }}>VND</span>
          <button onClick={saveRate} style={{ padding:"10px 16px", background:t.accent, color:"#fff", border:"none", borderRadius:10, fontSize:13, cursor:"pointer", fontWeight:800, fontFamily:"inherit" }}>Lưu</button>
        </div>
      </div>
      <div style={box}>
        <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:800, color:t.text }}>
          <Icon name="database-export" size={15} color={t.green} style={{ marginRight:6 }} />Backup dữ liệu
        </h3>
        <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
          <button onClick={exportData} style={{ padding:"10px 16px", background:t.greenBg, color:t.green, border:"none", borderRadius:10, fontSize:13, cursor:"pointer", fontWeight:700, display:"flex", alignItems:"center", gap:6, fontFamily:"inherit" }}>
            <Icon name="download" size={14} color={t.green} />Export JSON
          </button>
          <label style={{ padding:"10px 16px", background:t.accentBg, color:t.accentTxt, borderRadius:10, fontSize:13, cursor:"pointer", fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
            <Icon name="upload" size={14} />Import JSON
            <input type="file" accept=".json" onChange={importData} style={{ display:"none" }} />
          </label>
        </div>
        <p style={{ fontSize:11, color:t.textMuted, margin:"10px 0 0" }}>Export định kỳ để không mất dữ liệu khi xoá cache.</p>
      </div>
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────
const NAV = [
  { id:"dashboard", label:"Tổng quan", icon:"home" },
  { id:"add", label:"Thêm", icon:"plus-circle" },
  { id:"calendar", label:"Lịch", icon:"calendar" },
  { id:"history", label:"Lịch sử", icon:"list" },
  { id:"stats", label:"Thống kê", icon:"chart-bar" },
  { id:"settings", label:"Cài đặt", icon:"settings" },
];

export default function App() {
  const [items, setItems] = useState(()=>{ try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||[];}catch{return[];} });
  const [rate, setRate] = useState(()=>{ const r=localStorage.getItem(RATE_KEY); return r?+r:DEFAULT_RATE; });
  const [isDark, setIsDark] = useState(()=>localStorage.getItem(THEME_KEY)==="dark");
  const [tab, setTab] = useState("dashboard");
  const [toastData, setToastData] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(()=>{ localStorage.setItem(STORAGE_KEY,JSON.stringify(items)); },[items]);
  useEffect(()=>{ localStorage.setItem(THEME_KEY,isDark?"dark":"light"); },[isDark]);

  const t = isDark ? TH.dark : TH.light;
  const toast = useCallback((msg, type="success") => setToastData({msg,type,key:Date.now()}), []);
  const addItem = i => setItems(p=>[i,...p]);
  const delItem = id => {
    if (confirm("Xoá khoản này?")) {
      setItems(p=>p.filter(i=>i.id!==id));
      toast("Đã xoá","error");
    }
  };
  const editItem = (item) => setEditingItem(item);
  const saveEdit = (updated) => {
    setItems(p => p.map(i => i.id === updated.id ? updated : i));
    setEditingItem(null);
    toast("Đã lưu thay đổi!");
  };
  const delAll = () => setItems([]);

  const content = {
    dashboard: <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <DashboardCards items={items} rate={rate} t={t}/>
      <IncomeForm onAdd={addItem} rate={rate} toast={toast} t={t}/>
    </div>,
    add: <IncomeForm onAdd={addItem} rate={rate} toast={toast} t={t}/>,
    calendar: <IncomeCalendar items={items} rate={rate} onEdit={editItem} onDelete={delItem} t={t}/>,
    history: <IncomeTable items={items} rate={rate} onEdit={editItem} onDelete={delItem} onDeleteAll={delAll} toast={toast} t={t}/>,
    stats: <StatisticsChart items={items} rate={rate} t={t}/>,
    settings: <Settings rate={rate} setRate={setRate} items={items} setItems={setItems} toast={toast} t={t}/>,
  };

  return (
    <div style={{ minHeight:"100vh", background:t.bg, fontFamily:"'Nunito',system-ui,sans-serif", transition:"background .25s,color .25s" }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
      <link href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        button,input,select{font-family:inherit;}
        ::-webkit-scrollbar{height:3px;width:3px;}
        ::-webkit-scrollbar-thumb{background:${t.border};border-radius:4px;}
      `}</style>

      {/* Header */}
      <div style={{ background:`linear-gradient(150deg,${t.headerStart} 0%,${t.headerEnd} 100%)`, padding:"16px 14px 50px" }}>
        <div style={{ maxWidth:600, margin:"0 auto", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ background:"rgba(255,255,255,.15)", borderRadius:12, width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Icon name="wallet" size={19} color="#fff"/>
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:900, color:"#fff", letterSpacing:-.3 }}>Salary Tracker</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,.65)", fontWeight:700 }}>Quản lý thu nhập</div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.8)", background:"rgba(255,255,255,.15)", padding:"5px 9px", borderRadius:8, fontWeight:700, whiteSpace:"nowrap" }}>
              1$ = {rate.toLocaleString("vi-VN")}₫
            </div>
            <button onClick={()=>setIsDark(d=>!d)} style={{
              background:"rgba(255,255,255,.15)", border:"1.5px solid rgba(255,255,255,.25)", borderRadius:10,
              width:34, height:34, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0
            }}>
              <Icon name={isDark?"sun":"moon"} size={16} color="#fff"/>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:600, margin:"-24px auto 0", padding:"0 12px", position:"relative", zIndex:10 }}>
        <div style={{
          background:t.navBg, borderRadius:16, padding:"4px",
          display:"flex", gap:2, overflowX:"auto", scrollbarWidth:"none",
          boxShadow:`0 4px 20px rgba(0,0,0,${isDark?.25:.08})`, marginBottom:14,
          border:`1px solid ${t.border}`
        }}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{
              flex:"none", padding:"7px 10px", border:"none", borderRadius:11, cursor:"pointer",
              background:tab===n.id?t.navActiveBg:"transparent",
              color:tab===n.id?t.navActiveTxt:t.navTxt,
              fontSize:11, fontWeight:800,
              display:"flex", flexDirection:"column", alignItems:"center", gap:3,
              transition:"all .15s", minWidth:48
            }}>
              <Icon name={n.icon} size={16} color={tab===n.id?"#fff":t.navTxt}/>
              <span style={{ whiteSpace:"nowrap" }}>{n.label}</span>
            </button>
          ))}
        </div>
        <div style={{ paddingBottom:36 }}>{content[tab]}</div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <EditModal
          item={editingItem}
          rate={rate}
          onSave={saveEdit}
          onClose={()=>setEditingItem(null)}
          t={t}
        />
      )}

      {toastData && <Toast key={toastData.key} msg={toastData.msg} type={toastData.type} onClose={()=>setToastData(null)} t={t}/>}
    </div>
  );
}