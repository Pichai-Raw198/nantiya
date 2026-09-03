@echo off
set "PATH=%PATH%;C:\Program Files\nodejs"
cd /d "%~dp0"
echo === Expense Tracker ===
echo Starting server at http://localhost:3000
echo ถ้าเห็น "Ready in" คือสำเร็จ ห้ามปิดหน้าต่างนี้
echo เปิด Chrome ไปที่ http://localhost:3000
echo.
where node
call node -v
call npm -v
echo.
call npm run dev
pause
