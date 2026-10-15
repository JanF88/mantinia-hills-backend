-- Zweite Angebots-Erinnerung ("läuft in 3 Tagen ab"):
-- Stufe 1 kommt jetzt 3 Tage nach Versand, Stufe 2 drei Tage vor Ablauf.
alter table buchungen add column if not exists angebot_erinnert2_am timestamptz;
