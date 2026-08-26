-- Gäste-Feedback nach dem Aufenthalt (1–5 Sterne + Freitext + Einwilligung).
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  buchung_id uuid not null unique references buchungen(id) on delete cascade,
  sterne int not null check (sterne between 1 and 5),
  text text,
  veroeffentlichung_ok boolean not null default false,  -- Einwilligung zur Nutzung als Referenz
  erstellt_am timestamptz not null default now()
);
alter table feedback enable row level security;
drop policy if exists admin_alles on feedback;
create policy admin_alles on feedback for all to authenticated using (true) with check (true);

-- Einweg-Token + Versand-Vermerk an der Buchung
alter table buchungen add column if not exists feedback_token uuid;
alter table buchungen add column if not exists feedback_angefragt_am timestamptz;

-- Täglicher Auto-Versand (08:10 UTC) über pg_cron -> Edge Function feedback-anfragen.
-- Hinweis: der cron.schedule-Aufruf wurde direkt ausgeführt (Job 'feedback-anfragen-taeglich'):
-- select cron.schedule('feedback-anfragen-taeglich', '10 8 * * *',
--   $$ select net.http_post(url := 'https://fiicnznmxbahfnansckp.supabase.co/functions/v1/feedback-anfragen?key=<ICAL_KEY>', body := '{}'::jsonb) $$);
