const redis = require('./redis');

async function cleanRedis() {
  console.log("🧹 Đang dọn dẹp toàn bộ rác trong Redis...");
  await redis.flushall(); // Lệnh này sẽ xóa sạch sành sanh mọi dữ liệu trên Redis
  console.log("✨ Xong! Redis đã sạch bóng. Sẵn sàng nạp dữ liệu chuẩn.");
  process.exit();
}

cleanRedis();