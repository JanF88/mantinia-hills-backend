-- Vermerk, wann die automatische Angebots-Erinnerung versendet wurde (einmalig).
alter table buchungen add column if not exists angebot_erinnert_am timestamptz;

-- Täglicher Versand (08:20 UTC) über pg_cron -> Edge Function angebot-erinnerung.
-- Hinweis: der cron.schedule-Aufruf wurde direkt ausgeführt (Job 'angebot-erinnerung-taeglich'):
-- select cron.schedule('angebot-erinnerung-taeglich', '20 8 * * *',
--   $$ select net.http_post(url := 'https://fiicnznmxbahfnansckp.supabase.co/functions/v1/angebot-erinnerung?key=<ICAL_KEY>', body := '{}'::jsonb) $$);
