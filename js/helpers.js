'use strict';

function parseFloatOrNull(v) {
    if (v === '' || v === undefined || v === null) return null;
    const n = parseFloat(String(v));
    return isNaN(n) ? null : n;
}

function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatTimestamp(ts) {
    const d = new Date(ts.replace(' ', 'T'));
    return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function formatDatePL(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
}

function getLevel(value, levels) {
    if (value === null || isNaN(value)) return { label: 'Brak danych', color: '#9ca3af' };
    return levels.find(l => value <= l.max) || levels[levels.length - 1];
}

function mergeReadings(a, b) {
    const map = new Map();
    [...a, ...b].forEach(r => map.set(r.timestamp, r));
    return [...map.values()].sort((x, y) =>
        new Date(x.timestamp.replace(' ', 'T')) - new Date(y.timestamp.replace(' ', 'T'))
    );
}
