-- Neue Anfrage-Quelle für Buchungen über den "Verbindlich buchen"-Button der Website.
alter type anfrage_quelle add value if not exists 'direktbuchung';
