// Phân trang
const pageSize = 8;
let currentPage = 1;
let expanded = {};
let selectedId = null;

function loadPage(url) {
	const app = document.getElementById('app');
	fetch(url)
	.then(res => res.text())
	.then(html => {
		app.innerHTML = html;
	})
	.catch(() => {
		app.innerHTML = "<h2>Page not found</h2>";
	});
}

function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = '';
    if (!username || !password) {
        errorDiv.textContent = 'Vui lòng nhập đầy đủ thông tin.';
        return;
    }
    // Demo: kiểm tra tài khoản cố định
    if (username === 'admin' && password === '123@123') {
        page('/home');
    } else {
        errorDiv.textContent = 'Tên đăng nhập hoặc mật khẩu không đúng.';
    }
}

// home js

function renderProcedures() {
    const ul = document.getElementById('procedureList');
    ul.innerHTML = '';
    procedures.forEach(proc => {
        // Cha
        const li = document.createElement('li');
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
            li.onclick = (e) => {
                if (e.target === icon) {
                    expanded[proc.id] = !expanded[proc.id];
                    renderProcedures();
                    return;
                }
                selectedId = proc.id;
                renderProcedures();
            };
        } else {
            li.textContent = proc.name;
            li.onclick = () => {
                selectedId = proc.id;
                renderProcedures();
            };
        }
        ul.appendChild(li);
        // Con
        if (proc.children && proc.children.length && expanded[proc.id]) {
            proc.children.forEach(child => {
                const cli = document.createElement('li');
                cli.textContent = child.name;
                cli.className = 'child procedure-child';
                if (selectedId === child.id) cli.classList.add('active-child');
                cli.onclick = (e) => {
                    e.stopPropagation();
                    selectedId = child.id;
                    renderProcedures();
                };
                ul.appendChild(cli);
            });
        }
    });
}           

function renderRecords() {
    const tbody = document.querySelector('#recordsTable tbody');
    tbody.innerHTML = '';
    const start = (currentPage-1)*pageSize;
    const end = start + pageSize;
    records.slice(start, end).forEach(r => {
        const tr = document.createElement('tr');
        // Định dạng ngày dd/mm/yyyy
        let dateStr = r.date;
        if (dateStr && dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-');
            dateStr = `${d}/${m}/${y}`;
        }
        tr.innerHTML = `<td>${r.id}</td><td>${r.name}</td><td>${r.customer}</td><td>${r.status}</td><td>${dateStr}</td>`;
        tbody.appendChild(tr);
    });
}

function renderPagination() {
    const totalPages = Math.ceil(records.length / pageSize);
    const pagDiv = document.getElementById('pagination');
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