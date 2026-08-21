// Parser de um subconjunto de LilyPond -> mesma AST de comandos que o
// compile() do song_parser.js já entende (note/rest/keySignature/
// timeSignature/block/restoreStartPosition/setTrack/cleff).
//
// Suporta: notas absolutas e \relative, acidentes (is/es, isis/eses),
// durações com pontos, ligaduras (~), pausas, acordes <...>, \time, \key,
// \clef, \new Staff (múltiplas pautas -> tracks), blocos simultâneos
// << ... \\ ... >>, comentários (% e %{ %}).
//
// NÃO suporta (ignorado silenciosamente): quiálteras (\times), notas de
// apoggiatura (\grace), dinâmica/articulação, letra de música, marcações.

const NOTE_LETTERS = ["c", "d", "e", "f", "g", "a", "b"];

const MAJOR_FIFTHS = {
  "c": 0, "g": 1, "d": 2, "a": 3, "e": 4, "b": 5,
  "fis": 6, "cis": 7,
  "f": -1, "bes": -2, "ees": -3, "aes": -4, "des": -5, "ges": -6, "ces": -7,
};

const MINOR_FIFTHS = {
  "a": 0, "e": 1, "b": 2, "fis": 3, "cis": 4, "gis": 5, "dis": 6,
  "d": -1, "g": -2, "c": -3, "f": -4, "bes": -5, "ees": -6, "aes": -7,
};

class LilypondParseError extends Error {}

class Tokenizer {
  constructor(text) {
    // remove comentários de linha e de bloco
    text = text.replace(/%\{[\s\S]*?%\}/g, " ");
    text = text.replace(/%[^\n]*/g, " ");
    // LilyPond aceita ligadura com espaço antes ("c4 ~ c4") ou colada
    // ("c4~ c4") -- normalizamos pra sempre colada na nota anterior, que é
    // o formato que o resto do tokenizer/parser reconhece
    text = text.replace(/\s+~/g, "~");
    this.text = text;
    this.pos = 0;
    this.len = text.length;
  }

  peekChar() {
    return this.text[this.pos];
  }

  skipWhitespace() {
    while (this.pos < this.len && /\s/.test(this.text[this.pos])) this.pos++;
  }

  // devolve o próximo token bruto (string) sem interpretar; null no fim
  next() {
    this.skipWhitespace();
    if (this.pos >= this.len) return null;

    const c = this.text[this.pos];

    if (c === "{" || c === "}") {
      this.pos++;
      return c;
    }

    if (c === "<") {
      if (this.text[this.pos + 1] === "<") {
        this.pos += 2;
        return "<<";
      }
      this.pos++;
      return "<";
    }

    if (c === ">") {
      if (this.text[this.pos + 1] === ">") {
        this.pos += 2;
        return ">>";
      }
      // pode vir seguido de dígitos/pontos (duração do acorde), dedilhado
      // (-1 a -5) e marcador de cifra (*), ex: >4.-1*
      let start = this.pos;
      this.pos++;
      while (this.pos < this.len && /[0-9.]/.test(this.text[this.pos])) this.pos++;
      if (this.text[this.pos] === "-" && /[1-5]/.test(this.text[this.pos + 1])) {
        this.pos += 2;
      }
      if (this.text[this.pos] === "*") {
        this.pos++;
      }
      return this.text.slice(start, this.pos);
    }

    if (c === "\\") {
      if (this.text[this.pos + 1] === "\\") {
        this.pos += 2;
        return "\\\\";
      }
      let start = this.pos;
      this.pos++;
      while (this.pos < this.len && /[A-Za-z]/.test(this.text[this.pos])) this.pos++;
      return this.text.slice(start, this.pos);
    }

    if (c === "|") {
      this.pos++;
      return "|";
    }

    if (c === "\"") {
      let start = this.pos;
      this.pos++;
      while (this.pos < this.len && this.text[this.pos] !== "\"") this.pos++;
      this.pos++; // fecha aspas
      return this.text.slice(start, this.pos);
    }

    if (c === "=") {
      this.pos++;
      return "=";
    }

    // token "solto": nota/pausa/número/palavra — vai até achar espaço ou delimitador
    let start = this.pos;
    while (
      this.pos < this.len &&
      !/[\s{}<>|\\"=]/.test(this.text[this.pos])
    ) {
      this.pos++;
    }
    if (this.pos === start) {
      // caractere estranho isolado; pula pra não travar
      this.pos++;
      return this.text.slice(start, this.pos);
    }
    return this.text.slice(start, this.pos);
  }
}

// tokeniza tudo de uma vez, guardando índice para lookahead/backtrack fácil
// e também a posição (início/fim) de cada token no texto original -- usada
// para destacar a nota correspondente no editor quando clicada na pauta
function tokenize(text) {
  const t = new Tokenizer(text);
  const tokens = [];
  const positions = [];
  while (true) {
    t.skipWhitespace();
    const start = t.pos;
    const tok = t.next();
    if (tok === null) break;
    tokens.push(tok);
    positions.push([start, t.pos]);
  }
  return { tokens, positions };
}

class TokenStream {
  constructor(tokens, positions) {
    this.tokens = tokens;
    this.positions = positions || [];
    this.i = 0;
  }
  peek(offset = 0) {
    return this.tokens[this.i + offset];
  }
  next() {
    return this.tokens[this.i++];
  }
  // posição [início, fim] do último token consumido por next()
  lastPos() {
    return this.positions[this.i - 1] || null;
  }
  atEnd() {
    return this.i >= this.tokens.length;
  }
}

// --- parsing de um token de nota/acorde-membro/pausa ---
// devolve {type:'note', letter, accidental, marks, durTokens: {num, dots}, tie} ou {type:'rest', durTokens, ...} ou null se não for nota/pausa
//
// além do básico, reconhece:
//   -1 a -5   -> número de dedilhado (mesma notação do LilyPond)
//   *         -> marca que o PRÓXIMO token (uma string entre aspas) é uma
//                cifra/acorde a ser exibido acima da nota
const NOTE_TOKEN_RE = /^([a-g])(isis|eses|is|es)?([',]*)(?:(\d+)(\.*))?(?:-([1-5]))?(\*)?(~)?$/;
const REST_TOKEN_RE = /^[rR](?:(\d+)(\.*))?(?:-([1-5]))?(\*)?$/;

function parseNoteToken(raw) {
  // remove decorações comuns anexadas sem espaço (dinâmica \p, articulações
  // -., >, _, etc.) que não suportamos -- preserva um "*" sozinho no final,
  // que agora é reconhecido como indicador de cifra/acorde
  let tok = raw;
  if (!/\*$/.test(tok)) {
    tok = tok.replace(/[-^_][.>^!_+-]?$/, "");
  }
  tok = tok.replace(/[)(]/g, ""); // liga de fraseado, ignorada

  const restMatch = REST_TOKEN_RE.exec(tok);
  if (restMatch) {
    return {
      kind: "rest",
      durNum: restMatch[1] ? parseInt(restMatch[1], 10) : null,
      dots: restMatch[2] ? restMatch[2].length : 0,
      fingering: restMatch[3] ? parseInt(restMatch[3], 10) : null,
      hasChordMarkup: !!restMatch[4],
    };
  }

  const m = NOTE_TOKEN_RE.exec(tok);
  if (!m) return null;

  const [, letter, accSuffix, marks, durNum, dots, fingering, chordMarker, tie] = m;
  let accidental = 0;
  if (accSuffix === "is") accidental = 1;
  else if (accSuffix === "es") accidental = -1;
  else if (accSuffix === "isis") accidental = 2;
  else if (accSuffix === "eses") accidental = -2;

  return {
    kind: "note",
    letter,
    accidental,
    marks: marks || "",
    durNum: durNum ? parseInt(durNum, 10) : null,
    dots: dots ? dots.length : 0,
    tie: !!tie,
    fingering: fingering ? parseInt(fingering, 10) : null,
    hasChordMarkup: !!chordMarker,
  };
}

// calcula duração em "beats de semínima" (quarter-note beats) a partir de
// durNum (ex: 4 = semínima, 8 = colcheia) e número de pontos.
function durationInQuarterBeats(durNum, dots) {
  if (!durNum) return null;
  let beats = 4 / durNum;
  let add = beats / 2;
  for (let i = 0; i < dots; i++) {
    beats += add;
    add /= 2;
  }
  return beats;
}

// --- modo relativo: calcula a oitava da próxima nota dado o pitch anterior ---
function letterIndex(letter) {
  return NOTE_LETTERS.indexOf(letter);
}

function relativeOctave(prevLetter, prevOctave, curLetter, explicitMarks) {
  const prevIdx = letterIndex(prevLetter);
  const curIdx = letterIndex(curLetter);
  let diff = curIdx - prevIdx;
  let octaveAdjust = 0;
  if (diff > 3) octaveAdjust = -1;
  else if (diff < -3) octaveAdjust = 1;
  let octave = prevOctave + octaveAdjust;
  for (const ch of explicitMarks) {
    if (ch === "'") octave += 1;
    else if (ch === ",") octave -= 1;
  }
  return octave;
}

function absoluteOctave(marks) {
  // sem marcas = oitava 3 (convenção lilypond, escala científica: c=C3)
  let octave = 3;
  for (const ch of marks) {
    if (ch === "'") octave += 1;
    else if (ch === ",") octave -= 1;
  }
  return octave;
}

// --- suporte a \transpose: converte nota <-> semitom absoluto ---
const NATURAL_SEMITONES = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

function noteToSemitone(letter, accidental, octave) {
  return octave * 12 + NATURAL_SEMITONES[letter] + accidental;
}

// tabela de semitom-dentro-da-oitava -> [letra, acidente], uma versão
// preferindo sustenidos e outra preferindo bemóis
const SEMITONE_TO_NOTE_SHARP = [
  ["c", 0], ["c", 1], ["d", 0], ["d", 1], ["e", 0], ["f", 0],
  ["f", 1], ["g", 0], ["g", 1], ["a", 0], ["a", 1], ["b", 0],
];
const SEMITONE_TO_NOTE_FLAT = [
  ["c", 0], ["d", -1], ["d", 0], ["e", -1], ["e", 0], ["f", 0],
  ["g", -1], ["g", 0], ["a", -1], ["a", 0], ["b", -1], ["b", 0],
];

function semitoneToNote(semitone, preferFlats) {
  let octave = Math.floor(semitone / 12);
  let inOctave = ((semitone % 12) + 12) % 12;
  let table = preferFlats ? SEMITONE_TO_NOTE_FLAT : SEMITONE_TO_NOTE_SHARP;
  let [letter, accidental] = table[inOctave];
  return { letter, accidental, octave };
}

// --- parser recursivo de expressões musicais ---
// Produz uma árvore simplificada de "eventos" que depois é convertida em
// comandos da AST final. Eventos: {kind:'note',...}, {kind:'rest',...},
// {kind:'chordStart'}, {kind:'chordNote',...}, {kind:'chordEnd', durNum, dots},
// {kind:'time', num, den}, {kind:'key', fifths}, {kind:'clef', value},
// {kind:'sequential', body:[...]}, {kind:'simultaneous', branches:[[...],[...]]},
// {kind:'relative', refLetter, refOctave, body:[...]}, {kind:'newStaff', body:[...]}

class MusicParser {
  constructor(tokens, positions) {
    this.s = new TokenStream(tokens, positions);
  }

  parseTopLevel() {
    const body = [];
    while (!this.s.atEnd()) {
      const expr = this.parseMusicExpr();
      if (expr) body.push(expr);
    }
    return { kind: "sequential", body };
  }

  // consome UMA expressão musical (nota, comando, bloco, etc.) e a devolve
  parseMusicExpr() {
    const tok = this.s.peek();
    if (tok === undefined) return null;

    if (tok === "{") {
      this.s.next();
      const body = [];
      while (this.s.peek() !== "}" && !this.s.atEnd()) {
        const e = this.parseMusicExpr();
        if (e) body.push(e);
      }
      this.s.next(); // consome '}'
      return { kind: "sequential", body };
    }

    if (tok === "<<") {
      this.s.next();
      const branches = [[]];
      while (this.s.peek() !== ">>" && !this.s.atEnd()) {
        if (this.s.peek() === "\\\\") {
          this.s.next();
          branches.push([]);
          continue;
        }
        const e = this.parseMusicExpr();
        if (e) branches[branches.length - 1].push(e);
      }
      this.s.next(); // consome '>>'
      if (branches.length === 1) {
        // não havia "\\" separando vozes -- mas se dentro do bloco houver
        // mais de um "\new Staff", elas já são paralelas por definição
        // (cada uma cria seu próprio contexto), mesmo sem o separador
        // explícito. Ex: << \new Staff {...} \new Staff {...} >>
        const items = branches[0];
        const staffCount = items.filter(i => i && i.kind === "newStaff").length;
        if (staffCount > 1) {
          return { kind: "simultaneous", branches: items.map(i => [i]) };
        }
        return { kind: "sequential", body: items };
      }
      return { kind: "simultaneous", branches };
    }

    if (tok === "<") {
      // acorde
      this.s.next();
      const notes = [];
      while (this.s.peek() && !String(this.s.peek()).startsWith(">")) {
        const raw = this.s.next();
        const parsed = parseNoteToken(raw);
        if (parsed && parsed.kind === "note") {
          const pos = this.s.lastPos();
          if (pos) { parsed.sourceStart = pos[0]; parsed.sourceEnd = pos[1]; }
          notes.push(parsed);
        }
      }
      const closeTok = this.s.next() || ">"; // ex: ">4.", ">4-1^" ou ">"
      const durMatch = /^>(\d*)(\.*)(?:-([1-5]))?(\*)?/.exec(closeTok);
      const durNum = durMatch && durMatch[1] ? parseInt(durMatch[1], 10) : null;
      const dots = durMatch ? durMatch[2].length : 0;
      const fingering = durMatch && durMatch[3] ? parseInt(durMatch[3], 10) : null;
      const chordNode = { kind: "chord", notes, durNum, dots, fingering, hasChordMarkup: !!(durMatch && durMatch[4]) };
      if (chordNode.hasChordMarkup) {
        this.consumeMarkupText(chordNode);
      }

      // Assim como nas notas simples, a ligadura pode vir depois da cifra:
      // <d fis a>4-1*"A" ~ <d fis a>8
      if (this.s.peek() === "~") {
        this.s.next();
        chordNode.tie = true;
      }

      return chordNode;
    }

    if (tok === "|") {
      this.s.next();
      return null; // checagem de compasso: ignorada
    }

    if (tok === "\\\\") {
      // separador de voz encontrado fora de << >> - ignora
      this.s.next();
      return null;
    }

    if (tok.startsWith("\\")) {
      return this.parseCommand();
    }

    // nota ou pausa solta
    this.s.next();
    const parsed = parseNoteToken(tok);
    if (parsed) {
      const pos = this.s.lastPos();
      if (pos) { parsed.sourceStart = pos[0]; parsed.sourceEnd = pos[1]; }
      if ((parsed.kind === "note" || parsed.kind === "rest") && parsed.hasChordMarkup) {
        this.consumeMarkupText(parsed);
      }

      // A ligadura pode aparecer depois da cifra/dedilhado, por exemplo:
      // d4-3*"A" ~ d8
      // Nesse caso o "~" é um token separado (a cifra já consumiu o token
      // entre aspas). Precisamos anexá-lo à nota atual para que a segunda
      // nota seja mesclada pelo CommandBuilder.
      if (parsed.kind === "note" && this.s.peek() === "~") {
        this.s.next();
        parsed.tie = true;
      }

      return parsed;
    }
    return null; // token desconhecido, ignora
  }

  // consome o próximo token como texto de cifra/acorde (ex: "Am", "C7"),
  // se ele for uma string entre aspas -- usado depois de uma nota com "*"
  consumeMarkupText(noteObj) {
    const next = this.s.peek();
    if (next && next.startsWith("\"")) {
      this.s.next();
      noteObj.markupText = next.replace(/^"|"$/g, "");
    }
  }

  parseCommand() {
    const cmd = this.s.next(); // ex: "\time", "\relative", "\new"

    if (cmd === "\\time") {
      const frac = this.s.next() || "4/4";
      const m = /^(\d+)\/(\d+)$/.exec(frac);
      if (m) return { kind: "time", num: parseInt(m[1], 10), den: parseInt(m[2], 10) };
      return null;
    }

    if (cmd === "\\tempo") {
      // formas aceitas: "\tempo 4 = 100", "\tempo 4. = 80",
      // e opcionalmente com um texto antes: \tempo "Allegro" 4 = 120
      let durTok = this.s.next();
      if (durTok && durTok.startsWith("\"")) {
        // era só um texto (ex: "Allegro"); tenta achar a parte numérica em seguida
        durTok = this.s.next();
      }
      if (this.s.peek() === "=") {
        this.s.next(); // consome "="
        const bpmTok = this.s.next();
        const durNum = parseInt(durTok, 10) || 4;
        const bpm = parseInt(bpmTok, 10);
        if (bpm) {
          // converte para bpm equivalente em semínimas, já que o resto do
          // app sempre trabalha com tempo em "batidas de semínima"
          return { kind: "tempo", bpm: Math.round((bpm * 4) / durNum) };
        }
      }
      return null;
    }

    if (cmd === "\\key") {
      const pitchTok = this.s.next() || "c";
      const modeTok = this.s.next() || "\\major";
      const pm = /^([a-g])(isis|eses|is|es)?/.exec(pitchTok);
      const letterKey = pm ? pm[1] + (pm[2] || "") : "c";
      const isMinor = modeTok === "\\minor";
      const table = isMinor ? MINOR_FIFTHS : MAJOR_FIFTHS;
      const fifths = table.hasOwnProperty(letterKey) ? table[letterKey] : 0;
      return { kind: "key", fifths };
    }

    if (cmd === "\\clef") {
      const nameTok = (this.s.next() || "treble").replace(/"/g, "");
      let value = "g";
      if (/bass/i.test(nameTok)) value = "f";
      else if (/alto|tenor/i.test(nameTok)) value = "c";
      else value = "g";
      return { kind: "clef", value };
    }

    if (cmd === "\\relative") {
      // \relative [pitch] { ... }  -- o pitch de referência é opcional
      let refLetter = "c";
      let refOctave = 4; // c' por convenção quando omitido
      const maybePitch = this.s.peek();
      if (maybePitch && maybePitch !== "{" && /^[a-g]/.test(maybePitch)) {
        const raw = this.s.next();
        const parsed = parseNoteToken(raw);
        if (parsed && parsed.kind === "note") {
          refLetter = parsed.letter;
          refOctave = absoluteOctave(parsed.marks);
        }
      }
      const body = this.parseMusicExpr(); // deve ser um bloco { }
      return { kind: "relative", refLetter, refOctave, body: body || { kind: "sequential", body: [] } };
    }

    if (cmd === "\\transpose") {
      // \transpose from to { música } -- transpõe todas as notas de dentro
      // do bloco pelo intervalo entre "from" e "to"
      const fromTok = this.s.next();
      const toTok = this.s.next();
      const fromPitch = parseNoteToken(fromTok);
      const toPitch = parseNoteToken(toTok);
      const body = this.parseMusicExpr();
      return {
        kind: "transpose",
        fromPitch: fromPitch && fromPitch.kind === "note" ? fromPitch : null,
        toPitch: toPitch && toPitch.kind === "note" ? toPitch : null,
        body: body || { kind: "sequential", body: [] },
      };
    }

    if (cmd === "\\new") {
      const typeTok = this.s.next(); // "Staff", "PianoStaff", "Voice", etc.
      // nome opcional: = "nome" ou = nome
      if (this.s.peek() === "=") {
        this.s.next();
        this.s.next(); // consome o nome
      }
      const body = this.parseMusicExpr();
      const isStaff = /staff/i.test(typeTok || "");
      if (isStaff && !/pianostaff|grandstaff|staffgroup/i.test(typeTok)) {
        return { kind: "newStaff", body: body || { kind: "sequential", body: [] } };
      }
      // PianoStaff/StaffGroup/Voice etc: não cria track nova, só repassa o conteúdo
      return body;
    }

    // comando desconhecido (dinâmica, \times, \grace, \version, \header, etc.)
    // se vier seguido de bloco, processa o bloco normalmente (mais tolerante);
    // senão, se vier seguido de argumento tipo fração (\times 2/3), consome e ignora.
    if (this.s.peek() === "{") {
      return this.parseMusicExpr();
    }
    // consome um possível argumento simples (ex: número, fração) sem interpretar
    if (this.s.peek() && /^[\d/]+$/.test(this.s.peek())) {
      this.s.next();
      if (this.s.peek() === "{") return this.parseMusicExpr();
    }
    return null;
  }
}

// --- segunda passada: percorre a árvore de eventos e produz a AST de comandos ---

class CommandBuilder {
  constructor() {
    this.commands = [];
    this.currentTsDen = 4;
    this.trackCounter = 0;
    this.usedExplicitTrack = false;
  }

  push(cmd) {
    this.commands.push(cmd);
  }

  // multiplicador ("duration" no AST) equivalente a durNum/dots dado o
  // denominador do compasso atual (para casar com beatsPerNote do compile())
  multiplierFor(durNum, dots) {
    const quarterBeats = durationInQuarterBeats(durNum, dots);
    if (quarterBeats === null) return null;
    // beatsPerNote atual = 4/currentTsDen ; queremos duração final em beats
    // de semínima == quarterBeats, então multiplier = quarterBeats / (4/tsDen)
    return (quarterBeats * this.currentTsDen) / 4;
  }

  build(root) {
    // Se o arquivo tiver mais de uma expressão musical solta no nível mais
    // alto (sem "<< >>" nem "\new Staff" envolvendo), isso quase sempre
    // significa que a pessoa quis escrever pautas separadas (ex: mão
    // direita e mão esquerda de piano) mas esqueceu de agrupar -- em vez
    // de tocar tudo em sequência numa pauta só, tratamos cada bloco como
    // sua própria pauta, tocando junto desde o início.
    if (root && root.kind === "sequential" && root.body.length > 1) {
      // comandos "globais" (não são música em si, valem pra tudo que vem
      // depois) nunca devem ser tratados como se fossem uma pauta -- só
      // dividimos automaticamente quando há mais de um bloco de MÚSICA de
      // verdade solto no nível mais alto
      const GLOBAL_KINDS = ["tempo", "key", "time", "clef"];
      const items = root.body;
      const globals = items.filter(i => i && GLOBAL_KINDS.includes(i.kind));
      const musicItems = items.filter(i => !(i && GLOBAL_KINDS.includes(i.kind)));

      const alreadyExplicit = musicItems.every(i => i && i.kind === "newStaff");
      if (musicItems.length > 1 && !alreadyExplicit) {
        root = {
          kind: "sequential",
          body: [
            ...globals,
            {
              kind: "simultaneous",
              branches: musicItems.map(i => [
                i && i.kind === "newStaff" ? i : { kind: "newStaff", body: i },
              ]),
            },
          ],
        };
      }
    }

    this.walk(root, { lastDur: { num: 4, dots: 0 }, relStack: [] });
    return this.commands;
  }

  // "ctx" carrega o estado mutável relevante (duração implícita corrente e
  // pilha de referências de oitava para modo relativo). Vozes simultâneas
  // recebem uma CÓPIA do ctx para não vazarem duração implícita entre si.
  walk(node, ctx) {
    if (!node) return;

    switch (node.kind) {
      case "sequential": {
        for (const child of node.body) this.walkEvent(child, ctx);
        break;
      }
      case "note":
      case "rest":
      case "chord":
        this.walkEvent(node, ctx);
        break;
      default:
        this.walkEvent(node, ctx);
    }
  }

  walkEvent(node, ctx) {
    if (!node) return;

    switch (node.kind) {
      case "time": {
        this.currentTsDen = node.den;
        this.push(["timeSignature", node.num, node.den]);
        return;
      }
      case "tempo": {
        this.push(["tempo", node.bpm]);
        return;
      }
      case "key": {
        this.push(["keySignature", node.fifths]);
        return;
      }
      case "clef": {
        this.push(["cleff", node.value]);
        return;
      }
      case "relative": {
        const newCtx = {
          lastDur: ctx.lastDur,
          relStack: ctx.relStack.concat([{ letter: node.refLetter, octave: node.refOctave }]),
          transposeOffset: ctx.transposeOffset,
          transposePreferFlats: ctx.transposePreferFlats,
        };
        this.walk(node.body, newCtx);
        return;
      }
      case "transpose": {
        let offset = 0
        let preferFlats = ctx.transposePreferFlats

        if (node.fromPitch && node.toPitch) {
          const fromOct = absoluteOctave(node.fromPitch.marks)
          const toOct = absoluteOctave(node.toPitch.marks)
          const fromSemi = noteToSemitone(node.fromPitch.letter, node.fromPitch.accidental, fromOct)
          const toSemi = noteToSemitone(node.toPitch.letter, node.toPitch.accidental, toOct)
          offset = toSemi - fromSemi
          preferFlats = node.toPitch.accidental < 0
        }

        const newCtx = {
          lastDur: ctx.lastDur,
          relStack: ctx.relStack,
          transposeOffset: (ctx.transposeOffset || 0) + offset,
          transposePreferFlats: preferFlats,
        }
        this.walk(node.body, newCtx)
        return
      }
      case "newStaff": {
        this.push(["setTrack", this.trackCounter]);
        this.trackCounter++;
        this.walk(node.body, {
          lastDur: ctx.lastDur,
          relStack: ctx.relStack.map(r => ({ ...r })),
          transposeOffset: ctx.transposeOffset,
          transposePreferFlats: ctx.transposePreferFlats,
        });
        return;
      }
      case "simultaneous": {
        const blockCommands = [];
        const saved = this.commands;
        node.branches.forEach((branch, idx) => {
          this.commands = blockCommands;
          if (idx > 0) this.push(["restoreStartPosition"]);
          this.walk({ kind: "sequential", body: branch }, {
            lastDur: ctx.lastDur,
            // cópia independente por ramo -- sem isso, um ramo mutava a
            // referência de oitava relativa que o próximo ramo também lia
            relStack: ctx.relStack.map(r => ({ ...r })),
            transposeOffset: ctx.transposeOffset,
            transposePreferFlats: ctx.transposePreferFlats,
          });
        });
        this.commands = saved;
        this.push(["block", blockCommands]);
        return;
      }
      case "sequential": {
        this.walk(node, ctx);
        return;
      }
      case "rest": {
        let durNum = node.durNum, dots = node.dots;
        if (durNum === null) {
          durNum = ctx.lastDur.num;
          dots = ctx.lastDur.dots;
        } else {
          ctx.lastDur = { num: durNum, dots };
        }
        const mult = this.multiplierFor(durNum, dots);
        const opts = {};
        if (mult !== null && Math.abs(mult - 1) > 1e-9) opts.duration = mult;
        if (node.markupText) opts.markup = node.markupText;
        this.push(Object.keys(opts).length ? ["rest", opts] : ["rest"]);
        return;
      }
      case "note": {
        this.emitNote(node, ctx);
        return;
      }
      case "chord": {
        let durNum = node.durNum, dots = node.dots;
        if (durNum === null) {
          durNum = ctx.lastDur.num;
          dots = ctx.lastDur.dots;
        } else {
          ctx.lastDur = { num: durNum, dots };
        }
        // No LilyPond real, todas as notas de um acorde são calculadas em
        // modo relativo em relação à PRIMEIRA nota do próprio acorde (não
        // de forma cumulativa nota a nota). Por isso resolvemos a primeira
        // nota normalmente (o que atualiza a referência da pilha) e as
        // demais usando essa mesma referência fixa, sem deixar a pilha
        // avançar entre elas.
        //
        // Além disso, as notas do acorde precisam soar AO MESMO TEMPO, não
        // uma depois da outra -- por isso ficam dentro de um bloco com
        // "restoreStartPosition" antes de cada nota além da primeira,
        // voltando sempre para a posição inicial do acorde.
        const blockCommands = [];
        const saved = this.commands;
        this.commands = blockCommands;
        let chordRef = null;
        node.notes.forEach((n, idx) => {
          const noteWithDur = Object.assign({}, n, { durNum, dots });
          if (idx === 0) {
            // dedilhado/cifra do acorde (ex: <c e g>4-1*"Am") ficam
            // visualmente associados à primeira nota
            if (node.fingering != null) noteWithDur.fingering = node.fingering;
            if (node.markupText) noteWithDur.markupText = node.markupText;
            const resolvedOctave = this.emitNote(noteWithDur, ctx);
            chordRef = { letter: n.letter, octave: resolvedOctave };
          } else {
            this.push(["restoreStartPosition"]);
            this.emitNote(noteWithDur, ctx, chordRef);
          }
        });
        this.commands = saved;
        this.push(["block", blockCommands]);
        return;
      }
      default:
        return;
    }
  }

  // refOverride, se fornecido, é usado no lugar do topo da pilha relativa
  // e NÃO é persistido (usado para notas de acorde além da primeira).
  // Devolve a oitava científica resolvida (útil para o chamador de acordes).
  emitNote(node, ctx, refOverride) {
    let durNum = node.durNum, dots = node.dots;
    if (durNum === null) {
      durNum = ctx.lastDur.num;
      dots = ctx.lastDur.dots;
    } else {
      ctx.lastDur = { num: durNum, dots };
    }

    // resolve oitava
    let octave;
    if (refOverride) {
      octave = relativeOctave(refOverride.letter, refOverride.octave, node.letter, node.marks);
    } else if (ctx.relStack.length > 0) {
      const top = ctx.relStack[ctx.relStack.length - 1];
      octave = relativeOctave(top.letter, top.octave, node.letter, node.marks);
      // atualiza a referência do topo da pilha para a nota atual
      ctx.relStack[ctx.relStack.length - 1] = { letter: node.letter, octave };
    } else {
      octave = absoluteOctave(node.marks);
    }

    // converte para a convenção de oitava do app (app_oitava = lilypond_oitava + 1,
    // já que lilypond c' (oitava científica 4, dó central) == app "C5" == MIDI 60)
    let finalLetter = node.letter;
    let finalAccidental = node.accidental;
    let finalOctave = octave;

    // aplica \transpose, se este trecho estiver dentro de um bloco desses --
    // a resolução de oitava do modo relativo (acima) usa sempre as notas
    // ORIGINAIS (sem transpor), exatamente como o LilyPond de verdade faz;
    // só agora, com a altura final decidida, é que deslocamos o resultado
    if (ctx.transposeOffset) {
      const semitone = noteToSemitone(node.letter, node.accidental, octave) + ctx.transposeOffset;
      const conv = semitoneToNote(semitone, ctx.transposePreferFlats);
      finalLetter = conv.letter;
      finalAccidental = conv.accidental;
      finalOctave = conv.octave;
    }

    const appOctave = finalOctave + 1;

    const name = finalLetter.toUpperCase() + appOctave;

    const opts = {};
    const mult = this.multiplierFor(durNum, dots);
    if (mult !== null && Math.abs(mult - 1) > 1e-9) opts.duration = mult;
    if (finalAccidental === 1 || finalAccidental === 2) opts.sharp = true;
    else if (finalAccidental === -1 || finalAccidental === -2) opts.flat = true;
    else opts.natural = true;
    if (node.sourceStart != null) {
      opts.sourceStart = node.sourceStart;
      opts.sourceEnd = node.sourceEnd;
    }
    if (node.fingering != null) opts.fingering = node.fingering;
    if (node.markupText) opts.markup = node.markupText;

    // Nota importante: diferente do LML, aqui SEMPRE sabemos a altura exata
    // pretendida (LilyPond é explícito), então marcamos sempre um acidente
    // explícito (sharp/flat/natural) para não deixar o compile() reaplicar
    // a armadura de forma automática por conta própria.

    // ligadura: tenta mesclar com uma nota pendente da MESMA altura
    if (
      ctx.pendingTie &&
      ctx.pendingTie.letter === node.letter &&
      ctx.pendingTie.accidental === node.accidental &&
      ctx.pendingTie.octave === appOctave
    ) {
      // quanto (em unidades de multiplicador) já foi acumulado antes desta
      // continuação -- é exatamente onde ESTA nota começa dentro da nota
      // combinada, e é o que usamos pra posicionar corretamente uma cifra
      // que caia sobre ela (ex: quando a ligadura atravessa um compasso e
      // a cifra é escrita de novo no início do novo compasso)
      const offsetMult = ctx.pendingTie.command[2].duration || 1;

      if (node.markupText) {
        const mergedOpts = ctx.pendingTie.command[2];
        if (!mergedOpts.extraMarkups) mergedOpts.extraMarkups = [];
        mergedOpts.extraMarkups.push({ offsetMult, text: node.markupText });
      }

      ctx.pendingTie.command[2].duration =
        offsetMult + (mult === null ? 1 : mult);
      ctx.pendingTie = node.tie ? ctx.pendingTie : null;
      return octave;
    }

    const hasOpts = Object.keys(opts).length > 0;
    const command = hasOpts ? ["note", name, opts] : ["note", name];
    this.push(command);

    if (node.tie) {
      if (!opts.duration) opts.duration = 1;
      ctx.pendingTie = {
        letter: node.letter,
        accidental: node.accidental,
        octave: appOctave,
        command,
      };
    } else {
      ctx.pendingTie = null;
    }

    return octave;
  }
}

export function parseLilypond(text) {
  const { tokens, positions } = tokenize(text);
  const musicParser = new MusicParser(tokens, positions);
  const tree = musicParser.parseTopLevel();
  const builder = new CommandBuilder();
  return builder.build(tree);
}

