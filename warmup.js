const sqlite3 = require('sqlite3').verbose();
const redis = require('./redis'); // Gọi anh bảo vệ Redis của bạn

// 1. Kết nối vào Database SQLite hiện tại của bạn
const db = new sqlite3.Database('./database.db');

async function warmupCourseCache() {
  console.log("🚀 BẮT ĐẦU: Đọc dữ liệu từ SQLite...");

  // 2. Lấy danh sách môn học và tính số slot còn trống
  const query = "SELECT course_code, course_name, max_slots, current_slots FROM courses";
  
  db.all(query, [], async (err, courses) => {
    if (err) {
      console.error("❌ Lỗi truy vấn SQLite:", err);
      return;
    }

    if (courses.length === 0) {
      console.log("⚠️ Bảng courses trống trơn, không có gì để nạp!");
      return;
    }

    try {
      // 3. Khởi tạo Pipeline (Đóng gói hàng loạt để gửi đi 1 lần)
      const pipeline = redis.pipeline();

      courses.forEach(course => {
        // Tính toán: Ví dụ max 50, đã đăng ký 5 -> available = 45
        const availableSlots = course.max_slots - course.current_slots;
        
        // Quy tắc đặt tên key cực quan trọng: course:MÃ_MÔN:slots
        const redisKey = `course:${course.course_code}:slots`;

        // Đưa gói hàng vào xe tải Pipeline
        pipeline.set(redisKey, availableSlots);

        console.log(`👉 Sẵn sàng nạp: [${course.course_code}] ${course.course_name} -> ${availableSlots} slot`);
      });

      console.log("🚚 Đang gửi toàn bộ xe tải Pipeline lên Redis RAM...");
      
      // 4. Kích hoạt gửi 1 lần duy nhất!
      await pipeline.exec();
      
      console.log(`🎉 THÀNH CÔNG! Đã đẩy ${courses.length} môn học lên RAM an toàn.`);

    } catch (error) {
      console.error("❌ Lỗi khi nạp lên Redis:", error);
    } finally {
      // Đóng cửa các kết nối để Terminal tự thoát
      redis.quit();
      db.close();
    }
  });
}

// Chạy hàm
warmupCourseCache();