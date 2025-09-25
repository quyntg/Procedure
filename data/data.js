const ggApiUrl = 'https://script.google.com/macros/s/AKfycbyUWAmBNwl3QUua9JCBk9nsIVi_LuKlW1_llsNSqHgTtbPjlkx9AC0gPP5G4z_9dQ0z/exec';
// Dữ liệu mẫu cho thủ tục (có phân cấp)

const procedures = [
    { id: 1, name: 'Thủ tục A', counter: 10, children: [
        { id: 11, name: 'Thủ tục A1', counter: 5 },
        { id: 12, name: 'Thủ tục A2', counter: 5 }
    ]},
    { id: 2, name: 'Thủ tục B', counter: 18, children: [
        { id: 21, name: 'Thủ tục B1', counter: 6 },
        { id: 22, name: 'Thủ tục B2', counter: 6 },
        { id: 23, name: 'Thủ tục B3', counter: 6 }
    ]},
    { id: 3, name: 'Thủ tục C', counter: 5, children: [
        { id: 31, name: 'Thủ tục C1', counter: 5 }
    ] },
    { id: "procedure", name: 'Quy trình', children: [] }
];

// Dữ liệu mẫu cho hồ sơ tổng
const sample_records = Array.from({length: 100}, (_, i) => ({
    id: 'HS' + (i+1).toString().padStart(3, '0'),
    name: 'Hồ sơ ' + (i+1),
    type: ['1', '2', '3'][i%3],
    subType: ['1', '2', '3'][i%3] + ['1', '2', '3'][i%2],
    customer: 'Khách hàng ' + (i+1),
    status: ['Đang xử lý', 'Chờ duyệt', 'Hoàn thành'][i%3],
    date: '2025-09-' + ((i%30)+1).toString().padStart(2, '0')
}));

// Dữ liệu mẫu cho từng child (test)
const childRecords = {
    11: [
        {id: 'A1-01', name: 'Hồ sơ A1-01', customer: 'KH A1', status: 'Đang xử lý', date: '2025-09-01'},
        {id: 'A1-02', name: 'Hồ sơ A1-02', customer: 'KH A1', status: 'Chờ duyệt', date: '2025-09-02'}
    ],
    12: [
        {id: 'A2-01', name: 'Hồ sơ A2-01', customer: 'KH A2', status: 'Hoàn thành', date: '2025-09-03'}
    ],
    21: [
        {id: 'B1-01', name: 'Hồ sơ B1-01', customer: 'KH B1', status: 'Đang xử lý', date: '2025-09-04'}
    ],
    22: [
        {id: 'B2-01', name: 'Hồ sơ B2-01', customer: 'KH B2', status: 'Chờ duyệt', date: '2025-09-05'}
    ],
    23: [
        {id: 'B3-01', name: 'Hồ sơ B3-01', customer: 'KH B3', status: 'Hoàn thành', date: '2025-09-06'}
    ]
};

const steps = [{
    id: "B1",
    title: "Tiếp nhận",
    desc: "Nhận yêu cầu, ghi nhận thông tin cơ bản."
}, {
    id: "B2",
    title: "Chuẩn bị",
    desc: "Chuẩn bị tài liệu, công cụ và nhân sự."
}, {
    id: "B3",
    title: "Xử lý",
    desc: "Thực hiện các bước xử lý chính."
}, {
    id: "B4",
    title: "Kiểm tra",
    desc: "Kiểm thử, review kết quả."
}, {
    id: "B5",
    title: "Duyệt",
    desc: "Duyệt nội dung/phiên bản để phát hành."
}, {
    id: "B6",
    title: "Hoàn thiện",
    desc: "Hoàn thiện các công việc còn lại."
}, {
    id: "B7",
    title: "Phát hành",
    desc: "Đưa sản phẩm/dữ liệu vào môi trường thật."
}, {
    id: "B8",
    title: "Theo dõi",
    desc: "Theo dõi hoạt động, thu thập phản hồi."
}, {
    id: "B9",
    title: "Báo cáo",
    desc: "Tổng kết và lập báo cáo hoàn tất."
}, ];

// Spinner SVG template
const SPINNER_SVG = '<svg class="spinner-svg" width="24" height="24" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">\
    <circle class="spinner-bg" cx="25" cy="25" r="20" stroke="#bae6fd" stroke-width="5"/>\
    <circle class="spinner-fg" cx="25" cy="25" r="20" stroke="#0ea5e9" stroke-width="5" stroke-linecap="round" stroke-dasharray="90 60"/>\
</svg>';