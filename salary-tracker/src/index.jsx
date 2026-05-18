import { useEffect, useMemo, useRef, useState } from "react";
import { deleteIncomeItems, fetchIncomeItems, syncLocalItemsToCloud, upsertIncomeItem } from "./lib/incomeCloud";
import { isSupabaseConfigured } from "./lib/supabaseClient";

const STORAGE_KEY = "salary_items_usd";
const THEME_KEY = "salary_theme";

const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n || 0));
const fmtDate = (s) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};
const sumUSD = (items) => items.reduce((s, i) => s + (i.totalUSD || 0), 0);

const MONTHS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];
const DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const THEMES = {
  light: {
    bg: "#ecf2fb",
    panel: "#ffffff",
    panelAlt: "#f5f9ff",
    text: "#12243b",
    textSub: "#587196",
    border: "#d0deef",
    brand: "#2d74ef",
    brand2: "#153ea2",
    green: "#0f9f6f",
    greenSoft: "#e8faf3",
    red: "#d84444",
    redSoft: "#ffecec",
  },
  dark: {
    bg: "#0f1726",
    panel: "#171f30",
    panelAlt: "#1e2940",
    text: "#e6eef9",
    textSub: "#9eb3d0",
    border: "#2a3852",
    brand: "#4a95ff",
    brand2: "#275ec8",
    green: "#44d3a4",
    greenSoft: "#17362a",
    red: "#ff7575",
    redSoft: "#3a1d22",
  },
};

const ICONS = {
  home: ["M3 10.5L12 3l9 7.5", "M5 9.5V21h14V9.5"],
  plus: ["M12 5v14", "M5 12h14"],
  calendar: ["M4 6h16v14H4z", "M8 3v4", "M16 3v4", "M4 10h16"],
  list: ["M8 6h12", "M8 12h12", "M8 18h12", "M4 6h.01", "M4 12h.01", "M4 18h.01"],
  "chart-bar": ["M5 20V10", "M12 20V6", "M19 20V13", "M3 20h18"],
  settings: [
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
    "M19.4 15a1.6 1.6 0 0 0 .32 1.76l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.6 1.6 0 0 0 15.16 19a1.6 1.6 0 0 0-1.36.8 1.6 1.6 0 0 1-2.8 0A1.6 1.6 0 0 0 9.64 19a1.6 1.6 0 0 0-1.76.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 5 15.16a1.6 1.6 0 0 0-.8-1.36 1.6 1.6 0 0 1 0-2.8A1.6 1.6 0 0 0 5 9.64a1.6 1.6 0 0 0-.32-1.76l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9.64 5a1.6 1.6 0 0 0 1.36-.8 1.6 1.6 0 0 1 2.8 0A1.6 1.6 0 0 0 15.16 5a1.6 1.6 0 0 0 1.76-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19 9.64a1.6 1.6 0 0 0 .8 1.36 1.6 1.6 0 0 1 0 2.8A1.6 1.6 0 0 0 19.4 15Z",
  ],
  edit: ["M12 20h9", "M16.5 3.5a2.12 2.12 0 1 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"],
  trash: ["M3 6h18", "M8 6V4h8v2", "M6 6l1 14h10l1-14", "M10 10v7", "M14 10v7"],
  moon: ["M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"],
  sun: [
    "M12 3v2",
    "M12 19v2",
    "M3 12h2",
    "M19 12h2",
    "M5.6 5.6l1.4 1.4",
    "M17 17l1.4 1.4",
    "M17 7l1.4-1.4",
    "M5.6 18.4 7 17",
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  ],
  check: ["M20 6 9 17l-5-5"],
  "alert-circle": ["M12 8v5", "M12 16h.01", "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"],
  wallet: ["M3 7h18v12H3z", "M16 12h5", "M6 7V5h12v2"],
  clock: ["M12 7v5l3 2", "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"],
  chart: ["M4 19h16", "M7 16l3-4 3 2 4-6"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8"],
};

const Icon = ({ name, size = 16 }) => {
  const paths = ICONS[name] || ICONS["alert-circle"];
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {paths.map((d, i) => (
        <path key={`${name}-${i}`} d={d} />
      ))}
    </svg>
  );
};

const Toast = ({ text, type, onClose, theme }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2200);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`toast ${type}`}
      style={{
        background: type === "error" ? theme.redSoft : theme.greenSoft,
        color: type === "error" ? theme.red : theme.green,
        borderColor: type === "error" ? `${theme.red}55` : `${theme.green}55`,
      }}
    >
      <Icon name={type === "error" ? "alert-circle" : "check"} size={14} /> {text}
    </div>
  );
};

const Dashboard = ({ items, theme }) => {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  weekStart.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  weekStart.setHours(0, 0, 0, 0);

  const total = sumUSD(items);
  const monthItems = items.filter((i) => i.date.startsWith(thisMonth));
  const monthTotal = sumUSD(monthItems);
  const weekTotal = sumUSD(
    items.filter((i) => {
      const d = new Date(i.date);
      d.setHours(0, 0, 0, 0);
      return d >= weekStart;
    }),
  );
  const todayItems = items.filter((i) => i.date === todayStr());
  const todayTotal = sumUSD(todayItems);
  const uniqueDays = new Set(monthItems.map((i) => i.date)).size || 1;
  const avgPerDay = monthTotal / uniqueDays;

  const cards = [
    { label: "HÔM NAY", value: fmtUSD(todayTotal), tone: "amber", icon: "sun", sub: `${todayItems.length} khoản` },
    {
      label: "TUẦN NÀY",
      value: fmtUSD(weekTotal),
      tone: "green",
      icon: "clock",
      sub: `${items.filter((i) => {
        const d = new Date(i.date);
        d.setHours(0, 0, 0, 0);
        return d >= weekStart;
      }).length} khoản`,
    },
    { label: "THÁNG NÀY", value: fmtUSD(monthTotal), tone: "blue", icon: "calendar", sub: `${monthItems.length} khoản` },
    { label: "TB / NGÀY", value: fmtUSD(avgPerDay), tone: "purple", icon: "chart", sub: `${uniqueDays} ngày có thu nhập` },
    { label: "TỔNG THU", value: fmtUSD(total), tone: "rose", icon: "wallet", sub: `${items.length} khoản` },
    { label: "SỐ KHOẢN", value: `${items.length}`, tone: "slate", icon: "users", sub: "Đã lưu" },
  ];

  return (
    <div className="stack">
      <div className="card-grid">
        {cards.map((c) => (
          <div key={c.label} className={`stat-card tone-${c.tone}`} style={{ borderColor: theme.border, background: theme.panelAlt }}>
            <div className="stat-head">
              <p>{c.label}</p>
              <span className="stat-badge"><Icon name={c.icon} size={14} /></span>
            </div>
            <h3 style={{ color: theme.text }}>{c.value}</h3>
            <small className="stat-sub">{c.sub}</small>
          </div>
        ))}
      </div>
    </div>
  );
};

const IncomeForm = ({ onAdd, theme }) => {
  const [date, setDate] = useState(todayStr());
  const [wage, setWage] = useState("");
  const [tip, setTip] = useState("");
  const [note, setNote] = useState("");
  const [showTip, setShowTip] = useState(false);
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!date) return setError("Chọn ngày trước nhé.");
    if (!wage || Number(wage) <= 0) return setError("Nhập số tiền hợp lệ (> 0).");

    onAdd({
      id: uid(),
      date,
      wageUSD: Number(wage),
      tipUSD: showTip && tip && Number(tip) > 0 ? Number(tip) : 0,
      note: note.trim(),
      totalUSD: Number(wage) + (showTip && tip && Number(tip) > 0 ? Number(tip) : 0),
    });

    setWage("");
    setTip("");
    setNote("");
    setError("");
  };

  return (
    <form className="panel stack" onSubmit={submit} style={{ background: theme.panel, borderColor: theme.border }}>
      <h3 className="section-title" style={{ color: theme.text }}>
        <Icon name="plus" size={16} /> Thêm khoản thu
      </h3>

      <label>Ngày</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <label>Lương / Thu nhập ($)</label>
      <input type="number" min="0" step="0.01" placeholder="0.00" value={wage} onChange={(e) => setWage(e.target.value)} />

      <button className="subtle" type="button" onClick={() => setShowTip((v) => !v)}>
        {showTip ? "Ẩn tip" : "Thêm tip (tùy chọn)"}
      </button>

      {showTip ? (
        <>
          <label>Tip ($)</label>
          <input type="number" min="0" step="0.01" placeholder="0.00" value={tip} onChange={(e) => setTip(e.target.value)} />
        </>
      ) : null}

      <label>Ghi chú</label>
      <input type="text" placeholder="ca sáng, bonus..." value={note} onChange={(e) => setNote(e.target.value)} />

      {error ? <p className="error">{error}</p> : null}
      <button className="primary" type="submit" style={{ background: theme.brand }}>
        Lưu khoản thu
      </button>
    </form>
  );
};

const RowCard = ({ item, onEdit, onDelete }) => (
  <div className="income-row">
    <div>
      <p className="amount">{fmtUSD(item.totalUSD)}</p>
      <p className="meta">
        {fmtDate(item.date)} {item.note ? `- ${item.note}` : ""}
      </p>
    </div>
    <div className="actions">
      <button onClick={() => onEdit(item)}>
        <Icon name="edit" size={14} />
      </button>
      <button onClick={() => onDelete(item.id)}>
        <Icon name="trash" size={14} />
      </button>
    </div>
  </div>
);

const History = ({ items, onEdit, onDelete, onDeleteAll }) => {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      items
        .filter((i) => i.note?.toLowerCase().includes(q.toLowerCase()) || i.date.includes(q))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [items, q],
  );

  return (
    <div className="panel stack">
      <div className="row-between">
        <h3 className="section-title"><Icon name="list" size={16} /> Lịch sử ({items.length})</h3>
        <button className="danger" onClick={onDeleteAll}>Xóa hết</button>
      </div>
      <input placeholder="Tìm theo ngày hoặc ghi chú" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="stack">
        {filtered.length === 0 ? <p className="muted">Chưa có dữ liệu</p> : filtered.map((i) => <RowCard key={i.id} item={i} onEdit={onEdit} onDelete={onDelete} />)}
      </div>
    </div>
  );
};

const Calendar = ({ items, onEdit, onDelete }) => {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(todayStr());

  const mapByDate = useMemo(() => {
    const x = {};
    for (const i of items) {
      if (!x[i.date]) x[i.date] = [];
      x[i.date].push(i);
    }
    return x;
  }, [items]);

  const dim = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const firstDay = (() => {
    const d = new Date(cursor.y, cursor.m, 1).getDay();
    return d === 0 ? 6 : d - 1;
  })();

  const selectedItems = mapByDate[selected] || [];

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="row-between">
          <button onClick={() => setCursor((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}>‹</button>
          <h3 className="section-title"><Icon name="calendar" size={16} /> {MONTHS[cursor.m]} {cursor.y}</h3>
          <button onClick={() => setCursor((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))}>›</button>
        </div>

        <div className="calendar-grid head">
          {DAYS.map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="calendar-grid">
          {Array(firstDay).fill(null).map((_, i) => <span key={`e-${i}`} />)}
          {Array.from({ length: dim }, (_, i) => i + 1).map((day) => {
            const date = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const has = Boolean(mapByDate[date]);
            const active = selected === date;
            return (
              <button key={date} className={`day ${active ? "active" : ""}`} onClick={() => setSelected(date)}>
                {day}
                {has ? <small>•</small> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel stack">
        <h3>{fmtDate(selected)}</h3>
        {selectedItems.length === 0 ? <p className="muted">Không có khoản thu ngày này.</p> : selectedItems.map((i) => <RowCard key={i.id} item={i} onEdit={onEdit} onDelete={onDelete} />)}
      </div>
    </div>
  );
};

const Stats = ({ items }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const last7 = useMemo(
    () =>
      Array.from({ length: 7 }, (_, idx) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - idx));
        const key = d.toISOString().slice(0, 10);
        return { label: `${d.getDate()}/${d.getMonth() + 1}`, total: sumUSD(items.filter((i) => i.date === key)) };
      }),
    [items],
  );

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) => ({
        label: `T${m + 1}`,
        total: sumUSD(items.filter((i) => {
          const [y, mo] = i.date.split("-");
          return Number(y) === year && Number(mo) === m + 1;
        })),
      })),
    [items, year],
  );

  const Chart = ({ data }) => {
    const max = Math.max(...data.map((d) => d.total), 1);
    return (
      <div className="bars">
        {data.map((d) => (
          <div key={d.label} className="bar-col">
            <div className="bar" style={{ height: `${Math.max((d.total / max) * 100, 2)}%` }} />
            <span>{d.label}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="stack">
      <div className="panel stack">
        <h3 className="section-title"><Icon name="chart-bar" size={16} /> 7 ngày gần nhất</h3>
        <Chart data={last7} />
      </div>

      <div className="panel stack">
        <div className="row-between">
          <h3 className="section-title"><Icon name="chart" size={16} /> Theo tháng</h3>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear()].map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
        <Chart data={months} />
      </div>
    </div>
  );
};

const Settings = ({ items, setItems, showToast, cloudEnabled, cloudBusy, onReloadCloud, onSyncCloud }) => {
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ items, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `salary-usd-${todayStr()}.json`;
    link.click();
    showToast("Đã export dữ liệu");
  };

  const importJson = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.items)) throw new Error("invalid");
        setItems(data.items);
        showToast("Import thành công");
        if (cloudEnabled) {
          void onSyncCloud(data.items);
        }
      } catch {
        showToast("File không hợp lệ", "error");
      }
    };
    reader.readAsText(f);
  };

  return (
    <div className="panel stack">
      <h3 className="section-title"><Icon name="settings" size={16} /> Dữ liệu</h3>
      <p className="muted">{cloudEnabled ? "Supabase: Đã cấu hình" : "Supabase: Chưa cấu hình (đang lưu local)"}</p>
      <button className="subtle" onClick={() => void onReloadCloud()} disabled={!cloudEnabled || cloudBusy}>
        Tải lại từ cloud
      </button>
      <button className="subtle" onClick={() => void onSyncCloud()} disabled={!cloudEnabled || cloudBusy}>
        Đồng bộ lên cloud
      </button>
      <button onClick={exportJson}>Export JSON</button>
      <label className="file-btn">
        Import JSON
        <input type="file" accept=".json" onChange={importJson} />
      </label>
    </div>
  );
};

const EditModal = ({ item, onClose, onSave }) => {
  const [date, setDate] = useState(item.date);
  const [wage, setWage] = useState(item.wageUSD || 0);
  const [tip, setTip] = useState(item.tipUSD || 0);
  const [note, setNote] = useState(item.note || "");

  const save = () => {
    const wageNum = Number(wage);
    const tipNum = Number(tip) || 0;
    if (!wageNum || wageNum <= 0) return;

    onSave({ ...item, date, wageUSD: wageNum, tipUSD: tipNum, note, totalUSD: wageNum + tipNum });
  };

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel stack modal-box">
        <h3 className="section-title"><Icon name="edit" size={16} /> Sửa khoản thu</h3>
        <label>Ngày</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label>Lương ($)</label>
        <input type="number" min="0" step="0.01" value={wage} onChange={(e) => setWage(e.target.value)} />
        <label>Tip ($)</label>
        <input type="number" min="0" step="0.01" value={tip} onChange={(e) => setTip(e.target.value)} />
        <label>Ghi chú</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="row-between">
          <button onClick={onClose}>Hủy</button>
          <button className="primary" onClick={save}>Lưu</button>
        </div>
      </div>
    </div>
  );
};

const NAV = [
  { id: "dashboard", label: "Tổng quan", icon: "home" },
  { id: "add", label: "Thêm", icon: "plus" },
  { id: "calendar", label: "Lịch", icon: "calendar" },
  { id: "history", label: "Lịch sử", icon: "list" },
  { id: "stats", label: "Thống kê", icon: "chart-bar" },
  { id: "settings", label: "Cài đặt", icon: "settings" },
];

export default function App() {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });
  const [tab, setTab] = useState("dashboard");
  const [themeName, setThemeName] = useState(localStorage.getItem(THEME_KEY) || "light");
  const [toast, setToast] = useState(null);
  const [editing, setEditing] = useState(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const cloudBootstrappedRef = useRef(false);

  const theme = THEMES[themeName];

  const showToast = (text, type = "ok") => setToast({ text, type, key: Date.now() });

  const reloadFromCloud = async (notify = true, force = true) => {
    if (!isSupabaseConfigured) return false;
    setCloudBusy(true);
    try {
      const remoteItems = await fetchIncomeItems();
      setItems((prev) => {
        if (!force && remoteItems.length === 0 && prev.length > 0) {
          return prev;
        }
        return remoteItems;
      });
      if (notify) showToast("Đã tải dữ liệu từ cloud");
      return true;
    } catch {
      if (notify) showToast("Không tải được dữ liệu cloud", "error");
      return false;
    } finally {
      setCloudBusy(false);
    }
  };

  const syncCloud = async (sourceItems = items, notify = true) => {
    if (!isSupabaseConfigured) return false;
    setCloudBusy(true);
    try {
      const result = await syncLocalItemsToCloud(sourceItems);
      if (notify) showToast(`Đã đồng bộ cloud (${result.uploaded} khoản)`);
      return true;
    } catch {
      if (notify) showToast("Đồng bộ cloud thất bại", "error");
      return false;
    } finally {
      setCloudBusy(false);
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, themeName);
  }, [themeName]);

  useEffect(() => {
    if (!isSupabaseConfigured || cloudBootstrappedRef.current) return;
    cloudBootstrappedRef.current = true;
    void reloadFromCloud(false, false);
  }, []);

  const addItem = async (entry) => {
    setItems((prev) => [entry, ...prev]);
    if (!isSupabaseConfigured) {
      showToast("Đã thêm khoản thu");
      return;
    }

    try {
      await upsertIncomeItem(entry);
      showToast("Đã thêm khoản thu");
    } catch {
      showToast("Đã lưu trên máy, cloud đang lỗi", "error");
    }
  };

  const deleteItem = async (id) => {
    if (!confirm("Xóa khoản này?")) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (!isSupabaseConfigured) {
      showToast("Đã xóa", "error");
      return;
    }

    try {
      await deleteIncomeItems([id]);
      showToast("Đã xóa", "error");
    } catch {
      showToast("Đã xóa trên máy, cloud đang lỗi", "error");
    }
  };

  const saveEdit = async (updated) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditing(null);
    if (!isSupabaseConfigured) {
      showToast("Đã cập nhật");
      return;
    }

    try {
      await upsertIncomeItem(updated);
      showToast("Đã cập nhật");
    } catch {
      showToast("Đã cập nhật trên máy, cloud đang lỗi", "error");
    }
  };

  const deleteAll = async () => {
    if (!confirm("Xóa toàn bộ dữ liệu?")) return;
    const existingIds = items.map((item) => item.id);
    setItems([]);
    if (!isSupabaseConfigured) {
      showToast("Đã xóa toàn bộ", "error");
      return;
    }

    try {
      await deleteIncomeItems(existingIds);
      showToast("Đã xóa toàn bộ", "error");
    } catch {
      showToast("Đã xóa trên máy, cloud đang lỗi", "error");
    }
  };

  const views = {
    dashboard: (
      <div className="stack">
        <Dashboard items={items} theme={theme} />
        <IncomeForm onAdd={addItem} theme={theme} />
      </div>
    ),
    add: <IncomeForm onAdd={addItem} theme={theme} />,
    calendar: <Calendar items={items} onEdit={setEditing} onDelete={deleteItem} />,
    history: <History items={items} onEdit={setEditing} onDelete={deleteItem} onDeleteAll={deleteAll} />,
    stats: <Stats items={items} />,
    settings: (
      <Settings
        items={items}
        setItems={setItems}
        showToast={showToast}
        cloudEnabled={isSupabaseConfigured}
        cloudBusy={cloudBusy}
        onReloadCloud={reloadFromCloud}
        onSyncCloud={syncCloud}
      />
    ),
  };

  return (
    <div
      className="app"
      style={{
        background: theme.bg,
        color: theme.text,
        "--panel": theme.panel,
        "--panel-alt": theme.panelAlt,
        "--border": theme.border,
        "--text": theme.text,
        "--text-sub": theme.textSub,
        "--brand": theme.brand,
        "--brand-2": theme.brand2,
        "--green": theme.green,
        "--green-soft": theme.greenSoft,
        "--red": theme.red,
        "--red-soft": theme.redSoft,
      }}
    >
      <header className="app-header" style={{ background: `linear-gradient(145deg, ${theme.brand2}, ${theme.brand})` }}>
        <div>
          <h1>Salary Tracker</h1>
          <p>Chỉ theo dõi USD, giữ đầy đủ thống kê</p>
        </div>
        <button className="theme-toggle" onClick={() => setThemeName((v) => (v === "light" ? "dark" : "light"))}>
          <Icon name={themeName === "light" ? "moon" : "sun"} />
        </button>
      </header>

      <nav className="tabs" style={{ background: theme.panel, borderColor: theme.border }}>
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setTab(n.id)}
            className={`tab-${n.id} ${tab === n.id ? "active" : ""}`}
            style={tab === n.id ? { background: theme.brand, color: "#fff" } : { color: theme.textSub }}
          >
            <Icon name={n.icon} size={15} /> {n.label}
          </button>
        ))}
      </nav>

      <main className="content">{views[tab]}</main>

      {editing ? <EditModal item={editing} onClose={() => setEditing(null)} onSave={saveEdit} /> : null}
      {toast ? <Toast key={toast.key} text={toast.text} type={toast.type} onClose={() => setToast(null)} theme={theme} /> : null}
    </div>
  );
}
