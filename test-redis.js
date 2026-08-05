const redis = require('./redis');

async function testConnection() {
  try {
    console.log("Đang thử ghi dữ liệu vào Redis RAM...");
    
    // 1. Lệnh SET: Ghi thử một cặp Key-Value
    await redis.set("test_key", "Hello, sức mạnh của RAM!");
    
    // 2. Lệnh GET: Đọc dữ liệu đó ra
    const value = await redis.get("test_key");
    
    console.log("👉 Kết quả đọc ra:", value);
    
    if (value === "Hello, sức mạnh của RAM!") {
      console.log("🎉 THÀNH CÔNG! Node.js đã kết nối và ghi/đọc Redis mượt mà!");
    }

  } catch (error) {
    console.error("❌ Căng rồi, có lỗi xảy ra:", error);
  } finally {
    // 3. Đóng kết nối để giải phóng tài nguyên và thoát terminal
    redis.quit();
  }
}

// Chạy hàm
testConnection();