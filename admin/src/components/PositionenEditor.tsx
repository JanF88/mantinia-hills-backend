import { eur } from '../lib/format'
import { positionenSumme } from '../lib/preisberechnung'
import type { Position } from '../lib/types'

interface Props {
  positionen: Position[]
  onChange: (positionen: Position[]) => void
}

export default function PositionenEditor({ positionen, onChange }: Props) {
  function aendern(index: number, feld: 'bezeichnung' | 'menge' | 'einzelpreis', wert: string) {
    const kopie = positionen.map((p) => ({ ...p }))
    const pos = kopie[index]
    if (feld === 'bezeichnung') {
      pos.bezeichnung = wert
    } else {
      const zahl = parseFloat(wert.replace(',', '.'))
      if (feld === 'menge') pos.menge = isNaN(zahl) ? 0 : zahl
      else pos.einzelpreis = isNaN(zahl) ? 0 : zahl
      pos.betrag = Math.round(pos.menge * pos.einzelpreis * 100) / 100
    }
    onChange(kopie)
  }

  function loeschen(index: number) {
    onChange(positionen.filter((_, i) => i !== index))
  }

  function hinzufuegen() {
    onChange([...positionen, { bezeichnung: '', menge: 1, einzelpreis: 0, betrag: 0 }])
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th style={{ width: '55%' }}>Bezeichnung</th>
            <th style={{ width: 70 }}>Menge</th>
            <th style={{ width: 110 }}>Einzelpreis €</th>
            <th className="rechts">Betrag</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {positionen.map((p, i) => (
            <tr key={i}>
              <td><input value={p.bezeichnung} onChange={(e) => aendern(i, 'bezeichnung', e.target.value)} /></td>
              <td><input type="number" step="1" min="0" value={p.menge} onChange={(e) => aendern(i, 'menge', e.target.value)} /></td>
              <td><input type="number" step="0.01" value={p.einzelpreis} onChange={(e) => aendern(i, 'einzelpreis', e.target.value)} /></td>
              <td className="rechts"><strong>{eur(p.betrag)}</strong></td>
              <td>
                <button type="button" className="btn-klein btn-gefahr" title="Position entfernen" onClick={() => loeschen(i)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <button type="button" className="btn-klein" onClick={hinzufuegen}>+ Position hinzufügen</button>
        <div>
          Gesamt: <span className="summe-gross">{eur(positionenSumme(positionen))}</span>
        </div>
      </div>
    </>
  )
}
