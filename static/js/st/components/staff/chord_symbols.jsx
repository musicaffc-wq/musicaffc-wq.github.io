import * as React from "react"
import styles from "st/components/staff.module.css"
import * as types from "prop-types"

export default class ChordSymbols extends React.PureComponent {
  static defaultProps = {
    offsetLeft: 0,
    chordSymbols: [],
  }

  static propTypes = {
    notes: types.array.isRequired,
    chordSymbols: types.array,
    pixelsPerBeat: types.number.isRequired,
    offsetLeft: types.number.isRequired,
  }

  render() {
    // Mantém compatibilidade com SongNote.markup, mas usa a lista
    // independente para que pausas também possam ter cifras.
    const fallback = this.props.notes
      .filter(n => n.markup)
      .map(n => ({
        start: n.getStart(),
        markup: n.markup,
      }))

    const symbols = [...(this.props.chordSymbols || []), ...fallback]

    // Evita desenhar duas vezes uma cifra que já está na lista independente.
    const unique = []
    const seen = new Set()
    for (const symbol of symbols) {
      const key = `${symbol.start}|${symbol.markup}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(symbol)
    }

    if (!unique.length) {
      return null
    }

    return <div className={styles.chord_symbols_row}>
      {unique.map((symbol, idx) => {
        // A cifra usa a mesma régua horizontal da pausa/nota.
        // Como ChordSymbols está dentro de .staff_song_notes (left: 120px),
        // o zero aqui coincide com o início real dos eventos musicais.
        let fromLeft = symbol.start * this.props.pixelsPerBeat + 2

        return <div
          key={`chord-symbol-${idx}`}
          className={styles.chord_symbol}
          style={{ left: `${this.props.offsetLeft + fromLeft}px` }}>
            {symbol.markup}
          </div>
      })}
    </div>
  }
}
