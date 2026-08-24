# Panduan Deploy — Aplikasi Jurnal Literasi
SDIT Muhammadiyah Harjamukti, Kota Cirebon

Aplikasi ini adalah situs statis (HTML/CSS/JS murni, ringan, tanpa framework berat)
yang tersinkron ke Google Spreadsheet **DATA BASE LITERASI** milik Anda melalui
sebuah backend kecil **Google Apps Script**.

---

## 1. Deploy backend sinkron (Google Apps Script)

1. Buka spreadsheet **DATA BASE LITERASI**:
   `https://docs.google.com/spreadsheets/d/15NlIxjp42xlC-Bm-7rEvJtrS2T1jpP8R6EneKrBpeuM/edit`
2. Menu **Extensions → Apps Script**.
3. Hapus isi `Code.gs` bawaan, lalu salin-tempel seluruh isi file
   `apps-script/Code.gs` dari folder proyek ini.
4. Klik **Deploy → New deployment**.
   - Klik ikon ⚙️ di samping "Select type" → pilih **Web app**.
   - **Execute as**: `Me (akun Anda)`
   - **Who has access**: `Anyone`
   - Klik **Deploy**, izinkan akses (Authorize access) dengan akun Google pemilik sheet.
5. Salin URL yang diakhiri `/exec`, contoh:
   `https://script.google.com/macros/s/AKfycb.../exec`
6. Buka aplikasi web (setelah dideploy ke Netlify, langkah 2) → menu **Pengaturan**
   → tempel URL tadi ke kolom **URL Web App Sinkron**.

> Setiap kali Anda mengubah isi `Code.gs`, buat **New deployment** lagi (bukan hanya save)
> agar perubahan berlaku pada URL yang sama, atau gunakan **Manage deployments → Edit → New version**.

### Jika muncul error "Cannot read properties of null (reading 'getSheetByName')"
Ini terjadi karena `SpreadsheetApp.getActiveSpreadsheet()` mengembalikan `null`
saat skrip dijalankan sebagai Web App tanpa konteks spreadsheet aktif. Versi
`Code.gs` di paket ini sudah diperbaiki — skrip mengunci langsung ke ID
spreadsheet DATA BASE LITERASI (`SPREADSHEET_ID` di baris atas file) memakai
`SpreadsheetApp.openById(...)`, jadi tetap berfungsi siapa pun/dari mana pun
Web App dipanggil. Jika sebelumnya Anda sudah menempel versi lama, **tempel
ulang seluruh isi file `Code.gs` ini**, lalu buat **New deployment** (atau
**Manage deployments → Edit pensil → New version → Deploy**) supaya URL
`/exec` memakai kode terbaru.

### Catatan tentang struktur sheet
Skrip mengasumsikan setiap tab data punya **baris 1 = judul sheet**, **baris 2 = header
kolom**, **baris 3 dst = data** — sesuai format spreadsheet Anda saat ini. Jangan mengubah
susunan ini (jangan hapus/insert baris di atas header) agar sinkron tidak salah baca.

---

## 2. Deploy situs ke Netlify

Folder proyek ini (`literasi-app/`) sudah siap diupload apa adanya.

**Cara termudah (drag & drop):**
1. Buka https://app.netlify.com → **Add new site → Deploy manually**.
2. Seret (drag & drop) seluruh folder `literasi-app` (isinya: `index.html`,
   folder `css`, `js`, `logo`, dll) ke area upload.
3. Tunggu proses selesai — situs langsung online.

**Cara dengan Git (opsional, untuk update berkelanjutan):**
1. Push folder ini ke repository GitHub.
2. Di Netlify: **Add new site → Import from Git** → pilih repo tersebut.
3. Build command: kosongkan. Publish directory: `.` (folder root).

Folder `logo/` sengaja dipisah di root proyek agar file `logo.png`,
`icon-512.png`, dan `favicon.ico` ikut terupload sebagai aset statis Netlify
(diakses aplikasi lewat path `/logo/...`).

---

## 3. Setelah situs online — atur aplikasi

1. Buka situs → menu **Pengaturan**.
2. Isi:
   - **Nama Kepala Sekolah**
   - **Wali Kelas** (pilih dari daftar — Kelas akan terisi otomatis)
   - **Tahun Pelajaran** (contoh: `2026/2027`)
   - **URL Web App Sinkron** (dari langkah 1)
3. Simpan. Aplikasi siap dipakai — buka menu jurnal apa pun, klik **+ Tambah Data**,
   pilih nama siswa (otomatis terambil dari spreadsheet **DAFTAR MURID KELAS 1-6**
   sesuai kelas wali kelas yang login), lalu **Sinkron** untuk mengirim ke sheet.

> **Sinkron otomatis:** URL Web App sinkron sudah ditanam sebagai default di
> `js/config.js` (`CONFIG.defaultScriptUrl`), jadi begitu situs pertama dibuka
> di perangkat mana pun, aplikasi langsung menyinkronkan semua menu dari
> spreadsheet DATA BASE LITERASI tanpa perlu mengisi apa pun di Pengaturan
> terlebih dahulu. Field URL di Pengaturan tetap bisa diubah kalau suatu saat
> Anda mendeploy ulang Apps Script dan mendapat URL `/exec` yang baru.

### Sumber data nama siswa
Nama siswa diambil langsung (real-time, tanpa server tambahan) dari:
`https://docs.google.com/spreadsheets/d/16SR60Qk9bOvXczIXDfU9s6gpH7GjKI_shDcnZQVw1dw`
tab sesuai kelas (kolom A–D). Pastikan spreadsheet ini tetap dibagikan dengan akses
**"Siapa saja yang memiliki link dapat melihat (Viewer)"**, agar bisa dibaca browser
tanpa perlu login. Jika nama siswa tidak muncul, tersedia kolom "ketik manual".

---

## 4. Fitur ekspor PDF (siap cetak A4)

Setiap menu punya tombol **🖨️ Ekspor PDF** yang membuka **jendela Pratinjau**
terlebih dahulu — tampilan di pratinjau ini dijamin 100% identik dengan hasil
akhir karena memakai kode tampilan yang sama persis. Setelah memeriksa isi
dokumen (kop sekolah + logo, tabel data, kolom tanda tangan Wali Kelas &
Kepala Sekolah), klik **⬇️ Unduh PDF** di pojok kanan atas pratinjau — ini
membuka dialog cetak browser; pilih **Save as PDF / Simpan sebagai PDF**
sebagai tujuan untuk mengunduh file PDF A4 siap cetak (murni teks, bukan
tangkapan layar). Logo sekolah sudah disematkan langsung sebagai gambar
sehingga selalu tampil meski koneksi lambat.

## 5. Ceklis Kehadiran (menu Daftar Hadir Literasi)

Alih-alih mengisi satu-per-satu, menu ini punya panel **✅ Isi Kehadiran
(Ceklis Cepat)**: pilih bulan, lalu centang Pertemuan 1, Pertemuan 2, TLP2,
TLP4 untuk semua siswa di kelas sekaligus, dan klik **💾 Simpan Semua
Kehadiran**. Data otomatis masuk antrian dan langsung dicoba disinkronkan
bila URL sinkron sudah diisi. Riwayat data yang sudah tersimpan tetap
ditampilkan di tabel bawahnya seperti menu lain (bisa diedit/dihapus satu-
per-satu bila perlu).

## 6. Tautan otomatis bisa diklik

Di semua menu, jika isi sebuah kolom berupa link (diawali `http://`,
`https://`, atau `www.`) — misalnya kolom Tautan/Deskripsi di menu
Dokumentasi Kegiatan — sistem otomatis menampilkannya sebagai tautan biru
yang bisa langsung diklik dan terbuka di tab baru.

## 8. Mode Kepsek (login untuk rekap semua kelas)

Di pojok kanan atas header ada tombol **🔐 Login Kepsek**. Kata sandi default:

```
kepsek123
```

Untuk keamanan, ganti kata sandi ini di `js/config.js` → `CONFIG.adminPassword`
sebelum dipakai di sekolah (lalu upload ulang ke Netlify).

Setelah login, di menu **Jurnal Literasi Siswa, Daftar Hadir Literasi,
Dokumentasi Kegiatan, Rekap Hasil Literasi,** dan **Paspor Literasi Siswa**
akan muncul **bar pemilih kelas** di bagian atas. Pilih kelas mana pun
(misalnya "UBAY BIN KA'AB") untuk langsung melihat data kelas tersebut —
tidak terbatas pada kelas wali kelas yang login di Pengaturan.

Untuk menu yang berbasis data per-siswa (Jurnal Literasi Siswa, Daftar
Hadir Literasi, Rekap Hasil Literasi, Paspor Literasi Siswa), akan muncul
panel **👥 Rekap Siswa** berisi seluruh nama siswa di kelas terpilih —
ditandai **✅ sudah mengisi (n data)** atau **belum mengisi**. Klik nama
siswa mana pun untuk memfilter tabel di bawahnya agar hanya menampilkan
data siswa tersebut secara detail; klik lagi (atau tombol "Tampilkan
semua siswa") untuk kembali melihat semua data kelas itu.

Tombol **Sinkron**, **Ekspor PDF**, dan **+ Tambah Data** di Mode Kepsek
tetap berfungsi mengikuti kelas yang sedang dipilih — misalnya kepsek bisa
langsung mencetak PDF rekap kelas Ubay tanpa perlu login sebagai wali
kelasnya.

Klik tombol **Login Kepsek** lagi (sekarang bertuliskan **Mode Kepsek •
Keluar**) untuk keluar dari mode ini.

---

## 10. Halaman Mandiri Siswa (siswa.html)

Situs ini sekarang punya **halaman terpisah** khusus untuk siswa menulis
jurnal literasinya sendiri, tanpa perlu login sebagai guru:

```
https://[domain-netlify-anda]/siswa.html
```

Bagikan tautan ini ke siswa/orang tua (lewat WhatsApp grup kelas, misalnya).
Dari aplikasi guru, di menu **Jurnal Literasi Siswa** ada tombol
**🔗 Bagikan ke Siswa** yang otomatis menyalin tautan ini dan membuka
WhatsApp berisi pesan ajakan menulis jurnal.

Alur di halaman siswa:
1. Siswa memilih **Kelas**, lalu memilih **Nama** dari daftar (otomatis
   terambil dari spreadsheet DAFTAR MURID KELAS 1-6).
2. Sistem menampilkan daftar tulisan siswa itu yang **sudah ada** —
   siswa bisa klik **"Lanjutkan"** untuk melanjutkan/mengedit tulisan lama,
   atau klik **"✏️ Tulis Jurnal Baru"** untuk mulai jurnal baru.
3. Form berisi kolom yang sama persis dengan sheet: Bulan, Tanggal,
   Judul Buku/Bacaan, Halaman, dan Kesan/Ringkasan — Kelas, Nama, dan Wali
   Kelas terisi otomatis (tidak bisa diubah siswa).
4. Setelah disimpan, data langsung masuk ke sheet **01Jurnal Literasi Siswa**
   dan otomatis terlihat di aplikasi guru saat guru menekan **Sinkron**
   (atau otomatis lewat sinkron awal saat aplikasi guru dibuka).

Kolom **Paraf** dan **Kepala Sekolah** sengaja dikosongkan dari sisi siswa —
itu tetap diisi/dicek oleh wali kelas lewat aplikasi guru sebelum dicetak.

## 11. Kirim Laporan ke WhatsApp

Di semua menu guru **kecuali Dokumentasi Kegiatan**, sekarang ada:
- Tombol **📱 Kirim WA** di toolbar atas — mengirim rekap seluruh data kelas
  yang sedang tampil sebagai satu pesan WhatsApp.
- Tombol **📱** di setiap baris tabel — mengirim detail data baris itu saja
  (misalnya satu entri jurnal satu siswa) sebagai pesan WhatsApp, cocok
  untuk dikirim ke orang tua siswa tersebut.

Klik tombol ini akan membuka WhatsApp (aplikasi atau WhatsApp Web) dengan
teks laporan yang sudah rapi — guru tinggal memilih kontak/orang tua tujuan
lalu menekan kirim.

> **Catatan teknis:** karena keterbatasan WhatsApp (tidak mengizinkan situs
> web mengirim pesan atau melampirkan file secara otomatis tanpa interaksi
> pengguna, dan aplikasi ini tidak menyimpan nomor HP orang tua), pesan yang
> terbuka berupa **teks laporan siap kirim**, bukan file PDF terlampir
> otomatis. Jika ingin melampirkan PDF, unduh dulu lewat **Ekspor PDF**,
> lalu lampirkan manual di WhatsApp sebelum/sesudah mengirim teks laporan.

## 12. Menu Daftar Siswa

Menu baru **🧑‍🎓 Daftar Siswa** di navigasi menampilkan seluruh siswa di
kelas aktif (otomatis mengikuti Wali Kelas di Pengaturan, atau kelas yang
dipilih di Mode Kepsek), lengkap dengan status **✅ sudah mengisi (n data)**
atau **—** (belum mengisi) untuk tiap menu: Jurnal Literasi Siswa, Daftar
Hadir, Rekap Hasil Literasi, dan Paspor Literasi Siswa. Klik angka status
pada siswa mana pun untuk langsung membuka menu terkait, sudah terfilter
ke data siswa itu saja.

## 13. Sheet otomatis dibuat kalau belum ada

`Code.gs` sudah diperbarui: jika suatu saat sebuah tab/sheet yang
dibutuhkan (mis. `01Jurnal Literasi Siswa`) **tidak ditemukan** di
spreadsheet DATA BASE LITERASI — baik karena terhapus tak sengaja maupun
sebab lain — sistem akan **membuatnya otomatis** lengkap dengan baris judul
dan header kolom yang benar, sehingga sinkron/isi data dari aplikasi guru
maupun halaman siswa tidak akan gagal hanya karena sheet belum ada.

> **Wajib:** tempel ulang isi `apps-script/Code.gs` yang baru ke Apps
> Script (lihat langkah 1), lalu **Deploy → Manage deployments → pensil
> edit → New version → Deploy** supaya fitur ini aktif.

---

## 15. Identitas Siswa Pakai NISN & Kirim WA Otomatis ke Orang Tua

Aplikasi sekarang punya sumber data siswa sendiri di spreadsheet **DATA BASE
LITERASI** — dua sheet baru yang **dibuat otomatis** saat pertama dibutuhkan:

- **`00Roster Siswa`** — kolom `Kelas, NISN, Nama, L/P`. Ini daftar induk siswa
  per kelas, dipakai di semua pemilihan nama (form guru maupun halaman siswa).
- **`00Kontak Orang Tua`** — kolom `NISN, Nama, Kelas, No HP Orang Tua`. Nomor
  di sini yang dipakai tombol **📱 Kirim WA** supaya WhatsApp langsung terbuka
  ke kontak orang tua yang benar (tanpa guru mencari kontak manual).

**Cara mengisi:** buka menu **🧑‍🎓 Daftar Siswa** di aplikasi guru → klik
**+ Tambah/Edit Siswa** → isi NISN, Nama, L/P, dan No HP Orang Tua (boleh
dikosongkan dulu, isi belakangan). Data langsung tersimpan ke kedua sheet di
atas. NISN dipakai sebagai identitas unik siswa di seluruh aplikasi supaya dua
siswa dengan nama sama di kelas yang sama tidak tertukar datanya.

### ⚠️ Langkah wajib untuk data yang SUDAH ADA di sheet Anda
Sheet-sheet jurnal yang sudah berjalan (`01Jurnal Literasi Siswa`,
`02Format Administrasi Guru`, `05Paspor Literasi Siswa`) belum punya kolom
**NISN** di header baris 2. Karena sheet-sheet ini **sudah ada** (bukan
dibuat otomatis dari kosong), aplikasi tidak akan menambah kolom ini sendiri.
Anda perlu menambahkannya manual satu kali:
1. Buka spreadsheet DATA BASE LITERASI.
2. Di masing-masing sheet tersebut, tambahkan sel header **`NISN`** di baris
   ke-2 (boleh di kolom mana saja yang kosong — urutan kolom tidak masalah,
   aplikasi membaca header berdasarkan nama, bukan posisi).
3. Data lama yang belum punya NISN tetap terbaca dan tercocokkan lewat nama
   seperti biasa (fallback otomatis) — hanya data baru yang akan otomatis
   terisi NISN-nya setelah Anda memakai pemilih siswa yang baru.
4. Sheet `04Rekap Hasil Literasi` sudah punya kolom NISN dari versi
   sebelumnya, tidak perlu diubah — sekarang kolom itu otomatis terisi dari
   pemilihan siswa (tidak perlu diketik manual lagi).

Setelah menambah kolom, **tempel ulang `Code.gs` versi terbaru** dari paket
ini dan buat **New deployment** (lihat langkah 1) supaya perubahan berlaku.

### Catatan privasi nomor HP orang tua
Seperti seluruh data lain di aplikasi ini, sheet `00Kontak Orang Tua` dibaca
lewat Web App Apps Script yang di-deploy dengan akses **"Anyone"** — artinya
siapa pun yang mengetahui URL `/exec` (yang tertanam di kode sumber situs,
bisa dilihat siapa saja lewat "View Source" browser) berpotensi mengambil
seluruh data lewat permintaan langsung ke URL tersebut, termasuk nomor HP
orang tua. ini levelnya sama seperti data jurnal siswa yang sudah ada
sekarang (sama-sama publik-jika-tahu-URL, bukan sesuatu yang baru dari fitur
ini) — tapi karena nomor HP lebih sensitif, pertimbangkan untuk **tidak
membagikan URL `/exec` secara terbuka**, dan hubungi kami/pengembang bila
sekolah menginginkan proteksi tambahan (misalnya token akses) di masa depan.

## 14. Catatan & keterbatasan
- Data yang baru ditambahkan/diedit/dihapus disimpan dulu di perangkat
  (localStorage) sebagai **antrian**, lalu dikirim ke sheet saat tombol
  **Sinkron** ditekan (otomatis juga dicoba setiap kali simpan, dan setiap
  45 detik selagi halaman menu terbuka bila URL sinkron sudah diisi) —
  ini membuat aplikasi tetap ringan & responsif walau koneksi lambat.
- Jika beberapa **hapus data** dilakukan beruntun sebelum sempat sinkron,
  sinkronlah setelah setiap penghapusan agar penomoran baris tetap akurat.
- Aplikasi ini tidak menyimpan kredensial Google apa pun di sisi klien —
  penulisan ke sheet sepenuhnya lewat Web App Apps Script yang Anda kontrol.
