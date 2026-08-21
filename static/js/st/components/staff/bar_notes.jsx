
import * as React from "react"
import classNames from "classnames"
import {parseNote, noteStaffOffset, solfegeName, noteColor} from "st/music"

import * as types from "prop-types"
import styles from "st/components/staff.module.css"

export default class BarNotes extends React.PureComponent {
  static defaultProps = {
    heldNotes: {},
    offsetLeft: 0,
    showNoteNames: false,
    colorNotes: false,
  }

  static propTypes = {
    notes: types.array.isRequired,
    heldNotes: types.object.isRequired,
    offsetLeft: types.number.isRequired,
    onNoteClick: types.func,
    showNoteNames: types.bool,
    colorNotes: types.bool,
  }

  render() {
    let out = this.props.notes.map(this.renderNote.bind(this))

    if (out.length) {
      return out
    }

    return null
  }

  renderNote(note, idx) {
    const key = this.props.keySignature
    let noteName = note.note
    let pitch = parseNote(noteName)

    let pixelsPerBeat = this.props.pixelsPerBeat 
    let row = noteStaffOffset(noteName)

    let fromTop = this.props.upperRow - row
    let fromLeft = note.getStart() * pixelsPerBeat + 2
    let width = note.getRenderStop() * pixelsPerBeat - fromLeft - 4

    let accidentals = key.accidentalsForNote(noteName)

    let style = {
      top: `${Math.floor(fromTop * 25/2)}%`,
      left: `${this.props.offsetLeft + fromLeft}px`,
      width: `${width}px`
    }

    if (this.props.colorNotes) {
      style["--note-color"] = noteColor(noteName)
    }

    let outsideLoop = false

    if (this.props.loopLeft != null && this.props.loopRight != null) {
      outsideLoop = note.getStart() < this.props.loopLeft || note.getStart() >= this.props.loopRight
    }

    let held = this.props.heldNotes[note.id]

    return <div
      className={classNames(styles.note_bar, {
        [styles.is_flat]: accidentals == -1,
        [styles.is_sharp]: accidentals == 1,
        [styles.is_natural]: accidentals == 0,
        [styles.held]: held,
        [styles.outside_loop]: outsideLoop,
        [styles.pitch_colored]: this.props.colorNotes,
        [styles.clickable_note]: !!this.props.onNoteClick,
      })}
      title={noteName}
      style={style}
      onClick={this.props.onNoteClick && note.sourceStart != null
        ? (e) => { e.stopPropagation(); this.props.onNoteClick(note.sourceStart, note.sourceEnd) }
        : undefined}
      key={`bar-note-${idx}`}>
        {this.props.showNoteNames ? <span className={styles.note_label}>{solfegeName(noteName)}</span> : null}
        {note.fingering ? <span className={styles.fingering_label}>{note.fingering}</span> : null}
      </div>
  }
}
