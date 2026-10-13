/**
 * kegiatan.js — Modul Daftar Kegiatan v1.0
 * Dashboard Monitoring Webinar & Pelatihan | Pusbangkom
 * =====================================================
 * Sumber data: Google Spreadsheet (sheet "Kegiatan")
 *   - Data dibaca dari window.AppData.kegiatan (diisi oleh spreadsheet.js)
 *   - Data tambahan user (ditambah via form) disimpan di localStorage
 *     dengan key KG_LOCAL_KEY dan digabung saat render
 * Fitur:
 *  - CRUD kegiatan (Tambah, Baca, Ubah, Hapus)
 *    • Tambah/Edit/Hapus hanya berlaku pada data lokal (localStorage)
 *    • Data dari spreadsheet bersifat read-only
 *  - Filter status (Semua, Sedang Berlangsung, Akan Datang, Selesai)
 *  - Search real-time
 *  - Sort per kolom
 *  - Paginasi (10 baris per halaman)
 *  - Export CSV
 * =====================================================
 */

/* =====================================================
   SAFE HELPERS — agar tidak error jika spreadsheet.js
   belum selesai di-load (semua pakai defer)
   ===================================================== */
function _kgToast(type, title, msg) {
  const fn = window.showToast;
  if (typeof fn === 'function') fn(type, title, msg);
}

/* =====================================================
   STORAGE KEY & INISIALISASI DATA
   ===================================================== */
const KG_STORAGE_KEY  = 'pmw-kegiatan-data'; // legacy - tidak dipakai lagi
const KG_LOCAL_KEY    = 'pmw-kegiatan-local'; // data tambahan dari form user


/* =====================================================
   STATE
   ===================================================== */
let kegiatanData        = [];
let kegiatanFiltered    = [];
let kegiatanCurrentFilter = 'all';
let kegiatanSearchQuery = '';
let kegiatanSortCol     = 'tanggal';
let kegiatanSortAsc     = true;
let kegiatanCurrentPage = 1;
const KG_PAGE_SIZE      = 10;

let kegiatanEditId      = null;   // null = tambah baru, string = id yg diedit
let kegiatanDeleteId    = null;   // id yg akan dihapus

/* =====================================================
   INIT
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Muat data gabungan (spreadsheet + lokal)
  // Jika AppData.kegiatan belum terisi (belum fetch selesai), hanya data lokal yang tampil
  loadKegiatanData();

  // Keyboard handler untuk chip-chips
  document.querySelectorAll('.kegiatan-stat-chip').forEach(chip => {
    chip.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        chip.click();
      }
    });
  });

  // Tutup modal jika klik overlay
  document.getElementById('kegiatan-modal')?.addEventListener('click', function (e) {
    if (e.target === this) closeKegiatanModal();
  });
  document.getElementById('kegiatan-delete-modal')?.addEventListener('click', function (e) {
    if (e.target === this) closeDeleteModal();
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeKegiatanModal();
      closeDeleteModal();
    }
  });
});

/* =====================================================
   STORAGE — LOCAL ADDITIONS ONLY
   ===================================================== */

/**
 * Ambil data kegiatan gabungan:
 *   1. Data dari spreadsheet (window.AppData.kegiatan) — read-only, ditandai isLocal=false
 *   2. Data tambahan user dari localStorage — dapat di-edit/hapus, isLocal=true
 *
 * Dipanggil setiap kali renderKegiatanTable() atau renderKegiatanFromSpreadsheet().
 */
function loadKegiatanData() {
  const fromSheet = (window.AppData && window.AppData.kegiatan) || [];
  const fromLocal = loadLocalKegiatan();

  // Tandai sumber data
  const sheetItems = fromSheet.map(k => ({ ...k, isLocal: false }));
  const localItems = fromLocal.map(k => ({ ...k, isLocal: true }));

  // Gabung: spreadsheet duluan, lalu data lokal di bawah
  kegiatanData = [...sheetItems, ...localItems];
}

/**
 * Baca data lokal dari localStorage (data yang ditambah via form).
 */
function loadLocalKegiatan() {
  try {
    const raw = localStorage.getItem(KG_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.map(k => ({ jamSelesai: '', ...k }));
    }
  } catch { /* ignore */ }
  return [];
}

/**
 * Simpan hanya data lokal (isLocal=true) ke localStorage.
 */
function saveKegiatanToStorage() {
  const localOnly = kegiatanData.filter(k => k.isLocal);
  localStorage.setItem(KG_LOCAL_KEY, JSON.stringify(localOnly));
}

/**
 * Dipanggil oleh spreadsheet.js → renderTable() setiap kali data baru tiba.
 * Reload data gabungan lalu render ulang tabel.
 */
function renderKegiatanFromSpreadsheet() {
  loadKegiatanData();
  renderKegiatanTable();
}
window.renderKegiatanFromSpreadsheet = renderKegiatanFromSpreadsheet;

/* =====================================================
   RENDER TABEL
   ===================================================== */
function renderKegiatanTable() {
  applyKegiatanFilter();
  updateKegiatanChips();
}

function applyKegiatanFilter() {
  let data = [...kegiatanData];

  // Filter status
  if (kegiatanCurrentFilter !== 'all') {
    data = data.filter(k => k.status === kegiatanCurrentFilter);
  }

  // Search
  if (kegiatanSearchQuery) {
    const q = kegiatanSearchQuery.toLowerCase();
    data = data.filter(k =>
      k.nama.toLowerCase().includes(q) ||
      k.lokasi.toLowerCase().includes(q) ||
      k.status.toLowerCase().includes(q)
    );
  }

  // Sort
  data.sort((a, b) => {
    let va = a[kegiatanSortCol] || '';
    let vb = b[kegiatanSortCol] || '';
    if (va < vb) return kegiatanSortAsc ? -1 : 1;
    if (va > vb) return kegiatanSortAsc ? 1 : -1;
    return 0;
  });

  kegiatanFiltered = data;
  kegiatanCurrentPage = 1;
  renderKegiatanRows();
  renderKegiatanPagination();
  updateKegiatanCountInfo();
}

function renderKegiatanRows() {
  const tbody = document.getElementById('kegiatan-tbody');
  if (!tbody) return;

  const start = (kegiatanCurrentPage - 1) * KG_PAGE_SIZE;
  const slice = kegiatanFiltered.slice(start, start + KG_PAGE_SIZE);

  if (slice.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="kg-empty">
          <div class="kg-empty-inner">
            <i class="bi bi-calendar-x"></i>
            <p>Tidak ada kegiatan ditemukan</p>
            <button class="btn-kegiatan btn-primary-kg" onclick="openKegiatanModal()">
              <i class="bi bi-plus-lg"></i> Tambah Kegiatan
            </button>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = slice.map((item, idx) => {
    const no = start + idx + 1;
    return `
      <tr class="kg-row" data-id="${item.id}" data-status="${item.status}">
        <td class="td-center td-no">${no}</td>
        <td class="td-nama">
          <div class="kg-nama-wrap">
            <span class="kg-nama-text" title="${escapeHtml(item.nama)}">${escapeHtml(item.nama)}</span>
            <span class="kg-id-badge">${escapeHtml(item.id)}</span>
          </div>
        </td>
        <td class="td-keterangan">
          ${item.keterangan
            ? `<span class="kg-keterangan-text">${escapeHtml(item.keterangan)}</span>`
            : `<span class="kg-keterangan-empty">—</span>`}
        </td>
        <td class="td-tanggal">
          <div class="kg-tanggal-wrap">
            <i class="bi bi-calendar3 td-icon"></i>
            ${kgFormatTanggal(item.tanggal)}
          </div>
        </td>
        <td class="td-center td-jam">
          <div class="kg-jam-wrap">
            <i class="bi bi-clock td-icon"></i>
            ${item.jam || '-'}
          </div>
        </td>
        <td class="td-center td-jam">
          <div class="kg-jam-wrap">
            <i class="bi bi-clock-history td-icon"></i>
            ${item.jamSelesai || '-'}
          </div>
        </td>
        <td class="td-lokasi">
          <div class="kg-lokasi-wrap">
            <i class="bi bi-geo-alt td-icon"></i>
            <span title="${escapeHtml(item.lokasi)}">${escapeHtml(item.lokasi)}</span>
          </div>
        </td>
        <td class="td-center">
          ${renderStatusBadge(item.status)}
        </td>
        <td class="td-center td-aksi">
          <div class="kg-aksi-wrap">
            <button
              class="btn-aksi btn-edit"
              onclick="openKegiatanModal('${item.id}')"
              title="Edit kegiatan"
              aria-label="Edit ${escapeHtml(item.nama)}"
            >
              <i class="bi bi-pencil-fill"></i>
            </button>
            <button
              class="btn-aksi btn-delete"
              onclick="openDeleteModal('${item.id}')"
              title="Hapus kegiatan"
              aria-label="Hapus ${escapeHtml(item.nama)}"
            >
              <i class="bi bi-trash3-fill"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function renderStatusBadge(status) {
  const map = {
    'Sedang Berlangsung': { cls: 'badge-berlangsung', icon: 'bi-broadcast', label: 'Sedang Berlangsung' },
    'Akan Datang':        { cls: 'badge-datang',      icon: 'bi-calendar-event-fill', label: 'Akan Datang' },
    'Selesai':            { cls: 'badge-selesai',      icon: 'bi-check-circle-fill', label: 'Selesai' },
  };
  const cfg = map[status] || { cls: 'badge-default', icon: 'bi-question-circle', label: status };
  return `<span class="kg-status-badge ${cfg.cls}"><i class="bi ${cfg.icon}"></i> ${cfg.label}</span>`;
}

/* =====================================================
   CHIPS & COUNT INFO
   ===================================================== */
function updateKegiatanChips() {
  const all        = kegiatanData.length;
  const berlangsung = kegiatanData.filter(k => k.status === 'Sedang Berlangsung').length;
  const datang     = kegiatanData.filter(k => k.status === 'Akan Datang').length;
  const selesai    = kegiatanData.filter(k => k.status === 'Selesai').length;

  setEl('kg-count-all',         all);
  setEl('kg-count-berlangsung', berlangsung);
  setEl('kg-count-datang',      datang);
  setEl('kg-count-selesai',     selesai);
}

function updateKegiatanCountInfo() {
  const el = document.getElementById('kegiatan-count-info');
  if (!el) return;
  const total = kegiatanFiltered.length;
  const start = Math.min((kegiatanCurrentPage - 1) * KG_PAGE_SIZE + 1, total);
  const end   = Math.min(kegiatanCurrentPage * KG_PAGE_SIZE, total);
  el.textContent = total === 0
    ? 'Tidak ada kegiatan'
    : `Menampilkan ${start}–${end} dari ${total} kegiatan`;
}

/* =====================================================
   FILTER & SEARCH
   ===================================================== */
function filterKegiatanByStatus(status) {
  kegiatanCurrentFilter = status;

  // Update chip active state
  document.querySelectorAll('.kegiatan-stat-chip').forEach(chip => {
    chip.classList.remove('active');
    chip.setAttribute('aria-pressed', 'false');
  });
  const chipMap = {
    'all': 'kg-chip-all',
    'Sedang Berlangsung': 'kg-chip-berlangsung',
    'Akan Datang': 'kg-chip-datang',
    'Selesai': 'kg-chip-selesai',
  };
  const activeChip = document.getElementById(chipMap[status]);
  if (activeChip) {
    activeChip.classList.add('active');
    activeChip.setAttribute('aria-pressed', 'true');
  }

  applyKegiatanFilter();
}

function searchKegiatan() {
  kegiatanSearchQuery = (document.getElementById('kegiatan-search-input')?.value || '').trim();
  applyKegiatanFilter();
}

/* =====================================================
   SORT
   ===================================================== */
function sortKegiatan(col) {
  if (kegiatanSortCol === col) {
    kegiatanSortAsc = !kegiatanSortAsc;
  } else {
    kegiatanSortCol = col;
    kegiatanSortAsc = true;
  }

  // Update sort icons
  document.querySelectorAll('.kegiatan-table th.sortable').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (!icon) return;
    if (th.getAttribute('data-col') === col) {
      icon.className = `bi ${kegiatanSortAsc ? 'bi-arrow-up' : 'bi-arrow-down'} sort-icon sort-active`;
    } else {
      icon.className = 'bi bi-arrow-down-up sort-icon';
    }
  });

  applyKegiatanFilter();
}

/* =====================================================
   PAGINASI
   ===================================================== */
function renderKegiatanPagination() {
  const container = document.getElementById('kegiatan-pagination');
  if (!container) return;

  const totalPages = Math.ceil(kegiatanFiltered.length / KG_PAGE_SIZE);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const buttons = [];
  const rendered = new Set(); // mencegah ellipsis duplikat

  // Prev
  buttons.push(`
    <button class="kg-page-btn ${kegiatanCurrentPage === 1 ? 'disabled' : ''}"
      onclick="goKegiatanPage(${kegiatanCurrentPage - 1})"
      ${kegiatanCurrentPage === 1 ? 'disabled aria-disabled="true"' : ''}
      aria-label="Halaman sebelumnya">
      <i class="bi bi-chevron-left"></i>
    </button>`);

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - kegiatanCurrentPage) <= 1) {
      rendered.add(i);
      buttons.push(`
        <button class="kg-page-btn ${i === kegiatanCurrentPage ? 'active' : ''}"
          onclick="goKegiatanPage(${i})"
          aria-label="Halaman ${i}"
          ${i === kegiatanCurrentPage ? 'aria-current="page"' : ''}>
          ${i}
        </button>`);
    } else if (Math.abs(i - kegiatanCurrentPage) === 2 && !rendered.has(i)) {
      rendered.add(i);
      buttons.push(`<span class="kg-page-ellipsis">…</span>`);
    }
  }

  // Next
  buttons.push(`
    <button class="kg-page-btn ${kegiatanCurrentPage === totalPages ? 'disabled' : ''}"
      onclick="goKegiatanPage(${kegiatanCurrentPage + 1})"
      ${kegiatanCurrentPage === totalPages ? 'disabled aria-disabled="true"' : ''}
      aria-label="Halaman berikutnya">
      <i class="bi bi-chevron-right"></i>
    </button>`);

  container.innerHTML = buttons.join('');
}

function goKegiatanPage(page) {
  const totalPages = Math.ceil(kegiatanFiltered.length / KG_PAGE_SIZE);
  if (page < 1 || page > totalPages) return;
  kegiatanCurrentPage = page;
  renderKegiatanRows();
  renderKegiatanPagination();
  updateKegiatanCountInfo();
}

/* =====================================================
   APPS SCRIPT WRITE — POST ke spreadsheet
   ===================================================== */

/**
 * Kirim operasi write ke Apps Script.
 * action: 'create' | 'update' | 'delete'
 * payload: object data kegiatan
 */
async function kgPostToSheet(action, payload) {
  // Gunakan SECONDARY_URL jika tersedia (sheet kedua untuk kegiatan),
  // fallback ke SPREADSHEET_URL agar backward-compatible.
  const url = (window.CONFIG?.SECONDARY_URL) || window.CONFIG?.SPREADSHEET_URL;
  if (!url) throw new Error('SPREADSHEET_URL atau SECONDARY_URL belum dikonfigurasi.');

  const body = JSON.stringify({ action, sheet: 'Kegiatan', data: payload });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // Apps Script butuh text/plain untuk doPost
    body,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const result = await res.json();
  if (result.status === 'error') throw new Error(result.message || 'Gagal menyimpan data.');
  return result;
}

/**
 * Refresh data dari spreadsheet setelah operasi write berhasil.
 */
async function kgRefreshFromSheet() {
  if (typeof window.loadData === 'function') {
    await window.loadData();
  }
}
function openKegiatanModal(id = null) {
  kegiatanEditId = id;
  const modal   = document.getElementById('kegiatan-modal');
  const title   = document.getElementById('kg-modal-title');
  const icon    = modal?.querySelector('.kg-modal-icon-wrap i');
  const label   = document.getElementById('kg-submit-label');
  const form    = document.getElementById('kegiatan-form');

  if (!modal || !form) return;

  // Reset form
  form.reset();
  clearKegiatanErrors();
  document.getElementById('kg-form-id').value = '';
  kgResetDatepicker();
  kgResetTimepicker('mulai');
  kgResetTimepicker('selesai');

  if (id) {
    // Mode Edit — semua data bisa diedit (akan sync ke spreadsheet)
    const item = kegiatanData.find(k => k.id === id);
    if (!item) return;

    title.textContent = 'Edit Kegiatan';
    if (icon) icon.className = 'bi bi-pencil-fill';
    if (label) label.textContent = 'Simpan Perubahan';

    document.getElementById('kg-form-id').value      = item.id;
    document.getElementById('kg-nama').value          = item.nama;
    document.getElementById('kg-lokasi').value        = item.lokasi;
    document.getElementById('kg-status').value        = item.status;
    document.getElementById('kg-keterangan').value    = item.keterangan || '';
    // Custom pickers
    if (item.tanggal) kgSetDate(item.tanggal);
    if (item.jam)     kgSetTime('mulai', item.jam);
    if (item.jamSelesai) kgSetTime('selesai', item.jamSelesai);
  } else {
    // Mode Tambah
    title.textContent = 'Tambah Kegiatan';
    if (icon) icon.className = 'bi bi-calendar-plus-fill';
    if (label) label.textContent = 'Simpan Kegiatan';
  }

  // Show modal
  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('kg-modal-open'));
  document.getElementById('kg-nama')?.focus();
  document.body.style.overflow = 'hidden';
}

function closeKegiatanModal() {
  const modal = document.getElementById('kegiatan-modal');
  if (!modal) return;
  modal.classList.remove('kg-modal-open');
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }, 250);
  kegiatanEditId = null;
}

/* =====================================================
   FORM SUBMIT (Tambah / Update)
   ===================================================== */
function submitKegiatanForm(e) {
  e.preventDefault();

  if (!validateKegiatanForm()) return;

  const nama        = document.getElementById('kg-nama').value.trim();
  const tanggal     = document.getElementById('kg-tanggal').value;
  const jam         = document.getElementById('kg-jam').value;
  const jamSelesai  = document.getElementById('kg-jam-selesai').value;
  const lokasi      = document.getElementById('kg-lokasi').value.trim();
  const status      = document.getElementById('kg-status').value;
  const keterangan  = document.getElementById('kg-keterangan').value.trim();

  // Disable tombol submit selama proses
  const submitBtn = document.getElementById('kg-submit-btn');
  const origLabel = document.getElementById('kg-submit-label')?.textContent;
  if (submitBtn) {
    submitBtn.disabled = true;
    const lbl = document.getElementById('kg-submit-label');
    if (lbl) lbl.textContent = 'Menyimpan...';
  }

  const isEdit  = !!kegiatanEditId;
  const item    = isEdit ? kegiatanData.find(k => k.id === kegiatanEditId) : null;
  const payload = {
    id        : isEdit ? kegiatanEditId : null,
    rowIndex  : item?.rowIndex ?? null,  // rowIndex dari spreadsheet untuk update
    nama, tanggal, jam, jamSelesai, lokasi, status, keterangan,
  };

  kgPostToSheet(isEdit ? 'update' : 'create', payload)
    .then(() => {
      _kgToast('success',
        isEdit ? 'Berhasil Diubah' : 'Kegiatan Ditambahkan',
        isEdit
          ? `Kegiatan "${nama}" berhasil diperbarui.`
          : `Kegiatan "${nama}" berhasil ditambahkan.`
      );
      closeKegiatanModal();
      return kgRefreshFromSheet();
    })
    .catch(err => {
      console.error('[submitKegiatanForm]', err);
      _kgToast('error', 'Gagal Menyimpan', err.message || 'Terjadi kesalahan. Coba lagi.');
    })
    .finally(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
        const lbl = document.getElementById('kg-submit-label');
        if (lbl && origLabel) lbl.textContent = origLabel;
      }
    });
}

/* =====================================================
   VALIDASI FORM
   ===================================================== */
function validateKegiatanForm() {
  let valid = true;
  clearKegiatanErrors();

  const nama   = document.getElementById('kg-nama').value.trim();
  const tgl    = document.getElementById('kg-tanggal').value;
  const jam    = document.getElementById('kg-jam').value;
  const lokasi = document.getElementById('kg-lokasi').value.trim();
  const status = document.getElementById('kg-status').value;

  if (!nama) {
    setKgError('kg-nama-err', 'Nama kegiatan wajib diisi.');
    document.getElementById('kg-nama')?.classList.add('kg-input-error');
    valid = false;
  }
  if (!tgl) {
    setKgError('kg-tanggal-err', 'Tanggal wajib diisi.');
    document.getElementById('kg-tanggal')?.classList.add('kg-input-error');
    valid = false;
  }
  if (!jam) {
    setKgError('kg-jam-err', 'Jam mulai wajib diisi.');
    document.getElementById('kg-jam')?.classList.add('kg-input-error');
    valid = false;
  }
  if (!lokasi) {
    setKgError('kg-lokasi-err', 'Lokasi wajib diisi.');
    document.getElementById('kg-lokasi')?.classList.add('kg-input-error');
    valid = false;
  }
  if (!status) {
    setKgError('kg-status-err', 'Status wajib dipilih.');
    document.getElementById('kg-status')?.classList.add('kg-input-error');
    valid = false;
  }

  return valid;
}

function clearKegiatanErrors() {
  ['kg-nama-err', 'kg-tanggal-err', 'kg-jam-err', 'kg-jam-selesai-err', 'kg-lokasi-err', 'kg-status-err'].forEach(id => {
    setKgError(id, '');
  });
  // Reset trigger border errors for custom pickers
  ['kg-datepicker-trigger', 'kg-tp-mulai-trigger', 'kg-tp-selesai-trigger'].forEach(id => {
    document.getElementById(id)?.classList.remove('kg-input-error');
  });
  ['kg-nama', 'kg-lokasi', 'kg-status'].forEach(id => {
    document.getElementById(id)?.classList.remove('kg-input-error');
  });
}

function setKgError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

/* =====================================================
   MODAL DELETE
   ===================================================== */
function openDeleteModal(id) {
  kegiatanDeleteId = id;
  const item = kegiatanData.find(k => k.id === id);
  if (!item) return;

  const namaEl = document.getElementById('kg-delete-nama');
  if (namaEl) namaEl.textContent = item.nama;

  const modal = document.getElementById('kegiatan-delete-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('kg-modal-open'));
  document.body.style.overflow = 'hidden';

  document.getElementById('kg-confirm-delete-btn')?.focus();
}

function closeDeleteModal() {
  const modal = document.getElementById('kegiatan-delete-modal');
  if (!modal) return;
  modal.classList.remove('kg-modal-open');
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }, 250);
  kegiatanDeleteId = null;
}

function confirmDeleteKegiatan() {
  if (!kegiatanDeleteId) return;
  const item = kegiatanData.find(k => k.id === kegiatanDeleteId);
  if (!item) { closeDeleteModal(); return; }

  // Disable tombol konfirmasi selama proses
  const confirmBtn = document.getElementById('kg-confirm-delete-btn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Menghapus...';
  }

  kgPostToSheet('delete', { id: item.id, rowIndex: item.rowIndex ?? null })
    .then(() => {
      closeDeleteModal();
      _kgToast('info', 'Kegiatan Dihapus', `Kegiatan "${item.nama}" telah dihapus.`);
      return kgRefreshFromSheet();
    })
    .catch(err => {
      console.error('[confirmDeleteKegiatan]', err);
      _kgToast('error', 'Gagal Menghapus', err.message || 'Terjadi kesalahan. Coba lagi.');
    })
    .finally(() => {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Hapus';
      }
    });
}

/* =====================================================
   EXPORT CSV
   ===================================================== */
function exportKegiatanCSV() {
  if (!kegiatanFiltered.length) {
    _kgToast('info', 'Export CSV', 'Tidak ada data untuk diekspor.');
    return;
  }
  const header = ['No', 'Nama Kegiatan', 'Tanggal', 'Jam Mulai', 'Jam Selesai', 'Lokasi', 'Status'];
  const rows   = kegiatanFiltered.map((k, i) => [
    i + 1,
    k.nama,
    k.tanggal,
    k.jam,
    k.jamSelesai || '',
    k.lokasi,
    k.status,
  ]);
  const csv    = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob   = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = `daftar-kegiatan-pusbangkom-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  _kgToast('success', 'Export Berhasil', `${kegiatanFiltered.length} kegiatan berhasil diekspor.`);
}

/* =====================================================
   HELPER
   ===================================================== */
function generateKegiatanId() {
  const max = kegiatanData.reduce((acc, k) => {
    const num = parseInt((k.id || '').replace(/\D/g, '')) || 0;
    return Math.max(acc, num);
  }, 0);
  return 'KG' + String(max + 1).padStart(3, '0');
}

function kgFormatTanggal(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* =====================================================
   CUSTOM DATEPICKER
   ===================================================== */
const KG_MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const KG_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

let _kgCalViewYear, _kgCalViewMonth, _kgCalPanel = 'day'; // 'day' | 'month' | 'year'
let _kgDatepickerOpen = false;

function kgInitDatepicker() {
  const trigger = document.getElementById('kg-datepicker-trigger');
  const popup   = document.getElementById('kg-datepicker-popup');
  if (!trigger || !popup) return;

  const now = new Date();
  _kgCalViewYear  = now.getFullYear();
  _kgCalViewMonth = now.getMonth();

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    _kgDatepickerOpen ? kgCloseDatepicker() : kgOpenDatepicker();
  });

  document.getElementById('kg-cal-prev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_kgCalPanel === 'day') {
      _kgCalViewMonth--;
      if (_kgCalViewMonth < 0) { _kgCalViewMonth = 11; _kgCalViewYear--; }
    } else if (_kgCalPanel === 'year') {
      _kgCalViewYear -= 12;
    }
    kgRenderCal();
  });

  document.getElementById('kg-cal-next')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_kgCalPanel === 'day') {
      _kgCalViewMonth++;
      if (_kgCalViewMonth > 11) { _kgCalViewMonth = 0; _kgCalViewYear++; }
    } else if (_kgCalPanel === 'year') {
      _kgCalViewYear += 12;
    }
    kgRenderCal();
  });

  document.getElementById('kg-cal-month-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    _kgCalPanel = _kgCalPanel === 'month' ? 'day' : 'month';
    kgRenderCal();
  });

  document.getElementById('kg-cal-year-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    _kgCalPanel = _kgCalPanel === 'year' ? 'day' : 'year';
    kgRenderCal();
  });

  document.getElementById('kg-cal-today')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const t = new Date();
    kgSetDate(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`);
    kgCloseDatepicker();
  });

  document.getElementById('kg-cal-clear')?.addEventListener('click', (e) => {
    e.stopPropagation();
    kgResetDatepicker();
    kgCloseDatepicker();
  });

  popup.addEventListener('click', e => e.stopPropagation());
  kgRenderCal();
}

function kgOpenDatepicker() {
  const popup   = document.getElementById('kg-datepicker-popup');
  const trigger = document.getElementById('kg-datepicker-trigger');
  if (!popup) return;
  kgCloseAllPickers();
  popup.style.display = 'block';
  trigger?.classList.add('open');
  _kgDatepickerOpen = true;
}

function kgCloseDatepicker() {
  const popup   = document.getElementById('kg-datepicker-popup');
  const trigger = document.getElementById('kg-datepicker-trigger');
  if (!popup) return;
  popup.style.display = 'none';
  trigger?.classList.remove('open');
  _kgDatepickerOpen = false;
}

function kgSetDate(dateStr) {
  document.getElementById('kg-tanggal').value = dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  const display = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const el = document.getElementById('kg-datepicker-display');
  if (el) el.textContent = display;
  document.getElementById('kg-datepicker-trigger')?.classList.add('has-value');
  _kgCalViewYear  = d.getFullYear();
  _kgCalViewMonth = d.getMonth();
  kgRenderCal();
}

function kgResetDatepicker() {
  document.getElementById('kg-tanggal').value = '';
  const el = document.getElementById('kg-datepicker-display');
  if (el) el.textContent = 'Pilih tanggal';
  document.getElementById('kg-datepicker-trigger')?.classList.remove('has-value');
  const now = new Date();
  _kgCalViewYear  = now.getFullYear();
  _kgCalViewMonth = now.getMonth();
  _kgCalPanel = 'day';
  kgRenderCal();
}

function kgRenderCal() {
  const monthBtn = document.getElementById('kg-cal-month-btn');
  const yearBtn  = document.getElementById('kg-cal-year-btn');
  const dayPanel   = document.getElementById('kg-cal-day-panel');
  const monthPanel = document.getElementById('kg-cal-month-panel');
  const yearPanel  = document.getElementById('kg-cal-year-panel');
  if (!monthBtn) return;

  monthBtn.textContent = KG_MONTHS_ID[_kgCalViewMonth];
  yearBtn.textContent  = _kgCalViewYear;

  // Show correct panel
  dayPanel.style.display   = _kgCalPanel === 'day'   ? '' : 'none';
  monthPanel.style.display = _kgCalPanel === 'month' ? '' : 'none';
  yearPanel.style.display  = _kgCalPanel === 'year'  ? '' : 'none';

  if (_kgCalPanel === 'day')   kgRenderDays();
  if (_kgCalPanel === 'month') kgRenderMonths();
  if (_kgCalPanel === 'year')  kgRenderYears();
}

function kgRenderDays() {
  const container = document.getElementById('kg-cal-days');
  if (!container) return;
  const selVal = document.getElementById('kg-tanggal').value;
  const sel    = selVal ? new Date(selVal + 'T00:00:00') : null;
  const today  = new Date(); today.setHours(0,0,0,0);

  const firstDay = new Date(_kgCalViewYear, _kgCalViewMonth, 1).getDay();
  const daysInMonth = new Date(_kgCalViewYear, _kgCalViewMonth + 1, 0).getDate();
  const daysInPrev  = new Date(_kgCalViewYear, _kgCalViewMonth, 0).getDate();

  let html = '';
  // Prev month days
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<button type="button" class="kg-cal-day kg-cal-day-other">${daysInPrev - i}</button>`;
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const cur = new Date(_kgCalViewYear, _kgCalViewMonth, d);
    const isToday    = cur.getTime() === today.getTime();
    const isSelected = sel && cur.getTime() === sel.getTime();
    const dateStr    = `${_kgCalViewYear}-${String(_kgCalViewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    let cls = 'kg-cal-day';
    if (isToday)    cls += ' kg-cal-day-today';
    if (isSelected) cls += ' kg-cal-day-selected';
    html += `<button type="button" class="${cls}" data-date="${dateStr}">${d}</button>`;
  }
  // Next month days
  const total = firstDay + daysInMonth;
  const nextDays = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= nextDays; d++) {
    html += `<button type="button" class="kg-cal-day kg-cal-day-other">${d}</button>`;
  }

  container.innerHTML = html;
  container.querySelectorAll('[data-date]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      kgSetDate(btn.dataset.date);
      kgCloseDatepicker();
    });
  });
}

function kgRenderMonths() {
  const container = document.getElementById('kg-cal-month-panel');
  if (!container) return;
  const selVal = document.getElementById('kg-tanggal').value;
  const selMonth = selVal ? parseInt(selVal.split('-')[1]) - 1 : -1;
  const selYear  = selVal ? parseInt(selVal.split('-')[0]) : -1;

  container.innerHTML = KG_MONTHS_SHORT.map((m, i) => {
    const isActive = i === selMonth && _kgCalViewYear === selYear;
    return `<button type="button" class="kg-cal-month-item${isActive?' active':''}" data-month="${i}">${m}</button>`;
  }).join('');

  container.querySelectorAll('[data-month]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _kgCalViewMonth = parseInt(btn.dataset.month);
      _kgCalPanel = 'day';
      kgRenderCal();
    });
  });
}

function kgRenderYears() {
  const container = document.getElementById('kg-cal-year-panel');
  if (!container) return;
  const selVal  = document.getElementById('kg-tanggal').value;
  const selYear = selVal ? parseInt(selVal.split('-')[0]) : -1;
  const start   = _kgCalViewYear - 5;

  let html = '';
  for (let y = start; y < start + 12; y++) {
    const isActive = y === selYear;
    html += `<button type="button" class="kg-cal-year-item${isActive?' active':''}" data-year="${y}">${y}</button>`;
  }
  container.innerHTML = html;

  container.querySelectorAll('[data-year]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _kgCalViewYear = parseInt(btn.dataset.year);
      _kgCalPanel = 'month';
      kgRenderCal();
    });
  });
}

/* =====================================================
   CUSTOM TIMEPICKER
   ===================================================== */
const _kgTpState = { mulai: { h: null, m: null, open: false }, selesai: { h: null, m: null, open: false } };

function kgInitTimepicker(which) {
  const trigger = document.getElementById(`kg-tp-${which}-trigger`);
  const popup   = document.getElementById(`kg-tp-${which}-popup`);
  if (!trigger || !popup) return;

  // Build hours col (00-23)
  const hCol = document.getElementById(`kg-tp-${which}-h`);
  const mCol = document.getElementById(`kg-tp-${which}-m`);
  if (!hCol || !mCol) return;

  let hHtml = '', mHtml = '';
  for (let h = 0; h < 24; h++) {
    const v = String(h).padStart(2,'0');
    hHtml += `<button type="button" class="kg-tp-item" data-val="${v}">${v}</button>`;
  }
  for (let m = 0; m < 60; m += 5) {
    const v = String(m).padStart(2,'0');
    mHtml += `<button type="button" class="kg-tp-item" data-val="${v}">${v}</button>`;
  }
  hCol.innerHTML = hHtml;
  mCol.innerHTML = mHtml;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    _kgTpState[which].open ? kgCloseTimepicker(which) : kgOpenTimepicker(which);
  });

  hCol.querySelectorAll('.kg-tp-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _kgTpState[which].h = btn.dataset.val;
      kgTpUpdateDisplay(which);
      hCol.querySelectorAll('.kg-tp-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  mCol.querySelectorAll('.kg-tp-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _kgTpState[which].m = btn.dataset.val;
      kgTpUpdateDisplay(which);
      mCol.querySelectorAll('.kg-tp-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Auto-close if both h and m selected
      if (_kgTpState[which].h !== null) kgCloseTimepicker(which);
    });
  });

  popup.addEventListener('click', e => e.stopPropagation());
}

function kgOpenTimepicker(which) {
  const popup   = document.getElementById(`kg-tp-${which}-popup`);
  const trigger = document.getElementById(`kg-tp-${which}-trigger`);
  if (!popup) return;
  kgCloseAllPickers();
  popup.style.display = 'block';
  trigger?.classList.add('open');
  _kgTpState[which].open = true;
}

function kgCloseTimepicker(which) {
  const popup   = document.getElementById(`kg-tp-${which}-popup`);
  const trigger = document.getElementById(`kg-tp-${which}-trigger`);
  if (!popup) return;
  popup.style.display = 'none';
  trigger?.classList.remove('open');
  _kgTpState[which].open = false;
}

function kgCloseAllPickers() {
  kgCloseDatepicker();
  kgCloseTimepicker('mulai');
  kgCloseTimepicker('selesai');
}

function kgTpUpdateDisplay(which) {
  const h = _kgTpState[which].h ?? '--';
  const m = _kgTpState[which].m ?? '--';
  const val = (h !== '--' && m !== '--') ? `${h}:${m}` : `${h}:${m}`;
  const displayEl = document.getElementById(`kg-tp-${which}-display`);
  const hiddenEl  = document.getElementById(which === 'mulai' ? 'kg-jam' : 'kg-jam-selesai');
  if (displayEl) displayEl.textContent = val;
  if (hiddenEl && h !== '--' && m !== '--') hiddenEl.value = `${h}:${m}`;
}

function kgSetTime(which, timeStr) {
  if (!timeStr) return;
  const [h, m] = timeStr.split(':');
  const hRounded = h;
  // Round minutes to nearest 5
  const mRaw = parseInt(m, 10);
  const mRounded = String(Math.round(mRaw / 5) * 5 % 60).padStart(2,'0');
  _kgTpState[which].h = hRounded;
  _kgTpState[which].m = mRounded;
  kgTpUpdateDisplay(which);

  // Mark active in columns
  const hCol = document.getElementById(`kg-tp-${which}-h`);
  const mCol = document.getElementById(`kg-tp-${which}-m`);
  if (hCol) {
    hCol.querySelectorAll('.kg-tp-item').forEach(b => {
      b.classList.toggle('active', b.dataset.val === hRounded);
    });
  }
  if (mCol) {
    mCol.querySelectorAll('.kg-tp-item').forEach(b => {
      b.classList.toggle('active', b.dataset.val === mRounded);
    });
  }
}

function kgResetTimepicker(which) {
  _kgTpState[which].h = null;
  _kgTpState[which].m = null;
  const displayEl = document.getElementById(`kg-tp-${which}-display`);
  const hiddenEl  = document.getElementById(which === 'mulai' ? 'kg-jam' : 'kg-jam-selesai');
  if (displayEl) displayEl.textContent = '--:--';
  if (hiddenEl)  hiddenEl.value = '';
  const hCol = document.getElementById(`kg-tp-${which}-h`);
  const mCol = document.getElementById(`kg-tp-${which}-m`);
  hCol?.querySelectorAll('.kg-tp-item').forEach(b => b.classList.remove('active'));
  mCol?.querySelectorAll('.kg-tp-item').forEach(b => b.classList.remove('active'));
}

/* =====================================================
   INIT PICKERS ON DOMContentLoaded
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  kgInitDatepicker();
  kgInitTimepicker('mulai');
  kgInitTimepicker('selesai');

  // Close pickers when clicking outside
  document.addEventListener('click', () => {
    kgCloseDatepicker();
    kgCloseTimepicker('mulai');
    kgCloseTimepicker('selesai');
  });
});
