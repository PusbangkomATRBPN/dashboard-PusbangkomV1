# Dashboard Data Monitoring Pusbangkom - BPSDMPusbangkom

[![Firebase Hosting](https://img.shields.io/badge/Hosting-Firebase-orange)](https://firebase.google.com/)
[![HTML5](https://img.shields.io/badge/HTML-5-red)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS-3-blue)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

Dashboard monitoring webinar modern untuk **Pusat Pengembangan Kompetensi**. Dibangun dengan HTML5, CSS3, dan Vanilla JavaScript ES6+, dengan koneksi data menggunakan spredsheet app script.

---

## ✨ Fitur

| Fitur | Keterangan |
|---|---|
| 📊 Stat Cards | 6 kartu statistik dengan animasi counter |
| 📈 4 Charts | Bar, Pie, Line, Doughnut (Chart.js 4.x) |
| 🗂️ DataTable | Tabel peserta dengan search, sort, pagination |
| 🌙 Dark Mode | Toggle dark/light mode, tersimpan di localStorage |
| 📱 Responsive | Desktop, tablet, mobile + offcanvas sidebar |
| ⏰ Realtime Clock | Jam & tanggal update setiap detik |
| 🔄 Auto-Refresh | Data diperbarui otomatis setiap 30 detik |
| 📦 Export | CSV, JSON, Print |
| ♿ Accessibility | WCAG AA+, aria-label, keyboard navigation |
| 🔍 SEO | Title, OG, Twitter Card, JSON-LD, sitemap |

---

## 🗂️ Struktur Folder

```
monitorPusbangkom/
│
├── index.html              ← Entry point SPA
│
├── css/
│   ├── style.css           ← Design system utama
│   └── responsive.css      ← Media queries
│
├── js/
│   ├── app.js              ← Init, navigasi, dark mode, clock
│   ├── chart.js            ← 4 chart rendering (Chart.js)
│   └── spreadsheet.js      ← Data engine & auto-refresh
│
├── assets/
│   ├── img/                ← Gambar & logo
│   └── icon/               ← Favicon & PWA icons
│
├── data/
│   └── dummy.json          ← 100 peserta, 10 webinar, 5 narasumber
│
├── manifest.json           ← PWA manifest
├── robots.txt
├── sitemap.xml
└── README.md
```

---

## 🚀 Menjalankan Secara Lokal

### Dengan Laragon / XAMPP / WAMP
Taruh folder project di:
- Laragon: `C:\laragon\www\monitorPusbangkom\`
- Lalu akses: `http://monitorPusbangkom.test/`

### Dengan Python
```bash
cd monitorPusbangkom
python -m http.server 8080
# Akses: http://localhost:8080
```

### Dengan Node.js (http-server)
```bash
npx http-server . -p 8080 -o
```

> ⚠️ **Jangan buka langsung via `file://`** karena `fetch()` ke `dummy.json` membutuhkan server HTTP.

---

## 🔗 Integrasi Google Spreadsheet

### Langkah 1 — Buat Apps Script
Di Google Spreadsheet Anda, buka **Extensions → Apps Script** dan buat fungsi:

```javascript
function doGet(e) {
  const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');

  // Ambil data dari sheet
  const sheetWebinar  = ss.getSheetByName('Webinar');
  const sheetPeserta  = ss.getSheetByName('Peserta');

  const data = {
    webinars:  getSheetData(sheetWebinar),
    peserta:   getSheetData(sheetPeserta),
    // tambahkan narasumber, instansi, dst.
  };

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(sheet) {
  const [headers, ...rows] = sheet.getDataRange().getValues();
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}
```

### Langkah 2 — Deploy sebagai Web App
- Deploy → **Web App**
- Execute as: **Me**
- Who has access: **Anyone**
- Salin URL hasil deploy

### Langkah 3 — Konfigurasi Dashboard
Buka halaman **Laporan** di dashboard, tempel URL di kolom "Konfigurasi Google Spreadsheet", klik **Hubungkan**.

Atau edit langsung di `js/spreadsheet.js`:

```javascript
const CONFIG = {
  USE_DUMMY: false,                              // ← Ganti ke false
  SPREADSHEET_URL: 'https://script.google.com/macros/s/YOUR_ID/exec',  // ← Isi URL
  REFRESH_INTERVAL: 30000,                       // ← 30 detik
};
```

---

## 🔥 Deploy ke Firebase Hosting

### Prasyarat
```bash
npm install -g firebase-tools
firebase login
```

### Deploy
```bash
cd monitorPusbangkom
firebase init hosting
# Public directory: . (titik)
# Single-page app: No
# Overwrite index.html: No

firebase deploy
```

---

## 🎨 Design System

| Token | Nilai |
|---|---|
| Primary | `#F0C332` (Kuning) |
| Secondary | `#03A0EE` (Biru) |
| Success | `#22C55E` (Hijau) |
| Danger | `#EF4444` (Merah) |
| Font | Poppins (Google Fonts) |
| Radius | 16px |
| Tema | Glassmorphism + Flat Design |

---

## 📦 Dependencies (CDN)

| Library | Versi |
|---|---|
| Bootstrap 5 | 5.3.3 |
| Bootstrap Icons | 1.11.3 |
| Chart.js | 4.4.2 |
| DataTables | 1.13.8 |
| jQuery | 3.7.1 |
| Google Fonts Poppins | — |

---

## 🤝 Kontribusi

1. Fork repository
2. Buat branch baru: `git checkout -b fitur-baru`
3. Commit perubahan: `git commit -m 'Tambah fitur baru'`
4. Push branch: `git push origin fitur-baru`
5. Buat Pull Request

---

## 📄 Lisensi

Internal Pusbangkom — Seluruh hak cipta dilindungi.

## 👤 Pengembang
**Create** By [@IrsyadHaniff](https://github.com/IrsyadHaniff) **©**2026