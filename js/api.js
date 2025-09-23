function doGet(e) {
	const action = e.parameter.action;
	let result;

	if (action === "login") {
		result = JSON.stringify({
			error: "Vui lòng sử dụng POST để đăng nhập."
		});
	} else {
		result = JSON.stringify({
			error: "Invalid action"
		});
	}
	return ContentService
		.createTextOutput(result)
		.setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
	const action = e.parameter.action;
	let result;

	if (action === "login") {
		const username = e.parameter.username;
		const password = e.parameter.password;
		const loginResult = login(username, password);
		result = JSON.stringify(loginResult);
	} else {
		result = JSON.stringify({
			error: "Invalid action"
		});
	}
	return ContentService
		.createTextOutput(result)
		.setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
	return ContentService.createTextOutput("")
		.setMimeType(ContentService.MimeType.TEXT)
		.setHeader("Access-Control-Allow-Origin", "*")
		.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function login(username, password) {
	var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('login');
	if (!sheet) {
		return {
			success: false,
			message: 'Sheet login không tồn tại.'
		};
	}
	var data = sheet.getDataRange().getValues();
	for (var i = 1; i < data.length; i++) { // Bỏ qua header
		if (data[i][0] == username && data[i][1] == password) {
			// Lấy dữ liệu bảng login (bỏ header)
			var users = [];
			for (var j = 1; j < data.length; j++) {
				var user = {};
				for (var k = 0; k < data[0].length; k++) {
					user[data[0][k]] = data[j][k];
				}
				users.push(user);
			}
			return {
				success: true,
				message: 'Đăng nhập thành công!',
				users: users
			};
		}
	}
	return {
		success: false,
		message: 'Tên đăng nhập hoặc mật khẩu không đúng.'
	};
}