-- Zeitabhängige Übernachtungspreise: Liste von Preisständen mit „gültig ab".
-- Die aktuellen saison_preise werden als erste Periode (ab 2000) übernommen.
-- saison_preise bleibt als Fallback für das alte Website-Widget erhalten und
-- wird von der Einstellungen-Seite mit dem heute gültigen Stand synchron gehalten.
insert into einstellungen (key, value)
select 'preis_perioden',
       jsonb_build_array(
         jsonb_build_object(
           'ab', '2000-01-01',
           'saison_preise', (select value from einstellungen where key = 'saison_preise')
         )
       )
where not exists (select 1 from einstellungen where key = 'preis_perioden');
