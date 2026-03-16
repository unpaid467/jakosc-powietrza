'use strict';

/* ───── CHART INSTANCES ─────────────────────────────────────────────────── */
const chartInstances = { pm25: null, pm10: null, temp: null, hum: null, pressure: null, todPm25: null, todPm10: null, todTemp: null, todHum: null, todPressure: null, combined: null };

function destroyLineCharts() {
    ['pm25', 'pm10', 'temp', 'hum', 'pressure'].forEach(k => {
        if (chartInstances[k]) { chartInstances[k].destroy(); chartInstances[k] = null; }
    });
}
function destroyTodCharts() {
    ['todPm25', 'todPm10', 'todTemp', 'todHum', 'todPressure'].forEach(k => {
        if (chartInstances[k]) { chartInstances[k].destroy(); chartInstances[k] = null; }
    });
}
function destroyAllCharts() {
    destroyLineCharts();
    destroyTodCharts();
    if (chartInstances.combined) { chartInstances.combined.destroy(); chartInstances.combined = null; }
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

/* ───── TIME-OF-DAY AVERAGES ────────────────────────────────────────────────── */
function computeTimeOfDay(readings) {
    const slots = [
        { pm25: [], pm10: [], temp: [], hum: [], pressure: [] },  // Noc 0–6
        { pm25: [], pm10: [], temp: [], hum: [], pressure: [] },  // Rano 6–12
        { pm25: [], pm10: [], temp: [], hum: [], pressure: [] },  // Południe 12–18
        { pm25: [], pm10: [], temp: [], hum: [], pressure: [] },  // Wieczór 18–24
    ];
    for (const r of readings) {
        const ts = r.timestamp.replace ? r.timestamp.replace(' ', 'T') : r.timestamp;
        const h  = new Date(ts).getHours();
        const si = h < 6 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3;
        const s  = slots[si];
        if (r.pm25     !== null) s.pm25.push(r.pm25);
        if (r.pm10     !== null) s.pm10.push(r.pm10);
        if (r.temp     !== null) s.temp.push(r.temp);
        if (r.hum      !== null) s.hum.push(r.hum);
        if (r.pressure !== null) s.pressure.push(r.pressure / 100);  // Pa → hPa
    }
    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    return slots.map(s => ({ pm25: avg(s.pm25), pm10: avg(s.pm10), temp: avg(s.temp), hum: avg(s.hum), pressure: avg(s.pressure) }));
}

function makeBarChart(canvasId, values, colorFn, yTitle, normPlugin) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) { console.error(`[chart.js] canvas #${canvasId} not found`); return null; }

    const labels = [['\ud83c\udf19 Noc', '0–6'], ['\ud83c\udf05 Rano', '6–12'], ['\u2600\ufe0f Południe', '12–18'], ['\ud83c\udfd9\ufe0f Wieczór', '18–24']];
    const data   = values.map(v => v !== null ? +v.toFixed(2) : null);
    const colors = values.map(v => v !== null ? colorFn(v) : 'rgba(0,0,0,.12)');

    return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderColor:     colors,
                borderWidth: 1.5,
                borderRadius: 8,
                borderSkipped: false,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.parsed.y !== null
                            ? ` Średnio: ${ctx.parsed.y.toFixed(1)} ${yTitle}`
                            : ' Brak danych',
                    },
                },
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 12 } } },
                y: {
                    beginAtZero: yTitle !== '°C',
                    title: { display: true, text: yTitle, font: { size: 11 } },
                    grid: { color: 'rgba(0,0,0,.06)' },
                },
            },
        },
        plugins: normPlugin ? [normPlugin] : [],
    });
}

function buildTimeOfDayCharts(readings) {
    destroyTodCharts();
    const tod  = computeTimeOfDay(readings);
    const vals = key => tod.map(s => s[key]);

    chartInstances.todPm25     = makeBarChart('todPm25Chart',     vals('pm25'),     pm25Color,        'µg/m³', makeNormPlugin(25, 'Norma PL GUS (25)', 'rgba(80,80,80,.65)'));
    chartInstances.todPm10     = makeBarChart('todPm10Chart',     vals('pm10'),     pm10Color,        'µg/m³', makeNormPlugin(50, 'Norma PL GUS (50)', 'rgba(80,80,80,.65)'));
    chartInstances.todTemp     = makeBarChart('todTempChart',     vals('temp'),     () => '#10b981',  '°C');
    chartInstances.todHum      = makeBarChart('todHumChart',      vals('hum'),      () => '#8b5cf6',  '%');
    chartInstances.todPressure = makeBarChart('todPressureChart', vals('pressure'), () => '#0891b2',  'hPa');
}

/* ───── COMBINED OVERVIEW CHART ────────────────────────────────────────────── */
function buildCombinedChart(readings) {
    if (chartInstances.combined) { chartInstances.combined.destroy(); chartInstances.combined = null; }
    const canvas = document.getElementById('combinedChart');
    if (!canvas) { console.error('[chart.js] canvas #combinedChart not found'); return null; }

    const nPts   = readings.length < 48 ? 4 : 2;
    const labels = readings.map(r => formatTimestamp(r.timestamp));

    const datasets = [
        {
            label: 'PM2.5 (µg/m³)',
            data:  readings.map(r => r.pm25),
            borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.07)',
            borderWidth: 2.5, pointRadius: nPts, pointHoverRadius: 6,
            tension: 0.35, fill: false, spanGaps: true,
        },
        {
            label: 'PM10 (µg/m³)',
            data:  readings.map(r => r.pm10),
            borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,.07)',
            borderWidth: 2.5, pointRadius: nPts, pointHoverRadius: 6,
            tension: 0.35, fill: false, spanGaps: true,
        },
        {
            label: 'Temperatura (°C)',
            data:  readings.map(r => r.temp),
            borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.07)',
            borderWidth: 2.5, pointRadius: nPts, pointHoverRadius: 6,
            tension: 0.35, fill: false, spanGaps: true,
            borderDash: [6, 3],
        },
        {
            label: 'Wilgotność (%)',
            data:  readings.map(r => r.hum),
            borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,.07)',
            borderWidth: 2.5, pointRadius: nPts, pointHoverRadius: 6,
            tension: 0.35, fill: false, spanGaps: true,
            borderDash: [2, 3],
        },
    ];

    chartInstances.combined = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { family: 'Segoe UI, system-ui', size: 13 },
                        padding: 20, usePointStyle: true, pointStyleWidth: 28,
                        generateLabels: chart => chart.data.datasets.map((ds, i) => ({
                            text: ds.label,
                            fillStyle: ds.borderColor,
                            strokeStyle: ds.borderColor,
                            lineWidth: 2.5,
                            pointStyle: 'line',
                            hidden: !chart.isDatasetVisible(i),
                            datasetIndex: i,
                        })),
                    },
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const v = ctx.parsed.y;
                            return v !== null ? ` ${ctx.dataset.label}: ${v.toFixed(1)}` : ` ${ctx.dataset.label}: —`;
                        },
                    },
                },
            },
            scales: {
                x: { ticks: { maxTicksLimit: 12, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,.06)' } },
                y: {
                    suggestedMin: 0, suggestedMax: 60,
                    title: { display: true, text: 'µg/m³  |  °C  |  %', font: { size: 11 } },
                    grid: { color: 'rgba(0,0,0,.06)' },
                    ticks: { font: { size: 11 } },
                },
            },
        },
        plugins: [
            makeNormPlugin(25, 'Norma PM2.5 (25)', 'rgba(37,99,235,.45)'),
            makeNormPlugin(50, 'Norma PM10 (50)',  'rgba(249,115,22,.45)'),
        ],
    });
    return chartInstances.combined;
}

/* ───── PUBLIC API ──────────────────────────────────────────────────────── */
function buildCharts(readings) {
    destroyLineCharts();

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

    // Pressure: convert Pa → hPa for display
    const pressureReadings = readings.map(r => ({
        ...r,
        pressure: r.pressure !== null ? r.pressure / 100 : null,
    }));
    chartInstances.pressure = makeChart(
        'pressureChart', pressureReadings, 'pressure', 'Ciśnienie (hPa)',
        '#0891b2', 'rgba(8,145,178,.08)',
        { title: 'hPa', afterDataLimits: ax => { ax.min = ax.min - 2; ax.max = ax.max + 2; } },
    );
}

