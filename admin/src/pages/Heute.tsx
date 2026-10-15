// Startseite „Heute": beantwortet EINE Frage — was braucht mich jetzt?
// 1) Jetzt handeln   2) Wartet auf Gast   3) Nächste Anreisen
// Jeder Vorgang erscheint in genau EINEM Abschnitt (Priorität von oben nach unten).

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ladeEinstellungen } from '../lib/einstellungen'
import { autoAbschluss } from '../lib/autoAbschluss'
import { belegungsKonflikt, istVerbindlich, restzahlungFaellig, tagISO } from '../lib/statistik'
import { datumDE, eur } from '../lib/format'
import type { Buchung, IcalBlockierung } from '../lib/types'
import StatusBadge from '../components/StatusBadge'

interface Eintrag {
  buchung: Buchung
  hinweis: string
}

function Zeile({ e }: { e: Eintrag }) {
  const b = e.buchung
  return (
    <Link to={`/anfragen/${b.id}`} className="heute-zeile">
      <span className="heute-gast">
        <strong>{b.vorname} {b.nachname}</strong>
        <span className="text-klein">{datumDE(b.anreise)} – {datumDE(b.abreise)} · {b.personen} Pers.{b.gesamtpreis_eur != null ? ` · ${eur(b.gesamtpreis_eur)}` : ''}</span>
      </span>
      <span className="heute-rechts">
        <span className="text-hinweis">{e.hinweis}</span>
        <StatusBadge status={b.status} />
      </span>
    </Link>
  )
}

function Abschnitt({ titel, eintraege, leerText }: { titel: string; eintraege: Eintrag[]; leerText: string }) {
  return (
    <div className="card">
      <h2 style={{ marginBottom: 10 }}>{titel}{eintraege.length > 0 && <span style={{ color: 'var(--grau)', fontWeight: 400 }}> ({eintraege.length})</span>}</h2>
      {eintraege.length === 0
        ? <p className="text-hinweis" style={{ margin: 0 }}>{leerText}</p>
        : eintraege.map((e) => <Zeile key={e.buchung.id} e={e} />)}
    </div>
  )
}

export default function Heute() {
  const [alle, setAlle] = useState<Buchung[]>([])
  const [extern, setExtern] = useState<IcalBlockierung[]>([])
  const [tageVorher, setTageVorher] = useState(14)
  const [laedt, setLaedt] = useState(true)

  useEffect(() => {
    // Selbstpflegendes Archiv auch hier anstoßen (Startseite wird am häufigsten geöffnet).
    autoAbschluss().then(() => {
      supabase.from('buchungen').select('*').then(({ data }) => {
        setAlle((data as Buchung[]) ?? [])
        setLaedt(false)
      })
    })
    supabase.from('ical_blockierungen').select('*')
      .then(({ data }) => setExtern((data as IcalBlockierung[]) ?? []))
    ladeEinstellungen().then((e) => setTageVorher(e.abschlussrechnung_tage_vorher)).catch(() => { /* Standard */ })
  }, [])

  const { handeln, wartet, anreisen } = useMemo(() => {
    const heuteISO = tagISO(new Date())
    const handeln: Eintrag[] = []
    const wartet: Eintrag[] = []
    const anreisen: Eintrag[] = []
    const zugeteilt = new Set<string>()

    for (const b of alle) {
      // 1) Jetzt handeln — höchste Priorität
      if (b.status === 'neu') {
        handeln.push({ buchung: b, hinweis: 'Angebot erstellen' })
        zugeteilt.add(b.id)
      } else if (restzahlungFaellig(b, tageVorher)) {
        handeln.push({
          buchung: b,
          hinweis: b.status === 'angezahlt' ? 'Abschlussrechnung / Restzahlung' : 'Zahlungseingang prüfen',
        })
        zugeteilt.add(b.id)
      } else if (b.status === 'angebot_erstellt' && belegungsKonflikt(b, alle, extern)) {
        handeln.push({ buchung: b, hinweis: 'Zeitraum belegt — ablehnen?' })
        zugeteilt.add(b.id)
      }
    }
    for (const b of alle) {
      if (zugeteilt.has(b.id)) continue
      // 2) Wartet auf Gast — alles läuft, der Ball liegt beim Gast
      if (b.status === 'angebot_erstellt') {
        const stand = b.angebot_erinnert2_am ? 'Angebot offen · 2× erinnert'
          : b.angebot_erinnert_am ? 'Angebot offen · erinnert'
          : 'Angebot offen'
        wartet.push({ buchung: b, hinweis: stand })
        zugeteilt.add(b.id)
      } else if (b.status === 'bestaetigt') {
        wartet.push({ buchung: b, hinweis: 'Anzahlung ausstehend' })
        zugeteilt.add(b.id)
      }
    }
    for (const b of alle) {
      if (zugeteilt.has(b.id)) continue
      // 3) Nächste Anreisen — feste Buchungen, nur Vorfreude
      if (istVerbindlich(b) && b.anreise >= heuteISO) {
        anreisen.push({ buchung: b, hinweis: `Anreise ${datumDE(b.anreise)}` })
      }
    }

    handeln.sort((a, b) => a.buchung.anreise.localeCompare(b.buchung.anreise))
    wartet.sort((a, b) => a.buchung.anreise.localeCompare(b.buchung.anreise))
    anreisen.sort((a, b) => a.buchung.anreise.localeCompare(b.buchung.anreise))
    return { handeln, wartet, anreisen: anreisen.slice(0, 5) }
  }, [alle, extern, tageVorher])

  if (laedt) return <p className="leer">Wird geladen …</p>

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Heute</h2>
      <Abschnitt titel="Jetzt handeln" eintraege={handeln} leerText="Nichts zu tun — alles läuft. ✓" />
      <Abschnitt titel="Wartet auf Gast" eintraege={wartet} leerText="Keine offenen Angebote oder ausstehenden Anzahlungen." />
      <Abschnitt titel="Nächste Anreisen" eintraege={anreisen} leerText="Keine festen Buchungen in der Zukunft." />
      <p className="text-hinweis">
        Alle Vorgänge: <Link to="/anfragen">Anfragen-Liste</Link> · Belegung: <Link to="/kalender">Kalender</Link>
      </p>
    </>
  )
}
