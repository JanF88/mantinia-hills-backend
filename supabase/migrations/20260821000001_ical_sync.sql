-- iCal-Sync mit Booking/Airbnb: externe Blockierungen + Feed-URLs + Cron.
create table if not exists ical_blockierungen (
  id uuid primary key default gen_random_uuid(),
  quelle text not null,               -- 'booking' | 'airbnb' | ...
  uid text not null,                  -- iCal-UID des Events
  von date not null,                  -- Anreise (DTSTART)
  bis date not null,                  -- Abreise (DTEND, exklusiv wie abreise)
  zusammenfassung text,
  importiert_am timestamptz not null default now(),
  unique (quelle, uid)
);
alter table ical_blockierungen enable row level security;
drop policy if exists admin_alles on ical_blockierungen;
create policy admin_alles on ical_blockierungen for all to authenticated using (true) with check (true);

insert into einstellungen (key, value)
select 'ical_feeds', '{"booking":"","airbnb":""}'::jsonb
where not exists (select 1 from einstellungen where key = 'ical_feeds');

-- Stündlicher Import (Minute 5) über pg_cron -> Edge Function ical-sync.
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- Hinweis: der cron.schedule-Aufruf wurde direkt ausgeführt (Job 'ical-sync-stuendlich'):
-- select cron.schedule('ical-sync-stuendlich', '5 * * * *',
--   $$ select net.http_post(url := 'https://fiicnznmxbahfnansckp.supabase.co/functions/v1/ical-sync?key=<ICAL_KEY>', body := '{}'::jsonb) $$);
