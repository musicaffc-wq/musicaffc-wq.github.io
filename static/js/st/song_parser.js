
import {parseLilypond} from "st/lilypond_parser"
import {parseNote, noteName, KeySignature} from "st/music"

import {MultiTrackSong, SongNote} from "st/song_note_list"
import {AutoChords} from "st/auto_chords"

// Songs are written in a subset of LilyPond note-input syntax. See
// static/js/st/lilypond_parser.js for what's supported, and
// static/guides/lilypond.md for the user-facing guide.


export default class SongParser {
  static load(songText, opts) {
    let parser = new SongParser
    let ast = parser.parse(songText)
    return parser.compile(ast, opts)
  }

  // convert song text (LilyPond) to ast
  parse(songText) {
    return parseLilypond(songText)
  }

  // compile ast to song notes
  compile(ast, opts) {
    let state = {
      startPosition: 0,
      position: 0,
      beatsPerNote: 1,
      beatsPerMeasure: 4,
      timeScale: 1,
      keySignature: new KeySignature(0),
      currentTrack: 0,
    }

    let song = new MultiTrackSong()
    // Cifras são mantidas separadamente das notas porque uma pausa não
    // possui um SongNote ao qual a cifra possa ser anexada.
    song.chordSymbols = []
    this.compileCommands(ast, state, song)

    song.metadata = {
      keySignature: state.keySignature.count,
      beatsPerMeasure: state.beatsPerMeasure,
      bpm: state.bpm,
      timeSigNum: state.timeSigNum || 4,
      timeSigDen: state.timeSigDen || 4,
    }

    if (song.autoChords) {
      let settings = opts ? opts.autoChordsSettings : {}
      if (opts && opts.autoChords) {
        new opts.autoChords(song, settings).addChords()
      } else {
        AutoChords.defaultChords(song, settings).addChords()
      }
    }

    return song
  }

  addChordSymbol(song, trackIdx, start, markup) {
    const symbol = {
      start: start,
      markup: markup,
      track: trackIdx,
    }

    song.chordSymbols.push(symbol)

    const track = song.getTrack(trackIdx)
    if (!track.chordSymbols) {
      track.chordSymbols = []
    }
    track.chordSymbols.push(symbol)
  }

  compileCommands(commands, state, song) {
    for (let command of commands) {
      let t = command[0]
      switch (t) {
        case "restoreStartPosition": {
          state.position = state.startPosition
          break
        }
        case "block": {
          let [, blockCommands] = command
          let blockState = {
            startPosition: state.position
          }

          Object.setPrototypeOf(blockState, state)
          this.compileCommands(blockCommands, blockState, song)

          state.position = blockState.position

          break
        }
        case "halfTime": {
          state.timeScale *= 2
          break
        }
        case "doubleTime": {
          state.timeScale *= 0.5
          break
        }
        case "tripleTime": {
          state.timeScale *= 1/3
          break
        }
        case "measure": {
          let [, measure] = command
          state.position = measure * state.beatsPerMeasure
          break
        }
        case "setTrack": {
          let [, track] = command
          state.currentTrack = +track
          break
        }
        case "cleff": {
          let [, cleff] = command
          let track = song.getTrack(state.currentTrack)
          if (!track.cleffs) {
            track.cleffs = []
          }

          track.cleffs.push([state.position, cleff])
          break
        }
        case "note": {
          let [, name, noteOpts] = command
          let duration = state.beatsPerNote * state.timeScale
          let start = null

          let hasAccidental = false

          if (noteOpts) {
            if (noteOpts.duration) {
              duration *= noteOpts.duration
            }

            start = noteOpts.start


            if (noteOpts.sharp) {
              hasAccidental = true
              name = name.substr(0, 1) + "#" + name.substr(1)
            } else if (noteOpts.flat) {
              hasAccidental = true
              name = name.substr(0, 1) + "b" + name.substr(1)
            } else if (noteOpts.natural) {
              hasAccidental = true
            } 
          }

          if (!hasAccidental) {
            // apply default accidental
            name = state.keySignature.unconvertNote(name)
          }

          if (!start) {
            start = state.position
            state.position += duration
          }

          let songNote = new SongNote(name, start, duration)
          if (noteOpts && noteOpts.sourceStart != null) {
            songNote.sourceStart = noteOpts.sourceStart
            songNote.sourceEnd = noteOpts.sourceEnd
          }
          if (noteOpts && noteOpts.fingering != null) {
            songNote.fingering = noteOpts.fingering
          }
          if (noteOpts && noteOpts.markup) {
            songNote.markup = noteOpts.markup
            this.addChordSymbol(song, state.currentTrack, start, noteOpts.markup)
          }
          if (noteOpts && noteOpts.extraMarkups) {
            // cifras que caíam sobre notas que foram mescladas por uma
            // ligadura (ex: quando a ligadura atravessa um compasso e a
            // cifra é reescrita no início do novo compasso) -- calculamos
            // a posição real de cada uma a partir do deslocamento salvo
            // pelo parser, na mesma escala usada para a duração da nota
            let unitBeats = state.beatsPerNote * state.timeScale
            noteOpts.extraMarkups.forEach(m => {
              let markStart = start + m.offsetMult * unitBeats
              this.addChordSymbol(song, state.currentTrack, markStart, m.text)
            })
          }

          song.pushWithTrack(songNote, state.currentTrack)
          break
        }
        case "rest": {
          let [, restTiming] = command

          let duration = state.beatsPerNote * state.timeScale
          let start = state.position

          if (restTiming) {
            if (restTiming.start) {
              break // do nothing
            }

            if (restTiming.duration) {
              duration *= restTiming.duration
            }

            // Pausas agora podem carregar uma cifra, por exemplo:
            // r4*"Am"
            if (restTiming.markup) {
              this.addChordSymbol(song, state.currentTrack, start, restTiming.markup)
            }
          }

          state.position += duration
          break
        }
        case "keySignature": {
          state.keySignature = new KeySignature(+command[1])
          break
        }
        case "timeSignature": {
          let [, perBeat, noteValue] = command
          state.beatsPerNote = 4 / noteValue
          state.beatsPerMeasure = state.beatsPerNote * perBeat
          state.timeSigNum = perBeat
          state.timeSigDen = noteValue
          break
        }
        case "tempo": {
          state.bpm = +command[1]
          break
        }
        case "macro": {
          let [, macroName] = command
          let chord = AutoChords.coerceChord(macroName)

          if (chord) {
            if (!song.autoChords) {
              song.autoChords = []
            }
            song.autoChords.push([state.position, chord])
          }

          break
        }
        default: {
          console.warn("Got unknown command when parsing song", command)
        }
      }
    }

  }
}
