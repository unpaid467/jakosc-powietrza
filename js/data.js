'use strict';

/* ───── LOCAL STORAGE (today's rolling buffer) ───── */

function loadLocal() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const obj = JSON.parse(raw);
        if (obj.date !== todayStr()) return [];   // stale – new day
        return obj.readings || [];
    } catch { return []; }
}

function saveLocal(readings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            date: todayStr(),
            readings: readings.slice(-576),   // max ~2 days of 5-min readings
        }));
    } catch { /* storage full – ignore */ }
}

/* ───── LIVE SENSOR API (sensor.community) ───── */

async function fetchSensor(sensorId) {
    const url = `${API_BASE}/${sensorId}/`;
    const r = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} dla czujnika ${sensorId}`);
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error(`Brak danych z czujnika ${sensorId}`);
    return data;
}

async function fetchLiveBoth() {
    const [pmData, envData] = await Promise.allSettled([
        fetchSensor(PM_SENSOR_ID),
        fetchSensor(ENV_SENSOR_ID),
    ]);

    let pm25 = null, pm10 = null, temp = null, hum = null, pressure = null, timestamp = null;

    if (pmData.status === 'fulfilled') {
        const entry = pmData.value[0];
        timestamp = entry.timestamp;
        (entry.sensordatavalues || []).forEach(sv => {
            if (sv.value_type === 'P2') pm25 = parseFloatOrNull(sv.value);
            if (sv.value_type === 'P1') pm10 = parseFloatOrNull(sv.value);
        });
    } else {
        console.warn('PM sensor fetch failed:', pmData.reason);
    }

    if (envData.status === 'fulfilled') {
        const entry = envData.value[0];
        if (!timestamp) timestamp = entry.timestamp;
        (entry.sensordatavalues || []).forEach(sv => {
            if (sv.value_type === 'temperature') temp     = parseFloatOrNull(sv.value);
            if (sv.value_type === 'humidity')    hum      = parseFloatOrNull(sv.value);
            if (sv.value_type === 'pressure')    pressure = parseFloatOrNull(sv.value);
        });
    } else {
        console.warn('ENV sensor fetch failed:', envData.reason);
    }

    if (pm25 === null && pm10 === null && temp === null) {
        throw new Error('Oba czujniki nie zwróciły danych');
    }
    return { timestamp: timestamp || new Date().toISOString(), pm25, pm10, temp, hum, pressure };
}

function extractAllReadings(pmRaw, envRaw) {
    const envMap = {};
    if (envRaw && Array.isArray(envRaw)) {
        envRaw.forEach(entry => {
            const vals = {};
            (entry.sensordatavalues || []).forEach(sv => { vals[sv.value_type] = parseFloatOrNull(sv.value); });
            envMap[entry.timestamp] = {
                temp:     vals['temperature'] ?? null,
                hum:      vals['humidity']    ?? null,
                pressure: vals['pressure']    ?? null,
            };
        });
    }
    const result = [];
    if (pmRaw && Array.isArray(pmRaw)) {
        pmRaw.forEach(entry => {
            const vals = {};
            (entry.sensordatavalues || []).forEach(sv => { vals[sv.value_type] = parseFloatOrNull(sv.value); });
            const env = envMap[entry.timestamp] || { temp: null, hum: null, pressure: null };
            result.push({ timestamp: entry.timestamp, pm25: vals['P2'] ?? null, pm10: vals['P1'] ?? null, ...env });
        });
    }
    return result;
}

/* ───── ARCHIVE CSV (sensor.community, published ~08:00 next day) ───── */

async function fetchArchiveCSV(dateStr) {
    const url = `${ARCHIVE_BASE}/${dateStr}/${dateStr}_sds011_sensor_${PM_SENSOR_ID}.csv`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return [];
    const lines = (await r.text()).trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(';').map(h => h.trim());
    return lines.slice(1).map(line => {
        const cols = line.split(';');
        const row = {};
        headers.forEach((h, i) => { row[h] = cols[i]?.trim() ?? ''; });
        const ts = row['timestamp'] || '';
        if (!ts) return null;
        return { timestamp: ts, pm25: parseFloatOrNull(row['P2']), pm10: parseFloatOrNull(row['P1']), temp: null, hum: null, pressure: null };
    }).filter(r => r && (r.pm25 !== null || r.pm10 !== null));
}

/* ───── SUPABASE ───── */

async function fetchDayFromSupabase(dateStr) {
    // Convert local date boundaries to UTC ISO strings for the timestamptz column
    const start = new Date(`${dateStr}T00:00:00`).toISOString();
    const end   = new Date(`${dateStr}T23:59:59`).toISOString();
    const url   = `${SUPABASE_URL}/rest/v1/readings`
        + `?timestamp=gte.${start}`
        + `&timestamp=lte.${end}`
        + `&order=timestamp.asc`
        + `&select=timestamp,pm25,pm10,temp,hum,pressure`;
    const r = await fetch(url, {
        headers: {
            apikey:        SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
    });
    if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
    return r.json();
}

/* ─────────────────────────────────────────────────────────────────────────
 *  DATA SOURCE LAYER  ─  single function the rest of the app calls
 *
 *  CURRENT : Supabase database (fast, full history)
 *  FALLBACK: If Supabase is not yet configured (placeholder keys in config.js),
 *            the site transparently falls back to sensor.community archive CSV.
 *
 *  To switch back to archive-only: comment/uncomment the two return lines.
 * ───────────────────────────────────────────────────────────────────────── */
async function fetchDayFromSource(dateStr) {
    if (SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
        return fetchArchiveCSV(dateStr);   // not yet configured – use archive CSV
    }
    return fetchDayFromSupabase(dateStr);
    // return fetchArchiveCSV(dateStr);    // ← Option A: archive CSV only
}

/* ───── IN-MEMORY CACHE ───── */
const historyCache = new Map();
let currentViewDate = '';   // initialised by initHistoryControls()

async function loadDayData(dateStr) {
    if (dateStr === todayStr()) return loadLocal();
    if (historyCache.has(dateStr)) return historyCache.get(dateStr);
    const data = await fetchDayFromSource(dateStr);
    historyCache.set(dateStr, data);
    return data;
}
