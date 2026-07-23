// Übersetzungen für die PDF-Dokumente (de/en/gr). DE ist unverändert zur
// bisherigen Fassung; EN/GR sind Erstübersetzungen (GR bitte prüfen lassen).
// Beträge bleiben im EUR-Format (€) mit Komma-Dezimalstellen für alle Sprachen.

import type { Sprache } from '../lib/types'

const zahlDE = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export function eur(n: number): string {
  return zahlDE.format(n) + ' €'
}

/** Datum je Sprache: de -> TT.MM.JJJJ, en/gr -> TT/MM/JJJJ. */
export function datumL(iso: string | null | undefined, lang: Sprache): string {
  if (!iso) return '–'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return lang === 'de' ? `${d}.${m}.${y}` : `${d}/${m}/${y}`
}

function naechte(n: number, lang: Sprache): string {
  if (lang === 'de') return `${n} ${n === 1 ? 'Nacht' : 'Nächte'}`
  if (lang === 'en') return `${n} ${n === 1 ? 'night' : 'nights'}`
  return `${n} ${n === 1 ? 'διανυκτέρευση' : 'διανυκτερεύσεις'}`
}
function personen(n: number, lang: Sprache): string {
  if (lang === 'de') return `${n} ${n === 1 ? 'Person' : 'Personen'}`
  if (lang === 'en') return `${n} ${n === 1 ? 'person' : 'people'}`
  return `${n} ${n === 1 ? 'άτομο' : 'άτομα'}`
}

export interface PdfTexte {
  // Layout
  datum: string
  spBezeichnung: string
  spMenge: string
  spEinzelpreis: string
  spBetrag: string
  giroTitel: string
  giroText: string
  bankLabel: string
  // Positions-/Nebentexte
  endreinigung: string
  transfer: (label: string) => string
  uebernachtung: (saison: string, naechteN: number, personenN: number, satz: number) => string
  // Angebot
  angebotTitel: (n: string) => string
  angebotNummer: (n: string) => string
  angebotIntro: (objekt: string) => string
  angebotZeitraum: (von: string, bis: string, naechteN: number, personenN: number) => string
  gesamtbetrag: string
  angebotGueltig: (bis: string) => string
  angebotAnnahme: string
  // Rechnungs-Nummernlabel
  rechnung: (n: string) => string
  // Anzahlung
  anzahlungTitel: (n: string) => string
  anzahlungPos: (prozent: number, von: string, bis: string, an: string, gesamtEur: string) => string
  anzahlungIntro: (an: string) => string
  zuZahlenderBetrag: string
  bitteUeberweisenIban: (iban: string, nummer: string) => string
  bitteUeberweisenOhne: (nummer: string) => string
  restVorAnreise: (rest: string) => string
  // Abschluss
  abschlussTitel: (n: string) => string
  abschlussPos: (von: string, bis: string, an: string, gesamtEur: string, anzahlungEur: string) => string
  abschlussIntro: (von: string, bis: string) => string
  gesamtAufenthalt: string
  bereitsAnzahlung: string
  zuZahlenderRest: string
  bitteRestIban: (bis: string, iban: string, nummer: string) => string
  bitteRestOhne: (bis: string, nummer: string) => string
  freuenAufenthalt: string
  // Storno
  stornoTitel: (n: string) => string
  stornoPos: (prozent: number, wann: string, von: string, bis: string, basisEur: string, an: string) => string
  stornoTageVor: (tage: number) => string
  stornoNachTermin: string
  stornoIntro: (von: string, bis: string) => string
  stornogebuehr: string
  abzueglich: (label: string, nummer: string) => string
  anzahlungLabel: string
  zahlungenLabel: string
  guthaben: string
  bitteRestforderungIban: (iban: string, nummer: string) => string
  bitteRestforderungOhne: (nummer: string) => string
  bitteBetragIban: (iban: string, nummer: string) => string
  bitteBetragOhne: (nummer: string) => string
  guthabenText: (betrag: string) => string
  stornoBedauern: string
}

const DE: PdfTexte = {
  datum: 'Datum:',
  spBezeichnung: 'Bezeichnung', spMenge: 'Menge', spEinzelpreis: 'Einzelpreis', spBetrag: 'Betrag',
  giroTitel: 'Bequem zahlen per Banking-App',
  giroText: 'Giro-Code mit Ihrer Banking-App scannen — Empfänger, IBAN, Betrag und Verwendungszweck werden automatisch übernommen.',
  bankLabel: 'Bankverbindung',
  endreinigung: 'Endreinigung',
  transfer: (l) => `Flughafentransfer (${l})`,
  uebernachtung: (s, n, p, satz) => `Übernachtung ${s}: ${naechte(n, 'de')} × ${p} Pers. × ${satz} €`,
  angebotTitel: (n) => `Angebot ${n}`,
  angebotNummer: (n) => `Angebot ${n}`,
  angebotIntro: (o) => `vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot für Ihren Aufenthalt im ${o}:`,
  angebotZeitraum: (von, bis, n, p) => `Zeitraum: ${von} – ${bis} (${naechte(n, 'de')}) · ${personen(p, 'de')}`,
  gesamtbetrag: 'Gesamtbetrag',
  angebotGueltig: (bis) => `Dieses Angebot ist freibleibend und gültig bis ${bis}.`,
  angebotAnnahme: 'Zur Annahme genügt eine kurze Bestätigung per E-Mail. Nach Annahme erhalten Sie eine Anzahlungsrechnung; mit Eingang der Anzahlung ist Ihre Buchung verbindlich reserviert.',
  rechnung: (n) => `Rechnung ${n}`,
  anzahlungTitel: (n) => `Anzahlungsrechnung ${n}`,
  anzahlungPos: (pz, von, bis, an, g) => `Anzahlung ${pz} % auf Buchung ${von} – ${bis} (gemäß Angebot ${an}, Gesamtbetrag ${g})`,
  anzahlungIntro: (an) => `vielen Dank für die Annahme unseres Angebots ${an}. Zur verbindlichen Reservierung Ihres Aufenthalts berechnen wir folgende Anzahlung:`,
  zuZahlenderBetrag: 'Zu zahlender Betrag',
  bitteUeberweisenIban: (iban, n) => `Bitte überweisen Sie den Betrag auf das unten angegebene Konto (IBAN ${iban}) unter Angabe der Rechnungsnummer ${n}.`,
  bitteUeberweisenOhne: (n) => `Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer ${n}.`,
  restVorAnreise: (r) => `Der Restbetrag von ${r} wird vor Anreise fällig.`,
  abschlussTitel: (n) => `Abschlussrechnung ${n}`,
  abschlussPos: (von, bis, an, g, az) => `Restbetrag für Aufenthalt ${von} – ${bis} (gemäß Angebot ${an}, Gesamtbetrag ${g}, abzüglich Anzahlung ${az})`,
  abschlussIntro: (von, bis) => `Ihr Aufenthalt vom ${von} bis ${bis} steht bevor. Hiermit stellen wir Ihnen den noch offenen Restbetrag in Rechnung:`,
  gesamtAufenthalt: 'Gesamtbetrag Aufenthalt',
  bereitsAnzahlung: 'bereits gezahlte Anzahlung',
  zuZahlenderRest: 'Zu zahlender Restbetrag',
  bitteRestIban: (bis, iban, n) => `Bitte überweisen Sie den Restbetrag bis spätestens ${bis} auf das unten angegebene Konto (IBAN ${iban}) unter Angabe der Rechnungsnummer ${n}.`,
  bitteRestOhne: (bis, n) => `Bitte überweisen Sie den Restbetrag bis spätestens ${bis} unter Angabe der Rechnungsnummer ${n}.`,
  freuenAufenthalt: 'Wir freuen uns sehr auf Ihren Aufenthalt!',
  stornoTitel: (n) => `Stornorechnung ${n}`,
  stornoPos: (pz, wann, von, bis, basis, an) => `Stornogebühr ${pz} % (Stornierung ${wann}) auf Buchung ${von} – ${bis}, ${basis} gemäß Angebot ${an}`,
  stornoTageVor: (t) => `${t} Tage vor Anreise`,
  stornoNachTermin: 'nach Anreisetermin',
  stornoIntro: (von, bis) => `hiermit bestätigen wir die Stornierung Ihrer Buchung für den Zeitraum ${von} – ${bis}. Gemäß unseren Stornobedingungen berechnen wir:`,
  stornogebuehr: 'Stornogebühr',
  abzueglich: (label, nr) => `abzüglich erhaltener ${label}${nr ? ` (${nr})` : ''}`,
  anzahlungLabel: 'Anzahlung',
  zahlungenLabel: 'Zahlungen',
  guthaben: 'Guthaben zu Ihren Gunsten',
  bitteRestforderungIban: (iban, n) => `Bitte überweisen Sie den Restbetrag auf das unten angegebene Konto (IBAN ${iban}) unter Angabe der Rechnungsnummer ${n}.`,
  bitteRestforderungOhne: (n) => `Bitte überweisen Sie den Restbetrag unter Angabe der Rechnungsnummer ${n}.`,
  bitteBetragIban: (iban, n) => `Bitte überweisen Sie den Betrag auf das unten angegebene Konto (IBAN ${iban}) unter Angabe der Rechnungsnummer ${n}.`,
  bitteBetragOhne: (n) => `Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer ${n}.`,
  guthabenText: (b) => `Die erhaltene Anzahlung übersteigt die Stornogebühr. Wir erstatten Ihnen den Betrag von ${b} auf Ihr Konto zurück. Bitte teilen Sie uns hierfür Ihre Bankverbindung mit.`,
  stornoBedauern: 'Wir bedauern, dass Ihr Aufenthalt nicht zustande kommt, und würden uns freuen, Sie zu einem anderen Zeitpunkt begrüßen zu dürfen.',
}

const EN: PdfTexte = {
  datum: 'Date:',
  spBezeichnung: 'Description', spMenge: 'Qty', spEinzelpreis: 'Unit price', spBetrag: 'Amount',
  giroTitel: 'Pay easily via your banking app',
  giroText: 'Scan the giro code with your banking app — payee, IBAN, amount and reference are filled in automatically.',
  bankLabel: 'Bank details',
  endreinigung: 'Final cleaning',
  transfer: (l) => `Airport transfer (${l})`,
  uebernachtung: (s, n, p, satz) => `Accommodation ${s}: ${naechte(n, 'en')} × ${p} pers. × ${satz} €`,
  angebotTitel: (n) => `Offer ${n}`,
  angebotNummer: (n) => `Offer ${n}`,
  angebotIntro: (o) => `thank you for your enquiry. We are pleased to offer you the following for your stay at ${o}:`,
  angebotZeitraum: (von, bis, n, p) => `Period: ${von} – ${bis} (${naechte(n, 'en')}) · ${personen(p, 'en')}`,
  gesamtbetrag: 'Total amount',
  angebotGueltig: (bis) => `This offer is without obligation and valid until ${bis}.`,
  angebotAnnahme: 'A short confirmation by email is enough to accept. After acceptance you will receive a deposit invoice; once the deposit is received, your booking is bindingly reserved.',
  rechnung: (n) => `Invoice ${n}`,
  anzahlungTitel: (n) => `Deposit invoice ${n}`,
  anzahlungPos: (pz, von, bis, an, g) => `Deposit ${pz}% on booking ${von} – ${bis} (per offer ${an}, total ${g})`,
  anzahlungIntro: (an) => `thank you for accepting our offer ${an}. To bindingly reserve your stay we charge the following deposit:`,
  zuZahlenderBetrag: 'Amount payable',
  bitteUeberweisenIban: (iban, n) => `Please transfer the amount to the account below (IBAN ${iban}), quoting invoice number ${n}.`,
  bitteUeberweisenOhne: (n) => `Please transfer the amount quoting invoice number ${n}.`,
  restVorAnreise: (r) => `The remaining balance of ${r} is due before arrival.`,
  abschlussTitel: (n) => `Final invoice ${n}`,
  abschlussPos: (von, bis, an, g, az) => `Remaining balance for stay ${von} – ${bis} (per offer ${an}, total ${g}, less deposit ${az})`,
  abschlussIntro: (von, bis) => `your stay from ${von} to ${bis} is coming up. We hereby invoice the outstanding balance:`,
  gesamtAufenthalt: 'Total for stay',
  bereitsAnzahlung: 'deposit already paid',
  zuZahlenderRest: 'Remaining balance payable',
  bitteRestIban: (bis, iban, n) => `Please transfer the remaining balance by ${bis} at the latest to the account below (IBAN ${iban}), quoting invoice number ${n}.`,
  bitteRestOhne: (bis, n) => `Please transfer the remaining balance by ${bis} at the latest, quoting invoice number ${n}.`,
  freuenAufenthalt: 'We very much look forward to your stay!',
  stornoTitel: (n) => `Cancellation invoice ${n}`,
  stornoPos: (pz, wann, von, bis, basis, an) => `Cancellation fee ${pz}% (cancellation ${wann}) on booking ${von} – ${bis}, ${basis} per offer ${an}`,
  stornoTageVor: (t) => `${t} days before arrival`,
  stornoNachTermin: 'after the arrival date',
  stornoIntro: (von, bis) => `we hereby confirm the cancellation of your booking for the period ${von} – ${bis}. In accordance with our cancellation terms we charge:`,
  stornogebuehr: 'Cancellation fee',
  abzueglich: (label, nr) => `less received ${label}${nr ? ` (${nr})` : ''}`,
  anzahlungLabel: 'deposit',
  zahlungenLabel: 'payments',
  guthaben: 'Credit in your favour',
  bitteRestforderungIban: (iban, n) => `Please transfer the remaining balance to the account below (IBAN ${iban}), quoting invoice number ${n}.`,
  bitteRestforderungOhne: (n) => `Please transfer the remaining balance quoting invoice number ${n}.`,
  bitteBetragIban: (iban, n) => `Please transfer the amount to the account below (IBAN ${iban}), quoting invoice number ${n}.`,
  bitteBetragOhne: (n) => `Please transfer the amount quoting invoice number ${n}.`,
  guthabenText: (b) => `The deposit received exceeds the cancellation fee. We will refund the amount of ${b} to your account. Please let us know your bank details for this.`,
  stornoBedauern: 'We are sorry that your stay will not take place and would be delighted to welcome you at another time.',
}

const GR: PdfTexte = {
  datum: 'Ημερομηνία:',
  spBezeichnung: 'Περιγραφή', spMenge: 'Ποσ.', spEinzelpreis: 'Τιμή μονάδας', spBetrag: 'Ποσό',
  giroTitel: 'Εύκολη πληρωμή μέσω της εφαρμογής της τράπεζάς σας',
  giroText: 'Σαρώστε τον κωδικό giro με την εφαρμογή της τράπεζάς σας — δικαιούχος, IBAN, ποσό και αιτιολογία συμπληρώνονται αυτόματα.',
  bankLabel: 'Τραπεζικά στοιχεία',
  endreinigung: 'Τελικός καθαρισμός',
  transfer: (l) => `Μεταφορά από/προς αεροδρόμιο (${l})`,
  uebernachtung: (s, n, p, satz) => `Διαμονή ${s}: ${naechte(n, 'gr')} × ${p} άτ. × ${satz} €`,
  angebotTitel: (n) => `Προσφορά ${n}`,
  angebotNummer: (n) => `Προσφορά ${n}`,
  angebotIntro: (o) => `σας ευχαριστούμε για το αίτημά σας. Με χαρά σας προτείνουμε την ακόλουθη προσφορά για τη διαμονή σας στο ${o}:`,
  angebotZeitraum: (von, bis, n, p) => `Διάστημα: ${von} – ${bis} (${naechte(n, 'gr')}) · ${personen(p, 'gr')}`,
  gesamtbetrag: 'Συνολικό ποσό',
  angebotGueltig: (bis) => `Η παρούσα προσφορά είναι χωρίς δέσμευση και ισχύει έως ${bis}.`,
  angebotAnnahme: 'Για την αποδοχή αρκεί μια σύντομη επιβεβαίωση μέσω email. Μετά την αποδοχή θα λάβετε τιμολόγιο προκαταβολής· με την είσπραξη της προκαταβολής η κράτησή σας είναι δεσμευτικά εξασφαλισμένη.',
  rechnung: (n) => `Τιμολόγιο ${n}`,
  anzahlungTitel: (n) => `Τιμολόγιο προκαταβολής ${n}`,
  anzahlungPos: (pz, von, bis, an, g) => `Προκαταβολή ${pz}% επί κράτησης ${von} – ${bis} (βάσει προσφοράς ${an}, σύνολο ${g})`,
  anzahlungIntro: (an) => `σας ευχαριστούμε για την αποδοχή της προσφοράς μας ${an}. Για την οριστική κράτηση της διαμονής σας χρεώνουμε την ακόλουθη προκαταβολή:`,
  zuZahlenderBetrag: 'Πληρωτέο ποσό',
  bitteUeberweisenIban: (iban, n) => `Παρακαλούμε καταβάλετε το ποσό στον παρακάτω λογαριασμό (IBAN ${iban}), αναφέροντας τον αριθμό τιμολογίου ${n}.`,
  bitteUeberweisenOhne: (n) => `Παρακαλούμε καταβάλετε το ποσό αναφέροντας τον αριθμό τιμολογίου ${n}.`,
  restVorAnreise: (r) => `Το υπόλοιπο ποσό των ${r} καθίσταται απαιτητό πριν την άφιξη.`,
  abschlussTitel: (n) => `Τελικό τιμολόγιο ${n}`,
  abschlussPos: (von, bis, an, g, az) => `Υπόλοιπο για διαμονή ${von} – ${bis} (βάσει προσφοράς ${an}, σύνολο ${g}, μείον προκαταβολή ${az})`,
  abschlussIntro: (von, bis) => `η διαμονή σας από ${von} έως ${bis} πλησιάζει. Με το παρόν τιμολογούμε το εκκρεμές υπόλοιπο:`,
  gesamtAufenthalt: 'Συνολικό ποσό διαμονής',
  bereitsAnzahlung: 'ήδη καταβληθείσα προκαταβολή',
  zuZahlenderRest: 'Πληρωτέο υπόλοιπο',
  bitteRestIban: (bis, iban, n) => `Παρακαλούμε καταβάλετε το υπόλοιπο το αργότερο έως ${bis} στον παρακάτω λογαριασμό (IBAN ${iban}), αναφέροντας τον αριθμό τιμολογίου ${n}.`,
  bitteRestOhne: (bis, n) => `Παρακαλούμε καταβάλετε το υπόλοιπο το αργότερο έως ${bis}, αναφέροντας τον αριθμό τιμολογίου ${n}.`,
  freuenAufenthalt: 'Ανυπομονούμε πολύ για τη διαμονή σας!',
  stornoTitel: (n) => `Τιμολόγιο ακύρωσης ${n}`,
  stornoPos: (pz, wann, von, bis, basis, an) => `Χρέωση ακύρωσης ${pz}% (ακύρωση ${wann}) επί κράτησης ${von} – ${bis}, ${basis} βάσει προσφοράς ${an}`,
  stornoTageVor: (t) => `${t} ημέρες πριν την άφιξη`,
  stornoNachTermin: 'μετά την ημερομηνία άφιξης',
  stornoIntro: (von, bis) => `με το παρόν επιβεβαιώνουμε την ακύρωση της κράτησής σας για το διάστημα ${von} – ${bis}. Σύμφωνα με τους όρους ακύρωσης χρεώνουμε:`,
  stornogebuehr: 'Χρέωση ακύρωσης',
  abzueglich: (label, nr) => `μείον εισπραχθείσα ${label}${nr ? ` (${nr})` : ''}`,
  anzahlungLabel: 'προκαταβολή',
  zahlungenLabel: 'πληρωμές',
  guthaben: 'Πίστωση υπέρ υμών',
  bitteRestforderungIban: (iban, n) => `Παρακαλούμε καταβάλετε το υπόλοιπο στον παρακάτω λογαριασμό (IBAN ${iban}), αναφέροντας τον αριθμό τιμολογίου ${n}.`,
  bitteRestforderungOhne: (n) => `Παρακαλούμε καταβάλετε το υπόλοιπο αναφέροντας τον αριθμό τιμολογίου ${n}.`,
  bitteBetragIban: (iban, n) => `Παρακαλούμε καταβάλετε το ποσό στον παρακάτω λογαριασμό (IBAN ${iban}), αναφέροντας τον αριθμό τιμολογίου ${n}.`,
  bitteBetragOhne: (n) => `Παρακαλούμε καταβάλετε το ποσό αναφέροντας τον αριθμό τιμολογίου ${n}.`,
  guthabenText: (b) => `Η εισπραχθείσα προκαταβολή υπερβαίνει τη χρέωση ακύρωσης. Θα σας επιστρέψουμε το ποσό των ${b} στον λογαριασμό σας. Παρακαλούμε γνωστοποιήστε μας τα τραπεζικά σας στοιχεία.`,
  stornoBedauern: 'Λυπούμαστε που η διαμονή σας δεν θα πραγματοποιηθεί και θα χαρούμε να σας καλωσορίσουμε σε άλλη χρονική στιγμή.',
}

const ALLE: Record<Sprache, PdfTexte> = { de: DE, en: EN, gr: GR }

export function pdfT(lang: Sprache): PdfTexte {
  return ALLE[lang] ?? DE
}

/**
 * pdf-lib Standard-Helvetica (WinAnsi) kann KEIN Griechisch darstellen. Solange
 * kein Unicode-Font eingebettet ist, werden GR-PDFs auf Englisch gerendert —
 * E-Mails und Bestätigungsseiten (HTML) bleiben Griechisch. TODO: Noto-Font
 * einbetten, dann diese Abbildung entfernen.
 */
export function pdfLang(s: Sprache): Sprache {
  return s === 'gr' ? 'en' : s
}
