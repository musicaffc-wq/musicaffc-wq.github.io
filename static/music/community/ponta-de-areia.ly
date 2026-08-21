% Title: Ponta de Areia
% Artist: Milton Nascimento

\transpose g a {
\version "2.26.0"
% automatically converted by musicxml2ly from -
\pointAndClickOff

%% additional definitions required by the score:
D = \tweak Stem.direction #DOWN \etc
U = \tweak Stem.direction #UP \etc


\header {
  title = "ponta de Areia Milton Nascimento"
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
    doubleRepeatBarType = ":|.|:"
    autoBeaming = ##f
  }
}
PartPOneVoiceOne = \relative a' {

\tempo 4 = 45
  \repeat volta 2 {
    \clef "treble" \numericTimeSignature \time 4/4 \key g \major
r1
 \D a8 [ \D c8
    \D c8 \D d8 ] \D c4 \U a4 | % 1
    \time 5/4 \D c4 \U g4 \U d8 [ \U g8 ~ ] \U g2 | % 2
    \numericTimeSignature \time 4/4 \U f8 [ \U a8 \U a8 \U c8 ] \U g4 \U d4 | % 3
    \time 5/4 \U g4 \U d4 \U f8 [ \U d8 ~ ] \U d8 [ \U f8 ] \U f4 | % 4
    \numericTimeSignature \time 4/4 \D a8 [ \D c8 \D c8 \D d8 ] \D c4 \U a4 | % 5
    \time 5/4 \D c4 \U g4 \U d8 [ \U g8 ~ ] \U g2 | % 6
    \numericTimeSignature \time 4/4 \U f8 [ \U a8 \U a8 \U c8 ] \U g4 \U d4 | % 7
    \time 5/4 \U g4 \U d4 \U f8 [ \U d8 ~ ] \U d8 [ \U f8 ] \U f4 | % 8
    \numericTimeSignature \time 4/4 \D a8 [ \D c8 \D c8 \D d8 ] \D c4 \U a4
    \time 5/4 \D c4 \U g4 \U a8 [ \U a8 ~ ] \U a8 \U g4. | % 9

    \barNumberCheck #10
    \numericTimeSignature \time 4/4 \U f8 [ \U a8 \U a8 \U c8 ] \U g4 \U d4 | % 10
    \time 5/4 \U g4 \U d4 \U f8 [ \U d8 ~ ] \U d8 [ \U f8 ] \U f4 | % 11
    \numericTimeSignature \time 4/4 \D a8 [ \D c8 \D c8 \D d8 ] \D c4 \U a4 | % 12
    \time 5/4 \D c4 \U c4 \D c8 [ \D d8 ~ ] \U d8 [ \U c8 ] \U a4 | % 13
    \numericTimeSignature \time 4/4 \U f8 [ \U a8 \U a8 \U c8 ] \U g4 \U d4 | % 14
    \time 5/4 \U g4 \U d4 \U f8 [ \U d8 ~ ] \U d8 [ \U f8 ] \U f4 | % 15
    \numericTimeSignature \time 4/4 \D a8 [ \D c8 \D c8 \D d8 ] \D c4 \U a4 | % 16
    \time 5/4 \D c4 \U c4 \D c8 [ \D d8 ~ ] \U d8 [ \U c8 ] \U a4 | % 17
    \numericTimeSignature \time 4/4 \U f8 [ \U a8 \U a8 \U c8 ] \U g4 \U d4 | % 18
    \time 5/4 \U g4 \U d4 \U f8 [ \U d8 ~ ] \U d8 [ \U f8 ] \U f4 }
}
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

