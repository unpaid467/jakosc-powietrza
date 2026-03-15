'use strict';

/* ───── SENSOR IDs ───── */
const PM_SENSOR_ID  = 63261;   // SDS011  – P1=PM10, P2=PM2.5
const ENV_SENSOR_ID = 63262;   // BME280  – temperature, humidity, pressure

/* ───── API ENDPOINTS ───── */
const API_BASE    = 'https://data.sensor.community/airrohr/v1/sensor';
const ARCHIVE_BASE = 'https://archive.sensor.community';

/* ───── SUPABASE ─────────────────────────────────────────────────────────
 *  Fill in both values after creating your project (see SETUP.md).
 *  Until filled in, the site automatically falls back to archive CSV.
 * ──────────────────────────────────────────────────────────────────────── */
const SUPABASE_URL      = 'https://zpxdfvbkiofahbtldwny.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpweGRmdmJraW9mYWhidGxkd255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTc0MzcsImV4cCI6MjA4OTA5MzQzN30.BaXfg-DuHFU2owbvFGFDvEicglad5hlY2KVGBNPDReo';

/* ───── APP SETTINGS ───── */
const STORAGE_KEY = 'aq_mielec_rzochowska_v2';
const REFRESH_MS  = 5 * 60 * 1000;   // live data refresh interval (ms)

/* ───── AIR QUALITY LEVELS (GIOŚ) ───── */
const PM25_LEVELS = [
    { max: 10,       label: 'Bardzo dobra', color: '#059669' },
    { max: 15,       label: 'Dobra',        color: '#16a34a' },
    { max: 25,       label: 'Umiarkowana',  color: '#ca8a04' },
    { max: 50,       label: 'Dostateczna',  color: '#ea580c' },
    { max: 75,       label: 'Zła',          color: '#dc2626' },
    { max: Infinity, label: 'Bardzo zła',   color: '#7c3aed' },
];

const PM10_LEVELS = [
    { max: 20,       label: 'Bardzo dobra', color: '#059669' },
    { max: 50,       label: 'Dobra',        color: '#16a34a' },
    { max: 80,       label: 'Umiarkowana',  color: '#ca8a04' },
    { max: 110,      label: 'Dostateczna',  color: '#ea580c' },
    { max: 150,      label: 'Zła',          color: '#dc2626' },
    { max: Infinity, label: 'Bardzo zła',   color: '#7c3aed' },
];
