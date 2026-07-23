// Anfrage/Angebot ablehnen: Status auf „abgelehnt" setzen und optional eine
// freundliche Absage-E-Mail in der Sprache des Gastes senden.

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { sendeMail, mailRahmen } from '../lib/mail'
import { renderMailVorlage } from '../lib/mailVorlagen'
import { datumDE } from '../lib/format'
import type { Buchung, Einstellungen } from '../lib/types'

interface Props {
  buchung: Buchung
  einstellungen: Einstellungen
  onFertig: () => void
  onAbbrechen: () => void
}

export default function AbsageDialog({ buchung, einstellungen, onFertig, onAbbrechen }: Props) {
  const [senden, setSenden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [versandHinweis, setVersandHinweis] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  async function ablehnen() {
    setLaedt(true)
    setFehler(null)
    try {
      // Status zuerst setzen — dann darf die Aktion nicht mehr doppelt laufen.
      const { error } = await supabase.from('buchungen').update({ status: 'abgelehnt' }).eq('id', buchung.id)
      if (error) throw error

      if (senden) {
        const { betreff, html } = renderMailVorlage(einstellungen.mail_vorlagen[buchung.sprache].absage, {
          vorname: buchung.vorname,
          nachname: buchung.nachname,
          anreise: datumDE(buchung.anreise),
          abreise: datumDE(buchung.abreise),
        })
        try {
          await sendeMail({
            an: buchung.email,
            betreff,
            html: mailRahmen(html, einstellungen.anbieter),
            kopieAnMich: true,
          })
        } catch (mailErr) {
          setVersandHinweis(
            'Die Anfrage wurde abgelehnt, aber der E-Mail-Versand schlug fehl: ' +
            (mailErr instanceof Error ? mailErr.message : String(mailErr)) +
            ' — bitte den Gast ggf. manuell benachrichtigen.',
          )
          setLaedt(false)
          return
        }
      }
      onFertig()
    } catch (err) {
      setFehler('Fehler beim Ablehnen: ' + (err instanceof Error ? err.message : String(err)))
      setLaedt(false)
    }
  }

  if (versandHinweis) {
    return (
      <div className="dialog-hintergrund">
        <div className="dialog" style={{ maxWidth: 480 }}>
          <h2>Abgelehnt</h2>
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
        <h2>Anfrage ablehnen</h2>
        <p style={{ color: 'var(--grau)', fontSize: 14 }}>
          Die Anfrage von <strong>{buchung.vorname} {buchung.nachname}</strong> wird auf „Abgelehnt" gesetzt.
          Auf Wunsch senden wir eine freundliche Absage in der Sprache des Gastes.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={senden} onChange={(e) => setSenden(e.target.checked)} />
          Absage-E-Mail an <strong>{buchung.email}</strong> senden (Kopie an dich)
        </label>
        {fehler && <p className="fehler">{fehler}</p>}
        <div className="dialog-aktionen">
          <button onClick={onAbbrechen} disabled={laedt}>Abbrechen</button>
          <button className="btn-gefahr" onClick={ablehnen} disabled={laedt}>
            {laedt ? 'Wird verarbeitet …' : senden ? 'Ablehnen & Absage senden' : 'Ablehnen'}
          </button>
        </div>
      </div>
    </div>
  )
}
