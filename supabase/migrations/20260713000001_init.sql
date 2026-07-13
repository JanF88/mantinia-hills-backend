-- Buchungsverwaltung Mantinia Hills — Schema

create type buchung_status as enum (
  'neu',
  'angebot_erstellt',
  'bestaetigt',
  'angezahlt',
  'abgeschlossen',
  'storniert',
  'abgelehnt'
);

create type dokument_typ as enum ('angebot', 'anzahlungsrechnung', 'stornorechnung');
create type anfrage_quelle as enum ('webhook', 'manuell');

create or replace function set_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table buchungen (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status buchung_status not null default 'neu',
  quelle anfrage_quelle not null default 'webhook',
  vorname text not null,
  nachname text not null,
  email text not null,
  telefon text,
  personen int not null check (personen > 0),
  anreise date not null,
  abreise date not null,
  naechte int generated always as (abreise - anreise) stored,
  transfer_option text,
  transfer_eur numeric(10,2),
  endreinigung_eur numeric(10,2),
  uebernachtung_eur numeric(10,2),
  gesamtpreis_eur numeric(10,2),
  saison_aufschluesselung text,
  fahrzeug_interesse text,
  anfrage_zeitpunkt timestamptz,
  seite text,
  notizen text,
  angenommen_am timestamptz,
  anzahlung_eingegangen_am timestamptz,
  storniert_am timestamptz,
  raw_payload jsonb,
  constraint abreise_nach_anreise check (abreise > anreise)
);

create trigger buchungen_updated_at
  before update on buchungen
  for each row execute function set_updated_at();

create index buchungen_status_idx on buchungen (status);
create index buchungen_created_idx on buchungen (created_at desc);
create index buchungen_dedupe_idx on buchungen (email, anreise, abreise, created_at);

create table dokumente (
  id uuid primary key default gen_random_uuid(),
  buchung_id uuid not null references buchungen(id) on delete restrict,
  typ dokument_typ not null,
  nummer text not null unique,
  datum date not null default current_date,
  -- [{bezeichnung, menge, einzelpreis, betrag}]
  positionen jsonb not null default '[]'::jsonb,
  gesamt numeric(10,2) not null,
  -- typ-spezifisch: {anzahlung_prozent} | {storno_prozent, tage_vor_anreise, basisbetrag, verrechnete_anzahlung, restbetrag}
  meta jsonb not null default '{}'::jsonb,
  pdf_path text,
  created_at timestamptz not null default now()
);

create index dokumente_buchung_idx on dokumente (buchung_id);

create table dokument_nummern (
  sequenz text not null,
  jahr int not null,
  zaehler int not null default 0,
  primary key (sequenz, jahr)
);

-- Atomare Nummernvergabe, jahresbasiert: AN-2026-001, RE-2026-001 …
-- AN = Angebote, RE = Anzahlungs- UND Stornorechnungen (eine lückenlose Rechnungsserie).
create or replace function naechste_dokument_nummer(p_sequenz text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jahr int := extract(year from current_date);
  v_nr int;
begin
  if p_sequenz not in ('AN', 'RE') then
    raise exception 'Unbekannte Sequenz: %', p_sequenz;
  end if;
  insert into dokument_nummern (sequenz, jahr, zaehler)
    values (p_sequenz, v_jahr, 1)
    on conflict (sequenz, jahr)
    do update set zaehler = dokument_nummern.zaehler + 1
    returning zaehler into v_nr;
  return p_sequenz || '-' || v_jahr || '-' || lpad(v_nr::text, 3, '0');
end $$;

revoke execute on function naechste_dokument_nummer(text) from public, anon;
grant execute on function naechste_dokument_nummer(text) to authenticated;

create table einstellungen (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger einstellungen_updated_at
  before update on einstellungen
  for each row execute function set_updated_at();

-- RLS: genau ein Admin-User (Signups deaktiviert), daher pauschal authenticated.
alter table buchungen enable row level security;
alter table dokumente enable row level security;
alter table dokument_nummern enable row level security;
alter table einstellungen enable row level security;

create policy admin_alles on buchungen
  for all to authenticated using (true) with check (true);
create policy admin_alles on dokumente
  for all to authenticated using (true) with check (true);
create policy admin_lesen on dokument_nummern
  for select to authenticated using (true);
create policy admin_alles on einstellungen
  for all to authenticated using (true) with check (true);

-- Privater Storage-Bucket für PDF-Archiv
insert into storage.buckets (id, name, public) values ('dokumente', 'dokumente', false);

create policy dokumente_lesen on storage.objects
  for select to authenticated using (bucket_id = 'dokumente');
create policy dokumente_schreiben on storage.objects
  for insert to authenticated with check (bucket_id = 'dokumente');
