/**
 * chart.js — Chart Rendering Engine v2.0
 * Dashboard Monitoring Webinar & Pelatihan | Pusbangkom
 * =====================================================
 * Charts:
 *  1. Bar     — Peserta Webinar per webinar (Dashboard)
 *  2. Doughnut— Penonton YT vs Zoom total  (Dashboard)
 *  3. Bar     — Lulus vs Tidak Lulus Pelatihan (Dashboard)
 *  4. Line    — Tren Penonton YouTube       (Dashboard)
 *  5. Bar H   — Top Penonton YouTube        (Statistik)
 *  6. Bar H   — Top Peserta Zoom            (Statistik)
 * =====================================================
 */

const ChartInstances = {};

/* =====================================================
   1. GLOBAL DEFAULTS
   ===================================================== */
function initChartDefaults() {
  if (typeof Chart === 'undefined') return;

  Chart.defaults.font.family = "'Poppins', sans-serif";
  Chart.defaults.font.size   = 12;
  Chart.defaults.color       = getCSSVar('--text-secondary');

  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.padding       = 16;
  Chart.defaults.plugins.legend.labels.boxWidth      = 8;

  Chart.defaults.plugins.tooltip.backgroundColor = '#1F2937';
  Chart.defaults.plugins.tooltip.titleFont       = { size: 12, weight: '700' };
  Chart.defaults.plugins.tooltip.bodyFont        = { size: 11 };
  Chart.defaults.plugins.tooltip.padding         = 12;
  Chart.defaults.plugins.tooltip.cornerRadius    = 10;

  Chart.defaults.animation.duration = 800;
  Chart.defaults.animation.easing   = 'easeInOutQuart';
  Chart.defaults.scale.grid.color   = getCSSVar('--border-color');
  Chart.defaults.scale.ticks.color  = getCSSVar('--text-muted');
}

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '';
}

function destroyChart(key) {
  if (ChartInstances[key]) { ChartInstances[key].destroy(); ChartInstances[key] = null; }
}

function makeGradient(ctx, c1, c2) {
  const g = ctx.createLinearGradient(0, 0, 0, 280);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  return g;
}

/* =====================================================
   2. ENTRY POINT
   ===================================================== */
function renderCharts() {
  if (typeof Chart === 'undefined') return;
  initChartDefaults();
  renderBarPesertaWebinar();
  renderDoughnutViewers();
  renderBarPelatihan();
  renderLineTrendYT();
}

function updateChartTheme() {
  const textSecondary = getCSSVar('--text-secondary');
  const textMuted     = getCSSVar('--text-muted');
  const borderColor   = getCSSVar('--border-color');
  const textPrimary   = getCSSVar('--text-primary');

  // Update global defaults (berlaku untuk chart yang baru dibuat)
  Chart.defaults.color             = textSecondary;
  Chart.defaults.scale.grid.color  = borderColor;
  Chart.defaults.scale.ticks.color = textMuted;

  // Update setiap chart instance yang sudah ada secara eksplisit
  Object.values(ChartInstances).forEach(chart => {
    if (!chart) return;

    // Update legend label color
    if (chart.options.plugins?.legend?.labels) {
      chart.options.plugins.legend.labels.color = textSecondary;
    }

    // Update setiap scale (x, y, dll) yang ada di chart
    Object.keys(chart.options.scales || {}).forEach(scaleKey => {
      const scale = chart.options.scales[scaleKey];
      if (scale) {
        if (!scale.ticks) scale.ticks = {};
        scale.ticks.color = textMuted;
        if (!scale.grid) scale.grid = {};
        scale.grid.color = borderColor;
      }
    });

    chart.update();
  });
}

/* =====================================================
   3. CHART 1 — BAR: PESERTA WEBINAR
   ===================================================== */
function renderBarPesertaWebinar() {
  const canvas = document.getElementById('chart-bar-peserta');
  if (!canvas) return;
  destroyChart('barPeserta');

  const webinars = window.AppData.webinars;
  const ctx = canvas.getContext('2d');
  const labels = webinars.map(w => shortLabel(w.nama, 25));

  ChartInstances.barPeserta = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label:           'Peserta (YT)',
          data:            webinars.map(w => w.jumlahPeserta),
          backgroundColor: '#03A0EE',
          borderRadius:    6,
          borderSkipped:   false,
        },
        {
          label:           'Penerima Sertifikat',
          data:            webinars.map(w => w.jumlahPenerimaSertifikat),
          backgroundColor: '#22C55E',
          borderRadius:    6,
          borderSkipped:   false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('id-ID')}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 40, font: { size: 10 } } },
        y: { beginAtZero: true },
      },
      interaction: { mode: 'index', intersect: false },
    },
  });
}

/* =====================================================
   4. CHART 2 — DOUGHNUT: PENONTON YT vs ZOOM
   ===================================================== */
function renderDoughnutViewers() {
  const canvas = document.getElementById('chart-doughnut-viewer');
  if (!canvas) return;
  destroyChart('doughnutViewer');

  const s   = window.AppData.stats;
  const ctx = canvas.getContext('2d');

  const totalYT   = s.totalYT || 0;
  const totalZoom = s.totalZoom || 0;

  // Center text plugin
  const centerPlugin = {
    id: 'viewerCenter',
    beforeDraw(chart) {
      const { width, height, ctx: c } = chart;
      c.restore();
      const total = totalYT + totalZoom;
      c.font = `700 18px Poppins, sans-serif`;
      c.fillStyle = getCSSVar('--text-primary');
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(total.toLocaleString('id-ID'), width/2, height/2 - 8);
      c.font = `500 10px Poppins, sans-serif`;
      c.fillStyle = getCSSVar('--text-muted');
      c.fillText('Total Penonton', width/2, height/2 + 12);
      c.save();
    },
  };

  ChartInstances.doughnutViewer = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Penonton YouTube', 'Peserta Zoom'],
      datasets: [{
        data: [totalYT, totalZoom],
        backgroundColor: ['#EF4444', '#2D8CFF'],
        borderColor: 'transparent',
        borderWidth: 0,
        hoverOffset: 8,
        cutout: '68%',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed.toLocaleString('id-ID')}`,
          },
        },
      },
    },
    plugins: [centerPlugin],
  });
}

/* =====================================================
   5. CHART 3 — BAR: LULUS vs TIDAK LULUS PELATIHAN
   ===================================================== */
function renderBarPelatihan() {
  const canvas = document.getElementById('chart-bar-pelatihan');
  if (!canvas) return;
  destroyChart('barPelatihan');

  const data = window.AppData.pelatihan;
  const ctx  = canvas.getContext('2d');
  const labels = data.map(p => shortLabel(p.nama, 22));

  ChartInstances.barPelatihan = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label:           'Lulus',
          data:            data.map(p => p.lulus),
          backgroundColor: '#22C55E',
          borderRadius:    6,
          borderSkipped:   false,
        },
        {
          label:           'Tidak Lulus',
          data:            data.map(p => p.tidakLulus),
          backgroundColor: '#EF4444',
          borderRadius:    6,
          borderSkipped:   false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('id-ID')} peserta`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 40, font: { size: 10 } } },
        y: { beginAtZero: true },
      },
      interaction: { mode: 'index', intersect: false },
    },
  });
}

/* =====================================================
   6. CHART 4 — LINE: TREN PENONTON YOUTUBE
   ===================================================== */
function renderLineTrendYT() {
  const canvas = document.getElementById('chart-line-yt');
  if (!canvas) return;
  destroyChart('lineYT');

  const webinars = [...window.AppData.webinars].filter(w => w.jumlahMenontonYT > 0);
  const ctx      = canvas.getContext('2d');
  const grad     = makeGradient(ctx, 'rgba(239,68,68,0.4)', 'rgba(239,68,68,0.02)');
  const grad2    = makeGradient(ctx, 'rgba(45,140,255,0.35)', 'rgba(45,140,255,0.02)');

  ChartInstances.lineYT = new Chart(ctx, {
    type: 'line',
    data: {
      labels: webinars.map(w => shortLabel(w.nama, 20)),
      datasets: [
        {
          label:           'Penonton YouTube',
          data:            webinars.map(w => w.jumlahMenontonYT),
          borderColor:     '#EF4444',
          backgroundColor: grad,
          borderWidth:     2.5,
          pointRadius:     5,
          pointHoverRadius:8,
          pointBackgroundColor: '#EF4444',
          tension:         0.4,
          fill:            true,
        },
        {
          label:           'Peserta Zoom',
          data:            webinars.map(w => w.jumlahMenontonZoom),
          borderColor:     '#2D8CFF',
          backgroundColor: grad2,
          borderWidth:     2.5,
          pointRadius:     5,
          pointHoverRadius:8,
          pointBackgroundColor: '#2D8CFF',
          tension:         0.4,
          fill:            true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 35, font: { size: 10 } } },
        y: { beginAtZero: true },
      },
    },
  });
}

/* =====================================================
   7. CHART 5 — BAR H: TOP YOUTUBE (Statistik)
   ===================================================== */
function renderTopYTChart() {
  const canvas = document.getElementById('chart-top-yt');
  if (!canvas) return;
  destroyChart('topYT');

  const top  = (window.AppData.stats.topByYT || []).slice(0, 10);
  const ctx  = canvas.getContext('2d');

  ChartInstances.topYT = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(w => shortLabel(w.nama, 30)),
      datasets: [{
        label: 'Penonton YouTube',
        data:  top.map(w => w.jumlahMenontonYT),
        backgroundColor: top.map((_, i) =>
          i === 0 ? '#DC2626' : i === 1 ? '#EF4444' : i === 2 ? '#F87171' : '#FCA5A5'
        ),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.x.toLocaleString('id-ID')} penonton`,
          },
        },
      },
      scales: {
        x: { beginAtZero: true },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
    },
  });
}

/* =====================================================
   8. CHART 6 — BAR H: TOP ZOOM (Statistik)
   ===================================================== */
function renderTopZoomChart() {
  const canvas = document.getElementById('chart-top-zoom');
  if (!canvas) return;
  destroyChart('topZoom');

  const top = (window.AppData.stats.topByZoom || []).slice(0, 10);
  const ctx  = canvas.getContext('2d');

  ChartInstances.topZoom = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(w => shortLabel(w.nama, 30)),
      datasets: [{
        label: 'Peserta Zoom',
        data:  top.map(w => w.jumlahMenontonZoom),
        backgroundColor: top.map((_, i) =>
          i === 0 ? '#1D4ED8' : i === 1 ? '#2563EB' : i === 2 ? '#3B82F6' : '#93C5FD'
        ),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.x.toLocaleString('id-ID')} peserta`,
          },
        },
      },
      scales: {
        x: { beginAtZero: true },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
    },
  });
}

/* =====================================================
   9. UTILITY
   ===================================================== */
function shortLabel(str, maxLen = 25) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
}

/* =====================================================
   10. EXPORTS
   ===================================================== */
window.renderCharts     = renderCharts;
window.updateChartTheme = updateChartTheme;
window.renderTopYTChart   = renderTopYTChart;
window.renderTopZoomChart = renderTopZoomChart;
