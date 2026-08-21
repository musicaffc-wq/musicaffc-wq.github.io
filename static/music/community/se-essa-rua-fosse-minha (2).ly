% Title: Se essa rua fosse minha

\version "2.26.0"
% automatically converted by musicxml2ly from -
\pointAndClickOff

%% additional definitions required by the score:
hideNote =
  \tweak Dots.transparent ##t
  \tweak NoteHead.transparent ##t
  \tweak NoteHead.no-ledgers ##t
  \tweak Stem.transparent ##t
  \tweak Accidental.transparent ##t
  \tweak Rest.transparent ##t
  \tweak TabNoteHead.transparent ##t \etc

D = \tweak Stem.direction #DOWN \etc
U = \tweak Stem.direction #UP \etc


\header {
  title = "Se essa rua fosse minha"
  "id: software" = "Notion 3.7.0.113158"
}
#(set-global-staff-size 16.05987354330709)
\paper {
  paper-width = 21.0\cm
  paper-height = 29.69\cm
  top-margin = 1.9\cm
  bottom-margin = 1.58\cm
  left-margin = 1.58\cm
  right-margin = 1.58\cm
  indent = 1.62\cm
}
\layout {
  \context {
    \Staff
    printKeyCancellation = ##f
  }
  \context {
    \Score
    autoBeaming = ##f
  }
}
PartPOneVoiceOne = \relative b' {
  \clef "treble" \numericTimeSignature \time 4/4 \key g \major \partial 4 \D b8
  [ \D b8 ] \D e8 [ \D e8 ] \U b8 [ \U g8 ] \U e8 [ \U g8 ] \D d'8 [ \D c8 ] | % 1
  \D b4 \U fis4 r4 \D b8 [ \D b8 ] | % 2
  \D fis'8 [ \D fis8 ] \D dis8 [ \D b8 ] \D c8 [ \D b8 ] \D g'8 [ \D fis8 ] | % 3
  \D e2 r4 \D b8 [ \D b8 ] | % 4
  \D e8 [ \D e8 ] \D g8 [ \D fis8 ] \D e8 [ \D d8 ] \D c8 [ \D b8 ] | % 5
  \D d4 \D c4 r4 c8 [ c8 ] | % 6
  b4 fis'8 [ dis8 ] b8 [ a8 g8 fis8 ] | % 7
  e2 r2 | % 8
  \hideNote R1 \bar "|."
}


% The score definition
\score {
  <<
    \new Staff = "P1" <<
      \set Staff.instrumentName = "Piano"
      \context Staff <<
        \override Staff.BarLine.allow-span-bar = ##f
        \mergeDifferentlyDottedOn
        \mergeDifferentlyHeadedOn
        \context Voice = "PartPOneVoiceOne" {
          \PartPOneVoiceOne
        }
      >>
    >>
  >>
  \layout {}
  % To create MIDI output, uncomment the following line:
  % \midi { \tempo 4 = 80 }
}

