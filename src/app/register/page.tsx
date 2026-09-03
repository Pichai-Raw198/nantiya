"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "สมัครไม่สำเร็จ");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">
        <h1 className="text-2xl font-bold text-center mb-2">📝 สมัครสมาชิก</h1>
        <p className="text-sm text-zinc-500 text-center mb-6">สร้างบัญชีเพื่อเริ่มใช้งาน</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">ชื่อ (ไม่บังคับ)</label>
            <input type="text" value={name} onChange={(e)=>setName(e.target.value)} className="w-full mt-1 border border-zinc-300 rounded-xl px-3 py-2.5" placeholder="สมชาย" />
          </div>
          <div>
            <label className="text-sm font-medium">อีเมล</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required className="w-full mt-1 border border-zinc-300 rounded-xl px-3 py-2.5" placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-sm font-medium">รหัสผ่าน (≥6 ตัว)</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required className="w-full mt-1 border border-zinc-300 rounded-xl px-3 py-2.5" placeholder="••••••" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
            {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
          </button>
        </form>
        <p className="text-sm text-center mt-4 text-zinc-600">
          มีบัญชีแล้ว? <Link href="/login" className="text-emerald-600 font-medium hover:underline">เข้าสู่ระบบ</Link>
        </p>
      </div>
    </div>
  );
}
