'use strict';

/* ───── CHART INSTANCES ─────────────────────────────────────────────────── */
const chartInstances = { pm25: null, pm10: null, temp: null, hum: null };

function destroyAllCharts() {
    Object.keys(chartInstances).forEach(k => {
        if (chartInstances[k]) { chartInstances[k].destroy(); chartInstances[k] = null; }
    });
}

/* ───── GIOŚ COLOR HELPERS ─────────────────────────────────────────────── */
function pm25Color(v) { return getLevel(v ?? 0, PM25_LEVELS).color; }
function pm10Color(v) { return getLevel(v ?? 0, PM10_LEVELS).color; }

/* ───── NORM REFERENCE LINE PLUGIN ──────────────────────────────────────── */
function makeNormPlugin(value, label, color) {
    return {
        id: 'normLine',
        afterDraw(chart) {
            const { ctx, chartArea: { left, right }, scales: { y } } = chart;
            if (y.max < value) return;
            const yPos = y.getPixelForValue(value);
            ctx.save();
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(left, yPos); ctx.lineTo(right, yPos); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = color;
            ctx.font = 'bold 10px Segoe UI, system-ui';
            ctx.fillText(label, left + 4, yPos - 3);
            ctx.restore();
        },
    };
}

/* ───── SHARED CHART FACTORY ────────────────────────────────────────────── */
function makeChart(canvasId, readings, dataKey, label, color, bgColor, yOpts = {}, plugins = []) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) { console.error(`[chart.js] canvas #${canvasId} not found`); return null; }
    const nPts   = readings.length < 48 ? 4 : 2;
    const labels = readings.map(r => formatTimestamp(r.timestamp));
    const data   = readings.map(r => r[dataKey]);

    const yScale = {
        title: { display: true, text: yOpts.title ?? '', font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,.06)' },
    };
    if (yOpts.beginAtZero)     yScale.beginAtZero     = true;
    if (yOpts.afterDataLimits) yScale.afterDataLimits = yOpts.afterDataLimits;

    return new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label, data,
                borderColor: color, backgroundColor: bgColor,
                borderWidth: 2.5,
                pointRadius: nPts, pointHoverRadius: 6,
                tension: 0.35, fill: true, spanGaps: true,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { font: { family: 'Segoe UI, system-ui', size: 12 } } },
                tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1) ?? '—'}` } },
            },
            scales: {
                x: { ticks: { maxTicksLimit: 12, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,.06)' } },
                y: yScale,
            },
        },
        plugins,
    });
}

/* ───── PM2.5 GIOŚ-COLOURED CHART ──────────────────────────────────────── */
function buildPm25Chart(readings) {
    const canvas = document.getElementById('pm25Chart');
    if (!canvas) { console.error('[chart.js] canvas #pm25Chart not found'); return null; }

    const nPts     = readings.length < 48 ? 4 : 2;
    const labels   = readings.map(r => formatTimestamp(r.timestamp));
    const data     = readings.map(r => r.pm25);
    const ptColors = data.map(v => v !== null ? pm25Color(v) : 'rgba(0,0,0,.15)');

    return new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'PM2.5 (µg/m³)',
                data,
                segment: {
                    borderColor: ctx => {
                        const y0 = ctx.p0.parsed.y, y1 = ctx.p1.parsed.y;
                        return pm25Color((y0 + y1) / 2);
                    },
                },
                backgroundColor: 'rgba(0,0,0,.04)',
                pointBackgroundColor: ptColors,
                pointBorderColor:     ptColors,
                borderWidth: 2.5,
                pointRadius: nPts, pointHoverRadius: 6,
                tension: 0.35, fill: true, spanGaps: true,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { font: { family: 'Segoe UI, system-ui', size: 12 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => ` PM2.5: ${ctx.parsed.y?.toFixed(1) ?? '—'} µg/m³ — ${getLevel(ctx.parsed.y, PM25_LEVELS).label}`,
                        labelColor: ctx => {
                            const c = pm25Color(ctx.parsed.y);
                            return { backgroundColor: c, borderColor: c };
                        },
                    },
                },
            },
            scales: {
                x: { ticks: { maxTicksLimit: 12, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,.06)' } },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'µg/m³', font: { size: 11 } },
                    grid: { color: 'rgba(0,0,0,.06)' },
                    afterDataLimits: ax => { ax.max = Math.max(ax.max, 30); },
                },
            },
        },
        plugins: [makeNormPlugin(25, 'Norma PL GUS (25)', 'rgba(80,80,80,.65)')],
    });
}

/* ───── PM10 GIOŚ-COLOURED CHART ───────────────────────────────────────── */
function buildPm10Chart(readings) {
    const canvas = document.getElementById('pm10Chart');
    if (!canvas) { console.error('[chart.js] canvas #pm10Chart not found'); return null; }

    const nPts     = readings.length < 48 ? 4 : 2;
    const labels   = readings.map(r => formatTimestamp(r.timestamp));
    const data     = readings.map(r => r.pm10);
    const ptColors = data.map(v => v !== null ? pm10Color(v) : 'rgba(0,0,0,.15)');

    return new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'PM10 (µg/m³)',
                data,
                segment: {
                    borderColor: ctx => {
                        const y0 = ctx.p0.parsed.y, y1 = ctx.p1.parsed.y;
                        return pm10Color((y0 + y1) / 2);
                    },
                },
                backgroundColor: 'rgba(0,0,0,.04)',
                pointBackgroundColor: ptColors,
                pointBorderColor:     ptColors,
                borderWidth: 2.5,
                pointRadius: nPts, pointHoverRadius: 6,
                tension: 0.35, fill: true, spanGaps: true,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { font: { family: 'Segoe UI, system-ui', size: 12 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => ` PM10: ${ctx.parsed.y?.toFixed(1) ?? '—'} µg/m³ — ${getLevel(ctx.parsed.y, PM10_LEVELS).label}`,
                        labelColor: ctx => {
                            const c = pm10Color(ctx.parsed.y);
                            return { backgroundColor: c, borderColor: c };
                        },
                    },
                },
            },
            scales: {
                x: { ticks: { maxTicksLimit: 12, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,.06)' } },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'µg/m³', font: { size: 11 } },
                    grid: { color: 'rgba(0,0,0,.06)' },
                    afterDataLimits: ax => { ax.max = Math.max(ax.max, 60); },
                },
            },
        },
        plugins: [makeNormPlugin(50, 'Norma PL GUS (50)', 'rgba(80,80,80,.65)')],
    });
}

/* ───── PUBLIC API ──────────────────────────────────────────────────────── */
function buildCharts(readings) {
    destroyAllCharts();

    chartInstances.pm25 = buildPm25Chart(readings);
    chartInstances.pm10 = buildPm10Chart(readings);

    chartInstances.temp = makeChart(
        'tempChart', readings, 'temp', 'Temperatura (°C)',
        '#10b981', 'rgba(16,185,129,.08)',
        { title: '°C' },
    );

    chartInstances.hum = makeChart(
        'humChart', readings, 'hum', 'Wilgotność (%)',
        '#8b5cf6', 'rgba(139,92,246,.08)',
        { title: '%', beginAtZero: true, afterDataLimits: ax => { ax.max = Math.min(Math.max(ax.max, 80), 100); } },
    );
}

