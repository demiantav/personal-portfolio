// Vocabulario emocional compartido por los ojos del finale (processEyes.js) y
// los ojos del hero (heroSubtitleEyes.js), que alternan brasas coral y la
// almendra sólida del finale. Los valores están en grados/fracciones, tal como
// los consume el rig de párpados de cada pantalla. El hero no instancia
// processEyes: comparte la tabla y el renderer para que las dos criaturas
// sientan igual.

export const TILT = 0.1; // inclinación cat-eye (rad)

const DEG = Math.PI / 180;

// Estados del rig de párpados. Ángulos en grados (rotación de la tapa en la
// referencia local del ojo; mismo signo en ambos ojos). pos = cobertura de la
// tapa (0 = retirada, 1 = cubre todo el ojo). bow = curvatura hacia arriba del
// borde inferior (media luna, sonrisa).
//
// `asym` es un metadato del hero: sesgo entre el ojo izquierdo y el derecho
// (fracciones y radianes, ya sin `DEG`). El finale lo ignora; la criatura del
// hero lo usa para que la mirada no se sienta como un bloque.
export const NEUTRAL = {
  up: { rot: 0, pos: 0 },
  lo: { rot: 0, pos: 0 },
  bow: 0,
  tremor: 0,
  sac: [40, 90], // duración de sacádicos (ms)
  micro: 1, // multiplicador de amplitud de microsacádicas
  microGap: [400, 1500], // separación entre microsacádicas (ms)
  blinkMs: 120, // duración de un parpadeo
  blinkGap: [3000, 6000], // separación entre parpadeos (ms)
};

export const EMOTIONS = {
  neutral: NEUTRAL,
  // Escaneo: entrecerrado, sin gesto de tapa
  scan: { ...NEUTRAL, up: { rot: 0, pos: 0.5 }, sac: [40, 70], blinkGap: [4000, 7000] },
  // Enojo: canto interno del párpado superior baja (-25° en referencia local)
  angry: {
    ...NEUTRAL,
    up: { rot: -25, pos: 0.4 },
    tremor: 1,
    sac: [30, 50],
    blinkMs: 90,
    blinkGap: [1800, 3000],
  },
  // Pícara: párpado inferior sube en media luna
  playful: { ...NEUTRAL, lo: { rot: 0, pos: 0.45 }, bow: 0.6, sac: [50, 80] },
  // Sueño: párpado superior pesado, cubre el 45%
  sleepy: {
    ...NEUTRAL,
    up: { rot: 0, pos: 0.45 },
    sac: [160, 240],
    micro: 0.4,
    microGap: [2500, 4500],
    blinkMs: 260,
    blinkGap: [2000, 3500],
    asym: { upPos: 0.02, upRot: 0, loPos: 0 },
  },

  // ─── Vocabulario del hero ───────────────────────────────────────────
  // Performance contenida: una base, un foco y un sueño. El enojo y la
  // desconfianza no son estados completos; son impulsos que se suman a la pose.
  // A24: poca apertura, quietud y asimetría. El ojo nunca se abre del todo.
  hooded: {
    ...NEUTRAL,
    up: { rot: -4, pos: 0.22 },
    lo: { rot: 0, pos: 0.1 },
    bow: 0.06,
    sac: [60, 110],
    micro: 0.2,
    microGap: [2600, 5000],
    blinkMs: 240,
    blinkGap: [5200, 7600],
    asym: { upPos: 0.02, upRot: -0.015, loPos: 0.012 },
  },
  // Foco: la versión quieta y entornada de la mirada de acecho. Una sola
  // silueta para el momento en que el cursor se detiene.
  focus: {
    ...NEUTRAL,
    up: { rot: -8, pos: 0.34 },
    lo: { rot: 0, pos: 0.24 },
    bow: 0.12,
    tremor: 0.12,
    sac: [65, 110],
    micro: 0.28,
    microGap: [2800, 5200],
    blinkMs: 220,
    blinkGap: [5200, 7600],
    asym: { upPos: 0.02, upRot: -0.015, loPos: 0.015 },
  },
};

// Valores planos en radianes/fracciones para integrar con resortes
export const flatten = (s) => ({
  upPos: s.up.pos,
  upRot: s.up.rot * DEG,
  loPos: s.lo.pos,
  loRot: s.lo.rot * DEG,
  bow: s.bow,
  tremor: s.tremor,
});

export const FLAT = Object.fromEntries(
  Object.entries(EMOTIONS).map(([k, v]) => [k, flatten(v)]),
);

export const GEST_KEYS = ['upPos', 'upRot', 'loPos', 'loRot', 'bow', 'tremor'];
