const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const redis = require('./redis'); 

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// 1. TẤM KHIÊN CHỐNG SPAM (RATE LIMIT)
// ==========================================
async function rateLimitMiddleware(req, res, next) {
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
// 2. KHỞI TẠO SQLITE DATABASE
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
      UNIQUE(studentId, courseCode)
    )
  `);
});

// ==========================================
// 3. DANH SÁCH 5 API CỐT LÕI
// ==========================================

// API 1: Đăng nhập
app.post('/api/login', (req, res) => {
  const { studentId } = req.body;
  if (!studentId || studentId.trim() === '') {
    return res.status(400).json({ status: 'error', message: '⚠️ Vui lòng nhập Mã sinh viên!' });
  }
  return res.status(200).json({ status: 'success', studentId });
});

// API 2: Lấy danh sách môn đang mở (Đã tích hợp lấy sĩ số thật từ Redis)
app.get('/api/courses', (req, res) => {
  db.all("SELECT * FROM courses", [], async (err, courses) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });
    try {
      const coursesWithRealtimeSlots = [];
      for (let course of courses) {
        const availableSlots = await redis.get(`course:${course.course_code}:slots`);
        if (availableSlots !== null) {
           course.current_slots = course.max_slots - parseInt(availableSlots);
        }
        coursesWithRealtimeSlots.push(course);
      }
      res.json({ status: 'success', data: coursesWithRealtimeSlots });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Lỗi lấy sĩ số từ Redis!' });
    }
  });
});

// API 3: Lấy danh sách môn học của riêng 1 sinh viên (Trí nhớ của hệ thống)
app.get('/api/my-courses/:studentId', (req, res) => {
  const { studentId } = req.params;
  db.all("SELECT * FROM courses", [], async (err, courses) => {
    if (err) return res.status(500).json({ status: 'error' });
    try {
      const myCourses = [];
      for (let course of courses) {
        const isRegistered = await redis.sismember(`course:${course.course_code}:registered`, studentId);
        if (isRegistered === 1) myCourses.push(course);
      }
      res.json({ status: 'success', data: myCourses });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Lỗi đồng bộ Redis' });
    }
  });
});

// API 4: Đăng ký môn học (Bắn vào Lua Script)
app.post('/api/register-course', rateLimitMiddleware, async (req, res) => {
  const { studentId, courseCode } = req.body;
  if (!studentId || !courseCode) {
    return res.status(400).json({ status: 'error', message: "Thiếu mã sinh viên hoặc mã môn học!" });
  }

  const slotsKey = `course:${courseCode}:slots`;
  const registeredKey = `course:${courseCode}:registered`;

  try {
    const result = await redis.registerCourse(slotsKey, registeredKey, studentId);
    if (result === -1) return res.status(400).json({ status: 'error', message: "❌ Bạn đã đăng ký môn này rồi!" });
    if (result === 0) return res.status(400).json({ status: 'error', message: "😭 Môn học đã hết chỗ!" });
    if (result === 1) return res.status(200).json({ status: 'success', message: "🎉 Đăng ký thành công!" });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: "Lỗi hệ thống Redis!" });
  }
});

// API 5: Hủy đăng ký môn học (CHÍNH LÀ CHỖ BỊ MẤT GÂY RA LỖI HTML)
app.post('/api/cancel-course', async (req, res) => {
  const { studentId, courseCode } = req.body;
  const slotsKey = `course:${courseCode}:slots`;
  const registeredKey = `course:${courseCode}:registered`;

  try {
    const isRegistered = await redis.sismember(registeredKey, studentId);
    if (isRegistered === 0) {
      return res.status(400).json({ status: 'error', message: 'Bạn chưa đăng ký môn này!' });
    }

    await redis.srem(registeredKey, studentId);
    await redis.incr(slotsKey);
    res.json({ status: 'success', message: `Đã hủy môn ${courseCode} và hoàn lại 1 slot thành công!` });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Lỗi server Redis!' });
  }
});

// ==========================================
// 4. KÍCH HOẠT SERVER
// ==========================================
app.listen(port, () => {
  console.log(`🚀 Server đang chạy tại địa chỉ: http://localhost:${port}`);
});