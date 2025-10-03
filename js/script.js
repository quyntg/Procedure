// Phân trang
const pageSize = 8;
let currentPage = 1;
let expanded = {};
let selectedId = null;
let selectedIdDossier = null;
let selectedIdProcedure = null;
let selectedNameProcedure = "";
let dossiers = []; // Dữ liệu hiện tại hiển thị trong bảng
let isMobile = false;
let wasProcedure = true; // Biến kiểm tra xem trước đó có phải đang ở procedure ko
let recordFiles = []; // Mảng lưu trữ các file đã upload

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
    if (location.href.endsWith('/procedure') || location.href.includes('/dossier')) {
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

// Lấy procedures từ API Google Apps Script
async function getProceduresWithCounter() {
    showGlobalSpinner();
    return fetch(ggApiUrl + '?action=getProceduresWithCounter', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data && Array.isArray(data)) {
            return data;
        }
        return [];
    })
    .catch(() => [])
    .finally(() => hideGlobalSpinner());
}

// Lấy steps từ API Google Apps Script
async function getStepsByProcedureId(procedureId) {
    showGlobalSpinner();
    return fetch(ggApiUrl + '?action=getStepsByProcedureId&procedureId=' + encodeURIComponent(procedureId), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data && Array.isArray(data)) {
            return data;
        }
        return [];
    })
    .catch(() => [])
    .finally(() => {
        hideGlobalSpinner();
    });
}

// home js
async function loadProcedures() {
    procedures = await getProceduresWithCounter();
    renderProcedures();
}

async function loadSteps(procedureId, procedureName) {
    steps = await getStepsByProcedureId(procedureId, procedureName);
    renderSteps();
    selectStep(0);
    document.getElementById('procedure-title').innerText  = "Quy trình " + procedureName;
}

async function loadDossiers(procedure, status) {
    dossiers = await getDossiers(procedure, status);
    currentPage = 1;
    renderDossiers();
    renderPagination();
}

async function loadDossierDetail(id) {
    let dossierDetail = await getDossierDetail(id);
    console.log(dossierDetail);
    sessionStorage.setItem('dossierDetail', JSON.stringify(dossierDetail));
}

async function renderProcedures() {
    const ul = document.getElementById('dossierList');
    const ul2 = document.getElementById('procedureList');
    if (!ul) return;
    else ul.innerHTML = '';
    procedures.forEach(proc => {
        // Cha
        const li = document.createElement('li');
        const li2 = document.createElement('li');
        if (!li) return;
        li.className = 'parent procedure-parent';

        li2.className = 'parent procedure-parent';
        const nameSpan2 = document.createElement('span');
        nameSpan2.textContent = ' ' + proc.name;
        li2.appendChild(nameSpan2);
        li2.setAttribute('data-procedure-id', proc.id);
        // Gán active riêng biệt cho từng list
        if (selectedIdDossier === proc.id) li.classList.add('active-parent');
        li2.onclick = (e) => {
            document.querySelectorAll('.procedure-parent, .procedure-child').forEach(el => el.classList.remove('active-parent', 'active-child'));
            // Nếu đang ở li procedure và bấm sang li gốc khác thì mới load lại API
            wasProcedure = selectedIdProcedure === 'procedure';
            selectedIdProcedure = proc.id;
            selectedNameProcedure = proc.name;
            li2.classList.add('active-parent');
            // Nếu là procedure thì collapse hết
            
            page('/procedure'); 
            if (isMobile) {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) sidebar.style.display = 'none';
            } 
        };
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
        // Thêm icon thu gọn/mở rộng nếu có con
        if (proc.children && proc.children.length) {
            li.onclick = (e) => {
                document.querySelectorAll('.procedure-parent, .procedure-child').forEach(el => el.classList.remove('active-parent', 'active-child'));
                if (e.target === icon) {
                    // Toggle expand/collapse cho parent này
                    expanded[proc.id] = !expanded[proc.id];
                    renderProcedures();
                    return;
                }
                // Chỉ ảnh hưởng selectedIdDossier
                wasProcedure = selectedIdDossier === 'procedure';
                selectedIdDossier = proc.id;
               
                page('/home');
                // Expand/collapse parent này, collapse các parent khác
                Object.keys(expanded).forEach(k => { 
                    if (k !== proc.id) expanded[k] = false;
                });
                expanded[proc.id] = true;
                // Gán dossiers bằng loadDossiers khi bấm cha
                loadDossiers(proc.id, '');
                // Chỉ load lại API nếu chuyển từ procedure sang li gốc khác
                if (wasProcedure) {
                    loadProcedures();
                    return; // Không gọi renderProcedures phía dưới nữa
                }
                renderProcedures();
            };
        } else {
            li.onclick = () => {                
                document.querySelectorAll('.procedure-parent, .procedure-child').forEach(el => el.classList.remove('active-parent', 'active-child'));
                wasProcedure = selectedIdDossier === 'procedure';
                selectedIdDossier = proc.id;
                page('/home');
                renderProcedures();
            };
        }
    ul.appendChild(li);
    if (ul2) ul2.appendChild(li2);
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
                if (selectedIdDossier === child.id) cli.classList.add('active-child');
                cli.onclick = (e) => {
                    document.querySelectorAll('.procedure-parent, .procedure-child').forEach(el => el.classList.remove('active-parent', 'active-child'));
                    e.stopPropagation();
                    wasProcedure = selectedIdDossier === 'procedure';
                    selectedIdDossier = child.id;
                    renderProcedures();
                    // Khi bấm vào child thì thay đổi bảng theo child (lọc theo subType)
                    loadDossiers('', child.id);
                    page('/home');
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

function renderDossiers() {
    const tbody = document.querySelector('#dossiersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const start = (currentPage-1)*pageSize;
    const end = start + pageSize;
    const mobile = window.innerWidth <= 600;
    // Lấy tên danh mục đang chọn
    let modernName = '';
    if (selectedIdDossier) {
        // Tìm trong procedures hoặc con
        let found = procedures.find(p => p.id === selectedIdDossier);
        if (!found) {
            for (const p of procedures) {
                if (p.children) {
                    found = p.children.find(c => c.id === selectedIdDossier);
                    if (found) break;
                }
            }
        }
        if (found) modernName = found.name;
    }
    // Gán tên danh mục vào .modern-name nếu có
    const modernNameEl = document.getElementById('modern-name');
    if (modernNameEl) modernNameEl.textContent = modernName;
    
    dossiers.slice(start, end).forEach(r => {
        const tr = document.createElement('tr');
        // Định dạng ngày dd/mm/yyyy
        // let dateStr = r.date;
        // if (dateStr && dateStr.includes('-')) {
        //     const [y, m, d] = dateStr.split('-');
        //     dateStr = `${d}/${m}/${y}`;
        // }
        if (mobile) {
            tr.innerHTML = `<td>${r.id}</td><td>${r.name}</td><td><button class='action-btn' onclick='viewRecord("${r.id}")'>Xem</button></td>`;
        } else {
            tr.innerHTML = `<td>${r.id}</td><td>${r.name}</td><td>${r.customer}</td><td>${r.status}</td><td>${r.createDate}</td><td><button class='action-btn' onclick='viewRecord("${r.id}")'>Xem</button></td>`;
        }
        tbody.appendChild(tr);
    });
    // Ẩn/hiện cột theo mobile
    const table = document.getElementById('dossiersTable');
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
    const totalPages = Math.ceil(dossiers.length / pageSize);
    const pagDiv = document.getElementById('pagination');
    if (!pagDiv) return;
    pagDiv.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) btn.classList.add('active');
        btn.onclick = () => { 
            currentPage = i; 
            renderDossiers(); 
            renderPagination(); 
        };
        pagDiv.appendChild(btn);
    }
}
// end home js

async function getDossiers(procedure, status) {
    showGlobalSpinner();
    return fetch(ggApiUrl + '?action=getDossiers&procedure=' + encodeURIComponent(procedure) + '&status=' + encodeURIComponent(status), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data && Array.isArray(data)) {
            return data;
        }
        return [];
    })
    .catch(() => [])
    .finally(() => {
        hideGlobalSpinner();
    });
}

async function getDossierDetail(id) {
    showGlobalSpinner();
    return fetch(ggApiUrl + '?action=getDossierDetail&id=' + encodeURIComponent(id), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data && typeof data === 'object') {
            sessionStorage.setItem('dossierDetail', JSON.stringify(data));
            return data;
        }
        initDossierDetail({});
        return {};
    })
    .catch(() => {
        initDossierDetail({});
    })
    .finally(data => {
        initDossierDetail(data);
        hideGlobalSpinner();
    });
}

// --- Procedure page logic ---
function renderSteps() {
    const timeline = document.getElementById("timeline");
    if (!timeline) return;
    timeline.innerHTML = '';
    
    if (!steps || !steps.length) {
        timeline.style.display = 'block';
        timeline.innerHTML = '<div style="text-align: center; padding: 32px 0; color: #0ea5e9; font-size: 1.1rem;">Chưa có dữ liệu cho quy trình này.</div>';
        return;
    } else {
        timeline.style.display = 'flex';
    }
    steps.forEach((s, i) => {
        const btn = document.createElement("div");
        btn.className = "step";
        btn.innerHTML = `
            <div class="step-circle">B${i + 1}</div>
            <div class="step-title">${s.name}</div>`;
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
            <h3>B${index + 1} - ${steps[index].name}</h3>
            <p>${steps[index].description}</p>`;
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
        if (!steps || !steps.length) return;
        details.style.display = '';
        details.innerHTML = `
            <h3>B${index + 1} - ${steps[index].name}</h3>
            <p>${steps[index].description}</p>`;
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
    sessionStorage.setItem('dossierId', id);
    page('/dossier?id=' + id);
}

function showModal(type, file) {
    const modal = document.getElementById('modal-confirm');
    const msg = document.getElementById('modal-message');
    if (type === 'save') {
        msg.textContent = 'Bạn có chắc chắn muốn lưu file này?';
    } else if (type === 'preview') {
        msg.textContent = 'Bạn có chắc chắn muốn xem thử file này?';
    } else if (type === 'next') {
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
            alert(type === 'save' ? 'Đã lưu file!' : type === 'preview' ? 'Đã xem thử file!' : type === 'next' ? 'Đã chuyển trạng thái!' : '');
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

// Hiển thị spinner toàn màn hình khi gọi API
function showGlobalSpinner() {
    if (document.getElementById('global-spinner')) return;
    const div = document.createElement('div');
    div.id = 'global-spinner';
    div.innerHTML = `
        <div class="global-spinner-backdrop"></div>
        <div class="global-spinner-svg">
            ${SPINNER_SVG}
        </div>
    `;
    document.body.appendChild(div);
}

function hideGlobalSpinner() {
    const div = document.getElementById('global-spinner');
    if (div) div.remove();
}

function goBack() {
    window.history.back();
}

// Icon đóng/mở cho từng danh sách
function initHomeToggleIcons() {
    const dossierList = document.getElementById('dossierList');
    const procedureList = document.getElementById('procedureList');
    const toggleDossier = document.getElementById('toggleDossier');
    const toggleProcedure = document.getElementById('toggleProcedure');
    const dossierHeader = document.getElementById('dossierHeader');
    const procedureHeader = document.getElementById('procedureHeader');
    let openDossier = true;
    let openProcedure = true;
    if (toggleDossier && dossierHeader && dossierList) {
        dossierHeader.onclick = function() {
            openDossier = !openDossier;
            dossierList.style.display = openDossier ? '' : 'none';
            toggleDossier.textContent = openDossier ? '▼' : '▶';
        };
    }
    if (toggleProcedure && procedureHeader && procedureList) {
        procedureHeader.onclick = function() {
            openProcedure = !openProcedure;
            procedureList.style.display = openProcedure ? '' : 'none';
            toggleProcedure.textContent = openProcedure ? '▼' : '▶';
        };
    }
}

function initDossierDetail(dossierDetail) {
    // Nếu không truyền vào thì fallback lấy từ sessionStorage (giữ tương thích)
    if (!dossierDetail) {
        dossierDetail = JSON.parse(sessionStorage.getItem('dossierDetail') || '{}');
    }
    document.getElementById('record-id').textContent = dossierDetail.id || '';
    document.getElementById('record-name').textContent = dossierDetail.name || '';
    document.getElementById('record-customer').textContent = dossierDetail.customer || '';
    document.getElementById('record-createDate').textContent = dossierDetail.createDate || '';
    document.getElementById('record-modifiedDate').textContent = dossierDetail.modifiedDate || '';

    renderRecordFiles(dossierDetail.files || []);
}

// Đóng/mở form nhập liệu cho từng file
function toggleFileForm(fileId) {
    const form = document.getElementById(`file-form-${fileId}`);
    const icon = document.getElementById(`toggle-icon-${fileId}`);
    if (form.style.display === 'none') {
        form.style.display = 'block';
        icon.textContent = '▲';
    } else {
        form.style.display = 'none';
        icon.textContent = '▼';
    }
}

function renderRecordFiles(files) {
    const container = document.getElementById('record-files');
    container.innerHTML = '';
    files.forEach((file, index) => {
        const fileDiv = document.createElement('div');
        let html = '';
        fileDiv.className = 'record-file';
        html += `
            <div class="record-file-header" onclick="toggleFileForm('${file.id}')">
                <span class="file-name">${file.name}</span>
                <span class="file-toggle-icon" id="toggle-icon-${file.id}">▼</span>
            </div>`;
        html += 
            `<div class="record-file-form" id="file-form-${file.id}" style="display: none;">`;
        html += generateForm(JSON.parse(file.form), index);
        html += `
            <div class="record-actions">
                <button class="action-btn" onclick="showModal('save', '${file.id}')">Ghi lại</button>
                <button class="action-btn" onclick="showModal('preview', '${file.id}')">Xem thử</button>
            </div>
        </div>`;
        fileDiv.innerHTML = html;
        container.appendChild(fileDiv);
    });
}

function numberToVietnamese(amount) {
    if (typeof amount !== "number") amount = parseInt(amount, 10);
    if (isNaN(amount)) return "";

    const digits = ["không","một","hai","ba","bốn","năm","sáu","bảy","tám","chín"];
    const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

    function readThreeDigits(num) {
        let hundred = Math.floor(num / 100);
        let ten = Math.floor((num % 100) / 10);
        let unit = num % 10;
        let result = "";

        if (hundred > 0) {
            result += digits[hundred] + " trăm";
            if (ten == 0 && unit > 0) result += " linh";
        }
        if (ten > 0 && ten != 1) {
            result += " " + digits[ten] + " mươi";
            if (ten > 1 && unit == 1) result += " mốt";
        } else if (ten == 1) {
            result += " mười";
            if (unit == 1) result += " một";
        }
        if (unit > 0 && ten != 1 && unit != 1) {
            if (unit == 5 && ten > 0) result += " lăm";
            else result += " " + digits[unit];
        }
        return result.trim();
    }

    let index = 0;
    let result = "";
    while (amount > 0) {
        let part = amount % 1000;
        if (part > 0) {
            let unitName = units[index];
            result = readThreeDigits(part) + (unitName ? " " + unitName : "") + " " + result;
        }
        amount = Math.floor(amount / 1000);
        index++;
    }

    result = result.trim();
    if (result.length > 0) {
        result = result.charAt(0).toUpperCase() + result.slice(1);
    }
    return result + " đồng";
}

function generateForm(jsonData, index) {
    let html = '';
    if (!Array.isArray(jsonData)) return html;
    jsonData.forEach(section => {
        html += `<fieldset class="form-section"><legend class="legend-label">${section.title || ''}</legend>`;
        section.child.forEach(field => {
            if (field.type === 'table' && Array.isArray(field.columns)) {
                // Table with add/remove row buttons
                const tableId = `${index}_${field.id}`;
                html += `<div class="form-row"><label>${field.label || ''}</label><table class="dynamic-table" id="${tableId}"><thead><tr>`;
                field.columns.forEach(col => {
                    html += `<th>${col.header}</th>`;
                });
                html += `<th style='width:40px;text-align:center'>#</th>`;
                html += `</tr></thead><tbody>`;
                // Initial row
                html += `<tr>`;
                field.columns.forEach(col => {
                    html += `<td><input type="${col.type || 'text'}" name="${tableId}_${col.field}" ${field.pattern ? ` pattern='${field.pattern}'` : ''}/></td>`;
                });
                html += `<td style='text-align:center'>`;
                html += `<button type='button' class='table-btn' onclick='addTableRow("${tableId}", ${JSON.stringify(field.columns).replace(/'/g,"&#39;")})'>+</button>`;
                html += `<button type='button' class='table-btn' onclick='removeTableRow(this)'>-</button>`;
                html += `</td></tr>`;
                html += `</tbody></table></div>`;
            } else if (field.type === 'select' && Array.isArray(field.options)) {
                html += `<div class="form-row"><label for="${index}_${field.id}" >${field.label || ''}</label><select id="${index}_${field.id}" name="${index}_${field.id}"${field.required ? ' required' : ''}${field.readonly ? ' disabled' : ''}>`;
                field.options.forEach(opt => {
                    html += `<option value="${opt.value}">${opt.text}</option>`;
                });
                html += `</select></div>`;
            } else {
                html += `<div class="form-row"><label>${field.label || ''}</label><input type="${field.type || 'text'}" id="${index}_${field.id}" name="${index}_${field.id}" placeholder="${field.placeholder || ''}"${field.required ? ' required' : ''}${field.readonly ? ' readonly' : ''}${field.pattern ? ` pattern='${field.pattern}'` : ''}></div>`;
            }
        });
        html += `</fieldset>`;
    });
    return html;
}

// Add/remove row functions for dynamic tables
function addTableRow(tableId, columns) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const tbody = table.querySelector('tbody');
    const tr = document.createElement('tr');
    columns.forEach(col => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = col.type || 'text';
        input.name = `${tableId}_${col.field}`;
        td.appendChild(input);
        tr.appendChild(td);
    });
    // Add buttons
    const tdBtn = document.createElement('td');
    tdBtn.style.textAlign = 'center';
    tdBtn.innerHTML = `<button type='button' class='table-btn' onclick='addTableRow("${tableId}", ${JSON.stringify(columns).replace(/'/g,"&#39;")})'>+</button><button type='button' class='table-btn' onclick='removeTableRow(this)'>-</button>`;
    tr.appendChild(tdBtn);
    tbody.appendChild(tr);
}

function removeTableRow(btn) {
    const tr = btn.closest('tr');
    const tbody = tr.parentNode;
    if (tbody.rows.length > 1) tbody.removeChild(tr);
}
