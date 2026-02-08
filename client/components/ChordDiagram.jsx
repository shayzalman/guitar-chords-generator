/**
 * Guitar chord diagram component.
 * Displays a visual representation of finger positions on a guitar fretboard.
 */

// Chord fingering data: [string6(E), string5(A), string4(D), string3(G), string2(B), string1(e)]
// Values: -1 = muted (X), 0 = open (O), 1-5 = fret number
// Fingers: 0 = no finger, 1-4 = finger number (index, middle, ring, pinky)
const CHORD_DATA = {
  // Major chords
  "C": { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], barFret: 0 },
  "D": { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], barFret: 0 },
  "E": { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], barFret: 0 },
  "F": { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barFret: 1 },
  "G": { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], barFret: 0 },
  "A": { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], barFret: 0 },
  "B": { frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], barFret: 2 },

  // Minor chords
  "Cm": { frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barFret: 3 },
  "Dm": { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], barFret: 0 },
  "Em": { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], barFret: 0 },
  "Fm": { frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barFret: 1 },
  "Gm": { frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], barFret: 3 },
  "Am": { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], barFret: 0 },
  "Bm": { frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barFret: 2 },

  // Seventh chords
  "C7": { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0], barFret: 0 },
  "D7": { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], barFret: 0 },
  "E7": { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], barFret: 0 },
  "F7": { frets: [1, 3, 1, 2, 1, 1], fingers: [1, 3, 1, 2, 1, 1], barFret: 1 },
  "G7": { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], barFret: 0 },
  "A7": { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0], barFret: 0 },
  "B7": { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], barFret: 0 },

  // Minor seventh chords
  "Cm7": { frets: [-1, 3, 5, 3, 4, 3], fingers: [0, 1, 3, 1, 2, 1], barFret: 3 },
  "Dm7": { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1], barFret: 0 },
  "Em7": { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0], barFret: 0 },
  "Fm7": { frets: [1, 3, 1, 1, 1, 1], fingers: [1, 3, 1, 1, 1, 1], barFret: 1 },
  "Gm7": { frets: [3, 5, 3, 3, 3, 3], fingers: [1, 3, 1, 1, 1, 1], barFret: 3 },
  "Am7": { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0], barFret: 0 },
  "Bm7": { frets: [-1, 2, 4, 2, 3, 2], fingers: [0, 1, 3, 1, 2, 1], barFret: 2 },

  // Major seventh chords
  "Cmaj7": { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0], barFret: 0 },
  "Dmaj7": { frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1], barFret: 0 },
  "Emaj7": { frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0], barFret: 0 },
  "Fmaj7": { frets: [1, 3, 2, 2, 1, 0], fingers: [1, 4, 2, 3, 1, 0], barFret: 0 },
  "Gmaj7": { frets: [3, 2, 0, 0, 0, 2], fingers: [2, 1, 0, 0, 0, 3], barFret: 0 },
  "Amaj7": { frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0], barFret: 0 },
  "Bmaj7": { frets: [-1, 2, 4, 3, 4, 2], fingers: [0, 1, 3, 2, 4, 1], barFret: 2 },

  // Sus chords
  "Csus4": { frets: [-1, 3, 3, 0, 1, 1], fingers: [0, 3, 4, 0, 1, 1], barFret: 0 },
  "Dsus4": { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3], barFret: 0 },
  "Esus4": { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0], barFret: 0 },
  "Gsus4": { frets: [3, 3, 0, 0, 1, 3], fingers: [2, 3, 0, 0, 1, 4], barFret: 0 },
  "Asus4": { frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0], barFret: 0 },

  "Csus2": { frets: [-1, 3, 0, 0, 1, 0], fingers: [0, 3, 0, 0, 1, 0], barFret: 0 },
  "Dsus2": { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0], barFret: 0 },
  "Esus2": { frets: [0, 2, 4, 4, 0, 0], fingers: [0, 1, 3, 4, 0, 0], barFret: 0 },
  "Gsus2": { frets: [3, 0, 0, 0, 3, 3], fingers: [1, 0, 0, 0, 3, 4], barFret: 0 },
  "Asus2": { frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0], barFret: 0 },

  // Add9 chords
  "Cadd9": { frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0], barFret: 0 },
  "Dadd9": { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0], barFret: 0 },
  "Eadd9": { frets: [0, 2, 2, 1, 0, 2], fingers: [0, 2, 3, 1, 0, 4], barFret: 0 },
  "Gadd9": { frets: [3, 0, 0, 2, 0, 3], fingers: [2, 0, 0, 1, 0, 3], barFret: 0 },

  // Diminished
  "Cdim": { frets: [-1, 3, 4, 2, 4, 2], fingers: [0, 2, 3, 1, 4, 1], barFret: 0 },
  "Ddim": { frets: [-1, -1, 0, 1, 3, 1], fingers: [0, 0, 0, 1, 3, 2], barFret: 0 },
  "Edim": { frets: [0, 1, 2, 0, 2, 0], fingers: [0, 1, 2, 0, 3, 0], barFret: 0 },
  "Fdim": { frets: [-1, -1, 3, 4, 3, 4], fingers: [0, 0, 1, 2, 1, 3], barFret: 0 },
  "Gdim": { frets: [3, 4, 5, 3, 5, 3], fingers: [1, 2, 3, 1, 4, 1], barFret: 3 },
  "Adim": { frets: [-1, 0, 1, 2, 1, 2], fingers: [0, 0, 1, 3, 2, 4], barFret: 0 },
  "Bdim": { frets: [-1, 2, 3, 4, 3, -1], fingers: [0, 1, 2, 4, 3, 0], barFret: 0 },

  // Augmented
  "Caug": { frets: [-1, 3, 2, 1, 1, 0], fingers: [0, 4, 3, 1, 2, 0], barFret: 0 },
  "Daug": { frets: [-1, -1, 0, 3, 3, 2], fingers: [0, 0, 0, 2, 3, 1], barFret: 0 },
  "Eaug": { frets: [0, 3, 2, 1, 1, 0], fingers: [0, 4, 3, 1, 2, 0], barFret: 0 },
  "Faug": { frets: [-1, -1, 3, 2, 2, 1], fingers: [0, 0, 4, 2, 3, 1], barFret: 0 },
  "Gaug": { frets: [3, 2, 1, 0, 0, 3], fingers: [3, 2, 1, 0, 0, 4], barFret: 0 },
  "Aaug": { frets: [-1, 0, 3, 2, 2, 1], fingers: [0, 0, 4, 2, 3, 1], barFret: 0 },
  "Baug": { frets: [-1, 2, 1, 0, 0, 3], fingers: [0, 2, 1, 0, 0, 4], barFret: 0 },

  // Power chords
  "C5": { frets: [-1, 3, 5, 5, -1, -1], fingers: [0, 1, 3, 4, 0, 0], barFret: 0 },
  "D5": { frets: [-1, -1, 0, 2, 3, -1], fingers: [0, 0, 0, 1, 2, 0], barFret: 0 },
  "E5": { frets: [0, 2, 2, -1, -1, -1], fingers: [0, 1, 2, 0, 0, 0], barFret: 0 },
  "F5": { frets: [1, 3, 3, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0], barFret: 0 },
  "G5": { frets: [3, 5, 5, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0], barFret: 0 },
  "A5": { frets: [-1, 0, 2, 2, -1, -1], fingers: [0, 0, 1, 2, 0, 0], barFret: 0 },
  "B5": { frets: [-1, 2, 4, 4, -1, -1], fingers: [0, 1, 3, 4, 0, 0], barFret: 0 },
};

// Alternative chord names mapping
const CHORD_ALIASES = {
  "Cmin": "Cm", "Dmin": "Dm", "Emin": "Em", "Fmin": "Fm", "Gmin": "Gm", "Amin": "Am", "Bmin": "Bm",
  "Cmaj": "C", "Dmaj": "D", "Emaj": "E", "Fmaj": "F", "Gmaj": "G", "Amaj": "A", "Bmaj": "B",
  "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb",
};

// Sharp to flat mapping for transposed chords
const SHARP_TO_FLAT = {
  "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb",
  "C#m": "Dbm", "D#m": "Ebm", "F#m": "Gbm", "G#m": "Abm", "A#m": "Bbm",
};

function normalizeChordName(chord) {
  if (!chord || chord === "N") return null;

  // Try direct match first
  if (CHORD_DATA[chord]) return chord;

  // Try alias
  if (CHORD_ALIASES[chord] && CHORD_DATA[CHORD_ALIASES[chord]]) {
    return CHORD_ALIASES[chord];
  }

  // Try sharp to flat
  if (SHARP_TO_FLAT[chord] && CHORD_DATA[SHARP_TO_FLAT[chord]]) {
    return SHARP_TO_FLAT[chord];
  }

  // Try to extract base chord (e.g., "Cmaj7" -> "C" if Cmaj7 not found)
  const baseMatch = chord.match(/^([A-G][b#]?)/);
  if (baseMatch) {
    const base = baseMatch[1];
    // Try with minor
    if (chord.includes("m") && !chord.includes("maj")) {
      if (CHORD_DATA[base + "m"]) return base + "m";
    }
    // Try base major
    if (CHORD_DATA[base]) return base;
  }

  return null;
}

export default function ChordDiagram({ chord, size = 80 }) {
  const normalizedChord = normalizeChordName(chord);
  const chordInfo = normalizedChord ? CHORD_DATA[normalizedChord] : null;

  if (!chordInfo) {
    return (
      <div
        style={{
          width: size,
          height: size * 1.2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999",
          fontSize: 10,
        }}
      >
        {chord === "N" ? "" : "?"}
      </div>
    );
  }

  const { frets, fingers, barFret } = chordInfo;
  const stringSpacing = size / 7;
  const fretSpacing = (size * 1.1) / 5;
  const startX = stringSpacing;
  const startY = 20;
  const numFrets = 5;

  // Calculate min fret for position indicator
  const playedFrets = frets.filter(f => f > 0);
  const minFret = Math.min(...playedFrets);
  const maxFret = Math.max(...playedFrets);
  const startFret = barFret > 0 ? barFret : (maxFret > 4 ? minFret : 1);
  const showPosition = startFret > 1;

  return (
    <svg
      width={size}
      height={size * 1.3}
      viewBox={`0 0 ${size} ${size * 1.3}`}
      style={{ display: "block" }}
    >
      {/* Chord name */}
      <text
        x={size / 2}
        y={12}
        textAnchor="middle"
        fontSize={11}
        fontWeight="bold"
        fill="#333"
      >
        {chord}
      </text>

      {/* Position indicator */}
      {showPosition && (
        <text
          x={2}
          y={startY + fretSpacing / 2 + 4}
          fontSize={9}
          fill="#666"
        >
          {startFret}
        </text>
      )}

      {/* Nut (thick line at top if starting from fret 1) */}
      {!showPosition && (
        <line
          x1={startX}
          y1={startY}
          x2={startX + stringSpacing * 5}
          y2={startY}
          stroke="#333"
          strokeWidth={3}
        />
      )}

      {/* Frets (horizontal lines) */}
      {Array.from({ length: numFrets + 1 }).map((_, i) => (
        <line
          key={`fret-${i}`}
          x1={startX}
          y1={startY + i * fretSpacing}
          x2={startX + stringSpacing * 5}
          y2={startY + i * fretSpacing}
          stroke="#999"
          strokeWidth={1}
        />
      ))}

      {/* Strings (vertical lines) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <line
          key={`string-${i}`}
          x1={startX + i * stringSpacing}
          y1={startY}
          x2={startX + i * stringSpacing}
          y2={startY + numFrets * fretSpacing}
          stroke="#666"
          strokeWidth={i === 0 || i === 5 ? 1.5 : 1}
        />
      ))}

      {/* Barre indicator */}
      {barFret > 0 && (
        <rect
          x={startX - 3}
          y={startY + (barFret - startFret) * fretSpacing + fretSpacing * 0.2}
          width={stringSpacing * 5 + 6}
          height={fretSpacing * 0.6}
          rx={4}
          fill="#333"
        />
      )}

      {/* Open/muted string indicators and finger positions */}
      {frets.map((fret, stringIdx) => {
        const x = startX + stringIdx * stringSpacing;

        if (fret === -1) {
          // Muted string (X)
          return (
            <text
              key={`marker-${stringIdx}`}
              x={x}
              y={startY - 5}
              textAnchor="middle"
              fontSize={10}
              fill="#666"
            >
              ×
            </text>
          );
        } else if (fret === 0) {
          // Open string (O)
          return (
            <circle
              key={`marker-${stringIdx}`}
              cx={x}
              cy={startY - 8}
              r={4}
              fill="none"
              stroke="#333"
              strokeWidth={1.5}
            />
          );
        } else {
          // Finger position
          const displayFret = fret - startFret + 1;
          if (displayFret > 0 && displayFret <= numFrets) {
            const y = startY + (displayFret - 0.5) * fretSpacing;
            return (
              <circle
                key={`marker-${stringIdx}`}
                cx={x}
                cy={y}
                r={stringSpacing * 0.35}
                fill="#333"
              />
            );
          }
        }
        return null;
      })}
    </svg>
  );
}
