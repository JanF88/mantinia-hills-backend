-- Versand-Nachweis pro Dokument: wann wurde es erfolgreich per E-Mail an den
-- Gast versendet? NULL = nicht per Mail versendet (z. B. nur als PDF erstellt).
alter table dokumente add column if not exists versendet_am timestamptz;
comment on column dokumente.versendet_am is 'Zeitpunkt des erfolgreichen E-Mail-Versands an den Gast; NULL = nicht per Mail versendet.';
