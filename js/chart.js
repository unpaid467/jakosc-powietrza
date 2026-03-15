'use strict';

let chartInstance = null;

function buildChart(readings) {
    const labels = readings.map(r => formatTimestamp(r.timestamp));
    const pm25   = readings.map(r => r.pm25);
    const pm10   = readings.map(r => r.pm10);
    const nPts   = readings.length < 48 ? 4 : 2;

    const ctx = document.getElementById('mainChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'PM2.5 (µg/m³)',
                    data: pm25,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37,99,235,.08)',
                    borderWidth: 2.5,
                    pointRadius: nPts, pointHoverRadius: 6,
                    tension: 0.35, fill: true, spanGaps: true,
                },
                {
                    label: 'PM10 (µg/m³)',
                    data: pm10,
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249,115,22,.06)',
                    borderWidth: 2.5,
                    pointRadius: nPts, pointHoverRadius: 6,
                    tension: 0.35, fill: true, spanGaps: true,
                },
            ],
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
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'µg/m³', font: { size: 11 } },
                    grid: { color: 'rgba(0,0,0,.06)' },
                    afterDataLimits(axis) { axis.max = Math.max(axis.max, 30); },
                },
            },
        },
        plugins: [{
            id: 'whoLine',
            afterDraw(chart) {
                const { ctx, chartArea: { left, right }, scales: { y } } = chart;
                const drawLine = (val, label, color) => {
                    if (y.min > val || y.max < val) return;
                    const yPos = y.getPixelForValue(val);
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
                };
                drawLine(15, 'WHO PM2.5 (15)', 'rgba(37,99,235,.55)');
                drawLine(45, 'WHO PM10 (45)',   'rgba(249,115,22,.55)');
            },
        }],
    });
}
