-- Warum wurde eine Anfrage abgelehnt? (Auswertung der Absagegründe)
-- Werte: belegt | keine_reaktion | preis | storniert_durch_gast | abgelaufen | sonstiges
alter table buchungen add column if not exists ablehnungsgrund text;

-- Täglicher Auto-Ablauf (08:30 UTC) über pg_cron -> Edge Function angebot-ablauf.
-- Hinweis: der cron.schedule-Aufruf wurde direkt ausgeführt (Job 'angebot-ablauf-taeglich'):
-- select cron.schedule('angebot-ablauf-taeglich', '30 8 * * *',
--   $$ select net.http_post(url := 'https://fiicnznmxbahfnansckp.supabase.co/functions/v1/angebot-ablauf?key=<ICAL_KEY>', body := '{}'::jsonb) $$);
