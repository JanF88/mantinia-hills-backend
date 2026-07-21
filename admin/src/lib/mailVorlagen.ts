// E-Mail-Vorlagen (Betreff + Text) je Versandanlass, editierbar in den
// Einstellungen (Key `mail_vorlagen`). Platzhalter in geschweiften Klammern
// werden beim Versand ersetzt; **fett** wird zu <strong>; Leerzeilen trennen
// Absätze. Die Signatur (Logo + Kontakt) hängt mailRahmen() automatisch an.

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

export const MAIL_VORLAGEN_DEFAULTS: MailVorlagen = {
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

/** Gespeicherte Vorlagen mit den Defaults auffüllen (fehlende Keys/Felder ergänzen). */
export function mitVorlagenDefaults(gespeichert?: Partial<MailVorlagen>): MailVorlagen {
  const ergebnis = {} as MailVorlagen
  for (const key of Object.keys(MAIL_VORLAGEN_DEFAULTS) as (keyof MailVorlagen)[]) {
    ergebnis[key] = { ...MAIL_VORLAGEN_DEFAULTS[key], ...gespeichert?.[key] }
  }
  return ergebnis
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
