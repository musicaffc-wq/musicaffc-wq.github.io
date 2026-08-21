# LilyPond Programming Guide

Songs in *Play Along* mode are written using a subset of [LilyPond][lilypond]
note-input syntax — the same language used by the LilyPond music engraving
program. If you already know LilyPond, most of what you write here will work
as-is. This app only understands a **subset** of LilyPond, focused on pitches,
rhythm, and basic structure — see *Unsupported syntax* at the end of this
guide for what's left out.

[lilypond]: https://lilypond.org

Click the **Editor** button on any song to see how it's written.

## Notes

A note is written as a pitch letter (`a` through `g`), optionally followed by
an accidental and octave marks, and then a duration.

    c4 d4 e4 f4

## Accidentals

Sharps and flats are written by appending `is` (sharp) or `es` (flat) to the
letter — this is standard LilyPond note-name syntax:

    cis4 des4 e4

## Octaves

LilyPond pitch entry can work in **absolute** mode (every note's octave is
spelled out) or **relative** mode (each note's octave is inferred from the
previous note). Relative mode is the easiest way to write a melody by hand,
and is recommended.

Wrap a passage in `\relative <pitch> { ... }`. Each note after the first is
placed in whichever octave is closest to the note before it — within a
fourth. Add `'` to jump an extra octave up, or `,` to jump an extra octave
down.

    \relative c' { c d e f g a b c }

The example above starts on middle C and climbs a full octave, one step at a
time. Without any `\relative` wrapper, notes are read in **absolute** mode,
where octave marks are always relative to a fixed reference (`c` with no
marks sits an octave below middle C, `c'` is middle C, `c''` the octave
above, and so on):

    c'4 e'4 g'4

## Durations

A duration is a number placed right after the pitch: `1` for a whole note,
`2` half, `4` quarter, `8` eighth, `16` sixteenth, and so on. Add a `.` for a
dotted note. If you omit the duration, the last one written is reused:

    c4 d e8. f16 g4

## Ties

A `~` right after a note ties it to the next note of the same pitch,
combining them into one held note — including across a bar line:

    c4~ c4

## Rests

A rest is written `r` followed by a duration, using the same rules as notes:

    c4 r4 d4 r8 e8

## Chords

Notes inside `< >` sound together as a chord. The duration goes after the
closing `>`:

    <c e g>4 <c f a>4

## Time Signature

    \time 6/8
    g8 a b c d e

## Key Signature

    \key g \major
    g4 a b c

Because LilyPond pitches are always absolute, writing `f` in G major still
means F-natural — to get the F# that belongs to the key, write `fis`
explicitly. This is different from how many simpler notations work, where an
unmarked note automatically follows the key signature.

## Clef

    \clef bass
    c4 d e f

`treble`, `bass`, `alto`, and `tenor` are recognized.

## Multiple Staves (Piano Grand Staff)

Use `\new Staff { ... }` for each staff. Each one becomes its own track in
the player:

    \new Staff {
      \relative c' { \clef treble c4 d e f }
    }
    \new Staff {
      \relative c { \clef bass c4 d e f }
    }

## Simultaneous Voices

Inside a single passage, `<< ... \\ ... >>` lets two (or more) lines play at
the same time, each written independently:

    \relative c' {
      << { c4 e4 } \\ { g,4 c,4 } >>
    }

## Comments

`%` starts a line comment; `%{ ... %}` wraps a block comment.

    c4 d4 % this is a comment
    %{ this whole
       block is ignored %}
    e4 f4

## Unsupported syntax

To keep the player's engine simple, some real LilyPond syntax is not
understood and will be silently ignored: tuplets (`\times`), grace notes
(`\grace`), dynamics and articulations (`\f`, `-.`, `^`, and similar),
lyrics, and markup (`^"text"`). Bar checks (`|`) are read but not enforced —
they won't cause an error, but they also won't catch a miscounted measure for
you.
