const FOLDER_ID = "123VLlfdYBWCO5Tja282OtstxvoccyaIS";

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
	} else if (action === "getDossierDetail") {
		const id = e.parameter.id;
		result = JSON.stringify(getDossierDetail(id));
	} else if (action === "getDossierFiles") {
		const dossierId = e.parameter.dossierId;
		const templateFileId = e.parameter.templateFileId;
		result = JSON.stringify(getDossierFiles(dossierId, templateFileId));
	} else if (action === "deleteDossierFile") {
		const id = e.parameter.id;
		result = JSON.stringify(deleteDossierFile(id));
	} else if (action === "nextStepDossier") {
		const dossierId = e.parameter.dossierId;
		result = JSON.stringify(nextStepDossier(dossierId));
	} else if (action === "loadDossierFiles") {
		const dossierId = e.parameter.dossierId;
		result = JSON.stringify(loadDossierFiles(dossierId));
	} else if (action === "createDossier") {
		const name = e.parameter.name;
		const customer = e.parameter.customer;
		const procedure = e.parameter.procedure;
		const status = e.parameter.status;
		const type = e.parameter.type;
		result = JSON.stringify(createDossier(name, customer, procedure, status, type));
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

  const actions = {
    login: handleLogin,
    upload: handleUploadRequest,
    listFolders: handleListFolders,
    saveDossierFile: handleSaveDossierFile
    // thêm các action khác ở đây
  };

  if (actions[action]) {
    // Gọi function xử lý và stringify kết quả
    result = JSON.stringify(actions[action](e));
  } else {
    result = JSON.stringify({ error: "Invalid action" });
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

function handleLogin(e) {
  const username = e.parameter.username;
  const password = e.parameter.password;
  return login(username, password); // hàm login của bạn
}

// xử lý upload
function handleUploadRequest(e) {
  try {
    const fileData = e.parameter.fileData;
    const fileName = e.parameter.fileName || "unnamed";
    const mimeType = e.parameter.mimeType || "application/octet-stream";
    const folderName = e.parameter.folderName || "";
    const templateFileId = e.parameter.templateFileId || '';
    const templateShorten = e.parameter.templateShorten || '';
    const dossierId = e.parameter.dossierId || '';

    const file = saveFileToDrive(fileData, fileName, mimeType, folderName);

    // Ghi vào bảng dossierFiles
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('dossierFiles');
    if (!sheet) throw new Error('Sheet dossierFiles không tồn tại.');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    // Tìm id lớn nhất hiện tại
    let maxId = 0;
    for (let i = 1; i < data.length; i++) {
      const idStr = String(data[i][0] || '');
      if (/^DF\d{8}$/.test(idStr)) {
        const num = parseInt(idStr.slice(2), 10);
        if (num > maxId) maxId = num;
      }
    }
    const newId = 'DF' + String(maxId + 1).padStart(8, '0');
    // Kiểm tra file đã tồn tại (ghi đè): tìm theo dossierId + templateFileId + templateShorten
    let foundRow = -1;
    let now = new Date();
    let dd = String(now.getDate()).padStart(2, '0');
    let mm = String(now.getMonth() + 1).padStart(2, '0');
    let yyyy = now.getFullYear();
    let todayStr = dd + '/' + mm + '/' + yyyy;
    let dossierIdIdx = headers.indexOf('dossierId');
    let templateFileIdIdx = headers.indexOf('templateFileId');
    let templateShortenIdx = headers.indexOf('templateShorten');
    for (let i = 1; i < data.length; i++) {
      let row = data[i];
      if (
        row[dossierIdIdx] == dossierId &&
        row[templateFileIdIdx] == templateFileId &&
        row[templateShortenIdx] == templateShorten
      ) {
        foundRow = i + 1; // sheet row index (1-based)
        break;
      }
    }
    if (foundRow > 0) {
      // Ghi đè: chỉ cập nhật fileName, url, modifiedDate
      let nameIdx = headers.indexOf('name');
      let urlIdx = headers.indexOf('url');
      let modifiedIdx = headers.indexOf('modifiedDate');
      sheet.getRange(foundRow, nameIdx + 1).setValue(file.getName());
      sheet.getRange(foundRow, urlIdx + 1).setValue(file.getUrl());
      sheet.getRange(foundRow, modifiedIdx + 1).setValue(todayStr);
    } else {
      // Thêm mới
      let row = [];
      headers.forEach(h => {
        if (h === 'id') row.push(newId);
        else if (h === 'name') row.push(file.getName());
        else if (h === 'url') row.push(file.getUrl());
        else if (h === 'templateFileId') row.push(templateFileId);
        else if (h === 'templateShorten') row.push(templateShorten);
        else if (h === 'dossierId') row.push(dossierId);
        else if (h === 'data') row.push('');
        else if (h === 'createDate') row.push("'" + String(todayStr));
        else row.push('');
      });
      sheet.appendRow(row);
    }

    return {
      success: true,
      id: newId,
      templateFileId: templateFileId,
      name: file.getName(),
      url: file.getUrl()
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
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
  var counterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('counter');
  if (!sheet) {
    return { success: false, message: 'Sheet dossiers không tồn tại.' };
  }
  var dossiersData = sheet.getDataRange().getValues();
  var counterData = counterSheet.getDataRange().getValues();
  var headers = dossiersData.shift();
  var counterHeaders = counterData.shift();
  var procedureIdx = headers.indexOf('procedure');
  var statusIdx = headers.indexOf('status');
  var stepIdStepIdx = counterHeaders.indexOf('stepId');
  var procedureIdStepIdx = counterHeaders.indexOf('procedureId');
  var counterStepIdx = counterHeaders.indexOf('counter');
  var data = {};
  var dossiers = [];
  var counter = [];

  for (var i = 0; i < dossiersData.length; i++) {
    if (
      (procedure === '' || dossiersData[i][procedureIdx] == procedure) &&
      (status === '' || dossiersData[i][statusIdx] == status)
    ) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = dossiersData[i][j];
      }
      dossiers.push(row);
    }
  }

  if (procedure === '') {
    counterData.forEach(row => {
      if (row[stepIdStepIdx] === status) {
        procedure = row[procedureIdStepIdx];
      }
    });
  }
  for (var k = 0; k < counterData.length; k++) {
    if (counterData[k][procedureIdStepIdx] === procedure) {
      counter.push({
        stepId: counterData[k][stepIdStepIdx],
        counter: counterData[k][counterStepIdx] || 0
      });
    }
  }
  data['dossiers'] = dossiers;
  data['counter'] = counter;
  return data;
}

function getDossierDetail(id) {
  var dossiersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('dossiers');
  var stepsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('steps');
  var filesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('templateFiles');
  var dossierFilesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('dossierFiles');

  var dossiersData = dossiersSheet.getDataRange().getValues();
  var stepsData = stepsSheet.getDataRange().getValues();
  var filesData = filesSheet.getDataRange().getValues();
  var dossierFilesData = dossierFilesSheet.getDataRange().getValues();

  var dossiersHeaders = dossiersData.shift();
  var stepsHeaders = stepsData.shift();
  var filesHeaders = filesData.shift();
  var dossierFilesHeaders = dossierFilesData.shift();

  var idIdx = dossiersHeaders.indexOf('id');
  var statusIdx = dossiersHeaders.indexOf('status');
  var stepIdx = stepsHeaders.indexOf('id');
  var filesIdx = stepsHeaders.indexOf('files');
  var fileIdx = filesHeaders.indexOf('id');
  var dossierFileDossierIdIdx = dossierFilesHeaders.indexOf('dossierId');
  var templateFileIdIdx = dossierFilesHeaders.indexOf('templateFileId');
  var templateShortenIdx = dossierFilesHeaders.indexOf('templateShorten');
  var dataIdx = dossierFilesHeaders.indexOf('data');

  for (var i = 0; i < dossiersData.length; i++) {
    if (String(dossiersData[i][idIdx]) === String(id)) {
      var row = {};
      for (var j = 0; j < dossiersHeaders.length; j++) {
        row[dossiersHeaders[j]] = dossiersData[i][j];
      }
      var files = [];

      for (var k = 0; k < stepsData.length; k++) {
        if (stepsData[k][stepIdx] === dossiersData[i][statusIdx]) {
          var filesString = stepsData[k][filesIdx] || ''; 
          var filesArr = filesString.split(',').map(f => f.trim()).filter(f => f);

          for (var f = 0; f < filesArr.length; f++) {
            for (var h = 0; h < filesData.length; h++) {
              if (filesArr[f] === filesData[h][fileIdx]) {
                var fileObj = {};
                var dfArr = [];
                for (var m = 0; m < filesHeaders.length; m++) {
                  if (filesHeaders[m] === 'form') {
                    fileObj[filesHeaders[m]] = JSON.parse(JSON.stringify(filesData[h][m]));
                  } else {
                    fileObj[filesHeaders[m]] = filesData[h][m];
                  }
                }
                for (var n = 0; n < dossierFilesData.length; n++) {
                  if (dossierFilesData[n][dossierFileDossierIdIdx] === id && dossierFilesData[n][templateFileIdIdx] === filesData[h][fileIdx]) {
                    var dfObj = {};
                    for (var p = 0; p < dossierFilesHeaders.length; p++) {
                      dfObj[dossierFilesHeaders[p]] = dossierFilesData[n][p];
                    }
                    dfArr.push(dfObj);
                  }
                }
                fileObj['dossierFiles'] = dfArr;

                var mappings = JSON.parse(fileObj['mapping'] || '{}');
                var mappedData = {};
                mappings.forEach(key => {
                  for (var q = 0; q < dossierFilesData.length; q++) {
                    if (dossierFilesData[q][dossierFileDossierIdIdx] === id && dossierFilesData[q][templateShortenIdx] === key['mappingTemplateId']) {
                      var dataObj = JSON.parse(dossierFilesData[q][dataIdx] || '{}');
                      mappedData[key['field']] = dataObj[key['mappingField']] || '';
                    }
                  }
                });
                fileObj['mappedData'] = mappedData;
                Logger.log(mappedData)
                files.push(fileObj);
              }
            }
          }
        }
      }
      row['files'] = files;
      return row;
    }
  }
  return { success: false, message: 'Không tìm thấy hồ sơ với id này.' };
}

function handleListFolders(e) {
  const folders = [];
  const it = DriveApp.getFolders();
  while (it.hasNext() && folders.length < 20) {
    const f = it.next();
    folders.push({ id: f.getId(), name: f.getName() });
  }
  return ContentService.createTextOutput(
    JSON.stringify({ success: true, folders })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Nhận dữ liệu, tìm hoặc tạo folder con trong ROOT, rồi lưu file vào
 */
function saveFileToDrive(base64Data, fileName, mimeType, folderName) {
  // Xử lý chuỗi base64
  if (base64Data.indexOf('base64,') !== -1) {
    base64Data = base64Data.split('base64,')[1];
  }
  const decoded = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decoded, mimeType, fileName);

  // 📁 Lấy folder gốc
  const rootFolder = DriveApp.getFolderById(FOLDER_ID);

  // 📁 Tìm folder con theo tên trong folder gốc
  let targetFolder;
  if (folderName) {
    const folders = rootFolder.getFoldersByName(folderName);
    if (folders.hasNext()) {
      targetFolder = folders.next(); // folder đã tồn tại
    } else {
      targetFolder = rootFolder.createFolder(folderName); // tạo mới
    }
  } else {
    targetFolder = rootFolder;
  }

  // 📝 Ghi file vào folder đích
  // Nếu muốn overwrite file trùng tên thì kiểm tra trước
  const existingFiles = targetFolder.getFilesByName(fileName);
  if (existingFiles.hasNext()) {
    existingFiles.next().setTrashed(true); // bỏ file cũ vào thùng rác
  }

  const newFile = targetFolder.createFile(blob);
  return newFile; // trả về object file
}

// Lấy danh sách file đã upload theo dossierId
function getDossierFiles(dossierId, templateFileId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('dossierFiles');
  if (!sheet) return { success: false, message: 'Sheet dossierFiles không tồn tại.' };
  var data = sheet.getDataRange().getValues();
  var headers = data.shift();
  var dossierIdIdx = headers.indexOf('dossierId');
  var templateFileIdIdx = headers.indexOf('templateFileId');
  var result = [];
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][dossierIdIdx]) === String(dossierId) && String(data[i][templateFileIdIdx]) === String(templateFileId)) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      result.push(row);
    }
  }
  return result;
}

// Xoá file đã upload trong dossierFiles theo id
function deleteDossierFile(id) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('dossierFiles');
  if (!sheet) return { success: false, message: 'Sheet dossierFiles không tồn tại.' };
  var data = sheet.getDataRange().getValues();
  var headers = data.shift();
  var idIdx = headers.indexOf('id');
  var urlIdx = headers.indexOf('url');
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(id)) {
      // Xoá file trên Google Drive nếu có url
      var url = data[i][urlIdx];
      if (url) {
        try {
          var fileId = '';
          // Lấy fileId từ url dạng https://drive.google.com/file/d/FILE_ID/view?usp=drivesdk
          var match = url.match(/\/d\/([\w-]+)/);
          if (match && match[1]) fileId = match[1];
          if (fileId) {
            var file = DriveApp.getFileById(fileId);
            file.setTrashed(true);
          }
        } catch (err) {
          // Nếu lỗi vẫn tiếp tục xoá dòng
        }
      }
      sheet.deleteRow(i + 2); // +2 vì bỏ header và index 1-based
      return { success: true };
    }
  }
  return { success: false, message: 'Không tìm thấy file với id này.' };
}

function nextStepDossier(dossierId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('dossiers');
  var stepsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('steps');
  if (!sheet || !stepsSheet) {
    return { success: false, message: 'Sheet dossiers hoặc steps không tồn tại.' };
  }
  var data = sheet.getDataRange().getValues();
  var headers = data.shift();
  var idIdx = headers.indexOf('id');
  var statusIdx = headers.indexOf('status');
  var rowIdx = -1;
  var currentStatus = '';
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(dossierId)) {
      rowIdx = i + 2; // +2 vì header và index 1-based
      currentStatus = data[i][statusIdx];
      break;
    }
  }
  if (rowIdx === -1) {
    return { success: false, message: 'Không tìm thấy hồ sơ với id này.' };
  }

  // Tìm next step từ bảng steps
  var stepsData = stepsSheet.getDataRange().getValues();
  var stepsHeaders = stepsData.shift();
  var stepIdIdx = stepsHeaders.indexOf('id');
  var nextIdx = stepsHeaders.indexOf('next');
  var nextStep = '';
  for (var j = 0; j < stepsData.length; j++) {
    if (String(stepsData[j][stepIdIdx]) === String(currentStatus)) {
      nextStep = stepsData[j][nextIdx];
      break;
    }
  }
  if (!nextStep) {
    return { success: false, message: 'Không tìm thấy bước tiếp theo.' };
  }

  // Update status của hồ sơ
  sheet.getRange(rowIdx, statusIdx + 1).setValue(nextStep);

  return { success: true, nextStatus: nextStep };
}

// Lưu formdata vào dòng mới của dossierFiles
function handleSaveDossierFile(e) {
  try {
    const dossierId = e.parameter.dossierId || '';
    const templateFileId = e.parameter.templateFileId || '';
    const templateShorten = e.parameter.templateShorten || '';
    const formdata = e.parameter.formdata || '';
    const fileName = e.parameter.fileName || '';
    const url = e.parameter.url || '';

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('dossierFiles');
    if (!sheet) throw new Error('Sheet dossierFiles không tồn tại.');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    // Tìm id lớn nhất hiện tại
    let maxId = 0;
    for (let i = 1; i < data.length; i++) {
      const idStr = String(data[i][0] || '');
      if (/^DF\d{8}$/.test(idStr)) {
        const num = parseInt(idStr.slice(2), 10);
        if (num > maxId) maxId = num;
      }
    }
    const newId = 'DF' + String(maxId + 1).padStart(8, '0');
    let now = new Date();
    let dd = String(now.getDate()).padStart(2, '0');
    let mm = String(now.getMonth() + 1).padStart(2, '0');
    let yyyy = now.getFullYear();
    let todayStr = dd + '/' + mm + '/' + yyyy;

    // Kiểm tra đã tồn tại (ghi đè): tìm theo dossierId + templateFileId + templateShorten
    let foundRow = -1;
    let dossierIdIdx = headers.indexOf('dossierId');
    let templateFileIdIdx = headers.indexOf('templateFileId');
    let templateShortenIdx = headers.indexOf('templateShorten');
    for (let i = 1; i < data.length; i++) {
      let row = data[i];
      if (
        row[dossierIdIdx] == dossierId &&
        row[templateFileIdIdx] == templateFileId &&
        row[templateShortenIdx] == templateShorten
      ) {
        foundRow = i + 1; // sheet row index (1-based)
        break;
      }
    }
    if (foundRow > 0) {
      // Ghi đè: cập nhật data, fileName, url, modifiedDate
      let nameIdx = headers.indexOf('name');
      let urlIdx = headers.indexOf('url');
      let dataIdx = headers.indexOf('data');
      let modifiedIdx = headers.indexOf('modifiedDate');
      sheet.getRange(foundRow, nameIdx + 1).setValue(fileName);
      sheet.getRange(foundRow, urlIdx + 1).setValue(url);
      sheet.getRange(foundRow, dataIdx + 1).setValue(formdata);
      sheet.getRange(foundRow, modifiedIdx + 1).setValue("'" + String(todayStr));
      return {
        success: true,
        id: data[foundRow - 1][0],
        templateFileId: templateFileId,
        name: fileName,
        url: url,
        data: formdata,
        updated: true
      };
    } else {
      // Thêm mới
      let row = [];
      headers.forEach(h => {
        if (h === 'id') row.push(newId);
        else if (h === 'name') row.push(fileName);
        else if (h === 'url') row.push(url);
        else if (h === 'templateFileId') row.push(templateFileId);
        else if (h === 'templateShorten') row.push(templateShorten);
        else if (h === 'dossierId') row.push(dossierId);
        else if (h === 'data') row.push(formdata);
        else if (h === 'createDate') row.push("'" + String(todayStr));
        else row.push('');
      });
      sheet.appendRow(row);
      return {
        success: true,
        id: newId,
        templateFileId: templateFileId,
        name: fileName,
        url: url,
        data: formdata,
        created: true
      };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function createDossier(name, customer, procedure, status, type) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('dossiers');
  if (!sheet) return { success: false, message: 'Sheet dossiers không tồn tại.' };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  // Tìm id lớn nhất hiện tại
  let maxId = 0;
  for (let i = 1; i < data.length; i++) {
    const idStr = String(data[i][0] || '');
    if (/^D25\d{7}$/.test(idStr)) {
      const num = parseInt(idStr.slice(3), 10);
      if (num > maxId) maxId = num;
    }
  }
  const newId = 'D25' + String(maxId + 1).padStart(7, '0');
  let now = new Date();
  let dd = String(now.getDate()).padStart(2, '0');
  let mm = String(now.getMonth() + 1).padStart(2, '0');
  let yyyy = now.getFullYear();
  let todayStr = dd + '/' + mm + '/' + yyyy;

  // Tạo dòng mới
  let row = [];
  headers.forEach(h => {
    if (h === 'id') row.push(newId);
    else if (h === 'name') row.push(name);
    else if (h === 'customer') row.push(customer);
    else if (h === 'procedure') row.push(procedure);
    else if (h === 'status') row.push(status);
    else if (h === 'type') row.push(type);
    else if (h === 'createDate') row.push("'" + String(todayStr));
    else row.push('');
  });
  sheet.appendRow(row);

  return {
    success: true,
    id: newId,
    name,
    customer,
    procedure,
    status,
    type,
    createDate: todayStr,
    modifiedDate: ''
  };
}

function loadDossierFiles(dossierId) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('dossierFiles');
    if (!sheet) return { success: false, message: 'Sheet dossierFiles không tồn tại.' };
    var data = sheet.getDataRange().getValues();
    var headers = data.shift();
    var dossierIdIdx = headers.indexOf('dossierId');
    var result = [];
    for (var i = 0; i < data.length; i++) {
        if (String(data[i][dossierIdIdx]) === String(dossierId)) {
            var row = {};
            for (var j = 0; j < headers.length; j++) {
                row[headers[j]] = data[i][j];
            }
            result.push(row);
        }
    }
    return result;
}