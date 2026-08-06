 let registeredCourses = [];
const courseCatalog = {
    'IT101': 'Cấu trúc dữ liệu & Giải thuật',
    'IT102': 'Cơ sở dữ liệu',
    'IT103': 'Trí tuệ nhân tạo',
    'IT104': 'Mạng máy tính',
    'IT105': 'Lập trình Web'
};

// ==========================================
// 1. CÁC HÀM TẢI DỮ LIỆU TỪ MÁY CHỦ
// ==========================================

// Tải bảng môn học đang mở (Top Table)
async function loadAvailableCourses() {
    try {
        const res = await fetch('http://localhost:3000/api/courses');
        const data = await res.json();
        const tbody = document.getElementById('courseTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        data.data.forEach(c => {
            const isFull = c.current_slots >= c.max_slots;
            const badgeClass = isFull ? 'bg-danger' : 'bg-success'; // Đảm bảo CSS của bạn có class này
            tbody.innerHTML += `
                <tr>
                    <td><strong>${c.course_code}</strong></td>
                    <td>${c.course_name}</td>
                    <td><span class="badge ${badgeClass}">${c.current_slots} / ${c.max_slots}</span></td>
                    <td><a href="#" onclick="fillCourse('${c.course_code}')" style="color:blue;">Chọn</a></td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Lỗi tải môn học:", err);
    }
}

// Tải bảng môn học đã đăng ký của riêng mình (Bottom Table)
function fetchMyCourses(studentId) {
    fetch(`http://localhost:3000/api/my-courses/${studentId}`)
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            registeredCourses = data.data.map(c => ({ id: c.course_code, name: c.course_name }));
            renderRegisteredCourses(); 
        }
    })
    .catch(err => console.error("Lỗi đồng bộ dữ liệu:", err));
}

// ==========================================
// 2. CÁC HÀM VẼ GIAO DIỆN (RENDER)
// ==========================================

function renderRegisteredCourses() {
    const card = document.getElementById('my-registered-card');
    if (card) card.style.display = 'block';

    const listContainer = document.getElementById('registered-list');
    const totalSpan = document.getElementById('total-registered');
    if (!listContainer || !totalSpan) return;

    listContainer.innerHTML = '';
    totalSpan.innerText = registeredCourses.length;
    
    if (registeredCourses.length === 0) {
        listContainer.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#888;">Chưa có môn học nào được đăng ký</td></tr>';
        return;
    }

    registeredCourses.forEach(course => {
        const rowHTML = `
            <tr>
                <td><b>${course.id}</b></td>
                <td>${course.name}</td>
                <td>
                    <button onclick="cancelCourse('${course.id}')" style="background:#dc3545; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">Hủy</button>
                </td>
            </tr>
        `;
        listContainer.insertAdjacentHTML('beforeend', rowHTML);
    });
}

// Điền mã môn vào form khi bấm nút "Chọn"
function fillCourse(code) {
    const input = document.getElementById('courseCodeInput');
    if (input) input.value = code;
}

// ==========================================
// 3. XỬ LÝ SỰ KIỆN (ĐĂNG NHẬP, ĐĂNG KÝ, HỦY)
// ==========================================

function login(event) {
    if (event) event.preventDefault();
    const studentIdInput = document.getElementById('studentIdInput');
    const studentId = studentIdInput ? studentIdInput.value.trim() : '';

    if (!studentId) { alert('Vui lòng nhập Mã Sinh Viên!'); return; }

    fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success' || data.studentId) {
            document.getElementById('loginSection').classList.add('hidden');
            document.getElementById('studentDashboard').classList.remove('hidden');
            
            // Cập nhật tên sinh viên trên góc
            const msvDisplay = document.getElementById('currentStudentId');
            if(msvDisplay) msvDisplay.innerText = studentId;

            // Kéo dữ liệu về vẽ 2 cái bảng ngay lập tức!
            loadAvailableCourses();
            fetchMyCourses(studentId);
        } else {
            alert('Đăng nhập thất bại!');
        }
    })
    .catch(err => alert('Lỗi kết nối server!'));
}

function registerCourse(event) {
    if (event) event.preventDefault();

    const courseCode = document.getElementById('courseCodeInput').value.trim().toUpperCase();
    const studentId = document.getElementById('currentStudentId').innerText;

    if (!courseCode) { alert('Vui lòng nhập mã môn học!'); return; }

    if (registeredCourses.some(c => c.id === courseCode)) {
        alert(`Bạn đã đăng ký môn ${courseCode} từ trước rồi!`);
        return;
    }

    fetch('http://localhost:3000/api/register-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId, courseCode: courseCode })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            alert(data.message);
            document.getElementById('courseCodeInput').value = '';
            
            // Cập nhật lại CẢ 2 BẢNG (Để số slot trừ đi và môn lọt xuống dưới)
            loadAvailableCourses();
            fetchMyCourses(studentId);
        } else {
            alert(data.message || 'Không thể đăng ký môn học này!');
        }
    })
    .catch(err => alert('Lỗi kết nối đến máy chủ!'));
}

function cancelCourse(courseId) {
    if (!confirm(`Bạn có chắc muốn hủy môn ${courseId} không?`)) return;
    
    // Lấy MSV và kiểm tra xem có bị rỗng không
    const studentId = document.getElementById('currentStudentId').innerText.trim();
    if (!studentId) {
        alert("Lỗi: Không tìm thấy Mã sinh viên, vui lòng tải lại trang và đăng nhập lại!");
        return;
    }

    console.log("👉 Đang gửi yêu cầu Hủy:", courseId, "cho MSV:", studentId);

    fetch('http://localhost:3000/api/cancel-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId, courseCode: courseId })
    })
    .then(async (res) => {
        // Cố tình đọc thô để xem Server trả về cái gì (JSON hay mã HTML báo lỗi 404)
        const text = await res.text();
        try {
            return JSON.parse(text); 
        } catch (e) {
            throw new Error(`Server không trả về JSON! Dữ liệu nhận được: ${text.substring(0, 50)}...`);
        }
    })
    .then(data => {
        if (data.status === 'success') {
            alert(data.message);
            loadAvailableCourses();
            fetchMyCourses(studentId);
        } else {
            // Hiển thị đích danh câu báo lỗi từ server
            alert('❌ Server từ chối: ' + (data.message || 'Không rõ nguyên nhân!'));
        }
    })
    .catch(err => {
        console.error("Lỗi Hệ Thống:", err);
        // Hiển thị thẳng lỗi mạng/code lên màn hình
        alert('⚠️ Bắt được lỗi chi tiết: ' + err.message);
    });
}

// ==========================================
// 4. KHỞI TẠO LẮNG NGHE SỰ KIỆN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', login);

    const courseForm = document.getElementById('courseForm');
    if (courseForm) courseForm.addEventListener('submit', registerCourse);
});