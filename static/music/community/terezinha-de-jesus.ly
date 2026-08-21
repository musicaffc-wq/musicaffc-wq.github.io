% Title: Terezinha de Jesus
% Artist: Cancioneiro Infantil

\version "2.26.0"
% automatically converted by musicxml2ly from -
\pointAndClickOff

\header {
  title = "Terezinha de Jesus"
  composer = Composer
  "id: software" = "Notion 3.7.1.113463"
}
#(set-global-staff-size 16.05987354330709)
\paper {
  paper-width = 21.59\cm
  paper-height = 27.94\cm
  top-margin = 1.9\cm
  bottom-margin = 1.58\cm
  left-margin = 1.58\cm
  right-margin = 1.58\cm
  indent = 1.66\cm
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
PartPOneVoiceOne = \relative c'' {
  \clef "treble" \time 3/4 \key c 

\tempo 4 = 45 
\major r2. r4 r4 c8 [ e8 ] | % 1
  a,4 a4 c8 [ e8 ] | % 2
  a,2 e'8 [ e8 ] | % 3
  f4 e4 d8 [ cis8 ] | % 4
  d2 d8 [ e8 ] | % 5
  g4 f4 e8 [ d8 ] | % 6
  f4 e4 e8 [ f8 ] | % 7
  e4 d4 c8 [ b8 ] | % 8
  a2 c8 [ e8 ] | % 9

  \barNumberCheck #10
  a,4 a4 c8 [ e8 ] | % 10
  a,2 e'8 [ e8 ] | % 11
  f4 e4 d8 [ cis8 ] | % 12
  d2 d8 [ e8 ] | % 13
  g4 f4 e8 [ d8 ] | % 14
  f4 e4 e8 [ f8 ] | % 15
  e4 d4 c8 [ b8 ] | % 16
  a2 r4 \bar "|."
}


% The score definition
\score {
  <<
    \new Staff = "P1" <<
      \set Staff.instrumentName = "Part"
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
  % \midi { \tempo 4 = 60 }
}

