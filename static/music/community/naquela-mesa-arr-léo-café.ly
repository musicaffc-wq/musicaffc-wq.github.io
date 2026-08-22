% Title: Naquela Mesa (Arr.: Léo Café)
% Artist: Nelson Gonçalves

\version "2.26.0"

\header {
  title = "Naquela Mesa Partitura Simples"
}

#(set-global-staff-size 16)

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
    \Score
    autoBeaming = ##f
  }
}

\relative c'' {
  \clef "treble" \time 4/4
  r2 r8 c8 b8 a8
  e8 a8 b8 c8 b8 a8 e4
  r4 r8 a8 b8 c8 b8 a8
  e8 c'8 b8 c8 b8 e,4 f8 ~
  f2 r8 d'8 c8 b8
  f8 b8 c8 d8 c8 b8 f d
  r4 r8 b'8 c8 d8 c8 b8
  f8 b8 c8 d8 c8 b4 e,8 ~ e2 r8 c'8 b8 a8
  e8 a8 b8 c8 b8 a8 e4 r4 r8 a a8 a8 a8 a8

  bes8 a8 gis8 a8 bes8 a4 d8 ~ d2 r8 d8 d8 d8
  d8 c8 b8 d8 c8 b8 f'4
  r8 e8 a,8 b8 c8 d8 c4
  r8 b8 gis8 a8 b8 c4 a8 ~
  a2 r8 c8 b8 a8
  e8 a8 b8 c8 b8 a8 e4
  r4 r8 a8 b8 c8 b8 a8
  e8 c'8 b8 c8 b8 e,4 f8 ~
  f2 r8 d'8 c8 b8
  f8 b8 c8 d8 c8 b8 f d

  r4 r8 b'8 c8 d8 c8 b8
  f8 b8 c8 d8 c8 b4 e,8 ~
  e2 r8 c'8 b8 a8
  e8 a8 b8 c8 b8 a8 e4
  r4 r8 a8 a a8 a8 a8
  bes8 a8 gis8 a8 bes8 a4 d8 ~
  d2 r8 d8 d8 d8
  d8 c8 b8 d8 c8 b8 f'4
  r8 e8 a,8 b8 c8 d8 c4
  r8 b8 gis8 a8 b8 e,4 e'8 ~

  e2 r8 d8 d8 d8
  d8 c8 b8 d8 c8 b8 c4
  r8 b8 a8 b8 c8 d8 c4 ~
  c8 b8 gis8 a8 b8 c4 a8 ~
  a2 r2 \bar "|."
}
