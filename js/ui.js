'use strict';

function setVal(id, v, decimals = 1) {
    document.getElementById(id).textContent = v !== null ? v.toFixed(decimals) : '—';
}

function updateBanner(pm25) {
    const lv = getLevel(pm25, PM25_LEVELS);
    document.getElementById('aqiBanner').style.background = lv.color;
    document.getElementById('aqiDot').style.background    = 'rgba(255,255,255,.5)';
    document.getElementById('aqiLabel').textContent       = lv.label;
    document.getElementById('aqiDesc').textContent        =
        pm25 !== null ? `PM2.5: ${pm25.toFixed(1)} µg/m³` : 'Brak danych';
}

function updateCard(valueId, progId, badgeId, value, levels, normVal) {
    setVal(valueId, value);
    const lv  = getLevel(value, levels);
    const pct = value !== null ? Math.min((value / normVal) * 100, 150) : 0;
    const prog = document.getElementById(progId);
    document.getElementById(badgeId).textContent      = lv.label;
    document.getElementById(badgeId).style.background = lv.color;
    prog.style.width      = pct + '%';
    prog.style.background = lv.color;
}

function updateTempCard(temp) {
    setVal('valTemp', temp, 1);
    const desc = document.getElementById('tempDesc');
    if (temp === null)  { desc.textContent = 'Brak danych o temperaturze'; return; }
    if      (temp < 0)  desc.textContent = '❄️ Temperatura poniżej zera';
    else if (temp < 10) desc.textContent = '🧥 Zimno';
    else if (temp < 18) desc.textContent = '🌤️ Chłodno';
    else if (temp < 25) desc.textContent = '☀️ Komfortowo';
    else                desc.textContent = '🌡️ Ciepło / Gorąco';
}

function updateHumCard(hum) {
    setVal('valHum', hum, 0);
    const desc = document.getElementById('humDesc');
    if (hum === null)   { desc.textContent = 'Brak danych o wilgotności'; return; }
    if      (hum < 30)  desc.textContent = '🏜️ Zbyt suche powietrze';
    else if (hum <= 60) desc.textContent = '✅ Wilgotność w normie';
    else                desc.textContent = '💦 Podwyższona wilgotność';
}

function updateNormsTable(pm25, pm10) {
    const fmt = v => v !== null ? `${v.toFixed(1)} µg/m³` : '—';
    document.getElementById('normPM25val').textContent = fmt(pm25);
    document.getElementById('normPM10val').textContent = fmt(pm10);
    const setStatus = (id, value, norm) => {
        const el = document.getElementById(id);
        if (value === null) { el.textContent = '—'; el.className = 'norm-na'; return; }
        if (value <= norm)  { el.textContent = '✔ W normie'; el.className = 'norm-ok'; }
        else                { el.textContent = `✘ Przekroczona o ${((value / norm - 1) * 100).toFixed(0)}%`; el.className = 'norm-bad'; }
    };
    setStatus('normPM25status', pm25, 15);
    setStatus('normPM10status', pm10, 45);
}

function updateLastUpdate(ts) {
    const d = new Date(ts.replace ? ts.replace(' ', 'T') : ts);
    document.getElementById('lastUpdate').textContent =
        `Ostatni pomiar: ${d.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}`;
}

function updateNavUI(dateStr) {
    const today = todayStr();
    document.getElementById('historyDatePicker').value    = dateStr;
    document.getElementById('chartDateLabel').textContent = formatDatePL(dateStr);
    document.getElementById('btnNextDay').disabled = dateStr >= today;
    document.getElementById('btnToday').disabled   = dateStr === today;
}

function updateChartSummary(data) {
    const pm25Vals = data.map(r => r.pm25).filter(v => v !== null);
    const pm10Vals = data.map(r => r.pm10).filter(v => v !== null);
    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const max = arr => arr.length ? Math.max(...arr) : null;
    const fmt = v => v !== null ? v.toFixed(1) + ' µg/m³' : '—';
    document.getElementById('sumAvgPM25').textContent = fmt(avg(pm25Vals));
    document.getElementById('sumMaxPM25').textContent = fmt(max(pm25Vals));
    document.getElementById('sumAvgPM10').textContent = fmt(avg(pm10Vals));
    document.getElementById('sumMaxPM10').textContent = fmt(max(pm10Vals));
    document.getElementById('sumCount').textContent   = data.length;
}
