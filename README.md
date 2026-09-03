# Expense Tracker - รายรับรายจ่าย

## รันในเครื่อง
```powershell
cd "C:\Users\PICHAI\Documents\Default Project\expense-tracker"
npm run dev
# เปิด http://localhost:3000 -> จะเด้งไป /login
```
- สมัครสมาชิกที่ `/register` แล้ว login
- ข้อมูลเก็บใน `prisma/dev.db` (SQLite)

## Deploy ขึ้นเน็ต (Vercel)

### วิธีที่ 1: ผ่าน Vercel Dashboard (แนะนำ)
1. สร้าง repo GitHub: `git init`, `git add .`, `git commit -m "init"`, push ขึ้น GitHub
2. ไป https://vercel.com/new → Import Git Repository
3. ตั้ง Environment Variables ใน Vercel:
   - `DATABASE_URL` = `file:/tmp/dev.db` (SQLite แบบชั่วคราว) หรือ Postgres จาก Neon/Supabase เช่น `postgresql://user:pass@host/db?sslmode=require`
   - `JWT_SECRET` = สุ่ม 32 ตัวอักษร เช่น `openssl rand -hex 32`
4. Deploy → จะได้ลิงก์ `https://your-app.vercel.app`

> หมายเหตุ: SQLite บน Vercel จะหายเมื่อ redeploy (เพราะ `/tmp` ไม่ถาวร) ถ้าอยากเก็บถาวรให้ใช้ Postgres:
> - สร้างฟรีที่ https://neon.tech หรือ https://supabase.com
> - เอา connection string มาใส่ `DATABASE_URL`
> - แก้ `prisma/schema.prisma` provider เป็น `postgresql` แล้ว `npx prisma migrate deploy`

### วิธีที่ 2: ผ่าน CLI
```powershell
npm i -g vercel
vercel login
vercel --prod
# ตั้ง env: vercel env add DATABASE_URL, vercel env add JWT_SECRET
```

## โครงสร้าง
- `src/app/page.tsx` - Dashboard + กราฟ
- `src/app/login`, `src/app/register` - Auth
- `src/app/api/auth/*` - login/register/logout/me
- `src/app/api/transactions` - CRUD แบบ user แยกกัน
- `prisma/schema.prisma` - User, Category, Transaction
