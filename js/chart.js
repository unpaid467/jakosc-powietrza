'use strict';

/* ───── CHART INSTANCES ─────────────────────────────────────────────────── */
const chartInstances = { pm25: null, pm10: null, temp: null, hum: null };

function destroyAllCharts() {
    Object.keys(chartInstances).forEach(k => {
        if (chartInstances[k]) { chartInstances[k].destroy(); chartInstances[k] = null; }
    });
}

/* ───── WHO REFERENCE LINE PLUGIN ──────────────────────────────────────── */
function makeWhoPlugin(value, label, color) {
    return {
        id: 'whoLine',
        afterDraw(chart) {
            const { ctx, chartArea: { left, right }, scales: { y } } = chart;
            if (y.max < value) return;
            const yPos = y.getPixelForValue(value);
            ctx.save();
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(left, yPos); ctx.lineTo(right, yPos); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = color;
            ctx.font = '10px Segoe UI, system-ui';
            ctx.fillText(label, left + 4, yPos - 3);
            ctx.restore();
        },
    };
}

/* ───── SHARED CHART FACTORY ────────────────────────────────────────────── */
function makeChart(canvasId, readings, dataKey, label, color, bgColor, yOpts = {}, whoPlugin = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) { console.error(`[chart.js] canvas #${canvasId} not found`); return null; }
    const nPts   = readings.length < 48 ? 4 : 2;
    const labels = readings.map(r => formatTimestamp(r.timestamp));
    const data   = readings.map(r => r[dataKey]);

    const yScale = {
        title: { display: true, text: yOpts.title ?? '', font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,.06)' },
    };
    if (yOpts.beginAtZero)      yScale.beginAtZero      = true;
    if (yOpts.afterDataLimits)  yScale.afterDataLimits  = yOpts.afterDataLimits;

    return new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label,
                data,
                borderColor: color,
                backgroundColor: bgColor,
                borderWidth: 2.5,
                pointRadius: nPts, pointHoverRadius: 6,
                tension: 0.35, fill: true, spanGaps: true,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { font: { family: 'Segoe UI, system-ui', size: 12 } } },
                tooltip: {
                    callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1) ?? '—'}` },
                },
            },
            scales: {
                x: { ticks: { maxTicksLimit: 12, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,.06)' } },
                y: yScale,
            },
        },
        plugins: whoPlugin ? [whoPlugin] : [],
    });
}

/* ───── PUBLIC API ──────────────────────────────────────────────────────── */
function buildCharts(readings) {
    destroyAllCharts();

    chartInstances.pm25 = makeChart(
        'pm25Chart', readings, 'pm25', 'PM2.5 (µg/m³)',
        '#2563eb', 'rgba(37,99,235,.08)',
        { title: 'µg/m³', beginAtZero: true, afterDataLimits: ax => { ax.max = Math.max(ax.max, 30); } },
        makeWhoPlugin(15, 'WHO (15)', 'rgba(37,99,235,.55)'),
    );

    chartInstances.pm10 = makeChart(
        'pm10Chart', readings, 'pm10', 'PM10 (µg/m³)',
        '#f97316', 'rgba(249,115,22,.06)',
        { title: 'µg/m³', beginAtZero: true, afterDataLimits: ax => { ax.max = Math.max(ax.max, 60); } },
        makeWhoPlugin(45, 'WHO (45)', 'rgba(249,115,22,.55)'),
    );

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
