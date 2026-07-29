const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
let registeredCourses = []; // Mảng lưu trữ các môn học đã đăng ký (BỔ SUNG MỚI)
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Kết nối Database
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error('❌ Lỗi kết nối Database:', err.message);
  else console.log('⚡ Đã kết nối thành công tới Database SQLite!');
});

// Khởi tạo Database & Dữ liệu mẫu
db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL;');

  // Bảng lưu danh sách môn học (BỔ SUNG MỚI)
  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_code TEXT UNIQUE NOT NULL,
      course_name TEXT NOT NULL,
      max_slots INTEGER NOT NULL,
      current_slots INTEGER DEFAULT 0
    )
  `);

  // Bảng lưu lịch sử đăng ký của sinh viên
  db.run(`
    CREATE TABLE IF NOT EXISTS student_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId TEXT NOT NULL,
      courseCode TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tự động thêm 3 môn học mẫu nếu bảng courses đang trống
  db.get("SELECT COUNT(*) as count FROM courses", (err, row) => {
    if (row && row.count === 0) {
      const insert = db.prepare("INSERT INTO courses (course_code, course_name, max_slots) VALUES (?, ?, ?)");
      insert.run('IT101', 'Cấu trúc dữ liệu & Giải thuật', 2); // Chỉ cho 2 slot để test lớp đầy!
      insert.run('IT102', 'Cơ sở dữ liệu', 50);
      insert.run('IT103', 'Trí tuệ nhân tạo', 30);
      insert.run('IT104', 'Mang máy tính', 40);
      insert.run('IT105', 'Lập trình Web', 100);
      insert.finalize();
      console.log('📚 Đã tạo 5 môn học mẫu thành công!');
    }
  });
});

// API 1: Đăng nhập
app.post('/api/login', (req, res) => {
  const { studentId } = req.body;
  if (!studentId || studentId.trim() === '') {
    return res.status(400).json({ status: 'error', message: '⚠️ Vui lòng nhập Mã sinh viên!' });
  }
  return res.status(200).json({ status: 'success', studentId });
});

// API 2: Lấy danh sách môn học (BỔ SUNG MỚI CHO GIAI ĐOẠN 1)
app.get('/api/courses', (req, res) => {
  db.all("SELECT * FROM courses", [], (err, rows) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });
    res.json({ status: 'success', data: rows });
  });
});

// API 3: Đăng ký môn học (ĐÃ NÂNG CẤP LOGIC KIỂM TRA)
app.post('/api/register-course', (req, res) => {
  const { studentId, courseCode } = req.body;

  if (!studentId || !courseCode) {
    return res.status(400).json({ status: 'error', message: '⚠️ Thiếu thông tin sinh viên hoặc mã môn!' });
  }

  // BƯỚC 1: Kiểm tra xem môn học có tồn tại và còn slot không
  db.get("SELECT * FROM courses WHERE course_code = ?", [courseCode], (err, course) => {
    if (err) return res.status(500).json({ status: 'error', message: 'Lỗi Database!' });
    if (!course) return res.status(404).json({ status: 'error', message: '❌ Môn học không tồn tại!' });

    // Kiểm tra lớp đầy
    if (course.current_slots >= course.max_slots) {
      return res.status(400).json({ status: 'error', message: `⚠️ Lớp [${course.course_name}] đã ĐẦY SĨ SỐ!` });
    }

    // BƯỚC 2: Kiểm tra sinh viên đã đăng ký môn này chưa (Chặn đăng ký trùng)
    db.get("SELECT * FROM student_registrations WHERE studentId = ? AND courseCode = ?", [studentId, courseCode], (err, reg) => {
      if (reg) {
        return res.status(400).json({ status: 'error', message: '⚠️ Bạn đã đăng ký môn này rồi!' });
      }

      // BƯỚC 3: Thỏa mãn hết -> Tăng sĩ số + Lưu lịch sử đăng ký
      db.run("UPDATE courses SET current_slots = current_slots + 1 WHERE course_code = ?", [courseCode], (err) => {
        if (err) return res.status(500).json({ status: 'error', message: 'Lỗi cập nhật sĩ số!' });

        db.run("INSERT INTO student_registrations (studentId, courseCode) VALUES (?, ?)", [studentId, courseCode], function(err) {
          if (err) return res.status(500).json({ status: 'error', message: 'Lỗi lưu lịch sử!' });
          
          console.log(`✅ [MSV: ${studentId}] đăng ký thành công môn [${courseCode}]`);
          return res.status(200).json({ status: 'success', message: `🎉 Đăng ký thành công môn: ${course.course_name}!` });
        });
      });
    });
  });
});

app.listen(port, () => {
  console.log(`🚀 Server đang chạy tại địa chỉ: http://localhost:${port}`);
});