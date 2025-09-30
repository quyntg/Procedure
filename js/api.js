function doGet(e) {
	const action = e.parameter.action;
	let result;

	if (action === "getProceduresWithCounter") {
		result = JSON.stringify(getProceduresWithCounter());
	} else if (action === "getStepsByProcedureId") {
		const procedureId = e.parameter.procedureId;
		result = JSON.stringify(getStepsByProcedureId(procedureId));
	} else if (action === "getDossiers") {
		const procedure = e.parameter.procedure;
		const status = e.parameter.status;
		result = JSON.stringify(getDossiers(procedure, status));
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
	const stepNameIdx = counterHeaders.indexOf('stepName');
	const counterIdx = counterHeaders.indexOf('counter');
	
  for (var i = 1; i < procedures.length; i++) {
    var row = {};
    for (var j = 0; j < procedureHeaders.length; j++) {
      row[procedureHeaders[j]] = procedures[i][j];
    }
    var children = [];
    for (var k = 1; k < counters.length; k++) {
      if (counters[k][counterSheetProcedureIdx] == procedures[i][procedureSheetIdx]) {
        children.push({
          id: counters[k][stepIdx],
          name: counters[k][stepNameIdx],
          counter: counters[k][counterIdx] || 0
        });
      }
    }
    row['children'] = children;
    result.push(row);
  }
  return result;
}

function getStepsByProcedureId(procedureId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('steps');
  var data = sheet.getDataRange().getValues();
  var headers = data.shift();
  var result = [];
  const procedureIdIdx = headers.indexOf('procedureId');

  for (var i = 0; i < data.length; i++) {
    var row = {};
    if (data[i][procedureIdIdx] == procedureId) {
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      result.push(row);
    }
  }
  return result;
}

function getDossiers(procedure, status) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('dossiers');
  if (!sheet) {
    return { success: false, message: 'Sheet dossiers không tồn tại.' };
  }
  var data = sheet.getDataRange().getValues();
  var headers = data.shift();
  var procedureIdx = headers.indexOf('procedure');
  var statusIdx = headers.indexOf('status');
  var result = [];

  for (var i = 0; i < data.length; i++) {
    if (
      (procedure === '' || data[i][procedureIdx] == procedure) &&
      (status === '' || data[i][statusIdx] == status)
    ) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      result.push(row);
    }
  }
  return result;
}