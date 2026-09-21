-- PayPal-Zahlung der Anzahlung: Einweg-Link-Token + Zahlungsreferenz.
-- Der Token macht den Zahlungs-Link unerratbar; die Referenz hält die
-- PayPal-Capture-ID fest ("PayPal <id>"), sichtbar im Verlauf der Anfrage.
alter table buchungen add column if not exists zahlung_token uuid default gen_random_uuid();
alter table buchungen add column if not exists zahlung_referenz text;
update buchungen set zahlung_token = gen_random_uuid() where zahlung_token is null;
