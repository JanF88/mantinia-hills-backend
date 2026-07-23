import { useState } from 'react'
import { anzahlungsrechnungPdf } from '../pdf/dokumente'
import { downloadPdf, naechsteNummer, speichereDokument, markiereVersendet } from '../lib/dokumentService'
import { sendeMail, mailRahmen } from '../lib/mail'
import { renderMailVorlage } from '../lib/mailVorlagen'
import { datumDE, eur, heuteISO } from '../lib/format'
import type { Buchung, Dokument, Einstellungen } from '../lib/types'

interface Props {
  buchung: Buchung
  /** Jüngstes Angebots-Dokument — Basis für den Anzahlungsbetrag. */
  angebot: Dokument
  einstellungen: Einstellungen
  onFertig: () => void
  onAbbrechen: () => void
}

export default function AnzahlungDialog({ buchung, angebot, einstellungen, onFertig, onAbbrechen }: Props) {
  const basis = Number(angebot.gesamt)
  const [prozent, setProzent] = useState(einstellungen.anzahlung_prozent_default)
  const [betrag, setBetrag] = useState(() =>
    Math.round(basis * einstellungen.anzahlung_prozent_default) / 100,
  )
  const [senden, setSenden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [versandHinweis, setVersandHinweis] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  function prozentAendern(wert: string) {
    const p = parseFloat(wert.replace(',', '.'))
    if (isNaN(p)) return
    setProzent(p)
    setBetrag(Math.round(basis * p) / 100)
  }

  function betragAendern(wert: string) {
    const b = parseFloat(wert.replace(',', '.'))
    if (isNaN(b)) return
    const gerundet = Math.round(b * 100) / 100 // auf Cent runden (sonst 1-Cent-Differenz zum Restbetrag)
    setBetrag(gerundet)
    setProzent(Math.round((gerundet / basis) * 10000) / 100)
  }

  async function erstellen() {
    if (betrag <= 0) {
      setFehler('Betrag muss größer als 0 sein.')
      return
    }
    setLaedt(true)
    setFehler(null)
    try {
      const nummer = await naechsteNummer('RE')
      const datumISO = heuteISO()
      const bytes = await anzahlungsrechnungPdf(
        buchung, nummer, datumISO, angebot.nummer, basis, betrag, prozent, einstellungen,
      )
      const doc = await speichereDokument({
        buchungId: buchung.id,
        typ: 'anzahlungsrechnung',
        nummer,
        datumISO,
        positionen: [{
          bezeichnung: `Anzahlung ${prozent} % auf Angebot ${angebot.nummer}`,
          menge: 1,
          einzelpreis: betrag,
          betrag,
        }],
        gesamt: betrag,
        meta: { anzahlung_prozent: prozent, angebot_nummer: angebot.nummer, basisbetrag: basis },
        pdfBytes: bytes,
      })
      downloadPdf(bytes, `${nummer}_Anzahlung_Mantinia_Hills.pdf`)

      if (senden) {
        const { betreff, html } = renderMailVorlage(einstellungen.mail_vorlagen.anzahlung, {
          vorname: buchung.vorname,
          nachname: buchung.nachname,
          anreise: datumDE(buchung.anreise),
          abreise: datumDE(buchung.abreise),
          nummer,
          betrag: eur(betrag),
        })
        try {
          await sendeMail({
            an: buchung.email,
            betreff,
            html: mailRahmen(html, einstellungen.anbieter),
            anhangBytes: bytes,
            anhangName: `${nummer}_Anzahlung_Mantinia_Hills.pdf`,
            kopieAnMich: true,
          })
          await markiereVersendet(doc.id)
        } catch (mailErr) {
          setVersandHinweis(
            'Die Rechnung wurde erstellt und heruntergeladen, aber der E-Mail-Versand schlug fehl: ' +
            (mailErr instanceof Error ? mailErr.message : String(mailErr)) +
            ' — bitte das PDF manuell versenden.',
          )
          setLaedt(false)
          return
        }
      }
      onFertig()
    } catch (err) {
      setFehler('Fehler beim Erstellen: ' + (err instanceof Error ? err.message : String(err)))
      setLaedt(false)
    }
  }

  if (versandHinweis) {
    return (
      <div className="dialog-hintergrund">
        <div className="dialog" style={{ maxWidth: 480 }}>
          <h2>Rechnung erstellt</h2>
          <div className="warnung">{versandHinweis}</div>
          <div className="dialog-aktionen">
            <button className="btn-primary" onClick={onFertig}>Schließen</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dialog-hintergrund">
      <div className="dialog" style={{ maxWidth: 480 }}>
        <h2>Anzahlungsrechnung erstellen</h2>
        <p style={{ color: 'var(--grau)', fontSize: 14 }}>
          Basis: Angebot {angebot.nummer} über <strong>{eur(basis)}</strong>
        </p>
        <div className="zeile">
          <div>
            <label htmlFor="prozent">Anzahlung %</label>
            <input id="prozent" type="number" step="1" min="0" max="100" value={prozent} onChange={(e) => prozentAendern(e.target.value)} />
          </div>
          <div>
            <label htmlFor="betrag">Betrag €</label>
            <input id="betrag" type="number" step="0.01" min="0" value={betrag} onChange={(e) => betragAendern(e.target.value)} />
          </div>
        </div>
        {!einstellungen.anbieter.iban && (
          <div className="warnung">
            Es ist noch keine IBAN hinterlegt — die Rechnung enthält keine Bankverbindung.
            Bitte in den Einstellungen ergänzen.
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={senden} onChange={(e) => setSenden(e.target.checked)} />
          Rechnung per E-Mail an <strong>{buchung.email}</strong> senden (Kopie an dich)
        </label>
        {fehler && <p className="fehler">{fehler}</p>}
        <div className="dialog-aktionen">
          <button onClick={onAbbrechen} disabled={laedt}>Abbrechen</button>
          <button className="btn-primary" onClick={erstellen} disabled={laedt}>
            {laedt ? 'Wird verarbeitet …' : senden ? 'Erstellen & senden' : 'Nur erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}
