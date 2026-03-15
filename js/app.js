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

/* ───── MAIN REFRESH (runs every 10 min, reads everything from Supabase) ───── */

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
        ? 'Źródło danych: Supabase (zbierane co 10 min)'
        : `Czujniki: SDS011 #${PM_SENSOR_ID} + BME280 #${ENV_SENSOR_ID}`;

    // 3. Refresh chart if user is viewing today
    if (currentViewDate === todayStr()) {
        try {
            const todayData = await loadDayData(todayStr());
            updateNavUI(todayStr());
            if (todayData.length > 0) {
                buildChart(todayData);
                updateChartSummary(todayData);
                document.getElementById('historySummary').style.display = 'grid';
                document.getElementById('chartNote').textContent =
                    `${todayData.length} pomiarów • ${formatDatePL(todayStr())} (odświeżane co 10 min)`;
            } else {
                document.getElementById('chartNote').textContent =
                    'Brak danych z dzisiejszego dnia. Pojawią się po kolejnej kolekcji.';
            }
        } catch (err) {
            document.getElementById('chartNote').textContent = `Błąd ładowania wykresu: ${err.message}`;
        }
    }

    // 4. Hide overlay, schedule next refresh
    document.getElementById('overlay').style.display = 'none';
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, REFRESH_MS);
    startCountdown();
}

/* ───── BOOT ───── */
(async () => {
    initHistoryControls();
    await refresh();   // Supabase responds in <1s, overlay clears immediately
})();
