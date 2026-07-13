-- Seed: exakt die Konstanten des Website-Widgets (mantinia-hills.com).
-- Preise sind danach ausschließlich über die Einstellungs-Seite editierbar.

insert into einstellungen (key, value) values
  ('saison_preise', '[[35,30],[40,35],[45,40],[50,45],[65,60],[60,55],[50,45],[45,40],[35,30]]'),
  ('monat_zu_saison', '[0,0,1,1,2,3,4,4,5,6,7,8]'),
  ('saison_namen', '["Jan–Feb","Mär–Apr","Mai","Jun","Jul–Aug","Sep","Okt","Nov","Dez"]'),
  ('personen_schwelle', '5'),
  ('endreinigung_eur', '180'),
  ('transfer_optionen', '[{"label":"Kein Transfer","eur":0},{"label":"Eine Fahrt","eur":50},{"label":"Hin & zurück","eur":100}]'),
  ('anzahlung_prozent_default', '30'),
  ('angebot_gueltig_tage', '14'),
  ('storno_stufen', '[{"min_tage":60,"prozent":20},{"min_tage":30,"prozent":50},{"min_tage":7,"prozent":80},{"min_tage":0,"prozent":100}]'),
  ('anbieter', '{"name":"Ferienhaus Mantinia Hills","inhaber":"ZERO CENTER HELLAS IKE","strasse":"Asprochoma","ort":"24100 Kalamata","land":"Griechenland","telefon":"+30 2721 111 909","email":"info@zero-center.gr","web":"www.mantinia-hills.com","iban":"","bic":"","bank":""}'),
  ('pdf_fusszeile', '"Zahlbar innerhalb von 7 Tagen nach Rechnungsdatum. Vielen Dank für Ihre Buchung!"');
