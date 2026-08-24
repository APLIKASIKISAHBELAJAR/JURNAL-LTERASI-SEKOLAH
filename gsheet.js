/* =========================================================================
   GSHEET.JS — utilitas mengambil data dari Google Sheets
   - Roster siswa: dibaca langsung via endpoint publik gviz (read-only, ringan)
   - Data jurnal (DATA BASE LITERASI): dibaca & ditulis lewat Apps Script Web App
   ========================================================================= */

const GSheet = (() => {

  // Parser CSV sederhana namun aman untuk kutip & koma di dalam sel
  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
        else if (c === "\r") { /* skip */ }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(cell => cell !== ""));
  }

  // Ambil isi sheet (nama tab) dari spreadsheet publik sebagai array of object
  // Hanya memakai kolom A - D (sesuai kebutuhan data roster siswa)
  async function fetchSheetAsObjects(spreadsheetId, sheetName, colCount = 4) {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Gagal memuat sheet: " + sheetName);
    const csv = await res.text();
    const rows = parseCSV(csv);
    if (!rows.length) return [];

    const header = rows[0].slice(0, colCount).map(h => h.trim());
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const obj = {};
      let hasData = false;
      for (let c = 0; c < colCount; c++) {
        const val = (r[c] || "").trim();
        obj[header[c] || `col${c}`] = val;
        if (val) hasData = true;
      }
      if (hasData) out.push(obj);
    }
    return out;
  }

  // Cari nama siswa dari roster: ambil kolom yang paling "mirip nama"
  // (kolom teks terpanjang rata-rata, karena header sheet roster bisa bervariasi)
  function extractStudentNames(rosterRows) {
    if (!rosterRows.length) return [];
    const keys = Object.keys(rosterRows[0]);
    // Prioritaskan kolom bernama mengandung 'nama'
    let nameKey = keys.find(k => /nama/i.test(k));
    if (!nameKey) {
      // fallback: kolom dengan rata-rata panjang teks terbesar & bukan angka murni
      let best = null, bestLen = -1;
      keys.forEach(k => {
        const vals = rosterRows.map(r => r[k]).filter(Boolean);
        if (!vals.length) return;
        const numeric = vals.every(v => /^[0-9.\-\/]+$/.test(v));
        if (numeric) return;
        const avgLen = vals.reduce((a, v) => a + v.length, 0) / vals.length;
        if (avgLen > bestLen) { bestLen = avgLen; best = k; }
      });
      nameKey = best || keys[0];
    }
    const names = rosterRows.map(r => r[nameKey]).filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "id"));
  }

  // ---- Sinkron data jurnal via Apps Script Web App ----

  async function apiGet(scriptUrl, sheetName) {
    const url = `${scriptUrl}?sheet=${encodeURIComponent(sheetName)}&_=${Date.now()}`;
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const json = await res.json();
    if (json.status !== "ok") throw new Error(json.message || "Gagal mengambil data.");
    return json.data || [];
  }

  // Gunakan Content-Type text/plain agar tidak memicu CORS preflight (Apps Script tak mendukung OPTIONS)
  async function apiPost(scriptUrl, payload) {
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.status !== "ok") throw new Error(json.message || "Gagal menyimpan data.");
    return json;
  }

  // ---- Roster siswa (NISN) & kontak orang tua, lewat sheet DATA BASE LITERASI ----
  // Menggantikan roster lama (nama saja, dari spreadsheet publik terpisah):
  // sekarang sumbernya sheet "00Roster Siswa" / "00Kontak Orang Tua" di
  // DATA BASE LITERASI sendiri, dibaca lewat Apps Script Web App yang sama.

  async function fetchRoster(scriptUrl, sheetName) {
    const rows = await apiGet(scriptUrl, sheetName);
    return rows.map(r => ({
      _row: r._row,
      nisn: (r.NISN || "").trim(),
      nama: (r.Nama || "").trim(),
      kelas: (r.Kelas || "").trim(),
      lp: (r["L/P"] || "").trim(),
    })).filter(r => r.nisn && r.nama);
  }

  async function fetchContacts(scriptUrl, sheetName) {
    const rows = await apiGet(scriptUrl, sheetName);
    const map = {};
    rows.forEach(r => {
      const nisn = (r.NISN || "").trim();
      if (nisn) map[nisn] = { _row: r._row, nisn, nama: (r.Nama || "").trim(), kelas: (r.Kelas || "").trim(), phone: (r["No HP Orang Tua"] || "").trim() };
    });
    return map;
  }

  return { fetchSheetAsObjects, extractStudentNames, apiGet, apiPost, parseCSV, fetchRoster, fetchContacts };
})();
