import { useMemo, useState } from 'react'
import { abschlussrechnungPdf } from '../pdf/dokumente'
import { downloadPdf, naechsteNummer, speichereDokument } from '../lib/dokumentService'
import { sendeMail, mailRahmen } from '../lib/mail'
import { datumDE, eur, heuteISO } from '../lib/format'
import type { Buchung, Dokument, Einstellungen } from '../lib/types'

interface Props {
  buchung: Buchung
  /** Jüngstes Angebot — Basis für den Gesamtbetrag. */
  angebot: Dokument
  /** Jüngste Anzahlungsrechnung (wird vom Restbetrag abgezogen). */
  anzahlung: Dokument | null
  einstellungen: Einstellungen
  onFertig: () => void
  onAbbrechen: () => void
}

export default function AbschlussDialog({ buchung, angebot, anzahlung, einstellungen, onFertig, onAbbrechen }: Props) {
  const gesamt = Number(angebot.gesamt)
  const anzahlungBetrag = anzahlung ? Number(anzahlung.gesamt) : 0
  const restbetrag = Math.round((gesamt - anzahlungBetrag) * 100) / 100

  const faelligBis = useMemo(() => {
    const d = new Date(buchung.anreise + 'T00:00:00')
    d.setDate(d.getDate() - einstellungen.restzahlung_faellig_tage)
    return d.toISOString().slice(0, 10)
  }, [buchung.anreise, einstellungen.restzahlung_faellig_tage])

  const [senden, setSenden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [versandHinweis, setVersandHinweis] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  async function erstellen() {
    if (restbetrag <= 0) {
      setFehler('Der Restbetrag ist 0 € oder negativ – es ist keine Abschlussrechnung nötig.')
      return
    }
    setLaedt(true)
    setFehler(null)
    try {
      const nummer = await naechsteNummer('RE')
      const datumISO = heuteISO()
      const bytes = await abschlussrechnungPdf(
        buchung, nummer, datumISO, angebot.nummer, gesamt, anzahlungBetrag, restbetrag, faelligBis, einstellungen,
      )
      await speichereDokument({
        buchungId: buchung.id,
        typ: 'abschlussrechnung',
        nummer,
        datumISO,
        positionen: [{ bezeichnung: `Restbetrag auf Angebot ${angebot.nummer}`, menge: 1, einzelpreis: restbetrag, betrag: restbetrag }],
        gesamt: restbetrag,
        meta: { angebot_nummer: angebot.nummer, basisbetrag: gesamt, anzahlung: anzahlungBetrag, faellig_bis: faelligBis },
        pdfBytes: bytes,
      })
      downloadPdf(bytes, `${nummer}_Abschluss_Mantinia_Hills.pdf`)

      if (senden) {
        try {
          await sendeMail({
            an: buchung.email,
            betreff: `Abschlussrechnung ${nummer} - Ferienhaus Mantinia Hills`,
            html: mailRahmen(
              `<p>Guten Tag ${buchung.vorname} ${buchung.nachname},</p>
<p>Ihr Aufenthalt vom <strong>${datumDE(buchung.anreise)}</strong> bis <strong>${datumDE(buchung.abreise)}</strong> steht bevor. Im Anhang finden Sie die Abschlussrechnung über den offenen Restbetrag von <strong>${eur(restbetrag)}</strong>.</p>
<p>Bitte überweisen Sie den Betrag bis spätestens <strong>${datumDE(faelligBis)}</strong>. Wir freuen uns sehr auf Ihren Besuch!</p>
<p>Herzliche Grüße<br>Ihr Team vom Ferienhaus Mantinia Hills</p>`,
              einstellungen.anbieter,
            ),
            anhangBytes: bytes,
            anhangName: `${nummer}_Abschluss_Mantinia_Hills.pdf`,
            kopieAnMich: true,
          })
        } catch (mailErr) {
          setVersandHinweis(
            'Die Abschlussrechnung wurde erstellt und heruntergeladen, aber der E-Mail-Versand schlug fehl: ' +
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
          <h2>Abschlussrechnung erstellt</h2>
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
        <h2>Abschlussrechnung erstellen</h2>
        <div className="hinweis">
          Gesamt (Angebot {angebot.nummer}): <strong>{eur(gesamt)}</strong><br />
          abzüglich Anzahlung: <strong>{eur(anzahlungBetrag)}</strong><br />
          Restbetrag: <strong>{eur(restbetrag)}</strong><br />
          Zahlungsziel: <strong>{datumDE(faelligBis)}</strong> ({einstellungen.restzahlung_faellig_tage} Tage vor Anreise)
        </div>
        {!einstellungen.anbieter.iban && (
          <div className="warnung">Es ist noch keine IBAN hinterlegt — die Rechnung enthält keine Bankverbindung. Bitte in den Einstellungen ergänzen.</div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
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
