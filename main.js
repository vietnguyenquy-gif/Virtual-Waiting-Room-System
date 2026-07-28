// 1. Mảng lưu trữ môn học đã đăng ký (Mặc định RỖNG - Đăng ký môn nào mới đẩy vào đây)
let registeredCourses = [];

// Từ điển tra cứu tên môn học dự phòng
const courseCatalog = {
    'IT101': 'Cấu trúc dữ liệu & Giải thuật',
    'IT102': 'Cơ sở dữ liệu',
    'IT103': 'Trí tuệ nhân tạo',
    'IT104': 'Mạng máy tính',
    'IT105': 'Lập trình Web'
};

// 2. Hàm vẽ bảng môn học đã đăng ký
function renderRegisteredCourses() {
    const card = document.getElementById('my-registered-card');
    if (card) card.style.display = 'block';

    const listContainer = document.getElementById('registered-list');
    const totalSpan = document.getElementById('total-registered');
    
    if (!listContainer || !totalSpan) return;

    listContainer.innerHTML = ''; // Xóa trắng bảng cũ
    totalSpan.innerText = registeredCourses.length; // Cập nhật tổng số môn
    
    // Nếu chưa đăng ký môn nào -> Hiện thông báo rỗng
    if (registeredCourses.length === 0) {
        listContainer.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#888;">Chưa có môn học nào được đăng ký</td></tr>';
        return;
    }

    // Chỉ duyệt và vẽ ra ĐÚNG những môn có trong mảng registeredCourses
    registeredCourses.forEach(function(course) {
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

// 3. Hàm xử lý Đăng Ký Môn Học
function registerCourse(event) {
    if (event) event.preventDefault(); // Chặn tải lại trang

    const courseInput = document.getElementById('courseCodeInput');
    const courseCode = courseInput ? courseInput.value.trim().toUpperCase() : '';

    if (!courseCode) {
        alert('Vui lòng nhập mã môn học!');
        return;
    }

    // NGĂN ĐĂNG KÝ TRÙNG: Kiểm tra xem môn này đã có trong bảng chưa
    const isAlreadyRegistered = registeredCourses.some(c => c.id === courseCode);
    if (isAlreadyRegistered) {
        alert(`Bạn đã đăng ký môn ${courseCode} từ trước rồi!`);
        return;
    }

    const studentIdInput = document.getElementById('studentIdInput');
    const studentId = studentIdInput ? studentIdInput.value : '';

    // Gửi yêu cầu lên máy chủ Node.js
    fetch('http://localhost:3000/api/register-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId, courseCode: courseCode })
    })
    .then(response => response.json())
    .then(data => {
        // Kiểm tra phản hồi từ server (hỗ trợ nhiều format response khác nhau)
        if (data.status === 'success' || data.isSuccess || data.message?.toLowerCase().includes('thành công')) {
            alert(data.message || `Đăng ký thành công môn ${courseCode}!`);
            
            // Ưu tiên lấy tên môn do server trả về, nếu không có thì tra catalog
            const courseName = data.courseName || courseCatalog[courseCode] || 'Môn học chuyên ngành';

            // ĐẨY MÔN VỪA ĐĂNG KÝ VÀO MẢNG
            registeredCourses.push({ id: courseCode, name: courseName });

            // VẼ LẠI BẢNG -> Môn học mới sẽ lập tức xuất hiện bên bảng Đã Đăng Ký
            renderRegisteredCourses();

            if (courseInput) courseInput.value = ''; // Xóa ô nhập liệu
        } else {
            alert(data.message || 'Không thể đăng ký môn học này!');
        }
    })
    .catch(error => {
        console.error('Lỗi đăng ký:', error);
        alert('Lỗi kết nối đến máy chủ! Vui lòng kiểm tra server Node.js.');
    });
}

// 4. Hàm xử lý Hủy môn học
function cancelCourse(courseId) {
    if (!confirm(`Bạn có chắc muốn hủy môn ${courseId} không?`)) return;

    // Lọc bỏ môn muốn hủy khỏi mảng
    registeredCourses = registeredCourses.filter(course => course.id !== courseId);
    
    // Vẽ lại bảng -> Môn vừa hủy sẽ biến mất
    renderRegisteredCourses();
    alert(`Đã hủy môn ${courseId} thành công!`);
}

// 5. Hàm xử lý Đăng Nhập
function login(event) {
    if (event) event.preventDefault();

    const studentIdInput = document.getElementById('studentIdInput');
    const studentId = studentIdInput ? studentIdInput.value.trim() : '';

    if (!studentId) {
        alert('Vui lòng nhập Mã Sinh Viên!');
        return;
    }

    fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success' || data.studentId) {
            alert('Đăng nhập thành công! Chào bạn ' + (data.studentId || studentId));
            
            const loginSection = document.getElementById('loginSection');
            if (loginSection) loginSection.classList.add('hidden'); // Dùng class hidden như trong HTML của bạn

            const studentDashboard = document.getElementById('studentDashboard');
            if (studentDashboard) studentDashboard.classList.remove('hidden');

            // Khi mới đăng nhập, vẽ bảng ra (mặc định sẽ hiện 0 môn)
            renderRegisteredCourses();
        } else {
            alert('Đăng nhập thất bại: ' + (data.message || 'Mã sinh viên không đúng'));
        }
    })
    .catch(error => {
        console.error('Lỗi khi đăng nhập:', error);
        alert('Đã xảy ra lỗi khi đăng nhập. Vui lòng kiểm tra server.');
    });
}

// 6. Gắn sự kiện (ĐÃ SỬA CHÍNH XÁC THEO ID TRONG HTML CỦA BẠN)
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', login);

    // Bắt chính xác form đăng ký có ID là courseForm
    const courseForm = document.getElementById('courseForm');
    if (courseForm) {
        courseForm.addEventListener('submit', registerCourse);
    } else {
        // Dự phòng nếu bạn dùng form đăng ký nhanh quickRegisterForm ở bước trước
        const quickForm = document.getElementById('quickRegisterForm');
        if (quickForm) quickForm.addEventListener('submit', registerCourse);
    }
});