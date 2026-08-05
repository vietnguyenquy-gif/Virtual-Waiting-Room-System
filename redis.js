const Redis = require('ioredis');
const redis = new Redis({
    host: '127.0.0.1',
    port: 6379,
    retryStrategy: (times) => {
        if (times > 3) {
            console.error('❌ Redis connection failed after 3 attempts.');
            return null;

        }
        return Math.min(times * 200, 1000);
    }
});
redis.on('connect', () => {
    console.log("✅ Connected to Redis server successfully!");

});
redis.on('error',(err) => {
    console.error('❌ Redis connection error:', err);
});
// ... (các code kết nối cũ giữ nguyên)

// ĐỊNH NGHĨA LUA SCRIPT XỬ LÝ NGUYÊN TỬ (ATOMIC)
const REGISTRATION_SCRIPT = `
  local slots_key = KEYS[1]
  local registered_key = KEYS[2]
  local student_id = ARGV[1]

  -- 1. Kiểm tra sinh viên đã đăng ký môn này chưa (Sử dụng Set để kiểm tra)
  if redis.call("SISMEMBER", registered_key, student_id) == 1 then
    return -1 -- Trả về -1 nghĩa là: Đã đăng ký rồi
  end

  -- 2. Đọc số slot còn lại
  local slots = tonumber(redis.call("GET", slots_key) or "0")
  if slots <= 0 then
    return 0 -- Trả về 0 nghĩa là: Hết slot
  end

  -- 3. Đủ điều kiện: Trừ 1 slot và Ghi danh sinh viên vào Set
  redis.call("DECR", slots_key)
  redis.call("SADD", registered_key, student_id)
  
  return 1 -- Trả về 1 nghĩa là: Đăng ký thành công
`;

// Gắn script này vào ioredis thành một hàm có tên là "registerCourse"
redis.defineCommand("registerCourse", {
  numberOfKeys: 2,
  lua: REGISTRATION_SCRIPT,
});
module.exports = redis;
