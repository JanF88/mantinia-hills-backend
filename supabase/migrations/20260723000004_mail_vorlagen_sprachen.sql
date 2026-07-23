-- mail_vorlagen von flacher Struktur ({angebot,...}) auf Sprach-Struktur
-- ({de:{...}, en:{...}, gr:{...}}) umstellen. Nur anwenden, wenn noch flach.
-- EN/GR werden aus den Code-Defaults ergänzt bzw. in den Einstellungen gepflegt.
update einstellungen
set value = jsonb_build_object('de', value)
where key = 'mail_vorlagen'
  and value ? 'angebot';
