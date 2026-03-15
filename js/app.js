'use strict';

/* ───── DATA AGE INDICATOR ───── */
let refreshTimer      = null;
let dataAgeInterval   = null;
let latestTimestamp   = null;   // set after each successful fetch

function startDataAge() {
    clearInterval(dataAgeInterval);
    dataAgeInterval = setInterval(() => {
        if (!latestTimestamp) return;
        const diffMin = Math.round((Date.now() - new Date(latestTimestamp.replace(' ', 'T'))) / 60000);
        const el = document.getElementById('dataAge');
        if (!el) return;
        if (diffMin < 1)        el.textContent = 'Dane sprzed chwili';
        else if (diffMin === 1) el.textContent = 'Dane sprzed 1 min';
        else                    el.textContent = `Dane sprzed ${diffMin} min`;
    }, 30000);   // update every 30 s is plenty
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
            buildCharts(data);
            updateChartSummary(data);
            summary.style.display = 'grid';
            chartNote.textContent =
                `${data.length} pomiarów • ${formatDatePL(dateStr)}` +
                (isToday ? ' (dane bieżące, odświeżane co 1 godz.)' : ' (dane z bazy danych)');
        } else {
            destroyAllCharts();
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

/* ───── MAIN REFRESH (runs every hour, reads everything from Supabase) ───── */

async function refresh() {
    const overlayErr    = document.getElementById('overlayErr');
    overlayErr.textContent = '';
    const supabaseReady = !SUPABASE_URL.includes('YOUR_PROJECT_ID');

    // 1. Get latest reading for measurement cards
    let latest = null;
    try {
        latest = supabaseReady
            ? await fetchLatestFromSupabase()
            : await fetchLiveBoth();   // fallback when Supabase not configured
    } catch (err) {
        console.warn('Latest reading fetch failed:', err);
        overlayErr.textContent = `Błąd pobierania: ${err.message}`;
    }

    // 2. Update measurement cards
    if (latest) {
        updateBanner(latest.pm25);
        updateCard('valPM25', 'progPM25', 'badgePM25', latest.pm25, PM25_LEVELS, 15);
        updateCard('valPM10', 'progPM10', 'badgePM10', latest.pm10, PM10_LEVELS, 45);
        updateTempCard(latest.temp);
        updateHumCard(latest.hum);
        updateNormsTable(latest.pm25, latest.pm10);
        updateLastUpdate(latest.timestamp);
    } else if (!latest) {
        overlayErr.textContent = 'Brak danych. Spróbuj odświeżyć stronę.';
    }

    document.getElementById('dataSourceInfo').textContent = supabaseReady
        ? 'Źródło danych: Supabase (zbierane co 1 godz.)'
        : `Czujniki: SDS011 #${PM_SENSOR_ID} + BME280 #${ENV_SENSOR_ID}`;

    // 3. Refresh chart if user is viewing today
    if (currentViewDate === todayStr()) {
        try {
            const todayData = await loadDayData(todayStr());
            updateNavUI(todayStr());
            if (todayData.length > 0) {
                buildCharts(todayData);
                updateChartSummary(todayData);
                document.getElementById('historySummary').style.display = 'grid';
                document.getElementById('chartNote').textContent =
                    `${todayData.length} pomiarów • ${formatDatePL(todayStr())} (odświeżane co 1 godz.)`;
            } else {
                document.getElementById('chartNote').textContent =
                    'Brak danych z dzisiejszego dnia. Pojawią się po kolejnej kolekcji.';
            }
        } catch (err) {
            document.getElementById('chartNote').textContent = `Błąd ładowania wykresu: ${err.message}`;
        }
    }

    // 4. Hide overlay, schedule next refresh
    if (latest) {
        latestTimestamp = latest.timestamp;
        startDataAge();   // update age label immediately
        const diffMin = Math.round((Date.now() - new Date(latest.timestamp.replace(' ', 'T'))) / 60000);
        const el = document.getElementById('dataAge');
        if (el) el.textContent = diffMin < 1 ? 'Dane sprzed chwili' : `Dane sprzed ${diffMin} min`;
    }
    document.getElementById('overlay').style.display = 'none';
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, REFRESH_MS);
}

/* ───── BOOT ───── */
(async () => {
    initHistoryControls();
    await refresh();   // Supabase responds in <1s, overlay clears immediately
})();
