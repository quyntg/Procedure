function doGet(e) {
	const action = e.parameter.action;
	let result;

	if (action === "getProceduresWithCounter") {
		result = JSON.stringify(getProceduresWithCounter());
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
	var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
	if (!sheet) {
		return {
			success: false,
			message: 'Sheet login không tồn tại.'
		};
	}
	var data = sheet.getDataRange().getValues();
  	const headers = data.shift();
	const usernameIdx = headers.indexOf('username');
	const passwordIdx = headers.indexOf('password');

	for (var i = 0; i < data.length; i++) { // Bỏ qua header
		if (data[i][usernameIdx] == username && data[i][passwordIdx] == password) {
			// Lấy dữ liệu bảng login (bỏ header)
			var users = [];
			for (var j = 0; j < data.length; j++) {
				var user = {};
				for (var k = 0; k < headers.length; k++) {
					user[headers[k]] = data[j][k];
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

// Lấy danh sách procedures kèm counter từ sheet procedure
function getProceduresWithCounter() {
  var procedureSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('procedures');
  var counterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('counter');
  if (!procedureSheet) {
      return { success: false, message: 'Sheet procedure không tồn tại.' };
  }
  if (!counterSheet) {
      return { success: false, message: 'Sheet counter không tồn tại.' };
  }
  var procedures = procedureSheet.getDataRange().getValues();
  var counters = counterSheet.getDataRange().getValues();
  var procedureHeaders = procedures[0];
  var counterHeaders = counters[0];
  var result = [];
	const procedureSheetIdx = procedureHeaders.indexOf('id');
	const counterSheetProcedureIdx = counterHeaders.indexOf('procedureId');
	const stepIdx = counterHeaders.indexOf('stepId');
	const counterIdx = counterHeaders.indexOf('counter');
	
  for (var i = 1; i < procedures.length; i++) {
    var row = {};
    for (var j = 0; j < procedureHeaders.length; j++) {
      row[procedureHeaders[j]] = procedures[i][j];
    }
    var steps = {};
    for (var k = 1; k < counters.length; k++) {
      if (counters[k][counterSheetProcedureIdx] == procedures[i][procedureSheetIdx]) {
        steps[counters[k][stepIdx]] = counters[k][counterIdx];	
      }
    }
    row['steps'] = steps;
    result.push(row);
  }
  Logger.log(result)
  return result;
}