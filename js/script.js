// Phân trang
const pageSize = 8;
let currentPage = 1;
let expanded = {};
let selectedId = null;
let records = []; // Dữ liệu hiện tại hiển thị trong bảng
let isMobile = false;

function loadPage(url, id) {
	const app = document.getElementById(id);
	return fetch(url)
		.then(res => res.text())
		.then(html => {
			app.innerHTML = html;
		})
		.catch(() => {
			app.innerHTML = "<h2>Page not found</h2>";
		});
}

// Nếu F5 ở trang /procedure thì chuyển về /home
window.addEventListener('DOMContentLoaded', function() {
    if (location.href.endsWith('/procedure') || location.href.includes('/record')) {
        page('/home');
    }
});

function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorDiv = document.getElementById('error');
    const loginBtn = document.getElementById('login-btn');
    errorDiv.textContent = '';
    if (!username || !password) {
        errorDiv.textContent = 'Vui lòng nhập đầy đủ thông tin.';
        return;
    }
    // Hiển thị spinner trên nút đăng nhập
    initSpinner(loginBtn);
    // Gọi API Google Apps Script
    fetch(ggApiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    })
    .then(res => res.json())
    .then(data => {
        removeSpinner(loginBtn);
        if (data.success) {
            page('/home');
            // Nếu muốn lưu thông tin users: localStorage.setItem('users', JSON.stringify(data.users));
        } else {
            errorDiv.textContent = data.message || 'Tên đăng nhập hoặc mật khẩu không đúng.';
        }
    })
    .catch(() => {
        removeSpinner(loginBtn);
        errorDiv.textContent = 'Lỗi kết nối máy chủ.';
    });
}

// home js

function renderProcedures() {
    const ul = document.getElementById('procedureList');
    if (!ul) return;
    else ul.innerHTML = '';
    procedures.forEach(proc => {
        // Cha
        const li = document.createElement('li');
        if (!li) return;
        li.className = 'parent procedure-parent';
        if (selectedId === proc.id) li.classList.add('active-parent');
        // Thêm icon thu gọn/mở rộng nếu có con
        if (proc.children && proc.children.length) {
            const icon = document.createElement('span');
            icon.className = 'toggle-icon';
            icon.textContent = expanded[proc.id] ? '▼' : '▶';
            li.appendChild(icon);
            const nameSpan = document.createElement('span');
            nameSpan.textContent = ' ' + proc.name;
            li.appendChild(nameSpan);
            // Thêm counter góc phải
            const counter = document.createElement('span');
            counter.className = 'li-counter';
            counter.textContent = proc.counter !== undefined ? proc.counter : '';
            li.appendChild(counter);
            li.style.position = 'relative';
            li.onclick = (e) => {
                if (e.target === icon) {
                    // Toggle expand/collapse cho parent này
                    expanded[proc.id] = !expanded[proc.id];
                    renderProcedures();
                    return;
                }
                selectedId = proc.id;
                if (proc.id === "procedure") {
                    // Nếu là procedure thì collapse hết
                    expanded = {};
                    page('/procedure'); 
                    renderSteps();
                    selectStep(0);
                    window.addEventListener('resize', () => {
                        renderSteps();
                        selectStep(0);
                    });
                } else {
                    page('/home');
                    // Expand/collapse parent này, collapse các parent khác
                    Object.keys(expanded).forEach(k => { 
                        if (k !== proc.id) expanded[k] = false;
                    });
                    expanded[proc.id] = true;
                    // Gán records bằng filterRecords khi bấm cha
                    records = filterRecords(sample_records, proc.id, '');
                    currentPage = 1;
                    renderRecords();
                    renderPagination();
                    renderProcedures();
                }
            };
        } else {
            li.textContent = proc.name;
            li.style.position = 'relative';
            li.onclick = () => {
                selectedId = proc.id;
                if (proc.id === "procedure") {
                    expanded = {};
                    page('/procedure');
                    if (isMobile) {
                        const sidebar = document.getElementById('sidebar');
                        if (sidebar) sidebar.style.display = 'none';
                    }        
                } else {
                    page('/home');
                    renderProcedures();
                }
            };
        }
        ul.appendChild(li);
        // Con
        if (proc.children && proc.children.length && expanded[proc.id]) {
            proc.children.forEach(child => {
                const cli = document.createElement('li');
                cli.textContent = child.name;
                cli.className = 'child procedure-child';
                // Thêm counter cho child
                const counter = document.createElement('span');
                counter.className = 'li-counter';
                if (child.counter !== undefined && child.counter !== null && child.counter !== '') {
                    counter.textContent = child.counter;
                    counter.style.display = '';
                } else {
                    counter.style.display = 'none';
                }
                cli.appendChild(counter);
                cli.style.position = 'relative';
                if (selectedId === child.id) cli.classList.add('active-child');
                cli.onclick = (e) => {
                    e.stopPropagation();
                    selectedId = child.id;
                    renderProcedures();
                    // Khi bấm vào child thì thay đổi bảng theo child (lọc theo subType)
                    records = filterRecords(sample_records, '', child.id);
                    currentPage = 1;
                    page('/home');
                    renderRecords();
                    renderPagination();
                    // Nếu là mobile thì ẩn sidebar
                    if (isMobile) {
                        const sidebar = document.getElementById('sidebar');
                        if (sidebar) sidebar.style.display = 'none';
                    }
                };
                ul.appendChild(cli);
            });
        }
    });
}           

function renderRecords() {
    const tbody = document.querySelector('#recordsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const start = (currentPage-1)*pageSize;
    const end = start + pageSize;
    const mobile = window.innerWidth <= 600;
    // Lấy tên danh mục đang chọn
    let modernName = '';
    if (selectedId) {
        // Tìm trong procedures hoặc con
        let found = procedures.find(p => p.id === selectedId);
        if (!found) {
            for (const p of procedures) {
                if (p.children) {
                    found = p.children.find(c => c.id === selectedId);
                    if (found) break;
                }
            }
        }
        if (found) modernName = found.name;
    }
    // Gán tên danh mục vào .modern-name nếu có
    const modernNameEl = document.getElementById('modern-name');
    if (modernNameEl) modernNameEl.textContent = modernName;
    records.slice(start, end).forEach(r => {
        const tr = document.createElement('tr');
        // Định dạng ngày dd/mm/yyyy
        let dateStr = r.date;
        if (dateStr && dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-');
            dateStr = `${d}/${m}/${y}`;
        }
        if (mobile) {
            tr.innerHTML = `<td>${r.id}</td><td>${r.name}</td><td><button class='action-btn' onclick='viewRecord("${r.id}")'>Xem</button></td>`;
        } else {
            tr.innerHTML = `<td>${r.id}</td><td>${r.name}</td><td>${r.customer}</td><td>${r.status}</td><td>${dateStr}</td><td><button class='action-btn' onclick='viewRecord("${r.id}")'>Xem</button></td>`;
        }
        tbody.appendChild(tr);
    });
    // Ẩn/hiện cột theo mobile
    const table = document.getElementById('recordsTable');
    if (table) {
        const ths = table.querySelectorAll('th');
        ths.forEach((th, idx) => {
            if (mobile && idx > 1 && idx !== ths.length-1) th.style.display = 'none';
            else th.style.display = '';
        });
        // Ẩn/hiện td tương ứng
        tbody.querySelectorAll('tr').forEach(row => {
            row.querySelectorAll('td').forEach((td, idx) => {
                if (mobile && idx > 1 && idx !== row.children.length-1) td.style.display = 'none';
                else td.style.display = '';
            });
        });
    }
}

function renderPagination() {
    const totalPages = Math.ceil(records.length / pageSize);
    const pagDiv = document.getElementById('pagination');
    if (!pagDiv) return;
    pagDiv.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) btn.classList.add('active');
        btn.onclick = () => { 
            currentPage = i; 
            renderRecords(); 
            renderPagination(); 
        };
        pagDiv.appendChild(btn);
    }
}
// end home js

function filterRecords(records, type, subType) {
    if (!type) return records.filter(r => {
        return r.subType == subType;
    });
    if (!subType) return records.filter(r => {
        return r.type == type;
    });
}

// --- Procedure page logic ---
function renderSteps() {
    const timeline = document.getElementById("timeline");
    if (!timeline) return;
    timeline.innerHTML = '';
    steps.forEach((s, i) => {
        const btn = document.createElement("div");
        btn.className = "step";
        btn.innerHTML = `
            <div class="step-circle">${s.id}</div>
            <div class="step-title">${s.title}</div>`;
        btn.addEventListener("click", () => selectStep(i));
        timeline.appendChild(btn);
        // Desktop mới có mũi tên
        if (i < steps.length - 1 && window.innerWidth > 600) {
            const arrow = document.createElement("div");
            arrow.className = "arrow";
            arrow.textContent = "→";
            timeline.appendChild(arrow);
        }
    });
}

function selectStep(index) {
    const timeline = document.getElementById("timeline");
    const details = document.getElementById("details");
    if (!timeline || !details) return;
    document.querySelectorAll(".step").forEach((el, i) => {
        el.classList.toggle("active", i === index);
    });
    // Responsive: mobile sẽ xổ details riêng dưới step
    if (window.innerWidth <= 1024) {
        // Xóa details-inline cũ
        document.querySelectorAll('.details-inline').forEach(e => e.remove());
        // Tạo details mới
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'details details-inline';
        detailsDiv.innerHTML = `
            <h3>${steps[index].id} - ${steps[index].title}</h3>
            <p>${steps[index].desc}</p>`;
        // Chèn sau step đang chọn
        const stepEls = document.querySelectorAll('.step');
        if (stepEls[index].nextSibling) {
            timeline.insertBefore(detailsDiv, stepEls[index].nextSibling);
        } else {
            timeline.appendChild(detailsDiv);
        }
        // Ẩn details global
        details.style.display = 'none';
    } else {
        details.style.display = '';
        details.innerHTML = `
            <h3>${steps[index].id} - ${steps[index].title}</h3>
            <p>${steps[index].desc}</p>`;
        // Xóa details-inline nếu có
        document.querySelectorAll('.details-inline').forEach(e => e.remove());
    }
}

// Sidebar toggle for mobile
function handleSidebarMobile() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    if (window.innerWidth <= 600) {
        sidebar.classList.add('sidebar-mobile');
        toggle.style.display = 'block';
        sidebar.style.display = 'none';
        isMobile = true;
    } else {
        if (!sidebar) return;
        sidebar.classList.remove('sidebar-mobile');
        toggle.style.display = 'none';
        sidebar.style.display = '';
        isMobile = false;
    }
}

function viewRecord(id) {
    page('/record?id=' + id);
}

function showModal(type) {
    const modal = document.getElementById('modal-confirm');
    const msg = document.getElementById('modal-message');
    if (type === 'confirm') {
        msg.textContent = 'Bạn có chắc chắn muốn xem thử hồ sơ này?';
    } else if (type === 'cancel') {
        msg.textContent = 'Bạn có chắc chắn muốn chuyển trạng thái hồ sơ?';
    }
    let btnConfirm = document.getElementById('btn-confirm');
    let btnCancel = document.getElementById('btn-cancel');
    let spin = document.getElementById('spin-confirm');
    spin.style.display = 'none';
    modal.style.display = 'flex';
    btnConfirm.onclick = function() {
        // Hiệu ứng xoay
        spin.classList.add('spinning');
        spin.style.display = 'inline-block';
        setTimeout(() => {
            spin.classList.remove('spinning');
            spin.style.display = 'none';
            modal.style.display = 'none';
            alert(type === 'confirm' ? 'Đã xem thử!' : type === 'cancel' ? 'Đã chuyển trạng thái!' : '');
        }, 5000);
    };
    btnCancel.onclick = function() {
        modal.style.display = 'none';
    };
}

// Hàm khởi tạo spinner cho button
function initSpinner(btn) {
    if (!btn) return;
    btn.disabled = true;
    btn.classList.add('btn-loading');
    btn.insertAdjacentHTML('afterbegin', SPINNER_SVG);
}

function removeSpinner(btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.classList.remove('btn-loading');
    const spinner = btn.querySelector('.spinner-svg');
    if (spinner) spinner.remove();
}

function goBack() {
    window.history.back();
}
