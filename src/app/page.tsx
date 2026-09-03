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
    // update category default when type changes
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
    // map colors from categories
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

    // ensure categoryName belongs to selected type, fallback to first of type
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
    return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]"><p className="text-zinc-500">กำลังตรวจสอบสิทธิ์...</p></div>;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-zinc-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap gap-3 items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">💰 รายรับรายจ่าย</h1>
          <div className="flex gap-2 items-center">
            <input type="month" value={month} onChange={(e)=>setMonth(e.target.value)} className="border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white" />
            <select value={filterType} onChange={(e)=>setFilterType(e.target.value as never)} className="border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="all">ทั้งหมด</option>
              <option value="income">รายรับ</option>
              <option value="expense">รายจ่าย</option>
            </select>
            <span className="text-sm text-zinc-600 hidden sm:inline">{user?.name || user?.email}</span>
            <button onClick={handleLogout} className="text-sm px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 border">ออก</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-100">
            <p className="text-sm text-zinc-500">รายรับเดือนนี้</p>
            <p className="text-2xl font-bold text-emerald-600">฿ {fmt(summary.income)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-100">
            <p className="text-sm text-zinc-500">รายจ่ายเดือนนี้</p>
            <p className="text-2xl font-bold text-red-500">฿ {fmt(summary.expense)}</p>
          </div>
          <div className={`rounded-2xl p-5 shadow-sm border ${summary.balance >=0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
            <p className="text-sm text-zinc-500">คงเหลือ</p>
            <p className={`text-2xl font-bold ${summary.balance>=0? "text-emerald-700":"text-red-600"}`}>฿ {fmt(summary.balance)}</p>
            <p className="text-xs text-zinc-500 mt-1">{summary.balance>=0 ? "ออมได้ดี 👍" : "ใช้จ่ายเกินรายรับ ⚠️"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-zinc-100 h-fit">
            <h2 className="font-semibold text-lg mb-4">{editingId ? "✏️ แก้ไขรายการ" : "➕ เพิ่มรายการใหม่"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={()=>setType("expense")} className={`flex-1 py-2.5 rounded-xl font-medium border ${type==="expense"?"bg-red-500 text-white border-red-500":"bg-white border-zinc-300"}`}>รายจ่าย</button>
                <button type="button" onClick={()=>setType("income")} className={`flex-1 py-2.5 rounded-xl font-medium border ${type==="income"?"bg-emerald-500 text-white border-emerald-500":"bg-white border-zinc-300"}`}>รายรับ</button>
              </div>

              <div>
                <label className="text-sm font-medium">จำนวนเงิน (บาท)</label>
                <input type="number" step="0.01" value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0.00" className="w-full mt-1 border border-zinc-300 rounded-xl px-3 py-2.5 text-lg" required />
              </div>

              <div>
                <label className="text-sm font-medium">หมวดหมู่</label>
                <select value={categoryName} onChange={(e)=>setCategoryName(e.target.value)} className="w-full mt-1 border border-zinc-300 rounded-xl px-3 py-2.5 bg-white">
                  {filteredCats.map((c)=>(<option key={c.id} value={c.name}>{c.icon} {c.name}</option>))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">วันที่</label>
                <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-full mt-1 border border-zinc-300 rounded-xl px-3 py-2.5" required />
              </div>

              <div>
                <label className="text-sm font-medium">หมายเหตุ</label>
                <input type="text" value={note} onChange={(e)=>setNote(e.target.value)} placeholder="เช่น ค่ากาแฟ, เงินเดือน" className="w-full mt-1 border border-zinc-300 rounded-xl px-3 py-2.5" />
              </div>

              <button type="submit" disabled={submitting || categories.length===0} className={`w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed ${type==="income"?"bg-emerald-600 hover:bg-emerald-700":"bg-red-500 hover:bg-red-600"} transition`}>
                {submitting ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "บันทึกรายการ"}
              </button>
              {categories.length===0 && <p className="text-xs text-amber-600 text-center">กำลังโหลดหมวดหมู่...</p>}
              {editingId && <button type="button" onClick={()=>{setEditingId(null); setAmount(""); setNote("");}} className="w-full py-2.5 rounded-xl border border-zinc-300 bg-white">ยกเลิก</button>}
            </form>
          </div>

          {/* Chart + List */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
              <h3 className="font-semibold mb-3">สัดส่วนรายจ่ายตามหมวดหมู่</h3>
              {Object.keys(byCategory).length===0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">ยังไม่มีข้อมูลรายจ่ายเดือนนี้</p>
              ) : (
                <div className="max-w-[360px] mx-auto">
                  <canvas ref={chartRef} />
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
              <div className="p-4 flex justify-between items-center">
                <h3 className="font-semibold">ประวัติรายการ ({transactions.length})</h3>
                <span className="text-xs text-zinc-500">{loading ? "กำลังโหลด..." : `เดือน ${month}`}</span>
              </div>
              <div className="divide-y divide-zinc-100 max-h-[520px] overflow-auto">
                {transactions.length===0 ? (
                  <p className="text-center text-sm text-zinc-500 py-10">ยังไม่มีรายการ</p>
                ) : transactions.map((tx)=>{
                  const cat = categories.find(c=>c.name===tx.categoryName);
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0" style={{background: cat?.color + "20", border: `1px solid ${cat?.color}`}}>
                        {cat?.icon || (tx.type==="income"?"💵":"💸")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{tx.categoryName} <span className="font-normal text-zinc-500">• {new Date(tx.date).toLocaleDateString("th-TH")}</span></p>
                        <p className="text-xs text-zinc-500 truncate">{tx.note || "-"}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${tx.type==="income"?"text-emerald-600":"text-red-600"}`}>{tx.type==="income"?"+":"-"}฿ {fmt(tx.amount)}</p>
                        <div className="flex gap-1 justify-end mt-1">
                          <button onClick={()=>handleEdit(tx)} className="text-xs px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200">แก้ไข</button>
                          <button onClick={()=>handleDelete(tx.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">ลบ</button>
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
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900">
          <p className="font-semibold">💡 วิธีใช้งาน</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>เลือกเดือนที่มุมขวาบนเพื่อดูสรุปย้อนหลัง</li>
            <li>กราฟจะสรุปเฉพาะรายจ่ายเพื่อให้เห็นว่าใช้เงินไปกับอะไรเยอะสุด</li>
            <li>ข้อมูลเก็บใน SQLite (ไฟล์ <code>prisma/dev.db</code>) พร้อม Deploy ขึ้น Vercel/Supabase ได้</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
