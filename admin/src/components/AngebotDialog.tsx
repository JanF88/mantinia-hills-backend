import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { angebotsPositionen, berechneAufenthalt, positionenSumme } from '../lib/preisberechnung'
import { downloadPdf, naechsteNummer, speichereDokument } from '../lib/dokumentService'
import { sendeMail, mailRahmen } from '../lib/mail'
import { renderMailVorlage } from '../lib/mailVorlagen'
import { angebotPdf } from '../pdf/dokumente'
import { datumDE, heuteISO, lokalISO } from '../lib/format'
import PositionenEditor from './PositionenEditor'
import type { Buchung, Einstellungen, Position } from '../lib/types'

interface Props {
  buchung: Buchung
  einstellungen: Einstellungen
  onFertig: () => void
  onAbbrechen: () => void
}

export default function AngebotDialog({ buchung, einstellungen, onFertig, onAbbrechen }: Props) {
  const initial = useMemo<Position[]>(() => {
    const kalk = berechneAufenthalt(buchung.anreise, buchung.abreise, buchung.personen, einstellungen)
    if (!kalk) return []
    return angebotsPositionen(kalk, buchung.personen, buchung.transfer_option, buchung.transfer_eur, einstellungen)
  }, [buchung, einstellungen])

  const [positionen, setPositionen] = useState<Position[]>(initial)
  const [gueltigBis, setGueltigBis] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + einstellungen.angebot_gueltig_tage)
    return lokalISO(d)
  })
  const [senden, setSenden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [versandHinweis, setVersandHinweis] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  async function erstellen() {
    if (positionen.length === 0 || positionen.some((p) => !p.bezeichnung.trim())) {
      setFehler('Bitte mindestens eine Position mit Bezeichnung angeben.')
      return
    }
    setLaedt(true)
    setFehler(null)
    try {
      const nummer = await naechsteNummer('AN')
      const datumISO = heuteISO()
      const bytes = await angebotPdf(buchung, nummer, datumISO, positionen, gueltigBis, einstellungen)
      await speichereDokument({
        buchungId: buchung.id,
        typ: 'angebot',
        nummer,
        datumISO,
        positionen,
        gesamt: positionenSumme(positionen),
        meta: { gueltig_bis: gueltigBis },
        pdfBytes: bytes,
      })
      const token = crypto.randomUUID()
      const { error } = await supabase.from('buchungen').update({ status: 'angebot_erstellt', annahme_token: token }).eq('id', buchung.id)
      if (error) throw error
      downloadPdf(bytes, `${nummer}_Mantinia_Hills.pdf`)

      if (senden) {
        // Auf die Bestätigungsseite der App verlinken (NICHT direkt auf die
        // Funktion) — dort bestätigt der Gast bewusst per Klick. So nimmt kein
        // automatischer Mail-/Virenscanner das Angebot versehentlich an.
        const annahmeUrl = `${window.location.origin}/angebot-annehmen?token=${token}`
        const annahmeButton = `<table cellpadding="0" cellspacing="0" border="0" style="margin:22px 0"><tr><td style="border-radius:8px;background:#681318">
<a href="${annahmeUrl}" target="_blank" style="display:inline-block;padding:14px 28px;color:#fff;font-weight:bold;font-size:15px;text-decoration:none;font-family:Arial,Helvetica,sans-serif">Angebot annehmen</a>
</td></tr></table>
<p style="font-size:13px;color:#666">Falls der Button nicht funktioniert, kopieren Sie bitte diesen Link in Ihren Browser:<br><a href="${annahmeUrl}">${annahmeUrl}</a></p>`
        const { betreff, html } = renderMailVorlage(einstellungen.mail_vorlagen.angebot, {
          vorname: buchung.vorname,
          nachname: buchung.nachname,
          anreise: datumDE(buchung.anreise),
          abreise: datumDE(buchung.abreise),
          nummer,
          gueltig_bis: datumDE(gueltigBis),
        }, { button: annahmeButton })
        try {
          await sendeMail({
            an: buchung.email,
            betreff,
            html: mailRahmen(html, einstellungen.anbieter),
            anhangBytes: bytes,
            anhangName: `${nummer}_Angebot_Mantinia_Hills.pdf`,
            kopieAnMich: true,
          })
        } catch (mailErr) {
          setVersandHinweis(
            'Das Angebot wurde erstellt und heruntergeladen, aber der E-Mail-Versand schlug fehl: ' +
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
          <h2>Angebot erstellt</h2>
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
      <div className="dialog">
        <h2>Angebot erstellen</h2>
        <p style={{ color: 'var(--grau)', fontSize: 14 }}>
          Positionen sind aus der Saisonkalkulation vorbefüllt und frei anpassbar (Rabatte, Zusatzleistungen …).
        </p>
        <PositionenEditor positionen={positionen} onChange={setPositionen} />
        <label htmlFor="gueltig">Angebot gültig bis</label>
        <input id="gueltig" type="date" style={{ maxWidth: 200 }} value={gueltigBis} onChange={(e) => setGueltigBis(e.target.value)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={senden} onChange={(e) => setSenden(e.target.checked)} />
          Angebot per E-Mail an <strong>{buchung.email}</strong> senden (Kopie an dich)
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
