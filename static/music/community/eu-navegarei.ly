% Title: Eu navegarei
% Artist: Música Gospel

\version "2.26.0"
% automatically converted by musicxml2ly from -
\pointAndClickOff

%% additional definitions required by the score:
D = \tweak Stem.direction #DOWN \etc
U = \tweak Stem.direction #UP \etc


\header {
  title = "Eu navegarei"
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
    doubleRepeatBarType = ":|.|:"
    autoBeaming = ##f
  }
}
PartPOneVoiceOne = \relative b' {
  \clef "treble" \numericTimeSignature \time 4/4 \key g \major r2 \U b8 [ \U a8
  \U g8 \U a8 ] | % 1
  \U b2. r4 | % 2
  r8 \U b8 [ \U b8 \U b8 ] \D b8 [ \D b8 \D e8 \D d8 ] | % 3
  \D e8 [ \D d8 ] \D d2. | % 4
  r4 r8 \D d8 \U c8 [ \U b8 \U a8 \U b8 ] | % 5
  \D c2. r4 | % 6
  r4 r8 \D c8 \D c8 [ \D c8 \D e8 \D d8 ] | % 7
  b1 | % 8
  r2 \U b8 [ \U a8 \U g8 \U a8 ] | % 9

  \barNumberCheck #10
  b1 | % 10
  r8 \U b8 b8 [ b8 ] \D b8 [ \D b8 \D e8 \D d8 ] | % 11
  \D e8 [ \D d8 ] \D d2. | % 12
  r4 r8 \D d8 \U c8 [ \U b8 \U a8 \U b8 ] | % 13
  c1 | % 14
  r4 r8 \D c8 \D c8 [ \D c8 \D e8 \D d8 ] | % 15
  b1 | % 16
  \repeat volta 2 {
    r4 r8 \D g'8 \D g8 [ \D fis8 \D e8 \D fis8 ] | % 17
    \D g8 [ \D fis8 ] \D e2. | % 18
    r4 r8 \D g8 \D g8 [ \D g8 \D a8 \D g8 ] | % 19

    \barNumberCheck #20
    \D fis8 [ \D e8 ] \D d2. | % 20
    r4 r8 \D fis8 \D fis8 [ \D fis8 \D g8 \D fis8 ] | % 21
    \D e8 [ \D d8 ] \D c2. | % 22
    r4 r8 \D e8 \D e8 [ \D e8 \D fis8 \D e8 ] | % 23
    \D dis8 [ \D c8 ] \U b2. }
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
  % \midi { \tempo 4 = 67 }
}

