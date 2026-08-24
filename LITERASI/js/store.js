/* =========================================================================
   STORE.JS — manajemen state di localStorage (agar app ringan & tetap
   berfungsi walau koneksi lambat / offline sementara)
   ========================================================================= */

const Store = (() => {
  const SETTINGS_KEY = "literasi_settings_v1";
  const CACHE_PREFIX = "literasi_cache_v1_";
  const QUEUE_PREFIX = "literasi_queue_v1_";
  const ROSTER_PREFIX = "literasi_roster_v1_";

  function getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const s = raw ? JSON.parse(raw) : defaultSettings();
      // Jika URL sinkron belum pernah diisi user (mis. tersimpan kosong dari versi lama),
      // pakai URL default dari config.js supaya sinkron otomatis tetap jalan.
      if (!s.scriptUrl) s.scriptUrl = CONFIG.defaultScriptUrl || "";
      return s;
    } catch { return defaultSettings(); }
  }

  function defaultSettings() {
    return {
      kepsek: "",
      wali: "",
      kelas: "",
      tahunPelajaran: "2026/2027",
      scriptUrl: CONFIG.defaultScriptUrl || "",
    };
  }

  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  function getCache(sheetName) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + sheetName);
      return raw ? JSON.parse(raw) : { rows: [], lastSync: null };
    } catch { return { rows: [], lastSync: null }; }
  }

  function saveCache(sheetName, rows) {
    localStorage.setItem(CACHE_PREFIX + sheetName, JSON.stringify({
      rows, lastSync: new Date().toISOString(),
    }));
  }

  // Antrian data yang dibuat/diubah secara lokal tapi belum berhasil dikirim ke sheet
  function getQueue(sheetName) {
    try {
      const raw = localStorage.getItem(QUEUE_PREFIX + sheetName);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveQueue(sheetName, queue) {
    localStorage.setItem(QUEUE_PREFIX + sheetName, JSON.stringify(queue));
  }

  function pushToQueue(sheetName, action, row, rowIndex = null) {
    const q = getQueue(sheetName);
    q.push({ action, row, rowIndex, ts: Date.now(), localId: "L" + Date.now() + Math.random().toString(36).slice(2,7) });
    saveQueue(sheetName, q);
    return q[q.length - 1];
  }

  function clearQueueItem(sheetName, localId) {
    const q = getQueue(sheetName).filter(item => item.localId !== localId);
    saveQueue(sheetName, q);
  }

  function getRosterCache(rosterSheet) {
    try {
      const raw = localStorage.getItem(ROSTER_PREFIX + rosterSheet);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function saveRosterCache(rosterSheet, names) {
    localStorage.setItem(ROSTER_PREFIX + rosterSheet, JSON.stringify({ names, ts: Date.now() }));
  }

  function clearRosterCache(rosterSheet) {
    localStorage.removeItem(ROSTER_PREFIX + rosterSheet);
  }

  // ---- Mode Kepsek (login sederhana untuk melihat rekap semua kelas) ----
  const ADMIN_KEY = "literasi_admin_v1";

  function isAdminLoggedIn() {
    return localStorage.getItem(ADMIN_KEY) === "1";
  }

  function setAdminLoggedIn(value) {
    if (value) localStorage.setItem(ADMIN_KEY, "1");
    else localStorage.removeItem(ADMIN_KEY);
  }

  return {
    getSettings, saveSettings,
    getCache, saveCache,
    getQueue, saveQueue, pushToQueue, clearQueueItem,
    getRosterCache, saveRosterCache, clearRosterCache,
    isAdminLoggedIn, setAdminLoggedIn,
  };
})();
