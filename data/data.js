// Dữ liệu mẫu cho thủ tục (có phân cấp)
const procedures = [
    { id: 1, name: 'Thủ tục A', children: [
        { id: 11, name: 'Thủ tục A1' },
        { id: 12, name: 'Thủ tục A2' }
    ]},
    { id: 2, name: 'Thủ tục B', children: [
        { id: 21, name: 'Thủ tục B1' },
        { id: 22, name: 'Thủ tục B2' },
        { id: 23, name: 'Thủ tục B3' }
    ]},
    { id: 3, name: 'Thủ tục C', children: [] }
];

// Dữ liệu mẫu cho hồ sơ
const records = Array.from({length: 100}, (_, i) => ({
    id: 'HS' + (i+1).toString().padStart(3, '0'),
    name: 'Hồ sơ ' + (i+1),
    customer: 'Khách hàng ' + (i+1),
    status: ['Đang xử lý', 'Chờ duyệt', 'Hoàn thành'][i%3],
    date: '2025-09-' + ((i%30)+1).toString().padStart(2, '0')
}));