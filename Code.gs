/**
 * ============================================================================
 *  CODE.GS — Backend Sinkronisasi Aplikasi Jurnal Literasi
 *  Tempel skrip ini di: Spreadsheet "DATA BASE LITERASI" > Extensions >
 *  Apps Script, lalu Deploy > New deployment > Web app.
 *
 *  Pengaturan deploy:
 *    - Execute as   : Me (akun pemilik spreadsheet)
 *    - Who has access: Anyone
 *
 *  Setelah deploy, salin URL "/exec" dan tempel ke menu Pengaturan aplikasi.
 * ============================================================================
 */

var HEADER_ROW = 2;      // baris judul kolom (baris 1 adalah judul sheet)
var DATA_START_ROW = 3;  // data mulai dari baris ini

// ID spreadsheet DATA BASE LITERASI. Dikunci langsung (bukan getActiveSpreadsheet())
// supaya tetap berfungsi walau dijalankan lewat Web App tanpa konteks UI aktif.
var SPREADSHEET_ID = "15NlIxjp42xlC-Bm-7rEvJtrS2T1jpP8R6EneKrBpeuM";

// Header baku setiap sheet — dipakai untuk MEMBUAT OTOMATIS sheet yang belum
// ada (mis. terhapus tak sengaja, atau nama sheet baru dari aplikasi siswa)
// supaya sinkron tidak pernah gagal hanya karena tab belum tersedia.
var SHEET_HEADERS = {
  "00Roster Siswa": ["Kelas", "NISN", "Nama", "L/P"],
  "00Kontak Orang Tua": ["NISN", "Nama", "Kelas", "No HP Orang Tua"],
  "01Jurnal Literasi Siswa": ["Kelas", "NISN", "Siswa", "Bulan", "Wali Kelas", "Kepala Sekolah", "No", "Tanggal", "Judul", "Halaman", "Kesan", "Paraf"],
  "02Format Administrasi Guru": ["Kelas", "Bulan", "Wali Kelas", "Kepala Sekolah", "No", "NISN", "Nama", "Pertemuan1", "Pertemuan2", "TLP2", "TLP4"],
  "03Dokumentasi Kegiatan": ["Kelas", "Tema", "Pertemuan", "Wali Kelas", "Kepala Sekolah", "No", "Deskripsi", "Tautan", "Paraf"],
  "04Rekap Hasil Literasi": ["Kelas", "Bulan", "Wali Kelas", "Kepala Sekolah", "No", "NISN", "Nama", "Produk", "Presentasi", "Karya", "Predikat"],
  "05Paspor Literasi Siswa": ["Kelas", "NISN", "Siswa", "Tahun", "Target", "No", "Bulan", "Judul", "Genre", "ParafGuru", "ParafOrtu", "Bintang"],
  "✎Jurnal Membaca Guru": ["Kelas", "Bulan", "No", "Tanggal", "Judul", "Halaman", "Refleksi", "Dibagikan"]
};

// Sheet-sheet baru ini dibuat otomatis (kalau belum ada) sebagai sumber data
// tunggal untuk NISN siswa & nomor HP orang tua — menggantikan ketergantungan
// pada spreadsheet roster eksternal yang formatnya belum pasti/lengkap.
var ROSTER_SHEET_NAME = "00Roster Siswa";
var CONTACT_SHEET_NAME = "00Kontak Orang Tua";

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/** Ambil sheet by name; kalau belum ada, BUAT OTOMATIS lengkap dengan baris
 *  judul (baris 1) & header kolom (baris 2) sesuai SHEET_HEADERS. Kalau nama
 *  sheet tidak dikenal di SHEET_HEADERS, header diambil dari fallbackHeaders
 *  (biasanya kunci object payload.row saat action=append) sebagai cadangan. */
function getOrCreateSheet_(ss, sheetName, fallbackHeaders) {
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  sheet = ss.insertSheet(sheetName);
  var headers = SHEET_HEADERS[sheetName] || fallbackHeaders || [];
  sheet.getRange(1, 1, 1, 1).setValue(sheetName).setFontWeight("bold");
  if (headers.length) {
    var headerRange = sheet.getRange(HEADER_ROW, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight("bold").setBackground("#e6f4ec");
    sheet.setFrozenRows(HEADER_ROW);
  }
  return sheet;
}

function doGet(e) {
  try {
    var sheetName = e.parameter.sheet;
    var ss = getSpreadsheet_();

    if (!sheetName) {
      var names = ss.getSheets().map(function (sh) { return sh.getName(); });
      return jsonResponse({ status: "ok", sheets: names });
    }

    // auto-create supaya GET tidak pernah gagal hanya karena tab belum ada
    var sheet = getOrCreateSheet_(ss, sheetName, null);
    return jsonResponse({ status: "ok", data: readSheetData(sheet) });
  } catch (err) {
    return jsonResponse({ status: "error", message: String(err) });
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var sheetName = payload.sheet;
    var action = payload.action;

    var ss = getSpreadsheet_();
    var fallbackHeaders = (action === "append" && payload.row) ? Object.keys(payload.row) : null;
    var sheet = getOrCreateSheet_(ss, sheetName, fallbackHeaders);

    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0]
      .map(function (h) { return String(h).trim(); });

    if (action === "append") {
      var rowArr = headers.map(function (h) {
        return (payload.row && payload.row[h] !== undefined) ? payload.row[h] : "";
      });
      sheet.appendRow(rowArr);
      return jsonResponse({ status: "ok", row: sheet.getLastRow() });
    }

    if (action === "update") {
      var rIdx = parseInt(payload.rowIndex, 10);
      if (!rIdx || rIdx < DATA_START_ROW) return jsonResponse({ status: "error", message: "rowIndex tidak valid" });
      var rowArr2 = headers.map(function (h) {
        return (payload.row && payload.row[h] !== undefined) ? payload.row[h] : "";
      });
      sheet.getRange(rIdx, 1, 1, headers.length).setValues([rowArr2]);
      return jsonResponse({ status: "ok" });
    }

    if (action === "delete") {
      var rIdx2 = parseInt(payload.rowIndex, 10);
      if (!rIdx2 || rIdx2 < DATA_START_ROW) return jsonResponse({ status: "error", message: "rowIndex tidak valid" });
      sheet.deleteRow(rIdx2);
      return jsonResponse({ status: "ok" });
    }

    return jsonResponse({ status: "error", message: "Aksi tidak dikenal: " + action });
  } catch (err) {
    return jsonResponse({ status: "error", message: String(err) });
  }
}

/** Membaca seluruh baris data sebuah sheet menjadi array of object,
 *  memakai baris ke-HEADER_ROW sebagai nama kolom. Setiap objek diberi
 *  properti tersembunyi _row = nomor baris asli (untuk update/hapus). */
function readSheetData(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < HEADER_ROW || lastCol < 1) return [];

  var headers = sheet.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  var out = [];
  if (lastRow < DATA_START_ROW) return out;

  var values = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, lastCol).getValues();
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    var hasData = false;
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      var val = row[c];
      if (val instanceof Date) val = Utilities.formatDate(val, Session.getScriptTimeZone(), "dd/MM/yyyy");
      obj[headers[c]] = (val === null || val === undefined) ? "" : String(val);
      if (obj[headers[c]]) hasData = true;
    }
    if (hasData) {
      obj._row = DATA_START_ROW + i;
      out.push(obj);
    }
  }
  return out;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
