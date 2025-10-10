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
let hasFiles = false;
let rules = []; // Mảng lưu trữ các rule hiện tại
let downloadFileName = ""; // Tên file khi download

// Áp dụng rule
const calculators = {
    sum: vals => vals.reduce((a,b)=>a+b,0),
    vat: ([base, vat]) => base * vat / 100,
    convert: ([num]) => numberToVietnamese(num),
    // thêm calc khác...
};

function loadPage(url, id) {
	const app = document.getElementById(id);
	return fetch(url)
		.then(res => res.text())
		.then(html => {
			app.innerHTML = html;
		})
		.catch(() => {
			if (app) app.innerHTML = '<p class="error">Không thể tải trang.</p>';
		});
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

// Nếu F5 ở trang /procedure thì chuyển về /home
window.addEventListener('DOMContentLoaded', function() {
    if (location.href.endsWith('/procedure') || location.href.includes('/dossier')) {
        page('/home');
    }
});

// login
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

// Lấy danh sách file đã upload theo dossierId (API Google Apps Script)
async function getDossierFiles(dossierId, templateFileId) {
    const res = await fetch(ggApiUrl + '?action=getDossierFiles&dossierId=' + encodeURIComponent(dossierId) + '&templateFileId=' + encodeURIComponent(templateFileId), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    return res.json();
}

// home js

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
    let data = await getDossiers(procedure, status);
    dossiers = data.dossiers;
    let counters = data.counter;
    let counter = 0;

    counters.forEach(c => {
        counter += c.counter;
        let id = 'li-' + c.stepId;
        const li = document.getElementById(id);
        if (li) {
            li.querySelector('.li-counter').textContent = c.counter;
        }
    });

    if (procedure) {
        let id = 'li-' + procedure;
        const li = document.getElementById(id);
        if (li) {
            li.querySelector('.li-counter').textContent = counter;
        }
    }

    currentPage = 1;
    renderDossiers();
    renderPagination();
}

async function loadDossierDetail(id) {
    let dossierDetail = await getDossierDetail(id);
    sessionStorage.setItem('dossierDetail', JSON.stringify(dossierDetail));
}

async function renderProcedures() {
    const ul = document.getElementById('dossierList');
    const ul2 = document.getElementById('procedureList');
    if (!ul) return;
    ul.innerHTML = '';
    if (ul2) ul2.innerHTML = ''; // Thêm dòng này để clear procedureList
    
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
        li.id = 'li-' + proc.id;
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
                cli.id = 'li-' + child.id;
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
        if (data) {
            return data;
        }
        return {dossiers: [], counter: []};
    })
    .catch(() => [])
    .finally(() => {
        hideGlobalSpinner();
    });
}
// end home js

// Procedure js
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

// dossier js
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
            if (data.files && data.files.length > 0) {
                hasFiles = true;
            } else {
                hasFiles = false;
            }
            return data;
        }
        return {};
    })
    .catch(() => {
    })
    .finally(data => {
        initDossierDetail(data);
        hideGlobalSpinner();
    });
}

function viewRecord(id) {
    sessionStorage.setItem('dossierId', id);
    page('/dossier?id=' + id);
}

function showModal(type, file) {
    const modal = document.getElementById('modal-confirm');
    const msg = document.getElementById('modal-message');
    let btnConfirm = document.getElementById('btn-confirm');
    let btnCancel = document.getElementById('btn-cancel');
    let spin = document.getElementById('spin-confirm');
    
    if (type === 'save') {
        btnCancel.style.display = '';
        msg.innerHTML = 'Bạn có chắc chắn muốn lưu file này?';
    } else if (type === 'preview') {
        btnCancel.style.display = '';
        msg.innerHTML = 'Bạn có chắc chắn muốn xem thử file này?';
    } else if (type === 'next') {
        btnCancel.style.display = '';
        msg.innerHTML = 'Bạn có chắc chắn muốn chuyển trạng thái hồ sơ?';
    } else if (type === 'notification') {
        btnCancel.style.display = 'none';
        msg.innerHTML = file.message || 'Đã có lỗi xảy ra.';
    } else if (type === 'delete') {
        msg.innerHTML = file.message || 'Đã có lỗi xảy ra khi xoá file.';
    }

    spin.style.display = 'none';
    modal.style.display = 'flex';

    btnConfirm.onclick = function() {
        // Hiệu ứng xoay
        spin.classList.add('spinning');
        spin.style.display = 'inline-block';
        if (type === 'notification') {
            spin.classList.remove('spinning');
            spin.style.display = 'none';
            modal.style.display = 'none';

            if (file.type && file.type === 'next') {
                const activeLi = dossierList.querySelector('.active-child');
                if (activeLi) {
                    loadProcedures();
                    activeLi.click();
                }
            }
        } else if (type === 'delete') {            
            removeUploadedFileHandler(file.fileId, file.templateFileId);
        } else if (type === 'next') {
            let dossierId = sessionStorage.getItem('dossierId') || '';
            if (hasFiles) {
                let files = document.querySelectorAll('.uploaded-files');
                let allUploaded = true;

                files.forEach(file => {
                    let a = file.querySelectorAll('.uploaded-file-item a');
                    if (a.length === 0) {
                        allUploaded = false;
                    }
                });

                if (!allUploaded) {
                    showModal('notification', { message: 'Vui lòng tải lên đầy đủ file trước khi chuyển trạng thái!' });
                    return;
                }
            }
            nextStepDossierHandler(dossierId);
        }  else if (type === 'save') {            
            saveFormData(file.formId);
        } else {
            setTimeout(() => {
                spin.classList.remove('spinning');
                spin.style.display = 'none';
                modal.style.display = 'none';
                // alert(type === 'save' ? 'Đã lưu file!' : type === 'preview' ? 'Đã xem thử file!' : type === 'next' ? 'Đã chuyển trạng thái!' : '');
            }, 5000);
        }
    };

    btnCancel.onclick = function() {
        modal.style.display = 'none';
    };
}

function initDossierDetail(dossierDetail) {
    // Nếu không truyền vào thì fallback lấy từ sessionStorage (giữ tương thích)
    if (!dossierDetail) {
        dossierDetail = JSON.parse(sessionStorage.getItem('dossierDetail') || '{}');
    }
    
    let recordIdEl = document.getElementById('record-id');
    if (recordIdEl) recordIdEl.textContent = dossierDetail.id || '';
    let recordNameEl = document.getElementById('record-name');
    if (recordNameEl) recordNameEl.textContent = dossierDetail.name || '';
    let recordCustomerEl = document.getElementById('record-customer');
    if (recordCustomerEl) recordCustomerEl.textContent = dossierDetail.customer || '';
    let recordCreateDateEl = document.getElementById('record-createDate');
    if (recordCreateDateEl) recordCreateDateEl.textContent = dossierDetail.createDate || '';
    let recordModifiedDateEl = document.getElementById('record-modifiedDate');
    if (recordModifiedDateEl) recordModifiedDateEl.textContent = dossierDetail.modifiedDate || '';

    renderRecordFiles(dossierDetail.files || []);
}

async function nextStepDossierHandler(dossierId) {
    try {
        const res = await fetch(ggApiUrl + '?action=nextStepDossier&dossierId=' + encodeURIComponent(dossierId), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        const data = await res.json();
        
        const modal = document.getElementById('modal-confirm');
        let spin = document.getElementById('spin-confirm');

        spin.classList.remove('spinning');
        spin.style.display = 'none';
        modal.style.display = 'none';

        if (data.success) {
            showModal('notification', { message: 'Chuyển bước thành công!', type: 'next' });
        } else {
            showModal('notification', { message: data.message || 'Chuyển bước thất bại.' });
        }
    } catch (err) {
        showModal('notification', { message: 'Lỗi chuyển bước: ' + err.message });
    }
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

function applyRules(rules, formId) {
    let values = [];
    rules.forEach(rule => {
        if (rule.calc === 'sum') {
            let sumValues = 0;
            rule.relate.forEach(r => {
                if (r.type === "table") {
                    document.querySelectorAll(`#${formId}_${r.field} .${r.child}`).forEach(el=>{
                        sumValues += Number(el.value) || 0;
                    });
                } else if (r.type === "number") {
                    sumValues += Number(document.getElementById(`${formId}_${r.field}`).value) || 0;
                }
            });
            document.getElementById(`${formId}_${rule.id}`).value = sumValues;
        } else if (rule.calc === 'vat') {
            let base = 0, vat = 0;
            rule.relate.forEach(r => {
                if (r.type === "number") {
                    if (r.field === "tongDonGia") {
                        base = Number(document.getElementById(`${formId}_${r.field}`).value) || 0;
                    } else if (r.field === "vat") {
                        vat = Number(document.getElementById(`${formId}_${r.field}`).value) || 0;
                    }
                }
            });
            const tax = Math.round(calculators.vat([base, vat]));
            document.getElementById(`${formId}_${rule.id}`).value = tax;
        } else if (rule.calc === 'convert') {
            rule.relate.forEach(r => {
                if (r.type === "number") {
                    const num = Number(document.getElementById(`${formId}_${r.field}`).value) || 0;
                    const text = calculators.convert([num]);
                    document.getElementById(`${formId}_${rule.id}`).value = text;
                }
            });
        } else if (rule.calc === 'convertInTable') {
            let textField = rule.relate.find(r => r.type === 'text');
            let numField = rule.relate.find(r => r.type === 'number');
            document.querySelectorAll(`#${formId}_${rule.id} .${numField.field}`).forEach(el=>{
                let textConverted = calculators.convert([Number(el.value) || 0]);
                let row = el.closest('tr');
                if (row) {
                    let textInput = row.querySelector(`input.${textField.field}`);
                    if (textInput) {
                        textInput.value = textConverted;
                    }
                }
            });
        }
    });
}

function renderRecordFiles(files) {
    previewSettings = [];
    const container = document.getElementById('record-files');
    if (container) container.innerHTML = '';
    files.forEach((file, index) => {
        const fileDiv = document.createElement('div');
        let html = '';
        fileDiv.className = 'record-file';
        html += `
            <div class="record-file-header" onclick="toggleFileForm('${file.id}')">
                <span class="file-name">${file.name}</span>
                <span class="file-toggle-icon" id="toggle-icon-${file.id}">▼</span>
            </div>`;
        html += `<div class="record-file-form" id="file-form-${file.id}" style="display: none;">`;
        // Nếu file.form rỗng hoặc không có, hiển thị giao diện upload file và danh sách file đã upload
        if (!file.form || file.form === '' || file.form === '{}' || file.form === '[]') {
            html += `<div class='upload-section'>
                <input type='file' id='upload-input-${file.id}' multiple />
                <button class='action-btn' onclick='uploadFileHandler("${file.id}", "${file.shorten}")'>Tải lên</button>
                <div class='uploaded-files' id='uploaded-files-${file.id}'>`;
            if (Array.isArray(file.dossierFiles) && file.dossierFiles.length) {
                file.dossierFiles.forEach(f => {
                    html += `<div class='uploaded-file-item'>
                        <a href='${f.url}' target='_blank'>${f.name}</a>
                        <button class='action-btn' style='margin-left: 10px' onclick='removeFile("${f.id}", "${f.templateFileId}")'>Xóa</button>
                    </div>`;
                });
            } else {
                html += `<div class='uploaded-file-item'>Chưa có file nào.</div>`;
            }
            html += `</div></div>`;
        } else {
            downloadFileName = (sessionStorage.getItem('dossierId') + '_' + file.shorten) || 'file-xem-thu';
            let formData = {};
            let btnHTML = '';
            if (Array.isArray(file.dossierFiles) && file.dossierFiles.length) {
                file.dossierFiles.forEach(f => {
                    if (f.templateShorten == file.shorten) {
                        if (!f.data) {
                            btnHTML += `
                                <div class="record-actions">
                                    <button class="action-btn" id="save-btn-${file.id}" onclick="showModal('save', { formId: '${file.id}' })">Ghi lại</button>
                                    <button class="action-btn action-btn-disabled" id="preview-btn-${file.id}" disabled onclick="showPreviewModal('${file.path}', '${file.id}')">Xem thử</button>
                                </div>
                            `;
                        } else {      
                            formData = JSON.parse(f.data);   
                            btnHTML += `
                                <div class="record-actions">
                                    <button class="action-btn" id="save-btn-${file.id}" onclick="showModal('save', { formId: '${file.id}' })">Ghi lại</button>
                                    <button class="action-btn" id="preview-btn-${file.id}" onclick="showPreviewModal('${file.path}', '${file.id}')">Xem thử</button>
                                </div>
                            `;
                        }
                    }
                });
            } else {
                btnHTML += `
                    <div class="record-actions">
                        <button class="action-btn" id="save-btn-${file.id}" onclick="showModal('save', { formId: '${file.id}' })">Ghi lại</button>
                        <button class="action-btn action-btn-disabled" id="preview-btn-${file.id}" disabled onclick="showPreviewModal('${file.path}', '${file.id}')">Xem thử</button>
                    </div>
                `;
            }
            let formHTML = generateForm(JSON.parse(file.form), file.id, formData);
            html += formHTML;
            html += btnHTML;
            previewSettings.push({
                id: file.id,
                form: JSON.parse(file.form),
                formdata: formData || {}
            });
        }
        html += `</div>`;
        fileDiv.innerHTML = html;
        if (fileDiv && container) container.appendChild(fileDiv);

        if ((!file.form || file.form === '' || file.form === '{}' || file.form === '[]') && (!file.rule || file.rule === '' || file.rule === '{}' || file.rule === '[]')) return;
        rules = JSON.parse(file.rule);

        // Bind sự kiện
        if (rules && Array.isArray(rules)) {
            rules.forEach(rule => {
                rule.relate.forEach(r => {
                    if (r.type === "table") {
                        document.querySelectorAll(`#${file.id}_${r.field} .${r.child}`).forEach(el => {
                            el.addEventListener("input", function() {
                                applyRules(rules, file.id);
                            });
                        });
                    } else if (rule.calc === "convertInTable") {
                        let table = document.getElementById(`${file.id}_${rule.id}`);
                        table.querySelectorAll(`.${r.field}`).forEach(el => {
                            el.addEventListener("input", function() {
                                applyRules(rules, file.id);
                            });
                        });
                    } else {
                        const input = document.getElementById(`${file.id}_${r.field}`);
                        if (input) {
                            input.addEventListener("input", function() {
                                applyRules(rules, file.id);
                            });
                        }
                    }
                });
            });
        }
    });
}

async function uploadFileHandler(id, shorten) {
    const fileInput = document.getElementById(`upload-input-${id}`);
    const file = fileInput.files[0];
    const result = document.getElementById(`uploaded-files-${id}`);
    let folderName = sessionStorage.getItem('dossierId') || '';
    const btn = fileInput.nextElementSibling;

    if (!file) {
        result.innerText = "Vui lòng chọn file!";
        return;
    }

    // Hiệu ứng xoay và disable nút
    if (btn) {
        btn.disabled = true;
        btn.classList.add('btn-loading');
        btn.insertAdjacentHTML('afterbegin', SPINNER_SVG);
    }
    result.innerText = "Đang đọc file...";

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Data = e.target.result.split(",")[1]; // bỏ prefix "data:...;base64,"
        result.innerText = "Đang upload...";

        const body = new URLSearchParams();
        body.append("fileData", base64Data);
        body.append("fileName", folderName + "_" + shorten);
        body.append("mimeType", file.type);
        body.append("folderName", folderName);
        body.append("dossierId", folderName);
        body.append("templateFileId", id);
        body.append("templateShorten", shorten);
        body.append("action", "upload");

        let uploadSuccess = false;
        let message = '';
        let url = '';
        let name = '';
        let fileId = '';
        let dossierFiles = []; // Cập nhật lại danh sách file đã upload sau khi upload thành công
        try {
            const res = await fetch(ggApiUrl, {
                method: "POST",
                body: body
            });
            const data = await res.json();
            if (data.success) {
                uploadSuccess = true;
                url = data.url;
                name = data.name;
                fileId = data.id;
                dossierFiles.push(data);
                message = `✅ Upload thành công: <a href='${url}' target='_blank'>${name}</a>`;
            } else {
                message = "❌ Lỗi: " + data.error;
            }
            // Sau khi upload thành công, load lại danh sách file đã upload
            if (uploadSuccess) {
                // const dossierFiles = await getDossierFiles(folderName, id);
                // Tìm lại fileDiv và cập nhật danh sách file đã upload
                const uploadedFilesDiv = document.getElementById(`uploaded-files-${id}`);
                if (uploadedFilesDiv) {
                    let html = '';
                    const filtered = Array.isArray(dossierFiles) ? dossierFiles.filter(f => f.templateFileId == id) : [];
                    if (filtered.length) {
                        filtered.forEach(f => {
                            html += `<div class='uploaded-file-item'>
                                <a href='${f.url}' target='_blank'>${f.name}</a>
                                <button class='action-btn' style='margin-left: 10px' onclick='removeFile("${fileId}", "${id}")'>Xóa</button>
                            </div>`;
                        });
                    } else {
                        html = `<div class='uploaded-file-item'>Chưa có file nào.</div>`;
                    }
                    uploadedFilesDiv.innerHTML = html;
                }
            }
            // Hiện modal thông báo
            showModal('notification', {success: uploadSuccess, message, url, name});
        } catch (err) {
            message = "❌ Upload thất bại: " + err.message;
            showModal('notification', {success: uploadSuccess, message, url, name});
        }
        //result.innerText = "";

        // Clear input file
        fileInput.value = '';

        // Reset nút
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('btn-loading');
            const spinner = btn.querySelector('.spinner-svg');
            if (spinner) spinner.remove();
        }
    };
    reader.readAsDataURL(file);
}


// Hàm gọi API lưu dossier file
async function saveDossierFile ({ dossierId, templateFileId, templateShorten, fileName, url, formdata }) {
    try {
        const body = new URLSearchParams();
        body.append('action', 'saveDossierFile');
        body.append('dossierId', dossierId);
        body.append('templateFileId', templateFileId);
        body.append('templateShorten', templateShorten);
        body.append('fileName', fileName);
        body.append('url', url);
        body.append('formdata', formdata);
        const res = await fetch(ggApiUrl, {
            method: 'POST',
            body: body
        });
        const data = await res.json();
        const modal = document.getElementById('modal-confirm');
        let spin = document.getElementById('spin-confirm');
        spin.classList.remove('spinning');
        spin.style.display = 'none';
        modal.style.display = 'none';

        if (data && data.success) {
            let previewBtn = document.getElementById(`preview-btn-${templateFileId}`);
            if (previewBtn) {
                previewBtn.classList.remove('action-btn-disabled');
                previewBtn.removeAttribute('disabled');
            }
            showModal('notification', { message: "Ghi lại thành công." });
        } else {
            showModal('notification', { message: "Lỗi ghi lại: " + (data && data.error ? data.error : "") });
        }
        console.log('Save dossier file result:', data);
    } catch (err) {
        console.error('Save dossier file error:', err);
    }
}

function removeFile(fileId, templateFileId) {
    showModal('delete', {message: 'Bạn có chắc chắn muốn xoá file này?', templateFileId: templateFileId, fileId: fileId});
}

// Xoá file đã upload trong dossierFiles theo id, hiệu ứng như nút upload
async function removeUploadedFileHandler(fileId, templateFileId) {
    let data = { success: false };
    let message = '';
    try {
        const res = await fetch(ggApiUrl + '?action=deleteDossierFile&id=' + encodeURIComponent(fileId), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        data = await res.json();
        
        const modal = document.getElementById('modal-confirm');
        let spin = document.getElementById('spin-confirm');

        spin.classList.remove('spinning');
        spin.style.display = 'none';
        modal.style.display = 'none';
        
        const result = document.getElementById(`uploaded-files-${templateFileId}`);
        result.innerHTML = '';
        showModal('notification', {success: data.success, message: 'Xoá file thành công!'});
    } catch (err) {
        message = '❌ Xoá thất bại: ' + err.message;
    }
}

function convertDateFormat(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function generateForm(jsonData, formId, formData) {
    let html = '';
    if (!Array.isArray(jsonData)) return html;
    jsonData.forEach(section => {
        html += `<fieldset class="form-section"><legend class="legend-label">${section.title || ''}</legend>`;
        section.child.forEach(field => {
            if ((field.type === 'table' && Array.isArray(field.columns)) || (field.type === 'specialTable' && Array.isArray(field.columns))) {
                // Table with add/remove row buttons
                const tableId = `${formId}_${field.id}`;
                html += `<div class="form-row"><label>${field.label || ''}</label><table class="dynamic-table" id="${tableId}"><thead><tr>`;
                field.columns.forEach(col => {
                    html += `<th>${col.header}</th>`;
                });
                html += `<th style='width:40px;text-align:center'>#</th>`;
                html += `</tr></thead><tbody>`;
                // Initial row
                let tableData = formData[field.id] || [];
                let tableLength = (Array.isArray(tableData) && tableData.length) ? tableData.length : 1;
                for (let i = 0; i < tableLength; i++) {
                    html += `<tr>`;
                    field.columns.forEach((col, idx) => {
                        html += `<td><input type="${col.type || 'text'}" value="${tableData && tableData[i] ? tableData[i][col.field] : ''}" class="${col.field}" name="${tableId}_${col.field}" ${field.pattern ? ` pattern='${field.pattern}'` : ''}/></td>`;
                    });
                    html += `<td style='text-align:center'>`;
                    html += `<button type='button' class='table-btn' onclick='addTableRow("${tableId}", ${JSON.stringify(field.columns).replace(/'/g,"&#39;")})'>+</button>`;
                    html += `<button type='button' class='table-btn' onclick='removeTableRow(this)'>-</button>`;
                    html += `</td></tr>`;
                }
                html += `</tbody></table></div>`;
            } else if (field.type === 'select' && Array.isArray(field.options)) {
                html += `<div class="form-row"><label for="${formId}_${field.id}" >${field.label || ''}</label><select id="${formId}_${field.id}" name="${formId}_${field.id}"${field.required ? ' required' : ''}${field.readonly ? ' disabled' : ''}>`;
                field.options.forEach(opt => {
                    if (opt.value === formData[field.id]) html += `<option value="${opt.value}" selected>${opt.text}</option>`;
                    else html += `<option value="${opt.value}">${opt.text}</option>`;
                });
                html += `</select></div>`;
            } else if (field.type === 'date') {
                html += `<div class="form-row"><label>${field.label || ''}</label><input type="${field.type || 'text'}" value="${convertDateFormat(formData[field.id] || '')}" id="${formId}_${field.id}" name="${formId}_${field.id}" placeholder="${field.placeholder || ''}"${field.required ? ' required' : ''}${field.readonly ? ' readonly' : ''}${field.pattern ? ` pattern='${field.pattern}'` : ''}></div>`;
            } else if (field.type === 'textarea') {
                html += `<div class="form-row"><label>${field.label || ''}</label><textarea id="${formId}_${field.id}" name="${formId}_${field.id}" placeholder="${field.placeholder || ''}"${field.required ? ' required' : ''}${field.readonly ? ' readonly' : ''}>${formData[field.id] || ''}</textarea></div>`;
            } else {
                html += `<div class="form-row"><label>${field.label || ''}</label><input type="${field.type || 'text'}" value="${formData[field.id] || ''}" id="${formId}_${field.id}" name="${formId}_${field.id}" placeholder="${field.placeholder || ''}"${field.required ? ' required' : ''}${field.readonly ? ' readonly' : ''}${field.pattern ? ` pattern='${field.pattern}'` : ''}></div>`;
            }
        });
        html += `</fieldset>`;
    });
    return html;
}

function saveFormData(formId) {
    let dossierDetail = JSON.parse(sessionStorage.getItem('dossierDetail') || '{}');
    let form = JSON.parse(dossierDetail.files.find(f => f.id === formId).form || '[]');
    let formData = {};
    let firstInvalid = null;
    let errorMessage = '';

    form.forEach(section => {
        section.child.forEach(field => {
            if (field.type === 'table' || field.type === 'specialTable') {
                const tableId = `${formId}_${field.id}`;
                const table = document.getElementById(tableId);
                if (table) {
                    const rows = table.querySelectorAll('tbody tr');
                    formData[field.id] = [];
                    rows.forEach(row => {
                        const rowData = {};
                        let rowValid = true;
                        field.columns.forEach((col, idx) => {
                            const input = row.querySelectorAll('td input')[idx];
                            if (input) {
                                rowData[col.field] = input.value;
                                if (col.required && !input.value && rowValid) {
                                    rowValid = false;
                                    if (!firstInvalid) firstInvalid = input;
                                    errorMessage = `Vui lòng nhập đầy đủ trường "${col.header}" trong bảng "${field.label}"`;
                                }
                            }
                        });
                        formData[field.id].push(rowData);
                    });
                }
            } else if (field.type === 'select') {
                const select = document.getElementById(`${formId}_${field.id}`);
                if (select) {
                    formData[field.id] = select.value;
                    formData[`${field.id}_text`] = select.options[select.selectedIndex].text;
                    if (field.required && !select.value && !firstInvalid) {
                        firstInvalid = select;
                        errorMessage = `Vui lòng chọn trường "${field.label}"`;
                    }
                }
            } else if (field.type === 'date') {
                const input = document.getElementById(`${formId}_${field.id}`);
                if (input) {
                    const [year, month, day] = input.value.split("-");
                    const formatted = `${day}/${month}/${year}`;
                    formData[field.id] = formatted;
                    if (field.required && !input.value && !firstInvalid) {
                        firstInvalid = input;
                        errorMessage = `Vui lòng nhập trường "${field.label}"`;
                    }
                }
            } else {
                const input = document.getElementById(`${formId}_${field.id}`);
                if (input) {
                    formData[field.id] = input.value;
                    if (field.required && !input.value && !firstInvalid) {
                        firstInvalid = input;
                        errorMessage = `Vui lòng nhập trường "${field.label}"`;
                    }
                }
            }
        });
    });

    if (firstInvalid) {
        if (typeof firstInvalid.focus === 'function') firstInvalid.focus();
        showModal('notification', { message: errorMessage });
        return;
    }

    // Hiển thị spinner ở nút ghi lại
    let spin = document.getElementById('spin-confirm');
    spin.classList.add('spinning');
    spin.style.display = 'inline-block';

    // Gọi API lưu dossier file
    const dossierId = dossierDetail.id || '';
    const fileObj = dossierDetail.files.find(f => f.id === formId) || {};
    const templateFileId = fileObj.id || '';
    const templateShorten = fileObj.shorten || '';
    const fileName = (dossierId + '_' + templateShorten) || '';
    const url = fileObj.url || '';

    saveDossierFile ({
        dossierId,
        templateFileId,
        templateShorten,
        fileName,
        url,
        formdata: JSON.stringify(formData)
    });

    console.log('Form Data to save:', formData);
    previewSettings.find(f => f.id === formId).formdata = formData;
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
        input.className = col.field;
        input.name = `${tableId}_${col.field}`;
        // Bind sự kiện đúng cách
        input.addEventListener("input", function() {
            applyRules(rules, tableId.split('_')[0]);
        });
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

function numberToVietnamese(amount) {
    if (typeof amount !== "number") amount = parseInt(amount, 10);
    if (isNaN(amount) || amount === 0) return "không đồng";

    const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

    function readThreeDigits(num) {
        let hundred = Math.floor(num / 100);
        let ten = Math.floor((num % 100) / 10);
        let unit = num % 10;
        let result = "";

        if (hundred > 0) {
            result += digits[hundred] + " trăm";
            if (ten === 0 && unit > 0) result += " linh";
        }

        if (ten > 1) {
            result += " " + digits[ten] + " mươi";
            if (unit === 1) result += " mốt";
            else if (unit === 5) result += " lăm";
            else if (unit > 1 && unit !== 5) result += " " + digits[unit];
        } else if (ten === 1) {
            result += " mười";
            if (unit === 1) result += " một";
            else if (unit === 5) result += " lăm";
            else if (unit > 1 && unit !== 5) result += " " + digits[unit];
        } else if (ten === 0 && hundred === 0 && unit > 0) {
            result += digits[unit];
        } else if (ten === 0 && hundred > 0 && unit > 0) {
            result += " " + digits[unit];
        }

        return result.trim();
    }

    // Tách nhóm 3 chữ số từ phải sang trái
    let parts = [];
    while (amount > 0) {
        parts.push(amount % 1000);
        amount = Math.floor(amount / 1000);
    }

    // Đọc từ nhóm cao nhất xuống
    let result = "";
    for (let i = parts.length - 1; i >= 0; i--) {
        let group = parts[i];
        if (group > 0) {
            result += readThreeDigits(group) + " " + units[i] + " ";
        }
    }

    // Chuẩn hóa
    result = result.trim();
    result = result.charAt(0).toUpperCase() + result.slice(1) + " đồng";

    return result;
}


//end dossier js


// Hàm điền dữ liệu vào template
function populateTemplate(formdata, form, container) {
    form.forEach(section => {
        section.child.forEach(field => {
            if (field.type === 'table') {
                const tableId = `${field.id}`;
                const table = container.querySelector(`#${tableId}`);
                if (table) {
                    const tbody = table.querySelector('tbody');
                    if (tbody) {
                        tbody.innerHTML = '';
                        (formdata[field.id] || []).forEach(row => {
                            const tr = document.createElement('tr');
                            field.columns.forEach(col => {
                                const td = document.createElement('td');
                                td.innerText = row[col.field] || '';
                                if (col.field !== 'ten') {
                                    td.style.textAlign = 'center';
                                }
                                tr.appendChild(td);
                            });
                            tbody.appendChild(tr);
                        });
                    }
                }
            } else if (field.type === 'specialTable') {
                const tableId = `${field.id}`;
                const length = (formdata[field.id] || []).length;
                const input = container.querySelector(`#${tableId}_text`);
                if (input) {
                    if (length < 10) {
                        input.innerText = `0${length}` || '';
                    } else {
                        input.innerText = length || '';
                    }
                }
                const specialContainer = document.createElement('div');
                specialContainer.style.margin = '8px 0';
                specialContainer.style.textAlign = 'justify';
                (formdata[field.id] || []).forEach((row, index) => {
                    const p = document.createElement('p');
                    if (index == (length - 1)) {
                        p.innerHTML = `+ Lần ${index + 1}: Bên A thanh toán cho bên B số tiền còn lại là: <strong>${row.tien} đ</strong> (Bằng chữ: ${row.chu}) ${row.dieukien}.`;
                    } else {
                        p.innerHTML = `+ Lần ${index + 1}: Bên A thanh toán cho bên B số tiền là: <strong>${row.tien} đ</strong> (Bằng chữ: ${row.chu}) ${row.dieukien}.`;
                    }
                    specialContainer.appendChild(p);
                });
                const tableEl = container.querySelector(`#${tableId}`);
                if (tableEl && tableEl.parentNode) {
                    tableEl.parentNode.replaceChild(specialContainer, tableEl);
                }
            } else if (field.type === 'select') {
                const select = container.querySelector(`#${field.id}`);
                if (select) {
                    select.innerText = formdata[field.id + '_text'] || '';
                }
            } else if (field.type === 'date') {
                const input = container.querySelector(`#${field.id}`);
                if (input) {
                    let [day, month, year] = (formdata[field.id] || '').split("/");
                    input.innerText = `ngày ${day} tháng ${month} năm ${year}`;
                }
            } else if (field.type === 'textarea') {
                const textarea = container.querySelector(`#${field.id}`);
				let dataVal = formdata[field.id].replaceAll("\n", "<br>");
                if (textarea) {
                    textarea.innerHTML = dataVal || '';
                }
            } else {
                const input = container.querySelector(`#${field.id}`);
                if (input) {
                    if (field.pattern && formdata[field.id] < 10) {
                        input.textContent = `0${formdata[field.id]}` || '';
                    } else {
                        input.textContent = formdata[field.id] || '';
                    }
                }
            }
        });
    });
}

// Hàm mở modal và import file HTML (ví dụ LEDHD.html)
async function showPreviewModal(htmlFilePath, formId) {
    const modal = document.getElementById('modal-preview');
    const previewHtml = document.getElementById('preview-html');
    previewHtml.innerHTML = 'Đang tải...';
    modal.style.display = 'flex';
    previewSettings.find(f => {
        if (f.id === formId) {
            previewFormData = f.formdata;
            previewForm = f.form;
        }
    });
    try {
        const res = await fetch(htmlFilePath);
        const html = await res.text();
        previewHtml.innerHTML = html;        

        // Inject dữ liệu vào template
        if (previewFormData && previewForm) {
            populateTemplate(previewFormData, previewForm, previewHtml);
        }
    } catch (err) {
        previewHtml.innerHTML = '<p style="color:red">Không thể tải file!</p>';
    }
}

function closePreview() {
    document.getElementById('modal-preview').style.display = 'none';
    document.getElementById('preview-html').innerHTML = '';
}

// Hàm có cắt file thành nhiều trang, nhưng đôi khi bị lỗi cắt trang không đúng chỗ
// function downloadPDF() {
//     const element = document.getElementById('preview-html');
//     const opt = {
//         margin: [10, 10, 10, 10], // mm
//         filename: 'file-xem-thu.pdf',
//         image: { type: 'jpeg', quality: 0.98 },
//         html2canvas: {
//             scale: 1.5,
//             scrollY: 0,
//             useCORS: true
//         },
//         jsPDF: {
//             unit: 'mm',
//             format: 'a4',
//             orientation: 'portrait'
//         },
//         pagebreak: { 
//             mode: ['css'], 
//             avoid: 'tr' 
//         }
//     };

//     // Giảm lỗi cắt border + trang trắng
//     element.style.background = '#fff'; 
//     element.style.paddingBottom = '1px'; // giúp html2pdf tính chiều cao đúng

//     html2pdf()
//         .set(opt)
//         .from(element)
//         .toPdf()
//         .get('pdf')
//         .then(function (pdf) {
//         // Xóa trang trắng cuối nếu có (page rỗng hoặc rất nhỏ)
//         const totalPages = pdf.internal.getNumberOfPages();
//         const lastPage = pdf.internal.pages[totalPages];
//         if (lastPage && lastPage.length <= 2) {
//             pdf.deletePage(totalPages);
//         }
//         })
//         .save();
// }

function collectCSS() {
    let cssText = '';
    for (const sheet of document.styleSheets) {
        try {
        for (const rule of sheet.cssRules) {
            cssText += rule.cssText + '\n';
        }
        } catch (e) {
        
        }
    }
    return cssText;
}

function downloadPDF() {
    const element = document.getElementById('preview-html');

    const opt = {
        margin: [10, 10, 10, 10], // mm
        filename: downloadFileName + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 1.5,
            scrollY: 0,
            useCORS: true
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait'
        },
        // Loại bỏ cấu hình pagebreak để không tự cắt trang
        // pagebreak: false
    };

    element.style.background = '#fff';
    element.style.paddingBottom = '1px';

    html2pdf()
        .set(opt)
        .from(element)
        .save();
}


function downloadWord() {
    const element = document.getElementById('preview-html');
    const css = collectCSS();
    const html = `
        <html>
            <head>
                <meta charset="utf-8">
                <style>${css}</style>
            </head>
            <body>${element.innerHTML}</body>
        </html>
    `;
    const options = {
        orientation: 'portrait',
        margins: { top: 720, right: 720, bottom: 720, left: 720 }
    };
    const converted = window.htmlDocx.asBlob(html, options);
    saveAs(converted, downloadFileName + '.docx');
}

function createDossier() {
    document.getElementById('createDossierModal').style.display = 'flex';
}

function closeDossierModal() {
    document.getElementById('createDossierModal').style.display = 'none';
}

document.getElementById('dossierForm').onsubmit = async function(e) {
    e.preventDefault();
    // Lấy dữ liệu từ form
    const name = document.getElementById('dossierName').value;
    const customer = document.getElementById('dossierCustomer').value;
    const procedure = document.getElementById('dossierProcedure').value;
    const status = document.getElementById('dossierStatus').value;
    const type = document.getElementById('dossierType').value;

    // Gọi API tạo hồ sơ
    try {
        const res = await fetch('YOUR_API_URL?action=createDossier'
        + '&name=' + encodeURIComponent(name)
        + '&customer=' + encodeURIComponent(customer)
        + '&procedure=' + encodeURIComponent(procedure)
        + '&status=' + encodeURIComponent(status)
        + '&type=' + encodeURIComponent(type)
        );
        const data = await res.json();
        if (data.success) {
        alert('Tạo hồ sơ thành công!');
        closeDossierModal();
        // TODO: reload lại danh sách hồ sơ nếu cần
        } else {
        alert('Lỗi: ' + (data.message || 'Không tạo được hồ sơ'));
        }
    } catch (err) {
        alert('Lỗi kết nối API');
    }
};