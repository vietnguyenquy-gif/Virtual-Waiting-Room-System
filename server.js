const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const redis = require('./redis'); // BỔ SUNG: Gọi anh bảo vệ Redis vào làm việc!

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// 1. MIDDLEWARE: TẤM KHIÊN CHỐNG SPAM CLICK
// ==========================================
async function rateLimitMiddleware(req, res, next) {
  // Đồng bộ tên biến với Frontend: dùng studentId thay vì student_id
  const { studentId } = req.body; 
  
  if (!studentId) return next();

  const limitKey = `ratelimit:${studentId}`;

  try {
    const currentRequests = await redis.incr(limitKey);
    if (currentRequests === 1) await redis.expire(limitKey, 1);

    if (currentRequests > 3) {
      return res.status(429).json({
        status: 'error',
        message: "⚠️ Thao tác quá nhanh! Hệ thống nghi ngờ bạn dùng tool."
      });
    }
    next();
  } catch (error) {
    console.error("Lỗi Rate Limit:", error);
    next();
  }
} 

// ==========================================
// 2. KẾT NỐI VÀ KHỞI TẠO SQLITE
// ==========================================
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error('❌ Lỗi kết nối Database:', err.message);
  else console.log('⚡ Đã kết nối thành công tới Database SQLite!');
});

db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL;');

  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_code TEXT UNIQUE NOT NULL,
      course_name TEXT NOT NULL,
      max_slots INTEGER NOT NULL,
      current_slots INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS student_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId TEXT NOT NULL,
      courseCode TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(studentId, courseCode) -- Chặn trùng lặp tầng Database
    )
  `);
});

// ==========================================
// 3. DANH SÁCH API ENDPOINTS
// ==========================================

// API 1: Đăng nhập
app.post('/api/login', (req, res) => {
  const { studentId } = req.body;
  if (!studentId || studentId.trim() === '') {
    return res.status(400).json({ status: 'error', message: '⚠️ Vui lòng nhập Mã sinh viên!' });
  }
  return res.status(200).json({ status: 'success', studentId });
});

// API 2: Lấy danh sách môn học hiển thị ra Web
app.get('/api/courses', (req, res) => {
  db.all("SELECT * FROM courses", [], (err, rows) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });
    res.json({ status: 'success', data: rows });
  });
});

// API 3: ĐĂNG KÝ MÔN HỌC (ĐÃ CHẠY HOÀN TOÀN TRÊN REDIS)
app.post('/api/register-course', rateLimitMiddleware, async (req, res) => {
  // Lấy dữ liệu từ Frontend gửi lên (camelCase)
  const { studentId, courseCode } = req.body;

  if (!studentId || !courseCode) {
    return res.status(400).json({ status: 'error', message: "Thiếu mã sinh viên hoặc mã môn học!" });
  }

  // Khớp với định dạng key lúc Warm-up
  const slotsKey = `course:${courseCode}:slots`;
  const registeredKey = `course:${courseCode}:registered`;

  try {
    // ⚔️ GỌI LUA SCRIPT NGUYÊN TỬ TỪ REDIS
    const result = await redis.registerCourse(slotsKey, registeredKey, studentId);

    if (result === -1) {
      return res.status(400).json({ status: 'error', message: "❌ Bạn đã đăng ký môn này rồi!" });
    }
    
    if (result === 0) {
      return res.status(400).json({ status: 'error', message: " Môn học đã đủ!" });
    }

    if (result === 1) {
      // Thành công trên RAM!
      return res.status(200).json({ status: 'success', message: "🎉 Đăng ký thành công !" });
    }

  } catch (error) {
    console.error("Lỗi server Redis:", error);
    return res.status(500).json({ status: 'error', message: "Lỗi hệ thống!" });
  }
});

// ==========================================
// 4. CHẠY SERVER
// ==========================================
app.listen(port, () => {
  console.log(`🚀 Server đang chạy tại địa chỉ: http://localhost:${port}`);
});