'use strict';

/* ───── COUNTDOWN TIMER ───── */
let countdownSec      = REFRESH_MS / 1000;
let countdownInterval = null;
let refreshTimer      = null;

function startCountdown() {
    clearInterval(countdownInterval);
    countdownSec = REFRESH_MS / 1000;
    countdownInterval = setInterval(() => {
        countdownSec = Math.max(0, countdownSec - 1);
        const m = String(Math.floor(countdownSec / 60)).padStart(1, '0');
        const s = String(countdownSec % 60).padStart(2, '0');
        document.getElementById('countdown').textContent = `${m}:${s}`;
    }, 1000);
}

/* ───── HISTORY NAVIGATION ───── */

async function showHistoryDay(dateStr) {
    if (currentViewDate === dateStr) return;
    currentViewDate = dateStr;
    updateNavUI(dateStr);

    const isToday   = dateStr === todayStr();
    const loading   = document.getElementById('historyLoading');
    const summary   = document.getElementById('historySummary');
    const chartNote = document.getElementById('chartNote');

    if (!isToday) loading.style.display = 'flex';
    summary.style.display = 'none';

    try {
        const data = await loadDayData(dateStr);
        if (data.length > 0) {
            buildChart(data);
            updateChartSummary(data);
            summary.style.display = 'grid';
            chartNote.textContent =
                `${data.length} pomiarów • ${formatDatePL(dateStr)}` +
                (isToday ? ' (dane bieżące, odświeżane co 5 min)' : ' (dane z bazy danych)');
        } else {
            if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
            chartNote.textContent = isToday
                ? 'Brak danych z dzisiejszego dnia. Wykres wypełni się z kolejnymi pomiarami.'
                : 'Brak danych w bazie dla wybranego dnia.';
        }
    } catch (err) {
        chartNote.textContent = `Błąd ładowania danych: ${err.message}`;
        summary.style.display = 'none';
    } finally {
        loading.style.display = 'none';
    }
}

function initHistoryControls() {
    currentViewDate = todayStr();
    const picker    = document.getElementById('historyDatePicker');
    picker.max      = todayStr();
    picker.min      = '2020-01-01';
    picker.value    = todayStr();
    updateNavUI(todayStr());

    function offsetDay(delta) {
        const d = new Date(currentViewDate + 'T00:00:00');
        d.setDate(d.getDate() + delta);
        const next = d.toISOString().slice(0, 10);
        if (next <= todayStr() && next >= picker.min) showHistoryDay(next);
    }

    document.getElementById('btnPrevDay').addEventListener('click', () => offsetDay(-1));
    document.getElementById('btnNextDay').addEventListener('click', () => offsetDay(+1));
    document.getElementById('btnToday').addEventListener('click',   () => showHistoryDay(todayStr()));
    picker.addEventListener('change', () => { if (picker.value) showHistoryDay(picker.value); });
}

/* ───── MAIN REFRESH (live sensor, runs every 5 min) ───── */

async function refresh() {
    const overlayErr = document.getElementById('overlayErr');
    overlayErr.textContent = '';

    // 1. Fetch live data from both sensors in parallel
    let liveEntry = null, pmRaw = null, envRaw = null;
    try {
        const [pmResult, envResult] = await Promise.allSettled([
            fetchSensor(PM_SENSOR_ID),
            fetchSensor(ENV_SENSOR_ID),
        ]);
        if (pmResult.status === 'fulfilled')  pmRaw  = pmResult.value;
        if (envResult.status === 'fulfilled') envRaw = envResult.value;
        liveEntry = await fetchLiveBoth();
    } catch (err) {
        console.warn('Live API error:', err);
        overlayErr.textContent = `Błąd pobierania: ${err.message}`;
    }

    // 2. Accumulate new readings into localStorage (today's rolling buffer)
    let stored = loadLocal();
    if (pmRaw) {
        const newReadings = extractAllReadings(pmRaw, envRaw);
        newReadings.forEach(r => {
            if (!stored.some(s => s.timestamp === r.timestamp)) stored.push(r);
        });
        stored.sort((a, b) =>
            new Date(a.timestamp.replace(' ', 'T')) - new Date(b.timestamp.replace(' ', 'T'))
        );
        saveLocal(stored);
        historyCache.delete(todayStr());   // invalidate so next loadDayData picks up freshData
    }

    // 3. Update current-reading cards
    const latest = liveEntry ?? (stored.length > 0 ? stored[stored.length - 1] : null);
    if (latest) {
        updateBanner(latest.pm25);
        updateCard('valPM25', 'progPM25', 'badgePM25', latest.pm25, PM25_LEVELS, 15);
        updateCard('valPM10', 'progPM10', 'badgePM10', latest.pm10, PM10_LEVELS, 45);
        updateTempCard(latest.temp);
        updateHumCard(latest.hum);
        updateNormsTable(latest.pm25, latest.pm10);
        updateLastUpdate(latest.timestamp);
    } else {
        overlayErr.textContent = 'Brak danych z czujników. Spróbuj odświeżyć stronę.';
    }

    document.getElementById('dataSourceInfo').textContent =
        `Czujniki: SDS011 #${PM_SENSOR_ID} + BME280 #${ENV_SENSOR_ID}`;

    // 4. Refresh chart only if user is still on today's view
    if (currentViewDate === todayStr()) {
        updateNavUI(todayStr());
        if (stored.length > 0) {
            buildChart(stored);
            updateChartSummary(stored);
            document.getElementById('historySummary').style.display = 'grid';
            document.getElementById('chartNote').textContent =
                stored.length < 3
                    ? `${stored.length} pomiar${stored.length === 1 ? '' : 'y'} z dzisiaj.`
                    : `${stored.length} pomiarów • ${formatDatePL(todayStr())} (odświeżane co 5 min)`;
        } else {
            document.getElementById('chartNote').textContent =
                'Brak danych z dzisiejszego dnia. Wykres wypełni się z kolejnymi pomiarami.';
        }
    }

    // 5. Hide overlay, schedule next refresh
    document.getElementById('overlay').style.display = 'none';
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, REFRESH_MS);
    startCountdown();
}

/* ───── BOOT ───── */
(async () => {
    initHistoryControls();

    // Show cached data instantly so the page isn't blank while fetching
    const stored = loadLocal();
    if (stored.length > 0) {
        const latest = stored[stored.length - 1];
        updateBanner(latest.pm25);
        updateCard('valPM25', 'progPM25', 'badgePM25', latest.pm25, PM25_LEVELS, 15);
        updateCard('valPM10', 'progPM10', 'badgePM10', latest.pm10, PM10_LEVELS, 45);
        updateTempCard(latest.temp);
        updateHumCard(latest.hum);
        updateNormsTable(latest.pm25, latest.pm10);
        buildChart(stored);
        updateChartSummary(stored);
        document.getElementById('historySummary').style.display = 'grid';
        document.getElementById('overlay').style.display = 'none';
    }

    await refresh();
})();
