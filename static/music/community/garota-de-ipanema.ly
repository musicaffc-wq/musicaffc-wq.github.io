% Title: Garota de Ipanema
% Artist: Tom Jobim

\relative d'' {
  \clef "treble" 
  \time 2/4 
  \key a \major 
  \tempo 4 = 45
  
 
    
r2 
d8 d16 b b8 b16 a |
    d8 d16 b b16 b16 a d ~ |
    d16 d8 b16 b8 b16 a |
    d8 d16 b b16 b16 a c ~ |
    c16 c8 a16 a8 a16 g |
    b8 g16 g g16 g e g ~ |
    g2 |
    r2 |
  
d'8 d16 b b8 b16 a |

  d8 d16 b b16 b16 a d ~ |
    d16 d8 b16 b8 b16 a |
    d8 d16 b b16 b16 a c ~ |
    c16 c8 a16 a8 a16 g |
    b8 g16 g g16 g e g ~ |
    g2 |
    R2 | 
  c2 ~ 
  c16 cis8 c16 ais16 c8 ais16 |
  gis2 |
  ais2 |
  dis2 ~ |
  dis16 e8 dis16 cis16 dis8 cis16 |
  b2 |
  cis2 |
  e2 ~ |
  e16 f8 e16 d16 e8 d16 |

  c2 |
  d4 r16 e8 f16 |
  g16 g,8 a16 b16 c8 d16 |
  dis8. e16 ~ e8 r8 |
  f16 f,8 g16 a16 b8 c16 |
  cis8. d16 ~ d8 r8 |
  
  \repeat volta 2 {
    d8 d16 b b8 b16 a |
    d8 d16 b b16 b16 a d ~ |
    d16 d8 b16 b8 b16 a |
    d8 d16 b b16 b16 a e' ~ |

    e16 e8 c16 c8 c16 a |
    g'8 b,16 b b16 b a b ~ |
    b4 r4 |
    r8. b16 b16 b8 a16 |
    b4 r4 |
    r8. b16 b16 b8 a16 |
    b2 ~ |
    b4 r4 |
  }
}

\score {
  <<
    \new Staff = "P1" <<
      \set Staff.instrumentName = "Piano"
      \context Staff <<
        \context Voice = "PartPOneVoiceOne" {
          \PartPOneVoiceOne
        }
      >>
    >>
  >>
  \layout {}
}
