import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { stornorechnungPdf } from '../pdf/dokumente'
import { downloadPdf, naechsteNummer, speichereDokument, markiereVersendet } from '../lib/dokumentService'
import { stornoProzent, tageVorAnreise } from '../lib/storno'
import { sendeMail, mailRahmen } from '../lib/mail'
import { renderMailVorlage } from '../lib/mailVorlagen'
import { datumDE, eur, heuteISO } from '../lib/format'
import type { Buchung, Dokument, Einstellungen } from '../lib/types'

interface Props {
  buchung: Buchung
  /** Jüngstes Angebot — Basis für die Gebührenberechnung. */
  angebot: Dokument
  /** Jüngste Anzahlungsrechnung, falls Anzahlung eingegangen ist. */
  anzahlung: Dokument | null
  einstellungen: Einstellungen
  onFertig: () => void
  onAbbrechen: () => void
}

export default function StornoDialog({ buchung, angebot, anzahlung, einstellungen, onFertig, onAbbrechen }: Props) {
  const basis = Number(angebot.gesamt)
  const tage = useMemo(() => tageVorAnreise(buchung.anreise), [buchung.anreise])
  const vorschlag = useMemo(() => stornoProzent(tage, einstellungen.storno_stufen), [tage, einstellungen])

  const [prozent, setProzent] = useState(vorschlag)
  const [ohneRechnung, setOhneRechnung] = useState(false)
  const [senden, setSenden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [versandHinweis, setVersandHinweis] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  const anzahlungEingegangen = buchung.anzahlung_eingegangen_am != null && anzahlung != null
  const vollBezahlt = buchung.status === 'bezahlt' || buchung.restzahlung_eingegangen_am != null
  const gebuehr = Math.round(basis * prozent) / 100
  const verrechnet = vollBezahlt ? basis : anzahlungEingegangen ? Number(anzahlung.gesamt) : 0
  const rest = Math.round((gebuehr - verrechnet) * 100) / 100

  async function stornieren() {
    setLaedt(true)
    setFehler(null)
    try {
      let nummer: string | null = null
      let bytes: Uint8Array | null = null
      let docId: string | null = null
      if (!ohneRechnung) {
        nummer = await naechsteNummer('RE')
        const datumISO = heuteISO()
        const storno = {
          prozent,
          tageVorAnreise: tage,
          basisbetrag: basis,
          gebuehr,
          verrechneteAnzahlung: verrechnet,
          restbetrag: rest,
          anzahlungNummer: !vollBezahlt && anzahlungEingegangen ? anzahlung.nummer : undefined,
          zahlungLabel: vollBezahlt ? 'Zahlungen' : undefined,
        }
        bytes = await stornorechnungPdf(buchung, nummer, datumISO, angebot.nummer, storno, einstellungen)
        const doc = await speichereDokument({
          buchungId: buchung.id,
          typ: 'stornorechnung',
          nummer,
          datumISO,
          positionen: [{
            bezeichnung: `Stornogebühr ${prozent} % auf Angebot ${angebot.nummer}`,
            menge: 1,
            einzelpreis: gebuehr,
            betrag: gebuehr,
          }],
          gesamt: gebuehr,
          meta: {
            storno_prozent: prozent,
            tage_vor_anreise: tage,
            basisbetrag: basis,
            verrechnete_anzahlung: verrechnet,
            restbetrag: rest,
            angebot_nummer: angebot.nummer,
          },
          pdfBytes: bytes,
        })
        docId = doc.id
        downloadPdf(bytes, `${nummer}_Storno_Mantinia_Hills.pdf`)
      }

      // Status SOFORT (vor dem Mailversand) setzen: sobald die Stornorechnung
      // existiert, darf die Aktion nicht erneut laufen — sonst entstünden bei
      // einem Fehler nach dem Versand eine zweite Rechnung und eine zweite Mail.
      const { error: statusErr } = await supabase
        .from('buchungen')
        .update({ status: 'storniert', storniert_am: new Date().toISOString() })
        .eq('id', buchung.id)
      if (statusErr) throw statusErr

      if (!ohneRechnung && senden && nummer && bytes) {
        const { betreff, html } = renderMailVorlage(einstellungen.mail_vorlagen[buchung.sprache].storno, {
          vorname: buchung.vorname,
          nachname: buchung.nachname,
          anreise: datumDE(buchung.anreise),
          abreise: datumDE(buchung.abreise),
          nummer,
        })
        try {
          await sendeMail({
            an: buchung.email,
            betreff,
            html: mailRahmen(html, einstellungen.anbieter),
            anhangBytes: bytes,
            anhangName: `${nummer}_Stornorechnung_Mantinia_Hills.pdf`,
            kopieAnMich: true,
          })
          if (docId) await markiereVersendet(docId)
        } catch (mailErr) {
          setVersandHinweis(
            'Die Buchung wurde storniert und die Stornorechnung erstellt, aber der E-Mail-Versand schlug fehl: ' +
            (mailErr instanceof Error ? mailErr.message : String(mailErr)) +
            ' — bitte das PDF manuell versenden.',
          )
          setLaedt(false)
          return
        }
      }
      onFertig()
    } catch (err) {
      setFehler('Fehler beim Stornieren: ' + (err instanceof Error ? err.message : String(err)))
      setLaedt(false)
    }
  }

  if (versandHinweis) {
    return (
      <div className="dialog-hintergrund">
        <div className="dialog" style={{ maxWidth: 480 }}>
          <h2>Storniert</h2>
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
      <div className="dialog" style={{ maxWidth: 520 }}>
        <h2>Buchung stornieren</h2>
        <div className="hinweis">
          {tage >= 0
            ? <>Stornierung <strong>{tage} Tage</strong> vor Anreise — laut Staffel <strong>{vorschlag} %</strong> Gebühr.</>
            : <>Anreisetermin liegt in der Vergangenheit (No-Show) — laut Staffel <strong>{vorschlag} %</strong> Gebühr.</>}
        </div>
        <div className="zeile">
          <div>
            <label htmlFor="sprozent">Stornogebühr %</label>
            <input id="sprozent" type="number" step="1" min="0" max="100" value={prozent}
              onChange={(e) => { const p = parseFloat(e.target.value); if (!isNaN(p)) setProzent(p) }}
              disabled={ohneRechnung} />
          </div>
          <div>
            <label>Gebühr (Basis {eur(basis)})</label>
            <div style={{ padding: '9px 0', fontWeight: 700 }}>{eur(gebuehr)}</div>
          </div>
        </div>
        {verrechnet > 0 && !ohneRechnung && (
          <div className="hinweis">
            {vollBezahlt
              ? <>Buchung ist komplett bezahlt: <strong>{eur(verrechnet)}</strong> wird verrechnet.</>
              : <>Erhaltene Anzahlung ({anzahlung!.nummer}): <strong>{eur(verrechnet)}</strong> wird verrechnet.</>}{' '}
            {rest > 0
              ? <>Restforderung: <strong>{eur(rest)}</strong></>
              : <>Rückerstattung an den Gast: <strong>{eur(Math.abs(rest))}</strong></>}
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={ohneRechnung} onChange={(e) => setOhneRechnung(e.target.checked)} />
          Ohne Stornorechnung stornieren (Kulanz)
        </label>
        {!ohneRechnung && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={senden} onChange={(e) => setSenden(e.target.checked)} />
            Stornorechnung per E-Mail an <strong>{buchung.email}</strong> senden (Kopie an dich)
          </label>
        )}
        {fehler && <p className="fehler">{fehler}</p>}
        <div className="dialog-aktionen">
          <button onClick={onAbbrechen} disabled={laedt}>Abbrechen</button>
          <button className="btn-gefahr" onClick={stornieren} disabled={laedt}>
            {laedt ? 'Wird verarbeitet …' : ohneRechnung ? 'Stornieren' : senden ? 'Stornieren & senden' : 'Stornieren + PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
