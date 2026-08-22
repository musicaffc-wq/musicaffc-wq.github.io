% Title: O exilado (Harpa Cristã)
% Artist:  Harpa Cristã

\version "2.26.0"
% automatically converted by musicxml2ly from -
\pointAndClickOff

%% additional definitions required by the score:
D = \tweak Stem.direction #DOWN \etc
U = \tweak Stem.direction #UP \etc


\header {
  title = "O exilado "
  "id: software" = "Notion 3.7.1.113463"
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
  \clef "treble" \numericTimeSignature \time 4/4 \key g \major \D b2 \D a8 [ \D
  g8 ] \D b8. [ \D a16 ] | % 1
  \D g4 \D g'4 \D e4 \D g4 | % 2
  \D d2 \D b4 \D g4 | % 3
  \D a2. r4 | % 4
  \D b2 \D a8 [ \D g8 ] \D b8. [ \D a16 ] | % 5
  \D g4 \D g'4 \D e4 \D g4 | % 6
  \D d4 \D b8 [ \D g8 ] \D a4 \D a4 | % 7
  \D g2. r4 | % 8
  \D fis'4. \D g8 \D a4 \D d,4 | % 9

  \barNumberCheck #10
  \D d4. \D e8 \D d4 \D g4 | % 10
  \D g4 \D e4 \D c4 \D e4 | % 11
  d1 | % 12
  \D b2 \D a8 [ \D g8 ] \D b8. [ \D a16 ] | % 13
  \D g4 \D g'4 \D e4 \D g4 | % 14
  \D d4 \D b8 [ \D g8 ] \D a4 \D a4 | % 15
  \D g2. r4 \bar "|."
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

