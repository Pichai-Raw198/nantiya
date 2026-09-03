"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

type Tx = {
  id: string;
  amount: number;
  type: "income" | "expense";
  categoryName: string;
  date: string;
  note?: string | null;
  category?: { color: string; icon?: string } | null;
};

type Summary = { income: number; expense: number; balance: number };

type Category = { id: string; name: string; type: string; color: string; icon?: string };

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<{email:string; name?:string|null} | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [summary, setSummary] = useState<Summary>({ income: 0, expense: 0, balance: 0 });
  const [byCategory, setByCategory] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [loading, setLoading] = useState(false);

  // form
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [categoryName, setCategoryName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.status===401) { router.push("/login"); return; }
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategories(data);
        if (data.length) {
          const currentExists = data.some((c:Category)=>c.name===categoryName && c.type===type);
          if (!categoryName || !currentExists) {
            const matched = data.find((c:Category)=>c.type===type);
            setCategoryName(matched?.name || data[0].name);
          }
        }
      }
    } catch (e) { console.error("fetchCategories fail", e); }
  };

  const fetchData = async () => {
    setLoading(true);
    const params = new URLSearchParams({ month });
    if (filterType !== "all") params.set("type", filterType);
    const res = await fetch(`/api/transactions?${params.toString()}`);
    if (res.status===401) { router.push("/login"); return; }
    const data = await res.json();
    setTransactions(data.transactions || []);
    setSummary(data.summary || { income: 0, expense: 0, balance: 0 });
    setByCategory(data.byCategory || {});
    setLoading(false);
  };

  // auth check
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) { router.push("/login"); return; }
        const data = await res.json();
        if (!data.user) { router.push("/login"); return; }
        setUser(data.user);
      } catch { router.push("/login"); return; }
      setAuthLoading(false);
      fetchCategories();
      fetchData();
    };
    check();
  }, []);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [month, filterType]);
  useEffect(() => {
    const cat = categories.find((c) => c.type === type);
    if (cat) setCategoryName(cat.name);
  }, [type, categories]);

  // chart
  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    const labels = Object.keys(byCategory);
    const values = Object.values(byCategory);
    if (labels.length === 0) return;

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;
    const colors = labels.map((l) => categories.find((c) => c.name === l)?.color || "#6366f1");

    chartInstance.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: "#fff" }],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
      },
    });
    return () => { chartInstance.current?.destroy(); };
  }, [byCategory, categories]);

  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = amount.toString().replace(/,/g, "").trim();
    if (!cleanAmount || !categoryName || !date) return alert("กรุณากรอกข้อมูลให้ครบ (จำนวนเงิน/หมวดหมู่/วันที่)");
    if (isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) return alert("จำนวนเงินไม่ถูกต้อง");
    if (categories.length===0) return alert("กำลังโหลดหมวดหมู่ กรุณารอสักครู่แล้วลองใหม่");

    let finalCategory = categoryName;
    const exists = categories.some(c=>c.name===finalCategory && c.type===type);
    if (!exists) {
      const fallback = categories.find(c=>c.type===type);
      if (fallback) finalCategory = fallback.name;
    }

    const payload = {
      amount: Number(cleanAmount),
      type,
      categoryName: finalCategory,
      categoryId: categories.find((c) => c.name === finalCategory)?.id || null,
      date,
      note,
    };
    setSubmitting(true);
    try {
      const url = editingId ? `/api/transactions/${editingId}` : "/api/transactions";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(payload) });
      if (res.status===401) { router.push("/login"); return; }
      const result = await res.json().catch(()=> ({}));
      if (!res.ok) {
        console.error("save failed", result);
        return alert(`บันทึกไม่สำเร็จ: ${result.error || result.detail || res.statusText}`);
      }
      setAmount(""); setNote(""); setEditingId(null);
      setDate(new Date().toISOString().slice(0,10));
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: " + String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (tx: Tx) => {
    setEditingId(tx.id);
    setAmount(String(tx.amount));
    setType(tx.type);
    setCategoryName(tx.categoryName);
    setDate(tx.date.slice(0,10));
    setNote(tx.note || "");
    window.scrollTo({ top: 0, behavior: "smooth"});
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ลบรายการนี้?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE"});
    if (res.status===401) { router.push("/login"); return; }
    fetchData();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const fmt = (n:number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
  const filteredCats = categories.filter((c)=> c.type===type);

  if (authLoading) {
    return <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light"><div className="spinner-border text-primary me-2" role="status"></div><span className="text-muted">กำลังตรวจสอบสิทธิ์...</span></div>;
  }

  return (
    <div className="min-vh-100 bg-light">
      {/* Header - Bootstrap Navbar */}
      <nav className="navbar navbar-expand-lg bg-white border-bottom shadow-sm sticky-top">
        <div className="container">
          <span className="navbar-brand fw-bold fs-4">💰 รายรับรายจ่าย</span>
          <div className="d-flex align-items-center gap-2 flex-wrap ms-auto">
            <input type="month" value={month} onChange={(e)=>setMonth(e.target.value)} className="form-control form-control-sm" style={{width: 160}} />
            <select value={filterType} onChange={(e)=>setFilterType(e.target.value as never)} className="form-select form-select-sm" style={{width: 140}}>
              <option value="all">ทั้งหมด</option>
              <option value="income">รายรับ</option>
              <option value="expense">รายจ่าย</option>
            </select>
            <span className="small text-muted d-none d-sm-inline">{user?.name || user?.email}</span>
            <button onClick={handleLogout} className="btn btn-outline-secondary btn-sm">ออก</button>
          </div>
        </div>
      </nav>

      <div className="container py-4">
        {/* Summary Cards - Bootstrap Row */}
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-muted small">รายรับเดือนนี้</div>
                <div className="fs-4 fw-bold text-success">฿ {fmt(summary.income)}</div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-muted small">รายจ่ายเดือนนี้</div>
                <div className="fs-4 fw-bold text-danger">฿ {fmt(summary.expense)}</div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className={`card shadow-sm h-100 ${summary.balance >=0 ? "bg-success bg-opacity-10 border-success" : "bg-danger bg-opacity-10 border-danger"}`}>
              <div className="card-body">
                <div className="text-muted small">คงเหลือ</div>
                <div className={`fs-4 fw-bold ${summary.balance>=0? "text-success":"text-danger"}`}>฿ {fmt(summary.balance)}</div>
                <div className="small text-muted">{summary.balance>=0 ? "ออมได้ดี 👍" : "ใช้จ่ายเกินรายรับ ⚠️"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          {/* Form */}
          <div className="col-lg-4">
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <h5 className="card-title fw-semibold">{editingId ? "✏️ แก้ไขรายการ" : "➕ เพิ่มรายการใหม่"}</h5>
                <form onSubmit={handleSubmit}>
                  <div className="btn-group w-100 mb-3" role="group">
                    <button type="button" onClick={()=>setType("expense")} className={`btn ${type==="expense"?"btn-danger":"btn-outline-danger"}`}>รายจ่าย</button>
                    <button type="button" onClick={()=>setType("income")} className={`btn ${type==="income"?"btn-success":"btn-outline-success"}`}>รายรับ</button>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-medium">จำนวนเงิน (บาท)</label>
                    <input type="number" step="0.01" value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0.00" className="form-control form-control-lg" required />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-medium">หมวดหมู่</label>
                    <select value={categoryName} onChange={(e)=>setCategoryName(e.target.value)} className="form-select">
                      {filteredCats.map((c)=>(<option key={c.id} value={c.name}>{c.icon} {c.name}</option>))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-medium">วันที่</label>
                    <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="form-control" required />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-medium">หมายเหตุ</label>
                    <input type="text" value={note} onChange={(e)=>setNote(e.target.value)} placeholder="เช่น ค่ากาแฟ, เงินเดือน" className="form-control" />
                  </div>

                  <button type="submit" disabled={submitting || categories.length===0} className={`btn w-100 btn-lg fw-semibold ${type==="income"?"btn-success":"btn-danger"}`}>
                    {submitting ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "บันทึกรายการ"}
                  </button>
                  {categories.length===0 && <div className="text-warning small text-center mt-2">กำลังโหลดหมวดหมู่...</div>}
                  {editingId && <button type="button" onClick={()=>{setEditingId(null); setAmount(""); setNote("");}} className="btn btn-outline-secondary w-100 mt-2">ยกเลิก</button>}
                </form>
              </div>
            </div>
          </div>

          {/* Chart + List */}
          <div className="col-lg-8">
            <div className="card shadow-sm border-0 mb-4">
              <div className="card-body">
                <h6 className="card-title fw-semibold">สัดส่วนรายจ่ายตามหมวดหมู่</h6>
                {Object.keys(byCategory).length===0 ? (
                  <p className="text-muted small text-center py-4">ยังไม่มีข้อมูลรายจ่ายเดือนนี้</p>
                ) : (
                  <div style={{maxWidth: 360}} className="mx-auto">
                    <canvas ref={chartRef} />
                  </div>
                )}
              </div>
            </div>

            <div className="card shadow-sm border-0">
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-semibold">ประวัติรายการ ({transactions.length})</h6>
                <span className="small text-muted">{loading ? "กำลังโหลด..." : `เดือน ${month}`}</span>
              </div>
              <div className="list-group list-group-flush" style={{maxHeight: 520, overflowY: "auto"}}>
                {transactions.length===0 ? (
                  <div className="text-center text-muted small py-5">ยังไม่มีรายการ</div>
                ) : transactions.map((tx)=>{
                  const cat = categories.find(c=>c.name===tx.categoryName);
                  return (
                    <div key={tx.id} className="list-group-item d-flex align-items-center gap-3">
                      <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{width: 40, height: 40, background: (cat?.color || "#6366f1")+"20", border: `1px solid ${cat?.color || "#6366f1"}`}}>
                        <span>{cat?.icon || (tx.type==="income"?"💵":"💸")}</span>
                      </div>
                      <div className="flex-grow-1 text-truncate">
                        <div className="fw-medium small text-truncate">{tx.categoryName} <span className="fw-normal text-muted">• {new Date(tx.date).toLocaleDateString("th-TH")}</span></div>
                        <div className="small text-muted text-truncate">{tx.note || "-"}</div>
                      </div>
                      <div className="text-end">
                        <div className={`fw-bold ${tx.type==="income"?"text-success":"text-danger"}`}>{tx.type==="income"?"+":"-"}฿ {fmt(tx.amount)}</div>
                        <div className="btn-group btn-group-sm mt-1">
                          <button onClick={()=>handleEdit(tx)} className="btn btn-light btn-sm">แก้ไข</button>
                          <button onClick={()=>handleDelete(tx.id)} className="btn btn-outline-danger btn-sm">ลบ</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer help */}
        <div className="alert alert-primary mt-4" role="alert">
          <h6 className="alert-heading fw-semibold">💡 วิธีใช้งาน</h6>
          <ul className="mb-0 small">
            <li>เลือกเดือนที่มุมขวาบนเพื่อดูสรุปย้อนหลัง</li>
            <li>กราฟจะสรุปเฉพาะรายจ่ายเพื่อให้เห็นว่าใช้เงินไปกับอะไรเยอะสุด</li>
            <li>ข้อมูลแยกตามผู้ใช้ (ใช้ Postgres บน Vercel)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
