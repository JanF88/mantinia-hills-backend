-- Zufalls-Token für die Angebots-Annahme per Mail-Link (unratbar).
alter table buchungen add column if not exists annahme_token uuid;
create index if not exists buchungen_annahme_token_idx on buchungen (annahme_token);
