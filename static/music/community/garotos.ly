% Title: Garotos
% Artist: Leoni e

\version "2.26.0"
% automatically converted by musicxml2ly from -
\pointAndClickOff

%% additional definitions required by the score:
D = \tweak Stem.direction #DOWN \etc
U = \tweak Stem.direction #UP \etc


\header {
  title = "música garotos"
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
PartPOneVoiceOne = \relative e'' {

\tempo 4 = 70
  \clef "treble" \numericTimeSignature \time 4/4 \key c \major 
r1
r4 \D e8 [ \D e8
  ~ ] \U e8 [ \U d8 ~ \U d8 \U c8 ] | % 1
  \U d4 \D e8 [ \D e8 ~ ] \U e8 [ \U c8 ] r8 \U c8 | % 2
  \U f8 [ \U e8 \U d8 \U c8 ~ ] \U c8 [ \U d8 ~ \U d8 \U d8 ~ ] | % 3
  \U d2*"G" r2 \bar "|."
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

