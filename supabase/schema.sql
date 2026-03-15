-- ═══════════════════════════════════════════════════════════════════════
--  Air Quality Monitor – Supabase Database Schema
--  Run this once in the Supabase SQL Editor (Database → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════════════════

-- Main readings table
CREATE TABLE IF NOT EXISTS readings (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timestamp   TIMESTAMPTZ NOT NULL,
    pm25        REAL,
    pm10        REAL,
    temp        REAL,
    hum         REAL,
    pressure    REAL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate inserts for the exact same sensor timestamp
CREATE UNIQUE INDEX IF NOT EXISTS readings_timestamp_uniq
    ON readings (timestamp);

-- Speed up date-range queries used by the website
CREATE INDEX IF NOT EXISTS readings_timestamp_idx
    ON readings (timestamp ASC);

-- Enable Row Level Security (keeps data protected)
ALTER TABLE readings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access so the website can query without a login
CREATE POLICY "Public read access"
    ON readings
    FOR SELECT
    TO anon
    USING (true);

-- Only service role (used by the collector script) can insert/update
-- (no explicit policy needed – service role bypasses RLS by default)
