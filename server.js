const express = require('express');
const cors = require('cors'); // 1. Khai báo thư viện CORS
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3000;

// 2. Cho phép Frontend gọi API (CORS) & đọc dữ liệu JSON
app.use(cors());
app.use(express.json());

// Kết nối Database SQLite
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('❌ Lỗi kết nối Database:', err.message);
    } else {
        console.log('⚡ Đã kết nối thành công tới Database SQLite!');
    }
});

// Tạo bảng lưu danh sách Sinh viên đăng ký môn học
db.run(`
    CREATE TABLE IF NOT EXISTS student_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        studentId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// 3. API Nhận request Đăng ký môn học từ Frontend
app.post('/api/register-course', (req, res) => {
    const { studentId } = req.body; // Lấy studentId từ Frontend gửi lên

    if (!studentId) {
        return res.status(400).json({ status: 'error', message: '⚠️ Vui lòng nhập Mã sinh viên!' });
    }

    // Lưu vào bảng student_registrations trong Database
    const sql = `INSERT INTO student_registrations (studentId) VALUES (?)`;

    db.run(sql, [studentId], function (err) {
        if (err) {
            console.error('❌ Lỗi lưu dữ liệu:', err.message);
            return res.status(500).json({ status: 'error', message: 'Lỗi lưu vào Database' });
        }

        console.log(`✅ Sinh viên [${studentId}] đăng ký môn học thành công! ID: ${this.lastID}`);
        return res.json({ 
            status: 'success', 
            message: `🎉 Đăng ký môn học thành công cho Sinh viên: ${studentId}!` 
        });
    });
});

app.listen(port, () => {
    console.log(`🚀 Server đang chạy tại địa chỉ: http://localhost:${port}`);
});