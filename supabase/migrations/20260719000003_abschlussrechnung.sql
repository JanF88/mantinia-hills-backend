-- Abschlussrechnung (Restbetrag) als neuer Dokumenttyp + Fristen-Einstellungen.
alter type dokument_typ add value if not exists 'abschlussrechnung';

insert into einstellungen (key, value) values
  ('abschlussrechnung_tage_vorher', '14'),  -- so viele Tage vor Anreise wird die Abschlussrechnung fällig
  ('restzahlung_faellig_tage', '7')          -- Zahlungsziel: so viele Tage vor Anreise muss bezahlt sein
on conflict (key) do nothing;
