// E-Mail-Vorlagen (Betreff + Text) je Versandanlass UND je Sprache (de/en/gr),
// editierbar in den Einstellungen (Key `mail_vorlagen`). Platzhalter in
// geschweiften Klammern werden beim Versand ersetzt; **fett** wird zu <strong>;
// Leerzeilen trennen Absätze. Die Signatur (Logo + Kontakt) hängt mailRahmen() an.

export interface MailVorlage {
  betreff: string
  text: string
}

export interface MailVorlagen {
  angebot: MailVorlage
  anzahlung: MailVorlage
  annahme: MailVorlage
  abschluss: MailVorlage
  storno: MailVorlage
}

/** Vorlagen je Sprache. */
export type MailVorlagenSprachen = Record<'de' | 'en' | 'gr', MailVorlagen>

const DE: MailVorlagen = {
  angebot: {
    betreff: 'Ihr Angebot {nummer} - Ferienhaus Mantinia Hills',
    text: `Guten Tag {vorname} {nachname},

vielen Dank für Ihre Anfrage. Im Anhang finden Sie Ihr persönliches Angebot für Ihren Aufenthalt vom **{anreise}** bis **{abreise}**.

Das Angebot ist gültig bis {gueltig_bis}. Mit einem Klick auf den Button nehmen Sie das Angebot verbindlich an – Sie erhalten dann umgehend die Anzahlungsrechnung per E-Mail.

{button}

Bei Fragen sind wir jederzeit gern für Sie da.

Herzliche Grüße
Ihr Team vom Ferienhaus Mantinia Hills`,
  },
  anzahlung: {
    betreff: 'Anzahlungsrechnung {nummer} - Ferienhaus Mantinia Hills',
    text: `Guten Tag {vorname} {nachname},

vielen Dank für die Annahme unseres Angebots. Zur verbindlichen Reservierung Ihres Aufenthalts vom **{anreise}** bis **{abreise}** erhalten Sie im Anhang die Anzahlungsrechnung über **{betrag}**.

Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer {nummer}. Sobald die Anzahlung bei uns eingegangen ist, ist Ihre Buchung fest reserviert.

Herzliche Grüße
Ihr Team vom Ferienhaus Mantinia Hills`,
  },
  annahme: {
    betreff: 'Buchungsbestätigung und Anzahlungsrechnung {nummer}',
    text: `Guten Tag {vorname} {nachname},

vielen Dank – wir haben Ihre Annahme des Angebots {angebot_nummer} erhalten. Ihre Buchung für den Zeitraum **{anreise}** bis **{abreise}** ist damit bestätigt.

Im Anhang finden Sie die Anzahlungsrechnung über **{betrag}**. Mit Eingang der Anzahlung ist Ihr Aufenthalt fest reserviert.

Herzliche Grüße
Ihr Team vom Ferienhaus Mantinia Hills`,
  },
  abschluss: {
    betreff: 'Abschlussrechnung {nummer} - Ferienhaus Mantinia Hills',
    text: `Guten Tag {vorname} {nachname},

Ihr Aufenthalt vom **{anreise}** bis **{abreise}** steht bevor. Im Anhang finden Sie die Abschlussrechnung über den offenen Restbetrag von **{betrag}**.

Bitte überweisen Sie den Betrag bis spätestens **{faellig_bis}**. Wir freuen uns sehr auf Ihren Besuch!

Herzliche Grüße
Ihr Team vom Ferienhaus Mantinia Hills`,
  },
  storno: {
    betreff: 'Stornierung Ihrer Buchung {nummer} - Ferienhaus Mantinia Hills',
    text: `Guten Tag {vorname} {nachname},

hiermit bestätigen wir die Stornierung Ihrer Buchung für den Zeitraum **{anreise}** bis **{abreise}**. Die Einzelheiten entnehmen Sie bitte der Stornorechnung im Anhang.

Wir bedauern, dass Ihr Aufenthalt nicht zustande kommt, und würden uns freuen, Sie zu einem anderen Zeitpunkt begrüßen zu dürfen.

Herzliche Grüße
Ihr Team vom Ferienhaus Mantinia Hills`,
  },
}

// --- Englische Erstübersetzung (in den Einstellungen anpassbar) ---
const EN: MailVorlagen = {
  angebot: {
    betreff: 'Your offer {nummer} - Ferienhaus Mantinia Hills',
    text: `Dear {vorname} {nachname},

thank you for your enquiry. Please find attached your personal offer for your stay from **{anreise}** to **{abreise}**.

The offer is valid until {gueltig_bis}. Click the button below to accept the offer bindingly – you will then receive the deposit invoice by email right away.

{button}

If you have any questions, we are always happy to help.

Kind regards
Your team at Ferienhaus Mantinia Hills`,
  },
  anzahlung: {
    betreff: 'Deposit invoice {nummer} - Ferienhaus Mantinia Hills',
    text: `Dear {vorname} {nachname},

thank you for accepting our offer. To bindingly reserve your stay from **{anreise}** to **{abreise}**, please find the deposit invoice for **{betrag}** attached.

Please transfer the amount quoting the invoice number {nummer}. As soon as we receive the deposit, your booking is firmly reserved.

Kind regards
Your team at Ferienhaus Mantinia Hills`,
  },
  annahme: {
    betreff: 'Booking confirmation and deposit invoice {nummer}',
    text: `Dear {vorname} {nachname},

thank you – we have received your acceptance of offer {angebot_nummer}. Your booking for the period **{anreise}** to **{abreise}** is hereby confirmed.

Please find the deposit invoice for **{betrag}** attached. Once the deposit is received, your stay is firmly reserved.

Kind regards
Your team at Ferienhaus Mantinia Hills`,
  },
  abschluss: {
    betreff: 'Final invoice {nummer} - Ferienhaus Mantinia Hills',
    text: `Dear {vorname} {nachname},

your stay from **{anreise}** to **{abreise}** is coming up. Please find attached the final invoice for the outstanding balance of **{betrag}**.

Please transfer the amount by **{faellig_bis}** at the latest. We very much look forward to your visit!

Kind regards
Your team at Ferienhaus Mantinia Hills`,
  },
  storno: {
    betreff: 'Cancellation of your booking {nummer} - Ferienhaus Mantinia Hills',
    text: `Dear {vorname} {nachname},

we hereby confirm the cancellation of your booking for the period **{anreise}** to **{abreise}**. Please see the attached cancellation invoice for details.

We are sorry that your stay will not take place and would be delighted to welcome you at another time.

Kind regards
Your team at Ferienhaus Mantinia Hills`,
  },
}

// --- Griechische Erstübersetzung (bitte von Muttersprachler prüfen lassen) ---
const GR: MailVorlagen = {
  angebot: {
    betreff: 'Η προσφορά σας {nummer} - Ferienhaus Mantinia Hills',
    text: `Αγαπητέ/ή {vorname} {nachname},

σας ευχαριστούμε για το αίτημά σας. Στο συνημμένο θα βρείτε την προσωπική σας προσφορά για τη διαμονή σας από **{anreise}** έως **{abreise}**.

Η προσφορά ισχύει έως {gueltig_bis}. Με ένα κλικ στο κουμπί αποδέχεστε δεσμευτικά την προσφορά – θα λάβετε τότε αμέσως το τιμολόγιο προκαταβολής μέσω email.

{button}

Για οποιαδήποτε απορία είμαστε πάντα στη διάθεσή σας.

Με εγκάρδιους χαιρετισμούς
Η ομάδα του Ferienhaus Mantinia Hills`,
  },
  anzahlung: {
    betreff: 'Τιμολόγιο προκαταβολής {nummer} - Ferienhaus Mantinia Hills',
    text: `Αγαπητέ/ή {vorname} {nachname},

σας ευχαριστούμε για την αποδοχή της προσφοράς μας. Για την οριστική κράτηση της διαμονής σας από **{anreise}** έως **{abreise}** θα βρείτε στο συνημμένο το τιμολόγιο προκαταβολής ύψους **{betrag}**.

Παρακαλούμε καταβάλετε το ποσό αναφέροντας τον αριθμό τιμολογίου {nummer}. Μόλις λάβουμε την προκαταβολή, η κράτησή σας είναι οριστικά εξασφαλισμένη.

Με εγκάρδιους χαιρετισμούς
Η ομάδα του Ferienhaus Mantinia Hills`,
  },
  annahme: {
    betreff: 'Επιβεβαίωση κράτησης και τιμολόγιο προκαταβολής {nummer}',
    text: `Αγαπητέ/ή {vorname} {nachname},

σας ευχαριστούμε – λάβαμε την αποδοχή της προσφοράς {angebot_nummer}. Η κράτησή σας για το διάστημα **{anreise}** έως **{abreise}** επιβεβαιώνεται.

Στο συνημμένο θα βρείτε το τιμολόγιο προκαταβολής ύψους **{betrag}**. Μόλις λάβουμε την προκαταβολή, η διαμονή σας είναι οριστικά εξασφαλισμένη.

Με εγκάρδιους χαιρετισμούς
Η ομάδα του Ferienhaus Mantinia Hills`,
  },
  abschluss: {
    betreff: 'Τελικό τιμολόγιο {nummer} - Ferienhaus Mantinia Hills',
    text: `Αγαπητέ/ή {vorname} {nachname},

η διαμονή σας από **{anreise}** έως **{abreise}** πλησιάζει. Στο συνημμένο θα βρείτε το τελικό τιμολόγιο για το υπόλοιπο ποσό των **{betrag}**.

Παρακαλούμε καταβάλετε το ποσό το αργότερο έως **{faellig_bis}**. Ανυπομονούμε να σας υποδεχθούμε!

Με εγκάρδιους χαιρετισμούς
Η ομάδα του Ferienhaus Mantinia Hills`,
  },
  storno: {
    betreff: 'Ακύρωση της κράτησής σας {nummer} - Ferienhaus Mantinia Hills',
    text: `Αγαπητέ/ή {vorname} {nachname},

με το παρόν επιβεβαιώνουμε την ακύρωση της κράτησής σας για το διάστημα **{anreise}** έως **{abreise}**. Τις λεπτομέρειες θα βρείτε στο συνημμένο τιμολόγιο ακύρωσης.

Λυπούμαστε που η διαμονή σας δεν θα πραγματοποιηθεί και θα χαρούμε να σας καλωσορίσουμε σε άλλη χρονική στιγμή.

Με εγκάρδιους χαιρετισμούς
Η ομάδα του Ferienhaus Mantinia Hills`,
  },
}

export const MAIL_VORLAGEN_DEFAULTS: MailVorlagen = DE
export const MAIL_VORLAGEN_DEFAULTS_ALLE: MailVorlagenSprachen = { de: DE, en: EN, gr: GR }

/** Sprach-Reihenfolge + Anzeigename für den Sprach-Umschalter der Einstellungen. */
export const MAIL_SPRACHEN: { code: 'de' | 'en' | 'gr'; label: string }[] = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'gr', label: 'Ελληνικά' },
]

/** Beschriftung + verfügbare Platzhalter je Vorlage (für die Einstellungsseite). */
export const MAIL_VORLAGEN_INFO: Record<keyof MailVorlagen, { label: string; wann: string; platzhalter: string[] }> = {
  angebot: {
    label: 'Angebot',
    wann: 'beim Erstellen & Senden eines Angebots',
    platzhalter: ['vorname', 'nachname', 'anreise', 'abreise', 'nummer', 'gueltig_bis', 'button'],
  },
  annahme: {
    label: 'Buchungsbestätigung (Angebot online angenommen)',
    wann: 'automatisch, wenn der Gast in der Angebots-Mail auf „Angebot annehmen" klickt',
    platzhalter: ['vorname', 'nachname', 'anreise', 'abreise', 'angebot_nummer', 'nummer', 'betrag'],
  },
  anzahlung: {
    label: 'Anzahlungsrechnung (manuell erstellt)',
    wann: 'beim manuellen Erstellen & Senden der Anzahlungsrechnung',
    platzhalter: ['vorname', 'nachname', 'anreise', 'abreise', 'nummer', 'betrag'],
  },
  abschluss: {
    label: 'Abschlussrechnung',
    wann: 'beim Erstellen & Senden der Abschlussrechnung (Restbetrag)',
    platzhalter: ['vorname', 'nachname', 'anreise', 'abreise', 'nummer', 'betrag', 'faellig_bis'],
  },
  storno: {
    label: 'Stornierung',
    wann: 'beim Stornieren mit Stornorechnung',
    platzhalter: ['vorname', 'nachname', 'anreise', 'abreise', 'nummer'],
  },
}

function einVorlagensatz(gespeichert?: Partial<MailVorlagen>): MailVorlagen {
  const ergebnis = {} as MailVorlagen
  for (const key of Object.keys(DE) as (keyof MailVorlagen)[]) {
    ergebnis[key] = { ...DE[key], ...gespeichert?.[key] }
  }
  return ergebnis
}

/**
 * Gespeicherte Vorlagen mit Defaults auffüllen — je Sprache. Akzeptiert auch die
 * ALTE flache Struktur (nur ein Satz ohne Sprach-Ebene) und behandelt sie als de.
 */
export function mitVorlagenDefaults(gespeichert?: unknown): MailVorlagenSprachen {
  const g = (gespeichert ?? {}) as Record<string, unknown>
  // Legacy-Erkennung: alte flache Struktur hat direkt `angebot` statt `de`.
  const istFlach = g && typeof g === 'object' && 'angebot' in g && !('de' in g)
  const proSprache = istFlach
    ? { de: g as Partial<MailVorlagen>, en: undefined, gr: undefined }
    : (g as Partial<Record<'de' | 'en' | 'gr', Partial<MailVorlagen>>>)
  const basis: MailVorlagenSprachen = { de: DE, en: EN, gr: GR }
  return {
    de: { ...basis.de, ...einVorlagensatz(proSprache?.de) },
    en: { ...basis.en, ...einVorlagensatz(proSprache?.en ?? EN) },
    gr: { ...basis.gr, ...einVorlagensatz(proSprache?.gr ?? GR) },
  }
}

function ersetzePlatzhalter(text: string, werte: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (voll, name) => (name in werte ? werte[name] : voll))
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Klartext (Absätze durch Leerzeilen, **fett**) → einfaches Mail-HTML. */
export function textZuMailHtml(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((absatz) =>
      `<p>${escapeHtml(absatz.trim())
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

/**
 * Vorlage füllen: Platzhalter ersetzen, Text zu HTML wandeln, HTML-Blöcke
 * (z. B. der Annahme-Button) einsetzen — fehlt deren Platzhalter im Text,
 * werden sie ans Ende angehängt.
 */
export function renderMailVorlage(
  vorlage: MailVorlage,
  werte: Record<string, string>,
  bloecke: Record<string, string> = {},
): { betreff: string; html: string } {
  const betreff = ersetzePlatzhalter(vorlage.betreff, werte)
  let html = textZuMailHtml(ersetzePlatzhalter(vorlage.text, werte))
  for (const [name, blockHtml] of Object.entries(bloecke)) {
    const alleinImAbsatz = `<p>{${name}}</p>`
    const marker = `{${name}}`
    if (html.includes(alleinImAbsatz)) html = html.split(alleinImAbsatz).join(blockHtml)
    else if (html.includes(marker)) html = html.split(marker).join(blockHtml)
    else html += '\n' + blockHtml
  }
  return { betreff, html }
}
