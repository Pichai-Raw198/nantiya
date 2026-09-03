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
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
      <div className="card shadow-sm border-0" style={{ maxWidth: 440, width: "100%" }}>
        <div className="card-body p-4 p-md-5">
          <h1 className="h4 fw-bold text-center mb-1">📝 สมัครสมาชิก</h1>
          <p className="text-muted text-center small mb-4">สร้างบัญชีเพื่อเริ่มใช้งาน</p>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small fw-medium">ชื่อ (ไม่บังคับ)</label>
              <input type="text" value={name} onChange={(e)=>setName(e.target.value)} className="form-control form-control-lg" placeholder="สมชาย" />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-medium">อีเมล</label>
              <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required className="form-control form-control-lg" placeholder="you@example.com" />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-medium">รหัสผ่าน (≥6 ตัว)</label>
              <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required className="form-control form-control-lg" placeholder="••••••" />
            </div>
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-success btn-lg w-100 fw-semibold">
              {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
            </button>
          </form>
          <p className="text-center small mt-4 mb-0 text-muted">
            มีบัญชีแล้ว? <Link href="/login" className="text-success fw-medium text-decoration-none">เข้าสู่ระบบ</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
