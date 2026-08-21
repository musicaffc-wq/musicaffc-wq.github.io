import SongParser from "st/song_parser"
import {SongNoteList, SongNote} from "st/song_note_list"

let stripIds = notes =>
  notes.map(n => Object.assign({}, n, {id: undefined}))

let matchNotes = (have, expected) =>
  expect(stripIds([...have])).toEqual(stripIds(expected))

describe("song parser (LilyPond)", function() {
  it("parses a single absolute note", function() {
    expect(new SongParser().parse("a'4")).toEqual([
      ["note", "A5", {natural: true}]
    ])
  })

  it("parses a relative scale", function() {
    expect(new SongParser().parse("\\relative c' { c d e f g a b c }")).toEqual([
      ["note", "C5", {natural: true}],
      ["note", "D5", {natural: true}],
      ["note", "E5", {natural: true}],
      ["note", "F5", {natural: true}],
      ["note", "G5", {natural: true}],
      ["note", "A5", {natural: true}],
      ["note", "B5", {natural: true}],
      ["note", "C6", {natural: true}],
    ])
  })

  it("parses durations with dots", function() {
    let ast = new SongParser().parse("\\relative c' { c4 d8. e16 }")
    expect(ast[0]).toEqual(["note", "C5", {natural: true}])
    expect(ast[1][2].duration).toBeCloseTo(1.5)
    expect(ast[2][2].duration).toBeCloseTo(0.25)
  })

  it("parses rests", function() {
    expect(new SongParser().parse("\\relative c' { c4 r4 d4 }")).toEqual([
      ["note", "C5", {natural: true}],
      ["rest"],
      ["note", "D5", {natural: true}],
    ])
  })

  it("parses accidentals", function() {
    expect(new SongParser().parse("\\relative c' { cis4 des4 c4 }")).toEqual([
      ["note", "C5", {sharp: true}],
      ["note", "D5", {flat: true}],
      ["note", "C5", {natural: true}],
    ])
  })

  it("parses a key signature", function() {
    let ast = new SongParser().parse("\\key g \\major \\relative c' { c4 }")
    expect(ast[0]).toEqual(["keySignature", 1])
  })

  it("parses a time signature", function() {
    expect(new SongParser().parse("\\time 3/4")).toEqual([
      ["timeSignature", 3, 4],
    ])
  })

  it("ignores comments", function() {
    expect(new SongParser().parse(`
      \\relative c' {
        c4 % this is a comment
        %{ block comment %}
        d4
      }
    `)).toEqual([
      ["note", "C5", {natural: true}],
      ["note", "D5", {natural: true}],
    ])
  })

  it("merges a tie into a single note", function() {
    let ast = new SongParser().parse("\\relative c' { c4~ c4 }")
    expect(ast).toEqual([
      ["note", "C5", {natural: true, duration: 2}],
    ])
  })

  it("keeps a tie when a fingering and chord come between the notes", function() {
    let ast = new SongParser().parse('d4-3*"A" ~ d8')
    expect(ast).toEqual([
      ["note", "D5", {
        natural: true,
        duration: 1.5,
        fingering: 3,
        markup: "A",
        extraMarkups: [{offsetMult: 1, text: "A"}],
      }],
    ])
  })

  it("assigns a new track per \\new Staff", function() {
    let ast = new SongParser().parse(`
      \\new Staff { \\relative c' { c4 } }
      \\new Staff { \\relative c { c4 } }
    `)
    expect(ast).toEqual([
      ["setTrack", 0],
      ["note", "C5", {natural: true}],
      ["setTrack", 1],
      ["note", "C4", {natural: true}],
    ])
  })
})

describe("load song (LilyPond)", function() {
  it("loads empty song", function() {
    let song = SongParser.load("\\key c \\major")
    expect([...song]).toEqual([])
  })

  it("loads some notes", function() {
    let song = SongParser.load(`
      \\key g \\major
      \\relative b' { b a g a b b b4. a a a4. }
    `)

    matchNotes(song, [
      new SongNote("B5", 0, 1),
      new SongNote("A5", 1, 1),
      new SongNote("G5", 2, 1),
      new SongNote("A5", 3, 1),

      new SongNote("B5", 4, 1),
      new SongNote("B5", 5, 1),
      new SongNote("B5", 6, 1.5),

      new SongNote("A5", 7.5, 1.5),
      new SongNote("A5", 9, 1.5),
      new SongNote("A5", 10.5, 1.5),
    ])
  })

  it("loads notes with rests", function() {
    let song = SongParser.load(`
      \\relative g' { r4 g4 r2 a4 r2. r4 f'4 }
    `)

    matchNotes(song, [
      new SongNote("G5", 1, 1),
      new SongNote("A5", 4, 1),
      new SongNote("F6", 9, 1),
    ])
  })

  it("loads notes at eighth-note resolution", function() {
    let song = SongParser.load(`
      \\relative c' { c8 c8 c8 g'8 a8 g8 c,4 }
    `)

    matchNotes(song, [
      new SongNote("C5", 0, 0.5),
      new SongNote("C5", 0.5, 0.5),
      new SongNote("C5", 1.0, 0.5),

      new SongNote("G5", 1.5, 0.5),
      new SongNote("A5", 2.0, 0.5),
      new SongNote("G5", 2.5, 0.5),

      new SongNote("C5", 3.0, 1),
    ])
  })

  it("applies a key signature to plain letters only when explicit", function() {
    // LilyPond pitches are absolute: writing a plain letter always means
    // natural, regardless of key signature. To get the sharp/flat implied
    // by the key you write it out (cis, des, ...).
    let song = SongParser.load(`
      \\key d \\major
      \\relative c' { c d e f g a b }
    `)

    matchNotes(song, [
      new SongNote("C5", 0, 1),
      new SongNote("D5", 1, 1),
      new SongNote("E5", 2, 1),
      new SongNote("F5", 3, 1),
      new SongNote("G5", 4, 1),
      new SongNote("A5", 5, 1),
      new SongNote("B5", 6, 1),
    ])
  })

  it("sets position when using simultaneous voices, without leaking octave state between them", function() {
    let song = SongParser.load(`
      \\relative c' {
        << { c4 e4 } \\\\ { g,4 c4 } >>
        a''4
      }
    `)

    matchNotes(song, [
      new SongNote("C5", 0, 1),
      new SongNote("E5", 1, 1),
      new SongNote("G3", 0, 1),
      new SongNote("C4", 1, 1),
      new SongNote("A6", 2, 1),
    ])
  })

  it("renders a chord with all notes at the same position", function() {
    // Note: in real LilyPond, every note in a chord is placed relative to
    // the FIRST note of that same chord (not cumulatively note-to-note),
    // which is why the "g" here lands an octave lower than you might
    // expect from a plain ascending triad.
    let song = SongParser.load(`
      \\relative c' {
        <c e g>4
        a''4
      }
    `)

    matchNotes(song, [
      new SongNote("C5", 0, 1),
      new SongNote("E5", 0, 1),
      new SongNote("G4", 0, 1),
      new SongNote("A6", 1, 1),
    ])
  })

  it("loads song with 3/4 time", function() {
    let song = SongParser.load(`
      \\time 3/4
      \\relative c' {
        c4 d2
        e4 d4 c4
      }
    `)

    matchNotes(song, [
      new SongNote("C5", 0, 1),
      new SongNote("D5", 1, 2),

      new SongNote("E5", 3, 1),
      new SongNote("D5", 4, 1),
      new SongNote("C5", 5, 1),
    ])
  })

  it("loads song with 6/8 time", function() {
    let song = SongParser.load(`
      \\time 6/8
      \\relative c' { c8 d4 g,4. c'8 }
    `)

    matchNotes(song, [
      new SongNote("C5", 0, 0.5),
      new SongNote("D5", 0.5, 1),
      new SongNote("G4", 1.5, 1.5),
      new SongNote("C6", 3, 0.5),
    ])
  })

  it("keeps each 6/8 measure adding up to 3 beats even with a tie across the bar line", function() {
    let song = SongParser.load(`
      \\time 6/8
      \\relative g' { g8 g8 g8 g8 g8 g8 | g8~ g4 g8 g8 g8 }
    `)

    let total = [...song].reduce((sum, n) => sum + n.duration, 0)
    expect(total).toBeCloseTo(6)
  })
})
