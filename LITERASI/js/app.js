/* =========================================================================
   APP.JS — logika utama aplikasi Jurnal Literasi
   ========================================================================= */

const App = {
  view: "dashboard",
  pollTimer: null,
  syncing: {}, // { [sheetName]: true/false }
  adminSelectedKelas: null,  // kelas yang sedang dilihat kepsek di Mode Kepsek
  adminStudentFilter: null,  // { nisn, nama } siswa yang sedang difilter di panel rekap, atau null
};

// Menu yang tersedia untuk rekap lintas-kelas (Mode Kepsek).
// Jurnal Membaca Guru dikecualikan karena itu jurnal pribadi guru, bukan per-kelas/siswa.
const ADMIN_MENU_IDS = ["jurnal-siswa", "daftar-hadir", "dokumentasi", "rekap-hasil", "paspor"];

const $app = () => document.getElementById("app");

let LOGO_DATA_URI = null; // logo di-embed sebagai base64 supaya selalu tampil di PDF, tanpa jeda loading

async function preloadLogo() {
  try {
    const res = await fetch("/logo/logo.png");
    const blob = await res.blob();
    LOGO_DATA_URI = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("Gagal memuat logo untuk PDF:", err);
    LOGO_DATA_URI = null;
  }
}

/* Deteksi URL di dalam teks sel tabel supaya bisa diklik langsung
   (dipakai di tabel data & di dokumen cetak/pratinjau PDF). */
function linkifyCell(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const urlPattern = /^(https?:\/\/|www\.)\S+$/i;
  if (!urlPattern.test(text)) return escapeHtml(text);
  const href = /^https?:\/\//i.test(text) ? text : "https://" + text;
  const shown = text.length > 55 ? text.slice(0, 55) + "…" : text;
  return `<a href="${escapeHtml(href)}" class="cell-link" target="_blank" rel="noopener noreferrer">${escapeHtml(shown)}</a>`;
}

/* --------------------------------------------------------------------- */
/* INIT & NAV                                                             */
/* --------------------------------------------------------------------- */

function init() {
  buildNav();
  bindGlobalEvents();
  updateSyncIndicator();
  updateAdminButton();
  preloadLogo();
  navigateTo("dashboard");
  autoSyncAll();
}

/* Sinkron otomatis semua menu saat aplikasi pertama dibuka, supaya data
   dari sheet langsung terambil tanpa perlu klik tombol Sinkron manual. */
async function autoSyncAll() {
  const s = Store.getSettings();
  if (!s.scriptUrl) return;
  updateSyncIndicator("busy", "Menyinkronkan data awal...");
  for (const menu of MENUS) {
    await doSync(menu, { silent: true });
  }
  refreshCurrentView();
}

function refreshCurrentView() {
  if (App.view === "dashboard") renderDashboard();
  else if (App.view === "daftar-siswa") renderStudentListPage();
  else {
    const menu = MENUS.find(m => m.id === App.view);
    if (menu) renderMenuPage(menu);
  }
}

function buildNav() {
  const nav = document.getElementById("mainNav");
  const settingsBtn = nav.querySelector('[data-view="settings"]');
  MENUS.forEach(menu => {
    const btn = document.createElement("button");
    btn.className = "nav-item";
    btn.dataset.view = menu.id;
    btn.innerHTML = `${menu.icon} <span>${menu.label}</span>`;
    nav.insertBefore(btn, settingsBtn);
  });
  nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (!btn) return;
    navigateTo(btn.dataset.view);
  });
}

function bindGlobalEvents() {
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
  document.getElementById("pdfPreviewClose").addEventListener("click", closePdfPreview);
  document.getElementById("pdfPreviewDownload").addEventListener("click", downloadPdfNow);

  document.getElementById("viewOverlayClose").addEventListener("click", closeTextPreview);
  document.getElementById("viewOverlay").addEventListener("click", (e) => {
    if (e.target.id === "viewOverlay") closeTextPreview();
  });

  // Mode Kepsek: login / logout
  document.getElementById("adminToggleBtn").addEventListener("click", () => {
    if (Store.isAdminLoggedIn()) {
      if (confirm("Keluar dari Mode Kepsek?")) {
        Store.setAdminLoggedIn(false);
        App.adminSelectedKelas = null;
        App.adminStudentFilter = null;
        updateAdminButton();
        toast("Keluar dari Mode Kepsek.");
        refreshCurrentView();
      }
    } else {
      document.getElementById("adminPasswordInput").value = "";
      document.getElementById("adminLoginOverlay").classList.remove("hidden");
      document.getElementById("adminPasswordInput").focus();
    }
  });
  document.getElementById("adminLoginClose").addEventListener("click", closeAdminLogin);
  document.getElementById("adminLoginCancel").addEventListener("click", closeAdminLogin);
  document.getElementById("adminLoginOverlay").addEventListener("click", (e) => {
    if (e.target.id === "adminLoginOverlay") closeAdminLogin();
  });
  // Pastikan kolom kata sandi tetap terlihat di atas keyboard virtual (mobile)
  document.getElementById("adminPasswordInput").addEventListener("focus", (e) => {
    setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
  });
  document.getElementById("adminLoginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const pwd = document.getElementById("adminPasswordInput").value;
    if (pwd === CONFIG.adminPassword) {
      Store.setAdminLoggedIn(true);
      closeAdminLogin();
      updateAdminButton();
      toast("Berhasil masuk sebagai Kepsek. Pilih kelas untuk melihat rekap.");
      refreshCurrentView();
    } else {
      toast("Kata sandi salah.", true);
    }
  });
}

function closeAdminLogin() {
  document.getElementById("adminLoginOverlay").classList.add("hidden");
}

function updateAdminButton() {
  const logged = Store.isAdminLoggedIn();
  const btn = document.getElementById("adminToggleBtn");
  btn.classList.toggle("active", logged);
  document.getElementById("adminToggleLabel").textContent = logged ? "Mode Kepsek • Keluar" : "Login Kepsek";
}

function navigateTo(view) {
  App.view = view;
  App.adminStudentFilter = null;
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  if (App.pollTimer) { clearInterval(App.pollTimer); App.pollTimer = null; }

  if (view === "dashboard") renderDashboard();
  else if (view === "settings") renderSettingsPage();
  else if (view === "daftar-siswa") renderStudentListPage();
  else {
    const menu = MENUS.find(m => m.id === view);
    if (menu) renderMenuPage(menu);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toast(msg, isErr = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show" + (isErr ? " err" : "");
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = "toast"; }, 3200);
}

function updateSyncIndicator(status = "idle", label = "Belum sinkron") {
  const ind = document.getElementById("syncIndicator");
  const lbl = document.getElementById("syncLabel");
  ind.className = "sync-indicator" + (status === "idle" ? "" : " " + status);
  lbl.textContent = label;
}

/* --------------------------------------------------------------------- */
/* DASHBOARD                                                              */
/* --------------------------------------------------------------------- */

function renderDashboard() {
  const s = Store.getSettings();
  const totalQueue = MENUS.reduce((sum, m) => sum + Store.getQueue(m.name).length, 0);
  const activeWali = WALI_KELAS_LIST.find(w => w.wali === s.wali);

  $app().innerHTML = `
    <div class="page-header">
      <div>
        <h2>Selamat datang 👋</h2>
        <div class="sub">${CONFIG.namaSekolah}</div>
      </div>
    </div>

    ${!s.wali ? `<div class="notice">⚠️ Anda belum mengatur <strong>Wali Kelas</strong>. Buka menu <strong>Pengaturan</strong> untuk mengisi data terlebih dahulu.</div>` : ""}
    ${!s.scriptUrl ? `<div class="notice info">ℹ️ URL sinkron (Apps Script) belum diisi. Data akan tersimpan sementara di perangkat ini sampai URL sinkron diatur di menu <strong>Pengaturan</strong>.</div>` : ""}

    <div class="stat-grid">
      <div class="stat-card"><div class="num">${activeWali ? activeWali.kelas : "-"}</div><div class="lbl">Kelas Aktif</div></div>
      <div class="stat-card"><div class="num">${s.tahunPelajaran || "-"}</div><div class="lbl">Tahun Pelajaran</div></div>
      <div class="stat-card"><div class="num">${totalQueue}</div><div class="lbl">Data Belum Tersinkron</div></div>
      <div class="stat-card"><div class="num">${MENUS.length}</div><div class="lbl">Menu Jurnal</div></div>
    </div>

    <div class="card">
      <h3 style="margin-top:0;">Menu Jurnal</h3>
      <div class="menu-grid" id="dashMenuGrid"></div>
    </div>
  `;

  const grid = document.getElementById("dashMenuGrid");
  MENUS.forEach(menu => {
    const count = getFilteredRows(menu).length;
    const el = document.createElement("div");
    el.className = "menu-card";
    el.innerHTML = `<div class="ico">${menu.icon}</div><h4>${menu.label}</h4><p>${count} data ${effectiveKelasFor(menu) ? "di kelas ini" : "tersimpan"}</p>`;
    el.addEventListener("click", () => navigateTo(menu.id));
    grid.appendChild(el);
  });
}

/* --------------------------------------------------------------------- */
/* HALAMAN MENU (per sheet)                                               */
/* --------------------------------------------------------------------- */

function getActiveWaliEntry() {
  const s = Store.getSettings();
  return WALI_KELAS_LIST.find(w => w.wali === s.wali) || null;
}

/* Saat Mode Kepsek aktif & sebuah kelas dipilih di admin-bar, seluruh
   halaman (tabel, form tambah, ceklis kehadiran, ekspor PDF) mengikuti
   kelas pilihan kepsek itu — bukan kelas wali kelas di Pengaturan. */
function isAdminBrowsable(menu) {
  return Store.isAdminLoggedIn() && ADMIN_MENU_IDS.includes(menu.id);
}

function effectiveKelasFor(menu) {
  if (isAdminBrowsable(menu) && App.adminSelectedKelas) return App.adminSelectedKelas;
  return Store.getSettings().kelas;
}

function getEffectiveWaliEntry(menu) {
  if (isAdminBrowsable(menu) && App.adminSelectedKelas) {
    return WALI_KELAS_LIST.find(w => w.kelas === App.adminSelectedKelas) || null;
  }
  return getActiveWaliEntry();
}

function effectiveWaliFor(menu) {
  const entry = getEffectiveWaliEntry(menu);
  if (isAdminBrowsable(menu) && App.adminSelectedKelas) return entry ? entry.wali : "";
  return Store.getSettings().wali;
}

function getStudentColumnKey(menu) {
  const col = menu.columns.find(c => c.type === "studentSelect");
  return col ? col.key : null;
}

/* Identitas unik siswa dalam satu baris data: pakai NISN kalau ada (data baru),
   kalau tidak ada (data lama sebelum fitur NISN, atau siswa "ketik manual")
   fallback ke nama supaya data lama tetap kompatibel. */
function studentIdentity(row, menu) {
  if (row.NISN && String(row.NISN).trim()) return "N:" + String(row.NISN).trim();
  const key = getStudentColumnKey(menu);
  const name = key ? (row[key] || "").trim().toUpperCase() : "";
  return name ? "X:" + name : "";
}
function rosterIdentity(rosterEntry) {
  return "N:" + rosterEntry.nisn;
}
/* Cocokkan satu baris data (row) dengan satu entri roster {nisn, nama}.
   Dipakai supaya data lama (ditulis sebelum kolom NISN ada) tetap cocok
   lewat nama, tanpa membuat baris baru duplikat saat diedit/disinkron ulang. */
function matchesRoster(row, rosterEntry) {
  if (row.NISN && row.NISN.trim()) return row.NISN.trim() === rosterEntry.nisn;
  const nameKey = row.Nama !== undefined ? "Nama" : (row.Siswa !== undefined ? "Siswa" : null);
  if (!nameKey) return false;
  return (row[nameKey] || "").trim().toUpperCase() === rosterEntry.nama.trim().toUpperCase();
}
/* Sama seperti matchesRoster, tapi untuk baris SATU MENU tertentu (dipakai
   filter/hitung status per-menu, di mana kolom nama siswa bisa beda-beda
   nama kolomnya — lihat getStudentColumnKey). Baris lama yang sheet-nya
   belum punya kolom NISN sama sekali (identitasnya jatuh ke "X:NAMA") tetap
   cocok dengan roster lewat nama, bukan cuma lewat NISN. */
function matchesStudentFilter(row, menu, target) {
  if (!target) return false;
  if (row.NISN && String(row.NISN).trim()) {
    return !!target.nisn && String(row.NISN).trim() === target.nisn;
  }
  const key = getStudentColumnKey(menu);
  const name = key ? (row[key] || "").trim().toUpperCase() : "";
  return !!(name && target.nama && name === target.nama.trim().toUpperCase());
}
/* Hitung berapa baris di `rows` yang cocok dengan satu entri roster —
   mencocokkan lewat NISN kalau baris punya NISN, ATAU lewat nama kalau
   baris itu data lama tanpa kolom NISN. Dipakai Daftar Siswa & Rekap Siswa
   supaya status "sudah/belum mengisi" akurat untuk data lama maupun baru. */
function countRowsForRoster(rows, menu, rosterEntry) {
  let n = 0;
  rows.forEach(r => { if (matchesStudentFilter(r, menu, rosterEntry)) n++; });
  return n;
}

function getFilteredRows(menu) {
  const cache = Store.getCache(menu.name);
  const queue = Store.getQueue(menu.name);
  const kelas = effectiveKelasFor(menu);

  // gabungkan cache (dari sheet) dengan antrian lokal yang belum sinkron
  let rows = cache.rows.map(r => ({ ...r, _pending: false }));

  queue.forEach(item => {
    if (item.action === "append") {
      rows.push({ ...item.row, _pending: true, _localId: item.localId });
    } else if (item.action === "update") {
      const idx = rows.findIndex(r => r._row == item.rowIndex);
      if (idx > -1) rows[idx] = { ...rows[idx], ...item.row, _pending: true, _localId: item.localId };
    } else if (item.action === "delete") {
      rows = rows.filter(r => r._row != item.rowIndex);
    }
  });

  if (menu.filterBy && kelas) {
    rows = rows.filter(r => (r[menu.filterBy] || "").trim().toUpperCase() === kelas.trim().toUpperCase());
  }

  // Mode Kepsek: filter tambahan ke satu siswa saat diklik dari panel rekap
  // (berlaku juga untuk wali kelas biasa lewat menu Daftar Siswa)
  if (App.adminStudentFilter) {
    rows = rows.filter(r => matchesStudentFilter(r, menu, App.adminStudentFilter));
  }

  return rows;
}

function renderMenuPage(menu) {
  const s = Store.getSettings();
  const cache = Store.getCache(menu.name);
  const rows = getFilteredRows(menu);
  const effKelas = effectiveKelasFor(menu);
  const effWali = effectiveWaliFor(menu);
  const adminMode = isAdminBrowsable(menu);
  const studentKey = getStudentColumnKey(menu);

  $app().innerHTML = `
    <div class="page-header">
      <div>
        <h2>${menu.icon} ${menu.label}</h2>
        <div class="sub">Kelas: <strong>${effKelas || "belum dipilih"}</strong> &nbsp;•&nbsp; Wali Kelas: <strong>${effWali || "-"}</strong>
        &nbsp;•&nbsp; Terakhir sinkron: <span id="lastSyncLbl">${cache.lastSync ? new Date(cache.lastSync).toLocaleString("id-ID") : "belum pernah"}</span></div>
      </div>
      <div class="toolbar">
        <button class="btn" id="btnSync">🔄 Sinkron</button>
        <button class="btn btn-gold" id="btnExport">🖨️ Ekspor PDF</button>
        ${menu.id !== "dokumentasi" ? `<button class="btn btn-wa" id="btnWaBulk">📱 Kirim WA</button>` : ""}
        ${menu.id === "jurnal-siswa" ? `<button class="btn" id="btnShareSiswa">🔗 Bagikan ke Siswa</button>` : ""}
        <button class="btn btn-primary" id="btnAdd">+ Tambah Data</button>
      </div>
    </div>

    ${menu.id === "jurnal-siswa" ? `<div class="notice info">🔗 Siswa bisa mengisi jurnal literasi <strong>sendiri</strong> lewat halaman <strong>Jurnal Siswa</strong> — klik "Bagikan ke Siswa" untuk menyalin tautannya.</div>` : ""}

    ${adminMode ? `
      <div class="admin-bar">
        <span class="admin-bar-label">👤 Mode Kepsek — Rekap Semua Kelas</span>
        <select id="adminKelasSelect">
          <option value="">-- pilih kelas --</option>
          ${WALI_KELAS_LIST.map(w => `<option value="${escapeHtml(w.kelas)}" ${w.kelas === App.adminSelectedKelas ? "selected" : ""}>${escapeHtml(w.kelas)} — ${escapeHtml(w.wali)}</option>`).join("")}
        </select>
      </div>
    ` : ""}

    ${!adminMode && !s.kelas ? `<div class="notice">⚠️ Kelas belum diatur. Buka <strong>Pengaturan</strong> untuk memilih wali kelas Anda agar data terfilter otomatis.</div>` : ""}
    ${adminMode && !App.adminSelectedKelas ? `<div class="notice info">ℹ️ Pilih kelas di atas untuk melihat rekap data & daftar siswa yang sudah mengisi.</div>` : ""}

    ${adminMode && App.adminSelectedKelas && studentKey ? `<div class="card" id="adminRecapCard"></div>` : ""}

    ${menu.id === "daftar-hadir" && (!adminMode || App.adminSelectedKelas) ? `<div class="card" id="checklistCard"></div><h3 style="color:var(--green-900); font-size:15px; margin:0 0 10px;">Riwayat Data Tersimpan</h3>` : ""}

    <div class="card" id="tableCard"></div>
  `;

  document.getElementById("btnSync").addEventListener("click", () => doSync(menu));
  document.getElementById("btnExport").addEventListener("click", () => openPdfPreview(menu, getFilteredRows(menu)));
  document.getElementById("btnAdd").addEventListener("click", () => openFormModal(menu));
  document.getElementById("btnWaBulk")?.addEventListener("click", () => sendBulkToWhatsApp(menu, getFilteredRows(menu)));
  document.getElementById("btnShareSiswa")?.addEventListener("click", shareSiswaLink);

  if (adminMode) {
    document.getElementById("adminKelasSelect").addEventListener("change", (e) => {
      App.adminSelectedKelas = e.target.value || null;
      App.adminStudentFilter = null;
      renderMenuPage(menu);
    });
  }

  if (adminMode && App.adminSelectedKelas && studentKey) {
    renderStudentRecap(menu);
  }

  if (menu.id === "daftar-hadir" && (!adminMode || App.adminSelectedKelas)) {
    renderAttendanceChecklist(menu);
  }

  renderTable(menu, rows);

  // pra-muat kontak orang tua di latar belakang (bukan saat tombol WA diklik)
  // supaya window.open WhatsApp tidak diblokir popup blocker browser.
  if (menu.id !== "dokumentasi") loadContacts();

  // auto-refresh ringan tiap 45 detik selagi halaman ini terbuka (kesan realtime)
  if (s.scriptUrl && CONFIG.autoSyncInterval !== 0) {
    App.pollTimer = setInterval(() => doSync(menu, { silent: true }), CONFIG.autoSyncInterval || 45000);
  }
}

/* --------------------------------------------------------------------- */
/* REKAP SISWA — panel Mode Kepsek: siapa sudah/belum mengisi + detail    */
/* --------------------------------------------------------------------- */

async function renderStudentRecap(menu) {
  const card = document.getElementById("adminRecapCard");
  if (!card) return;
  const waliEntry = WALI_KELAS_LIST.find(w => w.kelas === App.adminSelectedKelas);
  if (!waliEntry) { card.innerHTML = ""; return; }

  card.innerHTML = `<div class="notice info" style="margin:0;">Memuat rekap siswa...</div>`;
  const roster = await loadStudentRoster(App.adminSelectedKelas);

  // hitung dari data TANPA filter siswa supaya angka rekap akurat
  const allRows = (() => {
    const savedFilter = App.adminStudentFilter;
    App.adminStudentFilter = null;
    const r = getFilteredRows(menu);
    App.adminStudentFilter = savedFilter;
    return r;
  })();

  if (!roster.length) {
    card.innerHTML = `<div class="notice">Belum ada siswa terdaftar di kelas ${escapeHtml(App.adminSelectedKelas)} pada sheet "00Roster Siswa". Tambahkan lewat menu <strong>Daftar Siswa</strong>.</div>`;
    return;
  }

  const filledCount = roster.filter(r => countRowsForRoster(allRows, menu, r) > 0).length;

  let html = `<h3 style="margin-top:0;">👥 Rekap Siswa — ${escapeHtml(App.adminSelectedKelas)}
      <span style="font-weight:400; font-size:12px; color:var(--ink-600);">(${filledCount}/${roster.length} sudah mengisi)</span></h3>
    <div class="recap-grid">`;
  roster.forEach(r => {
    const count = countRowsForRoster(allRows, menu, r);
    const filled = count > 0;
    const active = App.adminStudentFilter && App.adminStudentFilter.nisn === r.nisn;
    html += `<button type="button" class="recap-chip ${filled ? "filled" : ""} ${active ? "active" : ""}" data-nisn="${escapeHtml(r.nisn)}" data-nama="${escapeHtml(r.nama)}">
        <span class="rc-name">${escapeHtml(r.nama)}</span>
        <span class="rc-count">${filled ? "✅ " + count + " data" : "belum mengisi"}</span>
      </button>`;
  });
  html += `</div>`;
  if (App.adminStudentFilter) {
    html += `<div style="margin-top:12px;"><button type="button" class="btn btn-sm" id="recapClearFilter">✕ Tampilkan semua siswa di tabel</button></div>`;
  }
  card.innerHTML = html;

  card.querySelectorAll(".recap-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const nisn = chip.dataset.nisn, nama = chip.dataset.nama;
      App.adminStudentFilter = (App.adminStudentFilter && App.adminStudentFilter.nisn === nisn) ? null : { nisn, nama };
      renderMenuPage(menu);
    });
  });
  const clearBtn = document.getElementById("recapClearFilter");
  if (clearBtn) clearBtn.addEventListener("click", () => { App.adminStudentFilter = null; renderMenuPage(menu); });
}

function openTextPreview(title, text) {
  document.getElementById("viewOverlayTitle").textContent = title;
  document.getElementById("viewOverlayContent").textContent = text || "(kosong)";
  document.getElementById("viewOverlay").classList.remove("hidden");
}

function closeTextPreview() {
  document.getElementById("viewOverlay").classList.add("hidden");
}

function renderTable(menu, rows) {
  const card = document.getElementById("tableCard");
  if (!rows.length) {
    card.innerHTML = `<div class="empty-state"><div class="icon">📭</div>Belum ada data untuk kelas ini.<br>Klik <strong>+ Tambah Data</strong> untuk mulai mengisi.</div>`;
    return;
  }
  const visibleCols = menu.columns.filter(c => !["Kelas", "Wali Kelas", "Kepala Sekolah", "Tahun"].includes(c.key));
  const PREVIEW_LEN = 36;

  let html = `<div class="table-wrap"><table><thead><tr>`;
  visibleCols.forEach(c => html += `<th>${c.label}</th>`);
  html += `<th>Aksi</th></tr></thead><tbody>`;

  rows.forEach((r, i) => {
    html += `<tr class="${r._pending ? "pending" : ""}">`;
    visibleCols.forEach(c => {
      const val = r[c.key] || "";
      if (c.type === "textarea" && val) {
        const preview = val.length > PREVIEW_LEN ? val.slice(0, PREVIEW_LEN) + "…" : val;
        html += `<td><button type="button" class="cell-preview-btn" data-i="${i}" data-col="${escapeHtml(c.key)}" title="Klik untuk lihat isi lengkap">${escapeHtml(preview)}${val.length > PREVIEW_LEN ? ' <span class="cell-preview-ico">🔍</span>' : ""}</button></td>`;
      } else {
        html += `<td>${linkifyCell(val)}</td>`;
      }
    });
    html += `<td class="row-actions">
        ${r._pending ? `<span class="badge">belum sinkron</span>` : ""}
        ${menu.id !== "dokumentasi" ? `<button class="btn btn-sm btn-wa" data-act="wa" data-i="${i}" title="Kirim ke WhatsApp">📱</button>` : ""}
        <button class="btn btn-sm" data-act="edit" data-i="${i}">✏️</button>
        <button class="btn btn-sm btn-danger" data-act="del" data-i="${i}">🗑️</button>
      </td>`;
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  card.innerHTML = html;

  card.querySelectorAll("[data-act]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.i, 10);
      const row = rows[i];
      if (btn.dataset.act === "edit") openFormModal(menu, row);
      else if (btn.dataset.act === "del") handleDelete(menu, row);
      else if (btn.dataset.act === "wa") sendRowToWhatsApp(menu, row);
    });
  });

  card.querySelectorAll(".cell-preview-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.i, 10);
      const colKey = btn.dataset.col;
      const col = visibleCols.find(c => c.key === colKey);
      openTextPreview((col ? col.label : colKey) + (rows[i].Nama || rows[i].Siswa ? " — " + (rows[i].Nama || rows[i].Siswa) : ""), rows[i][colKey] || "");
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function handleDelete(menu, row) {
  if (!confirm("Hapus data ini?")) return;
  if (row._pending && row._localId) {
    Store.clearQueueItem(menu.name, row._localId);
  } else if (row._row) {
    Store.pushToQueue(menu.name, "delete", {}, row._row);
  } else {
    // data lokal tanpa referensi baris — hapus langsung dari cache
    const cache = Store.getCache(menu.name);
    cache.rows = cache.rows.filter(r => r !== row);
    Store.saveCache(menu.name, cache.rows);
  }
  toast("Data dihapus. Klik Sinkron untuk menyimpan perubahan ke sheet.");
  renderMenuPage(menu);
}

/* --------------------------------------------------------------------- */
/* KIRIM WHATSAPP — buka WhatsApp dengan teks laporan siap kirim.         */
/* Catatan: link wa.me hanya bisa membawa TEKS (bukan file PDF terlampir  */
/* otomatis — WhatsApp tidak mengizinkan itu dari browser biasa), jadi    */
/* isi pesan dibuat selengkap & serapi mungkin sebagai laporan.           */
/* --------------------------------------------------------------------- */

function buildWhatsAppTextForRow(menu, row) {
  const s = Store.getSettings();
  const effKelas = effectiveKelasFor(menu) || row.Kelas || "-";
  const effWali = effectiveWaliFor(menu) || row["Wali Kelas"] || "-";
  const studentKey = getStudentColumnKey(menu);

  const lines = [`*${CONFIG.namaSekolah}*`, `📘 *${menu.title}*`, ""];
  if (studentKey && row[studentKey]) lines.push(`👤 Nama: *${row[studentKey]}*`);
  lines.push(`🏫 Kelas: ${effKelas}`);

  menu.columns.forEach(c => {
    if (c.type === "auto" || c.key === studentKey || c.key === "Kelas") return;
    if (!row[c.key]) return;
    lines.push(`${c.label}: ${row[c.key]}`);
  });

  lines.push("");
  lines.push(`👩‍🏫 Wali Kelas: ${effWali}`);
  if (s.kepsek) lines.push(`🏛️ Kepala Sekolah: ${s.kepsek}`);
  lines.push("");
  lines.push(`_Laporan otomatis dari Aplikasi Jurnal Literasi ${CONFIG.namaSekolah}_`);
  return lines.join("\n");
}

function buildWhatsAppTextBulk(menu, rows) {
  const effKelas = effectiveKelasFor(menu) || "-";
  const studentKey = getStudentColumnKey(menu);
  const lines = [`*${CONFIG.namaSekolah}*`, `📘 *${menu.title}*`, `🏫 Kelas: ${effKelas}`, ""];

  const cap = rows.slice(0, 25);
  cap.forEach((r, i) => {
    const label = studentKey ? (r[studentKey] || "-") : `Data ${i + 1}`;
    const extra = [r.Bulan, r.Judul].filter(Boolean).join(" — ");
    lines.push(`${i + 1}. ${label}${extra ? " (" + extra + ")" : ""}`);
  });
  if (rows.length > 25) lines.push(`...dan ${rows.length - 25} data lainnya`);

  lines.push("");
  lines.push(`_Laporan otomatis dari Aplikasi Jurnal Literasi ${CONFIG.namaSekolah}_`);
  return lines.join("\n");
}

function openWhatsApp(text, phone) {
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  window.open(base + "?text=" + encodeURIComponent(text), "_blank");
}

/* Kirim WA satu baris: kalau NISN baris itu punya nomor HP orang tua di sheet
   "00Kontak Orang Tua", WhatsApp langsung dibuka ke kontak itu (tanpa perlu
   guru mencari kontak manual). Kalau belum ada nomornya, tetap dibuka WA
   dengan teks siap kirim, tapi guru pilih kontak sendiri (seperti sebelumnya)
   dan diberi tahu supaya nomornya dilengkapi di menu Daftar Siswa. */
async function sendRowToWhatsApp(menu, row) {
  const text = buildWhatsAppTextForRow(menu, row);
  const nisn = (row.NISN || "").trim();
  if (!nisn) { openWhatsApp(text); return; }
  const contacts = await loadContacts();
  const contact = contacts[nisn];
  const phone = contact ? normalizePhoneWa(contact.phone) : "";
  if (phone) {
    openWhatsApp(text, phone);
  } else {
    toast("Nomor HP orang tua siswa ini belum ada di data Kontak. Pilih kontak manual, atau lengkapi nomornya di menu Daftar Siswa.");
    openWhatsApp(text);
  }
}

function sendBulkToWhatsApp(menu, rows) {
  if (!rows.length) { toast("Tidak ada data untuk dikirim.", true); return; }
  openWhatsApp(buildWhatsAppTextBulk(menu, rows));
}

/* Salin tautan halaman Jurnal Siswa (siswa.html) supaya mudah dibagikan
   ke siswa lewat WhatsApp grup kelas, dsb. */
function shareSiswaLink() {
  const url = window.location.origin + "/siswa.html";
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(
      () => toast("Tautan disalin: " + url),
      () => toast(url)
    );
  } else {
    toast(url);
  }
  openWhatsApp(`✏️ *Yuk isi Jurnal Literasi kamu!*\n\nKlik tautan ini untuk menulis jurnal literasimu sendiri:\n${url}`);
}

/* --------------------------------------------------------------------- */
/* DAFTAR SISWA — roster otomatis sesuai kelas aktif, dengan status       */
/* isian tiap siswa di menu-menu jurnal (klik untuk lihat detail).        */
/* --------------------------------------------------------------------- */

function daftarSiswaEffectiveKelas() {
  if (Store.isAdminLoggedIn() && App.adminSelectedKelas) return App.adminSelectedKelas;
  return Store.getSettings().kelas;
}

function daftarSiswaEffectiveWaliEntry() {
  if (Store.isAdminLoggedIn() && App.adminSelectedKelas) {
    return WALI_KELAS_LIST.find(w => w.kelas === App.adminSelectedKelas) || null;
  }
  return getActiveWaliEntry();
}

async function renderStudentListPage() {
  const adminMode = Store.isAdminLoggedIn();
  const waliEntry = daftarSiswaEffectiveWaliEntry();
  const kelas = daftarSiswaEffectiveKelas();

  $app().innerHTML = `
    <div class="page-header">
      <div><h2>🧑‍🎓 Daftar Siswa</h2><div class="sub">Otomatis mengikuti wali kelas di Pengaturan — menampilkan siapa saja yang sudah mengisi tiap jurnal.</div></div>
    </div>
    ${adminMode ? `
      <div class="admin-bar">
        <span class="admin-bar-label">👤 Mode Kepsek — Pilih Kelas</span>
        <select id="adminKelasSelect2">
          <option value="">-- pilih kelas --</option>
          ${WALI_KELAS_LIST.map(w => `<option value="${escapeHtml(w.kelas)}" ${w.kelas === App.adminSelectedKelas ? "selected" : ""}>${escapeHtml(w.kelas)} — ${escapeHtml(w.wali)}</option>`).join("")}
        </select>
      </div>
    ` : ""}
    ${!waliEntry ? `<div class="notice">⚠️ ${adminMode ? "Pilih kelas di atas" : "Atur <strong>Wali Kelas</strong> di menu Pengaturan"} untuk melihat daftar siswa.</div>` : ""}
    <div class="card" id="studentListCard"></div>
  `;

  if (adminMode) {
    document.getElementById("adminKelasSelect2").addEventListener("change", (e) => {
      App.adminSelectedKelas = e.target.value || null;
      App.adminStudentFilter = null;
      renderStudentListPage();
    });
  }

  if (!waliEntry) return;

  const card = document.getElementById("studentListCard");
  card.innerHTML = `<div class="notice info" style="margin:0;">Memuat daftar siswa...</div>`;
  const roster = await loadStudentRoster(kelas);
  const contacts = await loadContacts();

  const addBtnHtml = `<div style="margin-bottom:12px;"><button type="button" class="btn btn-primary" id="btnAddStudent">+ Tambah/Edit Siswa</button></div>`;

  if (!roster.length) {
    card.innerHTML = addBtnHtml + `<div class="empty-state"><div class="icon">🧑‍🎓</div>Belum ada siswa terdaftar untuk kelas ${escapeHtml(kelas)}.<br>Klik <strong>+ Tambah/Edit Siswa</strong> di atas untuk mulai menambahkan (NISN, nama, dan nomor HP orang tua).</div>`;
    document.getElementById("btnAddStudent").addEventListener("click", () => openStudentModal(kelas, null));
    return;
  }

  const statusMenus = MENUS.filter(m => ["jurnal-siswa", "daftar-hadir", "rekap-hasil", "paspor"].includes(m.id));
  const savedFilter = App.adminStudentFilter;
  App.adminStudentFilter = null; // hitung tanpa filter siswa dulu, supaya jumlahnya akurat
  const rowsByMenu = {};
  statusMenus.forEach(m => { rowsByMenu[m.id] = getFilteredRows(m); });
  App.adminStudentFilter = savedFilter;

  let html = addBtnHtml + `<div class="table-wrap"><table><thead><tr>
      <th>No</th><th>NISN</th><th>Nama Siswa</th><th>No HP Ortu</th>${statusMenus.map(m => `<th>${m.icon} ${m.label}</th>`).join("")}<th>Aksi</th>
    </tr></thead><tbody>`;
  roster.forEach((r, i) => {
    const contact = contacts[r.nisn];
    html += `<tr><td>${i + 1}</td><td>${escapeHtml(r.nisn)}</td><td>${escapeHtml(r.nama)}</td><td>${contact && contact.phone ? escapeHtml(contact.phone) : '<span style="color:var(--ink-300);">— belum diisi</span>'}</td>`;
    statusMenus.forEach(m => {
      const count = countRowsForRoster(rowsByMenu[m.id], m, r);
      html += `<td style="text-align:center;"><button type="button" class="btn btn-sm" data-menu="${m.id}" data-nisn="${escapeHtml(r.nisn)}" data-nama="${escapeHtml(r.nama)}" title="Lihat detail di ${escapeHtml(m.label)}">${count ? "✅ " + count : "—"}</button></td>`;
    });
    html += `<td><button type="button" class="btn btn-sm" data-edit-nisn="${escapeHtml(r.nisn)}">✏️</button></td>`;
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  card.innerHTML = html;

  document.getElementById("btnAddStudent").addEventListener("click", () => openStudentModal(kelas, null));
  card.querySelectorAll("[data-menu]").forEach(btn => {
    btn.addEventListener("click", () => goToMenuForStudent(btn.dataset.menu, btn.dataset.nisn, btn.dataset.nama));
  });
  card.querySelectorAll("[data-edit-nisn]").forEach(btn => {
    btn.addEventListener("click", () => {
      const r = roster.find(x => x.nisn === btn.dataset.editNisn);
      openStudentModal(kelas, r || null);
    });
  });
}

/* Modal tambah/edit satu siswa: menulis ke sheet "00Roster Siswa" (Kelas, NISN,
   Nama, L/P) dan "00Kontak Orang Tua" (NISN, Nama, Kelas, No HP Orang Tua)
   sekaligus, langsung (tanpa antrian) supaya NISN duplikat bisa dicegah saat itu juga. */
function openStudentModal(kelas, existing) {
  const s = Store.getSettings();
  if (!s.scriptUrl) { toast("URL sinkron belum diatur. Buka menu Pengaturan dulu.", true); return; }

  document.getElementById("modalTitle").textContent = existing ? "Edit Data Siswa" : "Tambah Siswa — " + kelas;
  const form = document.getElementById("modalForm");
  const existingContact = existing ? (contactCache && contactCache[existing.nisn]) : null;
  form.innerHTML = `
    <div class="field"><label>Kelas</label><input type="text" value="${escapeHtml(kelas)}" readonly></div>
    <div class="field"><label>NISN</label><input type="text" name="f_nisn" value="${existing ? escapeHtml(existing.nisn) : ""}" ${existing ? "readonly" : ""} required placeholder="Contoh: 0123456789"></div>
    <div class="field"><label>Nama Siswa</label><input type="text" name="f_nama" value="${existing ? escapeHtml(existing.nama) : ""}" required></div>
    <div class="field">
      <label>L/P</label>
      <select name="f_lp">
        <option value="">-- pilih --</option>
        <option value="L" ${existing && existing.lp === "L" ? "selected" : ""}>L</option>
        <option value="P" ${existing && existing.lp === "P" ? "selected" : ""}>P</option>
      </select>
    </div>
    <div class="field">
      <label>No HP Orang Tua (WhatsApp)</label>
      <input type="text" name="f_phone" value="${existingContact ? escapeHtml(existingContact.phone) : ""}" placeholder="Contoh: 08123456789">
      <small>Dipakai untuk tombol "Kirim WA" langsung ke orang tua. Boleh dikosongkan.</small>
    </div>
    <div class="actions">
      <button type="button" class="btn" id="cancelStudentForm">Batal</button>
      <button type="submit" class="btn btn-primary">Simpan</button>
    </div>
  `;
  document.getElementById("modalOverlay").classList.remove("hidden");
  document.getElementById("cancelStudentForm").addEventListener("click", closeModal);
  form.onsubmit = (e) => { e.preventDefault(); submitStudentForm(e, kelas, existing, existingContact); };
}

async function submitStudentForm(e, kelas, existing, existingContact) {
  const fd = new FormData(e.target);
  const nisn = (fd.get("f_nisn") || "").trim();
  const nama = (fd.get("f_nama") || "").trim();
  const lp = (fd.get("f_lp") || "").trim();
  const phone = (fd.get("f_phone") || "").trim();
  if (!nisn || !nama) { toast("NISN dan Nama wajib diisi.", true); return; }

  const s = Store.getSettings();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Menyimpan...";

  try {
    // cek duplikat NISN kalau ini siswa baru
    if (!existing) {
      const allRoster = await GSheet.fetchRoster(s.scriptUrl, CONFIG.rosterSheetName);
      if (allRoster.some(r => r.nisn === nisn)) {
        toast("NISN " + nisn + " sudah terdaftar. Gunakan NISN lain atau edit data yang sudah ada.", true);
        submitBtn.disabled = false; submitBtn.textContent = "Simpan";
        return;
      }
    }

    const rosterRow = { Kelas: kelas, NISN: nisn, Nama: nama, "L/P": lp };
    if (existing && existing._row) {
      await GSheet.apiPost(s.scriptUrl, { sheet: CONFIG.rosterSheetName, action: "update", row: rosterRow, rowIndex: existing._row });
    } else {
      await GSheet.apiPost(s.scriptUrl, { sheet: CONFIG.rosterSheetName, action: "append", row: rosterRow });
    }

    const contactRow = { NISN: nisn, Nama: nama, Kelas: kelas, "No HP Orang Tua": phone };
    if (existingContact && existingContact._row) {
      await GSheet.apiPost(s.scriptUrl, { sheet: CONFIG.contactSheetName, action: "update", row: contactRow, rowIndex: existingContact._row });
    } else {
      await GSheet.apiPost(s.scriptUrl, { sheet: CONFIG.contactSheetName, action: "append", row: contactRow });
    }

    Store.clearRosterCache("kelas:" + kelas); // paksa reload roster segar berikutnya
    invalidateContactCache();
    toast("Data siswa disimpan.");
    closeModal();
    renderStudentListPage();
  } catch (err) {
    toast("Gagal menyimpan: " + err.message, true);
    submitBtn.disabled = false; submitBtn.textContent = "Simpan";
  }
}

function goToMenuForStudent(menuId, nisn, nama) {
  const menu = MENUS.find(m => m.id === menuId);
  if (!menu) return;
  App.view = menuId;
  App.adminStudentFilter = { nisn, nama };
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === menuId));
  if (App.pollTimer) { clearInterval(App.pollTimer); App.pollTimer = null; }
  renderMenuPage(menu);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* --------------------------------------------------------------------- */
/* CEKLIS KEHADIRAN — khusus menu Daftar Hadir Literasi                   */
/* Isi kehadiran semua siswa sekaligus, lalu simpan dalam satu klik.      */
/* --------------------------------------------------------------------- */

let attendanceSelectedBulan = "";

async function renderAttendanceChecklist(menu) {
  const card = document.getElementById("checklistCard");
  if (!card) return;
  const waliEntry = getEffectiveWaliEntry(menu);

  if (!waliEntry) {
    card.innerHTML = `<div class="notice">⚠️ Atur <strong>Wali Kelas</strong> di menu Pengaturan dulu untuk memakai ceklis kehadiran.</div>`;
    return;
  }

  card.innerHTML = `
    <h3 style="margin-top:0;">✅ Isi Kehadiran (Ceklis Cepat)</h3>
    <div class="checklist-toolbar">
      <label>Bulan:</label>
      <select id="attBulan">
        <option value="">-- pilih bulan --</option>
        ${BULAN_LIST.map(b => `<option value="${b}" ${b === attendanceSelectedBulan ? "selected" : ""}>${b}</option>`).join("")}
      </select>
      <span style="color:var(--ink-300); font-size:12px;">Memuat daftar siswa...</span>
    </div>
    <div id="attTableWrap"></div>
  `;

  document.getElementById("attBulan").addEventListener("change", (e) => {
    attendanceSelectedBulan = e.target.value;
    renderAttendanceChecklist(menu);
  });

  const roster = await loadStudentRoster(waliEntry.kelas);
  const wrap = document.getElementById("attTableWrap");

  if (!roster.length) {
    wrap.innerHTML = `<div class="notice">Belum ada siswa terdaftar untuk kelas ${escapeHtml(waliEntry.kelas)} di sheet "00Roster Siswa". Tambahkan lewat menu <strong>Daftar Siswa</strong> terlebih dahulu.</div>`;
    return;
  }
  if (!attendanceSelectedBulan) {
    wrap.innerHTML = `<div class="notice info">Pilih bulan terlebih dahulu untuk mulai mencentang kehadiran.</div>`;
    return;
  }

  const rows = getFilteredRows(menu).filter(r => (r.Bulan || "") === attendanceSelectedBulan);

  let html = `<div class="table-wrap"><table class="checklist-table"><thead><tr>
      <th>No</th><th>Nama Siswa</th><th>Pertemuan 1</th><th>Pertemuan 2</th><th>TLP2</th><th>TLP4</th>
    </tr></thead><tbody>`;
  roster.forEach((r, i) => {
    const existing = rows.find(row => matchesRoster(row, r));
    const p1 = existing && existing.Pertemuan1 && existing.Pertemuan1 !== "" && existing.Pertemuan1 !== "Alpa";
    const p2 = existing && existing.Pertemuan2 && existing.Pertemuan2 !== "" && existing.Pertemuan2 !== "Alpa";
    const t2 = existing && existing.TLP2;
    const t4 = existing && existing.TLP4;
    html += `<tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(r.nama)}</td>
      <td><input type="checkbox" data-nisn="${escapeHtml(r.nisn)}" data-field="Pertemuan1" ${p1 ? "checked" : ""}></td>
      <td><input type="checkbox" data-nisn="${escapeHtml(r.nisn)}" data-field="Pertemuan2" ${p2 ? "checked" : ""}></td>
      <td><input type="checkbox" data-nisn="${escapeHtml(r.nisn)}" data-field="TLP2" ${t2 ? "checked" : ""}></td>
      <td><input type="checkbox" data-nisn="${escapeHtml(r.nisn)}" data-field="TLP4" ${t4 ? "checked" : ""}></td>
    </tr>`;
  });
  html += `</tbody></table></div>
    <div class="actions" style="display:flex; justify-content:flex-end; margin-top:12px;">
      <button class="btn btn-primary" id="attSaveAll">💾 Simpan Semua Kehadiran</button>
    </div>`;
  wrap.innerHTML = html;

  document.getElementById("attSaveAll").addEventListener("click", () => saveAttendanceChecklist(menu, roster));
}

function saveAttendanceChecklist(menu, roster) {
  const s = Store.getSettings();
  const waliEntry = getEffectiveWaliEntry(menu);
  const rows = getFilteredRows(menu).filter(r => (r.Bulan || "") === attendanceSelectedBulan);
  const checkboxes = document.querySelectorAll('#attTableWrap input[type="checkbox"]');

  const dataByNisn = {};
  checkboxes.forEach(cb => {
    const nisn = cb.dataset.nisn;
    dataByNisn[nisn] = dataByNisn[nisn] || {};
    if (cb.dataset.field === "Pertemuan1" || cb.dataset.field === "Pertemuan2") {
      dataByNisn[nisn][cb.dataset.field] = cb.checked ? "Hadir" : "Alpa";
    } else {
      dataByNisn[nisn][cb.dataset.field] = cb.checked ? "✓" : "";
    }
  });

  let savedCount = 0;
  roster.forEach((r, i) => {
    const rowData = {
      Kelas: waliEntry.kelas,
      Bulan: attendanceSelectedBulan,
      "Wali Kelas": waliEntry.wali,
      "Kepala Sekolah": s.kepsek,
      No: String(i + 1),
      NISN: r.nisn,
      Nama: r.nama,
      ...dataByNisn[r.nisn],
    };
    const existing = rows.find(row => matchesRoster(row, r));

    if (existing && existing._pending && existing._localId) {
      const q = Store.getQueue(menu.name);
      const item = q.find(it => it.localId === existing._localId);
      if (item) { item.row = { ...item.row, ...rowData }; Store.saveQueue(menu.name, q); }
    } else if (existing && existing._row) {
      Store.pushToQueue(menu.name, "update", rowData, existing._row);
    } else {
      Store.pushToQueue(menu.name, "append", rowData);
    }
    savedCount++;
  });

  toast(`Kehadiran ${savedCount} siswa disimpan. Menyinkronkan ke sheet...`);
  renderMenuPage(menu);
  if (s.scriptUrl) doSync(menu, { silent: true });
}

/* --------------------------------------------------------------------- */
/* FORM TAMBAH / EDIT DATA                                                */
/* --------------------------------------------------------------------- */

let studentNamesCache = [];

async function openFormModal(menu, existingRow = null) {
  const s = Store.getSettings();
  const waliEntry = getEffectiveWaliEntry(menu);

  document.getElementById("modalTitle").textContent = existingRow ? "Edit Data" : "Tambah Data — " + menu.label;
  const form = document.getElementById("modalForm");
  form.innerHTML = `<div class="notice info" style="margin:0;">Memuat data siswa...</div>`;
  document.getElementById("modalOverlay").classList.remove("hidden");

  studentNamesCache = waliEntry ? await loadStudentRoster(waliEntry.kelas) : [];

  const savedFilter = App.adminStudentFilter;
  App.adminStudentFilter = null;
  const rows = getFilteredRows(menu);
  App.adminStudentFilter = savedFilter;
  const nextNo = existingRow ? existingRow.No : (rows.length + 1);

  let html = "";
  menu.columns.forEach(col => {
    let val = existingRow ? (existingRow[col.key] ?? "") : "";
    if (col.type === "studentSelect") {
      val = existingRow ? { __nisn: existingRow.NISN || "", __name: existingRow[col.key] || "" } : { __nisn: "", __name: "" };
    }
    html += `<div class="field"><label>${col.label}</label>${renderFieldInput(col, val, s, waliEntry, nextNo)}</div>`;
  });
  html += `<div class="actions">
      <button type="button" class="btn" id="cancelForm">Batal</button>
      <button type="submit" class="btn btn-primary">${existingRow ? "Simpan Perubahan" : "Simpan"}</button>
    </div>`;
  form.innerHTML = html;

  document.getElementById("cancelForm").addEventListener("click", closeModal);
  form.onsubmit = (e) => { e.preventDefault(); submitForm(e, menu, existingRow); };
}

function renderFieldInput(col, val, s, waliEntry, nextNo) {
  const name = `f_${col.key}`;
  if (col.type === "auto") {
    let autoVal = val;
    if (!existingValIsSet(val)) {
      if (col.key === "Kelas") autoVal = waliEntry ? waliEntry.kelas : "";
      else if (col.key === "Wali Kelas") autoVal = waliEntry ? waliEntry.wali : s.wali;
      else if (col.key === "Kepala Sekolah") autoVal = s.kepsek;
      else if (col.key === "Tahun") autoVal = s.tahunPelajaran;
    }
    return `<input type="text" name="${name}" value="${escapeHtml(autoVal)}" readonly>`;
  }
  if (col.type === "studentSelect") {
    // val di sini adalah NISN siswa yang sudah tersimpan di baris ini (kalau ada),
    // dicari lewat properti tersembunyi __nisn yang disisipkan saat membuka form edit.
    const currentNisn = val && val.__nisn ? val.__nisn : "";
    let opts = studentNamesCache.map(r => `<option value="${escapeHtml(r.nisn)}" ${r.nisn === currentNisn ? "selected" : ""}>${escapeHtml(r.nama)} — ${escapeHtml(r.nisn)}</option>`).join("");
    if (!studentNamesCache.length) opts = `<option value="">(daftar siswa belum ada — tambahkan lewat menu Daftar Siswa, atau ketik manual di bawah)</option>`;
    return `<select name="${name}" data-role="studentSelect">${opts ? `<option value="">-- pilih siswa --</option>${opts}` : ""}</select>
      <small>Jika nama tidak ada di daftar, ketik manual (data tidak akan tertaut NISN):</small>
      <input type="text" name="${name}_manual" placeholder="Nama siswa manual (opsional)" value="${!currentNisn && val && val.__name ? escapeHtml(val.__name) : ""}">`;
  }
  if (col.type === "month") {
    const opts = BULAN_LIST.map(b => `<option value="${b}" ${b === val ? "selected" : ""}>${b}</option>`).join("");
    return `<select name="${name}"><option value="">-- pilih bulan --</option>${opts}</select>`;
  }
  if (col.type === "select") {
    const opts = (col.options || []).map(o => `<option value="${escapeHtml(o)}" ${o === val ? "selected" : ""}>${escapeHtml(o)}</option>`).join("");
    return `<select name="${name}"><option value="">-- pilih --</option>${opts}</select>`;
  }
  if (col.type === "date") {
    return `<input type="date" name="${name}" value="${toDateInputValue(val)}">`;
  }
  if (col.type === "number") {
    const v = val || (col.key === "No" ? nextNo : "");
    return `<input type="number" name="${name}" value="${escapeHtml(v)}">`;
  }
  if (col.type === "textarea") {
    return `<textarea name="${name}" rows="3">${escapeHtml(val)}</textarea>`;
  }
  return `<input type="text" name="${name}" value="${escapeHtml(val)}">`;
}

function existingValIsSet(v) { return v !== undefined && v !== null && v !== ""; }

function toDateInputValue(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return "";
  return d.toISOString().slice(0, 10);
}

/* Roster siswa (NISN + Nama) untuk satu kelas, dari sheet "00Roster Siswa"
   di DATA BASE LITERASI (lewat Apps Script). NISN dipakai sebagai identitas
   unik siswa di seluruh aplikasi supaya nama kembar tidak tertukar datanya. */
async function loadStudentRoster(kelas) {
  if (!kelas) return [];
  const cacheKey = "kelas:" + kelas;
  const cached = Store.getRosterCache(cacheKey);
  const isFresh = cached && (Date.now() - cached.ts) < 5 * 60 * 1000; // 5 menit — roster berubah lebih sering dari cache lama
  const s = Store.getSettings();
  if (!s.scriptUrl) return isFresh ? cached.names : (cached ? cached.names : []);
  if (isFresh) return cached.names;
  try {
    const all = await GSheet.fetchRoster(s.scriptUrl, CONFIG.rosterSheetName);
    const list = all.filter(r => r.kelas.trim().toUpperCase() === kelas.trim().toUpperCase())
      .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
    Store.saveRosterCache(cacheKey, list);
    return list;
  } catch (err) {
    console.warn("Gagal memuat roster siswa:", err);
    return cached ? cached.names : [];
  }
}

let contactCache = null; // { [nisn]: { nisn, nama, kelas, phone } } — dimuat sekali per sesi, dipakai fitur WA
async function loadContacts() {
  const s = Store.getSettings();
  if (!s.scriptUrl) return {};
  if (contactCache) return contactCache;
  try {
    contactCache = await GSheet.fetchContacts(s.scriptUrl, CONFIG.contactSheetName);
    return contactCache;
  } catch (err) {
    console.warn("Gagal memuat kontak orang tua:", err);
    return {};
  }
}
function invalidateContactCache() { contactCache = null; }

/* Normalisasi nomor HP Indonesia -> format wa.me (62xxxxxxxxxx, tanpa +/spasi/strip). */
function normalizePhoneWa(raw) {
  let d = String(raw || "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("62")) { /* sudah benar */ }
  else if (d.startsWith("8")) d = "62" + d;
  return d;
}

function closeModal() {
  document.getElementById("modalOverlay").classList.add("hidden");
}

function submitForm(e, menu, existingRow) {
  const fd = new FormData(e.target);
  const rowData = {};
  menu.columns.forEach(col => {
    if (col.type === "studentSelect") {
      const manual = (fd.get(`f_${col.key}_manual`) || "").trim();
      const pickedNisn = (fd.get(`f_${col.key}`) || "").trim();
      const matched = studentNamesCache.find(r => r.nisn === pickedNisn);
      rowData[col.key] = manual || (matched ? matched.nama : "");
      // NISN ikut disimpan (kalau sheet asli punya kolom NISN) supaya identitas
      // siswa tidak tertukar walau ada nama kembar di kelas yang sama. Entri
      // "ketik manual" tidak punya NISN — dianggap siswa di luar roster.
      rowData.NISN = manual ? "" : pickedNisn;
    } else {
      rowData[col.key] = (fd.get(`f_${col.key}`) || "").toString().trim();
    }
  });

  if (existingRow) {
    if (existingRow._pending && existingRow._localId) {
      const q = Store.getQueue(menu.name);
      const item = q.find(i => i.localId === existingRow._localId);
      if (item) { item.row = { ...item.row, ...rowData }; Store.saveQueue(menu.name, q); }
    } else if (existingRow._row) {
      Store.pushToQueue(menu.name, "update", rowData, existingRow._row);
    }
    toast("Perubahan disimpan. Klik Sinkron untuk mengirim ke sheet.");
  } else {
    Store.pushToQueue(menu.name, "append", rowData);
    toast("Data ditambahkan. Klik Sinkron untuk mengirim ke sheet.");
  }

  closeModal();
  renderMenuPage(menu);
  const s = Store.getSettings();
  if (s.scriptUrl) doSync(menu, { silent: true });
}

/* --------------------------------------------------------------------- */
/* SINKRONISASI                                                           */
/* --------------------------------------------------------------------- */

async function doSync(menu, opts = {}) {
  const s = Store.getSettings();
  if (!s.scriptUrl) {
    if (!opts.silent) toast("URL sinkron belum diatur. Buka menu Pengaturan.", true);
    return;
  }
  if (App.syncing[menu.name]) return;
  App.syncing[menu.name] = true;
  updateSyncIndicator("busy", "Menyinkronkan...");

  try {
    // 1. kirim antrian lokal (append/update/delete)
    const queue = Store.getQueue(menu.name);
    for (const item of queue) {
      try {
        await GSheet.apiPost(s.scriptUrl, { sheet: menu.name, action: item.action, row: item.row, rowIndex: item.rowIndex });
        Store.clearQueueItem(menu.name, item.localId);
      } catch (err) {
        console.warn("Gagal mengirim item antrian:", err);
        // hentikan agar tidak duplikat; sisanya dicoba lagi saat sinkron berikutnya
        break;
      }
    }

    // 2. ambil data terbaru dari sheet
    const fresh = await GSheet.apiGet(s.scriptUrl, menu.name);
    Store.saveCache(menu.name, fresh);

    updateSyncIndicator("ok", "Tersinkron " + new Date().toLocaleTimeString("id-ID"));
    if (!opts.silent) toast("Sinkron berhasil.");
    if (App.view === menu.id) renderMenuPage(menu);
  } catch (err) {
    console.error(err);
    updateSyncIndicator("err", "Gagal sinkron");
    if (!opts.silent) toast("Gagal sinkron: " + err.message, true);
  } finally {
    App.syncing[menu.name] = false;
  }
}

/* --------------------------------------------------------------------- */
/* PENGATURAN                                                             */
/* --------------------------------------------------------------------- */

function renderSettingsPage() {
  const s = Store.getSettings();

  $app().innerHTML = `
    <div class="page-header">
      <div><h2>⚙️ Pengaturan</h2><div class="sub">Data ini digunakan untuk mengisi otomatis kolom Kelas, Wali Kelas, dan Kepala Sekolah di setiap jurnal.</div></div>
    </div>

    <div class="card">
      <form id="settingsForm" class="form-grid">
        <div class="field">
          <label>Nama Kepala Sekolah</label>
          <input type="text" id="set_kepsek" value="${escapeHtml(s.kepsek)}" placeholder="Contoh: Encup Supriatna, S.Pd">
        </div>
        <div class="field">
          <label>Wali Kelas</label>
          <select id="set_wali">
            <option value="">-- pilih wali kelas --</option>
            ${WALI_KELAS_LIST.map(w => `<option value="${escapeHtml(w.wali)}" ${w.wali === s.wali ? "selected" : ""}>${escapeHtml(w.wali)}</option>`).join("")}
          </select>
        </div>
        <div class="field readonly">
          <label>Kelas (otomatis)</label>
          <input type="text" id="set_kelas" value="${escapeHtml(s.kelas)}" readonly>
        </div>
        <div class="field">
          <label>Tahun Pelajaran</label>
          <input type="text" id="set_tahun" value="${escapeHtml(s.tahunPelajaran)}" placeholder="2026/2027">
        </div>
        <div class="field" style="grid-column:1/-1;">
          <label>URL Web App Sinkron (Google Apps Script)</label>
          <input type="text" id="set_script" value="${escapeHtml(s.scriptUrl)}" placeholder="https://script.google.com/macros/s/xxxx/exec">
          <small>Dapatkan URL ini setelah deploy <code>apps-script/Code.gs</code> ke spreadsheet DATA BASE LITERASI. Lihat PANDUAN_DEPLOY.md.</small>
        </div>
        <div class="actions" style="grid-column:1/-1;">
          <button type="submit" class="btn btn-primary">💾 Simpan Pengaturan</button>
        </div>
      </form>
    </div>
  `;

  const waliSelect = document.getElementById("set_wali");
  const kelasInput = document.getElementById("set_kelas");
  waliSelect.addEventListener("change", () => {
    const entry = WALI_KELAS_LIST.find(w => w.wali === waliSelect.value);
    kelasInput.value = entry ? entry.kelas : "";
  });

  document.getElementById("settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const newSettings = {
      kepsek: document.getElementById("set_kepsek").value.trim(),
      wali: waliSelect.value,
      kelas: kelasInput.value.trim(),
      tahunPelajaran: document.getElementById("set_tahun").value.trim(),
      scriptUrl: document.getElementById("set_script").value.trim(),
    };
    Store.saveSettings(newSettings);
    toast("Pengaturan disimpan.");
    navigateTo("dashboard");
  });
}

/* --------------------------------------------------------------------- */
/* EKSPOR PDF — Pratinjau dulu, lalu Unduh (hasil dijamin identik karena  */
/* memakai HTML & CSS yang sama persis untuk pratinjau maupun cetak)      */
/* --------------------------------------------------------------------- */

function buildDocHtml(menu, rows) {
  const s = Store.getSettings();
  const effKelas = effectiveKelasFor(menu);
  const effWali = effectiveWaliFor(menu);
  const visibleCols = menu.columns.filter(c => !["Kelas", "Wali Kelas", "Kepala Sekolah", "Tahun"].includes(c.key));
  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const logoSrc = LOGO_DATA_URI || "/logo/logo.png";

  let tableRows = "";
  rows.forEach(r => {
    tableRows += "<tr>";
    visibleCols.forEach(c => {
      const isNum = c.type === "number";
      tableRows += `<td class="${isNum ? "center" : ""}">${linkifyCell(r[c.key] || "")}</td>`;
    });
    tableRows += "</tr>";
  });

  return `
    <div class="doc">
      <div class="doc-head">
        <img src="${logoSrc}" alt="logo">
        <div>
          <p class="sch-name">${CONFIG.namaSekolah}</p>
          <p class="sch-addr">Harjamukti, Kota Cirebon</p>
        </div>
      </div>
      <div class="doc-title">${menu.title}</div>
      <table class="doc-meta">
        <tr><td class="k">Kelas</td><td>: ${escapeHtml(effKelas)}</td><td class="sep"></td><td class="k">Tahun Pelajaran</td><td>: ${escapeHtml(s.tahunPelajaran)}</td></tr>
        <tr><td class="k">Wali Kelas</td><td>: ${escapeHtml(effWali)}</td><td class="sep"></td><td class="k">Tanggal Cetak</td><td>: ${today}</td></tr>
      </table>
      <table class="doc-table">
        <thead><tr>${visibleCols.map(c => `<th>${c.label}</th>`).join("")}</tr></thead>
        <tbody>${tableRows || `<tr><td colspan="${visibleCols.length}" class="center">Tidak ada data</td></tr>`}</tbody>
      </table>
      <div class="doc-sign">
        <div class="box">
          <div class="place">Cirebon, ${today}</div>
          <div class="role">Wali Kelas</div>
          <div class="name">${escapeHtml(effWali || "________________")}</div>
        </div>
        <div class="box">
          <div class="place">&nbsp;</div>
          <div class="role">Mengetahui,<br>Kepala Sekolah</div>
          <div class="name">${escapeHtml(s.kepsek || "________________")}</div>
        </div>
      </div>
      <div class="doc-footer-note">Dicetak otomatis dari Aplikasi Jurnal Literasi — ${CONFIG.namaSekolah}.</div>
    </div>
  `;
}

let currentPdfContext = null; // { menu, rows } — dipakai saat tombol "Unduh PDF" ditekan

async function openPdfPreview(menu, rows) {
  if (!rows.length) { toast("Tidak ada data untuk dicetak.", true); return; }
  if (!LOGO_DATA_URI) await preloadLogo();

  currentPdfContext = { menu, rows };
  const html = buildDocHtml(menu, rows);
  document.getElementById("pdfPreviewContent").innerHTML = html;
  document.getElementById("pdfPreviewOverlay").classList.remove("hidden");
}

function closePdfPreview() {
  document.getElementById("pdfPreviewOverlay").classList.add("hidden");
}

function downloadPdfNow() {
  if (!currentPdfContext) return;
  const { menu, rows } = currentPdfContext;
  const html = buildDocHtml(menu, rows); // dibangun ulang dari data yang sama persis dengan pratinjau

  document.getElementById("print-area").innerHTML = html;
  document.body.classList.add("printing");
  const prevTitle = document.title;
  document.title = `${menu.title} - ${effectiveKelasFor(menu) || ""}`;
  window.print();
  setTimeout(() => {
    document.body.classList.remove("printing");
    document.title = prevTitle;
  }, 500);
}

/* --------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", init);
