-- Sprache der Anfrage (de/en/gr) — steuert Sprache von E-Mails, PDFs und
-- Gästeseiten. Bestehende/unbekannte Anfragen: Standard Deutsch.
alter table buchungen add column if not exists sprache text not null default 'de';
alter table buchungen drop constraint if exists buchungen_sprache_check;
alter table buchungen add constraint buchungen_sprache_check check (sprache in ('de','en','gr'));
comment on column buchungen.sprache is 'Sprache der Anfrage (de/en/gr) — steuert Sprache von E-Mails, PDFs und Gästeseiten.';
