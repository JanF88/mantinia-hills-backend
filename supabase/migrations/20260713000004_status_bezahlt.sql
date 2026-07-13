-- Neuer Status „Komplett bezahlt": Restzahlung eingegangen, Aufenthalt steht noch aus.
-- Fluss: angezahlt → bezahlt → abgeschlossen

alter type buchung_status add value if not exists 'bezahlt' after 'angezahlt';
alter table buchungen add column if not exists restzahlung_eingegangen_am timestamptz;
