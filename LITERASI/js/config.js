/* =========================================================================
   KONFIGURASI APLIKASI JURNAL LITERASI — SDIT MUHAMMADIYAH HARJAMUKTI
   =========================================================================
   Edit bagian ini jika ada perubahan wali kelas, kelas, atau ID spreadsheet.
   ========================================================================= */

const CONFIG = {
  // Nama sekolah (tampil di header & cetak PDF)
  namaSekolah: "SDIT MUHAMMADIYAH HARJAMUKTI - KOTA CIREBON",

  // ID Google Spreadsheet "DATA BASE LITERASI" (tempat data disimpan/disinkronkan)
  dbSpreadsheetId: "15NlIxjp42xlC-Bm-7rEvJtrS2T1jpP8R6EneKrBpeuM",

  // ID Google Spreadsheet "DAFTAR MURID KELAS 1-6" — TIDAK dipakai lagi sebagai
  // sumber data (formatnya belum punya NISN). Disimpan hanya untuk referensi lama.
  rosterSpreadsheetId: "16SR60Qk9bOvXczIXDfU9s6gpH7GjKI_shDcnZQVw1dw",

  // Nama tab di spreadsheet DATA BASE LITERASI yang menyimpan daftar siswa
  // (Kelas, NISN, Nama, L/P) dan kontak orang tua (NISN, No HP). Kedua sheet
  // ini dibuat otomatis oleh Code.gs saat pertama dibutuhkan, dan dikelola
  // lewat menu "Daftar Siswa" di aplikasi guru (tombol "+ Tambah/Edit Siswa").
  rosterSheetName: "00Roster Siswa",
  contactSheetName: "00Kontak Orang Tua",

  // URL Web App Google Apps Script (SINKRON baca/tulis ke DATA BASE LITERASI).
  // Sudah diisi sehingga aplikasi otomatis tersinkron saat pertama dibuka.
  // Bisa diganti kapan saja lewat menu Pengaturan bila URL deployment berubah.
  defaultScriptUrl: "https://script.google.com/macros/s/AKfycbyQRZHAkqthLaYl0yMUEbanJmV6_KiPVzjrwMqf1989TOf5IAfbbdxEklbgv9Xz8vA/exec",

  // Interval auto-sync latar belakang (ms). 0 = nonaktif (sinkron manual saja).
  autoSyncInterval: 0,
  // Kata sandi sederhana untuk masuk ke "Mode Kepsek" (lihat rekap semua kelas).
  // Ganti sesuai kebutuhan sekolah Anda.
  adminPassword: "kepsek123",
};

/* -------------------------------------------------------------------------
   PETA WALI KELAS -> KELAS -> SHEET ROSTER (sumber nama siswa)
   Nama sheet roster diambil dari tab pada spreadsheet DAFTAR MURID KELAS 1-6.
   Kolom yang dipakai dari sheet roster: A - D saja.
   ------------------------------------------------------------------------- */
const WALI_KELAS_LIST = [
  { wali: "Audy Farah Diba El Zunan, S.Pd",  kelas: "ABU BAKAR ASH SIDDIQ", tingkat: "1", roster: "KELAS 1 ABU BAKAR" },
  { wali: "Ainina Siti Nurhaliza, S. Hum",   kelas: "UTSMAN BIN AFFAN",     tingkat: "1", roster: "KELAS 1 UTSMAN" },
  { wali: "Eris Muchlis, S.Pd",              kelas: "UMAR BIN KHATAB",      tingkat: "2", roster: "KELAS 2 UMAR" },
  { wali: "Chris Sanjaya, S.Pd.",            kelas: "ALI BIN ABI THALIB",   tingkat: "2", roster: "KELAS 2 ALI" },
  { wali: "Siti Alfina Damayanti, S.Pd.",    kelas: "KHALID BIN WALID",     tingkat: "3", roster: "KELAS 3 KHOLID" },
  { wali: "Nurul Jumroh, S.Pd",              kelas: "MUADZ BIN JABAL",      tingkat: "3", roster: "KELAS 3 MUADZ" },
  { wali: "Novi Anggarsari, S.Pd",           kelas: "SA'AD BIN ABI WAQAS",  tingkat: "4", roster: "KELAS 4 SA'AD" },
  { wali: "Agung Surya Permadi, S.Pd, I",    kelas: "UBAY BIN KA'AB",       tingkat: "4", roster: "KELAS 4 UBAY" },
  { wali: "Salman Yahya, S.Pd",              kelas: "ZUBAIR BIN AWWAM",     tingkat: "5", roster: "KELAS 5 ZUBAIR" },
  { wali: "Nurjannah, S.Pd.,SD",             kelas: "ZAID BIN TSABIT",      tingkat: "5", roster: "KELAS 5 ZAID" },
  { wali: "Anisyah Wulandari, S.Pd",         kelas: "IBNU SINA",            tingkat: "6", roster: "KELAS 6 IBNU SINA" },
  { wali: "Surtiningsih. S.Pd",              kelas: "ALKHAWARIZMI",         tingkat: "6", roster: "KELAS 6 AL KHAWARIZMI" },
];

/* -------------------------------------------------------------------------
   SKEMA MENU / SHEET DATA
   name        = nama tab persis di spreadsheet DATA BASE LITERASI
   label       = judul menu di navigasi
   title       = judul dokumen saat cetak PDF
   columns     = { key, label, type, width }
       type: text | textarea | date | number | select | studentSelect | month
   filterBy    = kolom yang dipakai untuk memfilter data sesuai kelas aktif
   ------------------------------------------------------------------------- */
const MENUS = [
  {
    name: "01Jurnal Literasi Siswa",
    id: "jurnal-siswa",
    label: "Jurnal Literasi Siswa",
    icon: "📖",
    title: "JURNAL LITERASI SISWA",
    filterBy: "Kelas",
    columns: [
      { key: "Kelas", label: "Kelas", type: "auto" },
      { key: "Siswa", label: "Nama Siswa", type: "studentSelect" },
      { key: "Bulan", label: "Bulan", type: "month" },
      { key: "Wali Kelas", label: "Wali Kelas", type: "auto" },
      { key: "Kepala Sekolah", label: "Kepala Sekolah", type: "auto" },
      { key: "No", label: "No", type: "number" },
      { key: "Tanggal", label: "Tanggal", type: "date" },
      { key: "Judul", label: "Judul Buku/Bacaan", type: "text" },
      { key: "Halaman", label: "Halaman", type: "text" },
      { key: "Kesan", label: "Kesan/Ringkasan", type: "textarea" },
      { key: "Paraf", label: "Paraf", type: "text" },
    ],
  },
  {
    name: "02Format Administrasi Guru",
    id: "daftar-hadir",
    label: "Daftar Hadir Literasi",
    icon: "🗓️",
    title: "FORMAT DAFTAR HADIR KEGIATAN LITERASI",
    filterBy: "Kelas",
    columns: [
      { key: "Kelas", label: "Kelas", type: "auto" },
      { key: "Bulan", label: "Bulan", type: "month" },
      { key: "Wali Kelas", label: "Wali Kelas", type: "auto" },
      { key: "Kepala Sekolah", label: "Kepala Sekolah", type: "auto" },
      { key: "No", label: "No", type: "number" },
      { key: "Nama", label: "Nama Siswa", type: "studentSelect" },
      { key: "Pertemuan1", label: "Pertemuan 1", type: "select", options: ["Hadir", "Sakit", "Izin", "Alpa"] },
      { key: "Pertemuan2", label: "Pertemuan 2", type: "select", options: ["Hadir", "Sakit", "Izin", "Alpa"] },
      { key: "TLP2", label: "TLP2", type: "text" },
      { key: "TLP4", label: "TLP4", type: "text" },
    ],
  },
  {
    name: "03Dokumentasi Kegiatan",
    id: "dokumentasi",
    label: "Dokumentasi Kegiatan",
    icon: "📷",
    title: "DOKUMENTASI KEGIATAN LITERASI",
    filterBy: "Kelas",
    columns: [
      { key: "Kelas", label: "Kelas", type: "auto" },
      { key: "Tema", label: "Tema", type: "text" },
      { key: "Pertemuan", label: "Pertemuan", type: "text" },
      { key: "Wali Kelas", label: "Wali Kelas", type: "auto" },
      { key: "Kepala Sekolah", label: "Kepala Sekolah", type: "auto" },
      { key: "No", label: "No", type: "number" },
      { key: "Deskripsi", label: "Deskripsi", type: "textarea" },
      { key: "Tautan", label: "Tautan (Link Dokumentasi)", type: "text" },
      { key: "Paraf", label: "Paraf", type: "text" },
    ],
  },
  {
    name: "04Rekap Hasil Literasi",
    id: "rekap-hasil",
    label: "Rekap Hasil Literasi",
    icon: "📊",
    title: "REKAP HASIL LITERASI BULANAN",
    filterBy: "Kelas",
    columns: [
      { key: "Kelas", label: "Kelas", type: "auto" },
      { key: "Bulan", label: "Bulan", type: "month" },
      { key: "Wali Kelas", label: "Wali Kelas", type: "auto" },
      { key: "Kepala Sekolah", label: "Kepala Sekolah", type: "auto" },
      { key: "No", label: "No", type: "number" },
      { key: "Nama", label: "Nama Siswa", type: "studentSelect" },
      { key: "Produk", label: "Nilai Produk", type: "number" },
      { key: "Presentasi", label: "Nilai Presentasi", type: "number" },
      { key: "Karya", label: "Nilai Karya", type: "number" },
      { key: "Predikat", label: "Predikat", type: "select", options: ["Sangat Baik", "Baik", "Cukup", "Perlu Bimbingan", "—"] },
    ],
  },
  {
    name: "05Paspor Literasi Siswa",
    id: "paspor",
    label: "Paspor Literasi Siswa",
    icon: "🛂",
    title: "PASPOR LITERASI SISWA",
    filterBy: "Kelas",
    columns: [
      { key: "Kelas", label: "Kelas", type: "auto" },
      { key: "Siswa", label: "Nama Siswa", type: "studentSelect" },
      { key: "Tahun", label: "Tahun Pelajaran", type: "auto" },
      { key: "Target", label: "Target Bacaan", type: "text" },
      { key: "No", label: "No", type: "number" },
      { key: "Bulan", label: "Bulan", type: "month" },
      { key: "Judul", label: "Judul", type: "text" },
      { key: "Genre", label: "Genre", type: "text" },
      { key: "ParafGuru", label: "Paraf Guru", type: "text" },
      { key: "ParafOrtu", label: "Paraf Ortu", type: "text" },
      { key: "Bintang", label: "Bintang", type: "select", options: ["★", "★★", "★★★", "★★★★", "★★★★★"] },
    ],
  },
  {
    name: "✎Jurnal Membaca Guru",
    id: "jurnal-guru",
    label: "Jurnal Membaca Guru",
    icon: "✎",
    title: "JURNAL MEMBACA GURU",
    filterBy: "Kelas",
    columns: [
      { key: "Kelas", label: "Kelas", type: "auto" },
      { key: "Bulan", label: "Bulan", type: "month" },
      { key: "No", label: "No", type: "number" },
      { key: "Tanggal", label: "Tanggal", type: "date" },
      { key: "Judul", label: "Judul", type: "text" },
      { key: "Halaman", label: "Halaman", type: "text" },
      { key: "Refleksi", label: "Refleksi", type: "textarea" },
      { key: "Dibagikan", label: "Dibagikan", type: "select", options: ["Ya", "Belum"] },
    ],
  },
];

const BULAN_LIST = ["Juli","Agustus","September","Oktober","November","Desember","Januari","Februari","Maret","April","Mei","Juni"];
