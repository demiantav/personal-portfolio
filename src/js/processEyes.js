import gsap from 'gsap';
import { createNoise2D } from 'simplex-noise';

// Dos ojos ROJOS durante la fase de proceso. Todo va atado al scroll real del
// holder (.progress-reveal, skillsProgressReveal.js), sin ScrollTrigger propio.
//  · PIN: el título queda fijo; los ojos entran por las tapas (cerrados al 50%,
//    se abren) en el mismo punto donde estaba el título. El cuerpo no escala;
//  · SUBIDA: tras el pin los ojos suben a la franja superior con inercia;
//  · EMOCIONES: el gesto vive en las TAPAS. Cada estado fija rotación (°) y
//    cobertura (%) del párpado superior e inferior, como un rig de párpados.
//    Los cambios son secos (resorte casi críticamente amortiguado, ~180 ms);
//  · disparadores reactivos (scroll brusco, puntero quieto, inactividad) y un
//    ciclo de emociones mientras el título está fijo;
//  · MIRADA: sacádicos secos entre objetivos (cartas) y persecución suave con
//    el scroll. Sin flotación: el globo no se mueve, sólo párpados.
// Forma: almendra asimétrica (cat-eye). Las tapas usan --bg-color para
// fundirse con la sección. Reduced-motion / sin JS: sin overlay.
const REDUCE = '(prefers-reduced-motion: reduce)';
const COARSE = '(hover: none)';
const RED = '#ff0000';
const FALLBACK_LID = '#080707';
const DEG = Math.PI / 180;
const TILT = 0.1; // inclinación cat-eye (rad)
const EYE_TOP = 0.14; // franja superior (fracción de H) donde quedan al subir
const OPEN_FROM = 0.55; // progreso del pin en que empiezan a entrar (título ya saliendo)
const OPEN_TO = 0.95; // y en que terminan de abrir
const LAG_RIGHT = 0.04; // s: retardo mínimo del ojo derecho respecto al estado compartido
const MAX_A = 0.16; // rotación de tapas por mirada lateral (rad)
const SQUINT_MAX = 0.2; // cobertura extra por scroll rápido
const SAC_MIN = 40; // duración mínima de un sacádico (ms)
const SAC_MAX = 90; // duración máxima de un sacádico (ms)
const SAC_GAP = 200; // separación mínima entre dos sacádicos de objetivo (ms)
const MICRO_MS = 25; // duración de una microsacádica
const MICRO_AMP = 0.05; // amplitud base de una microsacádica (unidades de mirada)
const DRIFT_AMP = 0.02; // microderiva continua de la fijación
const HIT_EVERY = 6; // frames entre hit-tests del puntero/carta centrada
const REFOCUS_MS = 500; // cada cuánto se re-enfoca la misma carta mientras se desplaza
const LID_SETTLE = 0.18; // s: asentado de las tapas (seco, zeta 1)
const TREMOR_HZ = 22; // frecuencia del temblor de enojo

// Disparadores reactivos
const BRUSQUE_PX = 1500; // px/s promedio dentro de la ventana para considerar scroll brusco
const BRUSQUE_WIN = 400; // ventana de medición (ms)
const JUMP_PX = 400; // desplazamiento por frame que se considera salto, no gesto
const ANGRY_MS = 2200; // cuánto dura el enojo tras el último brusco
const SCAN_HOLD = 350; // ms sin avance de cards para dejar de escanear
const SCAN_FIX = [600, 1200]; // fijación entre saltos del escaneo (ms)
const PLAY_MS = 1500; // puntero quieto sobre una carta para la pícara (ms)
const PLAY_HOLD = 300; // cuánto se mantiene la pícara tras soltar (ms)
const STILL_PX = 24; // movimiento del puntero que cuenta como "no quieto"
const SLEEP_AFTER = 6000; // inactividad para el sueño (ms)

// Ciclo de emociones mientras el título está fijo
const CYCLE = ['angry', 'playful', 'sleepy'];
const CYCLE_GAP = [3000, 5000];

// Estados del rig de párpados. Ángulos en grados (rotación de la tapa en la
// referencia local del ojo; mismo signo en ambos ojos). pos = cobertura de la
// tapa (0 = retirada, 1 = cubre todo el ojo). bow = curvatura hacia arriba del
// borde inferior (media luna, sonrisa).
const NEUTRAL = {
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
const EMOTIONS = {
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
  },
};
// Valores planos en radianes/fracciones para integrar con resortes
const flatten = (s) => ({
  upPos: s.up.pos,
  upRot: s.up.rot * DEG,
  loPos: s.lo.pos,
  loRot: s.lo.rot * DEG,
  bow: s.bow,
  tremor: s.tremor,
});
const FLAT = Object.fromEntries(Object.entries(EMOTIONS).map(([k, v]) => [k, flatten(v)]));
const GEST_KEYS = ['upPos', 'upRot', 'loPos', 'loRot', 'bow', 'tremor'];
const ENTER_POS = 0.5; // tapas a mitad al entrar (ojos cerrados)

const noise = createNoise2D();

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoothstep = (a, b, t) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
const easeOut3 = (t) => 1 - Math.pow(1 - t, 3);
// Resorte amortiguado: settle = tiempo de asentado (s), zeta < 1 da rebote leve.
const mkSpring = (settle, zeta) => {
  const w = (2 * Math.PI) / settle;
  return { k: w * w, c: 2 * zeta * w };
};
const integrate = (s, target, sp, dt) => {
  s.vel += ((target - s.v) * sp.k - s.vel * sp.c) * dt;
  s.v += s.vel * dt;
  return s.v;
};
const rand = (a, b) => a + Math.random() * (b - a);

export const processEyes = () => {
  if (window.matchMedia(REDUCE).matches) return;
  const titleSection = document.querySelector('.progress-title-section');
  const holder = document.querySelector('.progress-reveal');
  if (!titleSection || !holder) return;
  const cards = document.querySelector('.progress-section_cards-container');
  const titleEl = titleSection.querySelector('.section-title__progress');
  const titleBlock = titleSection.querySelector('.section-title');
  const lines = titleSection.querySelectorAll('.section-title__line');
  const isCoarse = window.matchMedia(COARSE).matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'process-eyes';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Color de las tapas: el mismo fondo de la sección (variable de tema)
  const lid =
    getComputedStyle(titleSection).getPropertyValue('--bg-color').trim() || FALLBACK_LID;

  // ─── Estado ─────────────────────────────────────────────────────────
  let W = 0;
  let H = 0;
  let alpha = 0;
  let p = 0; // progreso horizontal de las cards (0→1)
  let lastP = 0;
  let pinP = 0; // 0→1 mientras el título está fijo
  let riseP = 0; // 0→1 mientras la sección sale y las cards entran
  let lastPinP = -1;
  let lastT = 0;
  let raf = 0;
  let running = false;
  let cyInit = false;
  const S_CY = mkSpring(0.9, 0.95);
  const S_GAZE = mkSpring(0.85, 0.9); // persecución con el scroll
  const S_MIX = mkSpring(0.16, 0.9); // transición scroll ↔ mirada a objetivo
  const S_LID = mkSpring(LID_SETTLE, 1); // tapas: secas, sin rebote
  const S_SQUINT = mkSpring(0.25, 0.9);
  const sCy = { v: 0, vel: 0 };
  const sGaze = { v: 0, vel: 0 };
  const sMix = { v: 0, vel: 0 };
  const sSquint = { v: 0, vel: 0 };
  // Gestos de tapa mezclados. Arrancan con tapas a mitad (ojos cerrados).
  const gest = Object.fromEntries(
    GEST_KEYS.map((k) => [
      k,
      { v: k === 'upPos' || k === 'loPos' ? ENTER_POS : 0, vel: 0 },
    ]),
  );

  // Estado emocional
  let curState = 'neutral';
  let angryUntil = -Infinity;
  let scrollLog = []; // {t, dy}: desplazamientos recientes para medir brusquedad
  let lastScrollY = window.scrollY;
  let lastPMoveAt = -Infinity;
  let playUntil = -Infinity;
  let anchorX = -1;
  let anchorY = -1;
  let anchorAt = performance.now();
  let lastActivityAt = performance.now();
  let cycleState = null;
  let cycleAt = 0;

  // Ojos: sólo se diferencian por el retardo del resorte (el derecho sigue un
  // poco después). `s` guarda el gesto que realmente dibuja cada ojo.
  const eyes = [
    { dir: -1, lag: 0 },
    { dir: 1, lag: LAG_RIGHT },
  ].map((e) => ({
    ...e,
    s: { upPos: ENTER_POS, upRot: 0, loPos: ENTER_POS, loRot: 0, bow: 0, tremor: 0 },
  }));

  // ─── Sacádicos (mirada a objetivo) ──────────────────────────────────
  let sacFrom = { x: 0, y: 0 };
  let sacTo = { x: 0, y: 0 };
  let sacT0 = 0;
  let sacDur = 1;
  let lastSacAt = -Infinity;
  let anchor = { x: 0, y: 0 };
  let nextMicro = performance.now() + rand(...NEUTRAL.microGap);
  const sacAt = (now) => {
    const e = easeOut3(clamp((now - sacT0) / sacDur, 0, 1));
    return {
      x: sacFrom.x + (sacTo.x - sacFrom.x) * e,
      y: sacFrom.y + (sacTo.y - sacFrom.y) * e,
    };
  };
  const startSaccade = (to, now, dur, gated = true) => {
    sacFrom = sacAt(now);
    sacTo = to;
    sacT0 = now;
    sacDur = dur;
    if (gated) lastSacAt = now;
  };

  // Objetivo de mirada a partir de una carta: x/y normalizados al viewport
  const gazeFor = (card) => {
    const r = card.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return {
      x: clamp((W / 2 - cx) / (W * 0.5), -1, 1) * 0.9, // positivo = mira a la izquierda
      y: clamp((cy - H / 2) / (H * 0.5), -1, 1) * 0.5, // positivo = mira abajo
    };
  };

  // Cartas con su centro dentro del viewport: candidatas del escaneo
  const cardItems = () => document.querySelectorAll('.progress__card');
  const scanTargets = () => {
    const out = [];
    for (const c of cardItems()) {
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      if (cx > W * 0.08 && cx < W * 0.92) out.push(gazeFor(c));
    }
    return out;
  };
  let scanNext = 0;
  let scanLast = -1;

  // Carta bajo el puntero (mouse) o, en táctil, la más centrada del viewport
  let mouse = false;
  let px = -1;
  let py = -1;
  let dirtyHit = true;
  let frameN = 0;
  let lastCard = null;
  const hitCard = () => {
    if (mouse && px >= 0) {
      const el = document.elementFromPoint(px, py);
      return el?.closest?.('.progress__card') ?? null;
    }
    if (isCoarse) {
      let best = null;
      let bestD = Infinity;
      for (const c of cardItems()) {
        const r = c.getBoundingClientRect();
        if (r.right <= 0 || r.left >= W) continue;
        const d = Math.abs(r.left + r.width / 2 - W / 2);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return best;
    }
    return null;
  };

  // Parpadeo compartido: ambos párpados cierran a la vez, con la cadencia del
  // estado activo. La tapa superior cubre todo el ojo en el pico.
  let blinkStart = -1;
  let nextBlink = performance.now() + 2000 + Math.random() * 2000;
  const blinkLevel = (now) => {
    const cfg = EMOTIONS[curState];
    if (blinkStart < 0 && now >= nextBlink) blinkStart = now;
    if (blinkStart < 0) return 0;
    const ph = (now - blinkStart) / cfg.blinkMs;
    if (ph >= 1) {
      blinkStart = -1;
      nextBlink = now + rand(...cfg.blinkGap);
      return 0;
    }
    return Math.sin(ph * Math.PI); // 0 → 1 → 0 suave
  };

  // ─── Medición ───────────────────────────────────────────────────────
  const measure = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  measure();

  // ─── Almendra asimétrica (marco local, canto externo en +x) ────────
  const almond = (rx, ry) => {
    ctx.beginPath();
    ctx.moveTo(-rx * 0.95, ry * 0.1);
    ctx.bezierCurveTo(-rx * 0.55, -ry * 1.3, rx * 0.3, -ry * 1.5, rx, -ry * 0.28);
    ctx.bezierCurveTo(rx * 0.45, ry * 0.85, -rx * 0.4, ry * 1.05, -rx * 0.95, ry * 0.1);
    ctx.closePath();
  };

  // ─── Dibujo de un ojo ───────────────────────────────────────────────
  // El cuerpo es fijo; sólo se dibujan las tapas encima, recortadas al ojo.
  // Tapa superior: su borde está en y = -1.3ry + pos·2.6ry (pos 0 = retirada,
  // 1 = cubre todo). Rotación positiva = canto interno (x<0 local) sube.
  // Tapa inferior: su borde sube con pos, y `bow` lo curva hacia arriba.
  const drawEye = (eye, cx, cy, R, look) => {
    const rx = R * 1.9;
    const ry = R * 0.82;
    const s = eye.s;
    const big = ry * 6;

    ctx.save();
    ctx.translate(cx + look.dx, cy);
    ctx.scale(eye.dir, 1); // el ojo izquierdo es espejo: canto externo hacia fuera
    ctx.rotate(-TILT); // cat-eye: canto externo elevado

    // Cuerpo: almendra roja plana, sin glow. No escala nunca.
    ctx.fillStyle = RED;
    almond(rx, ry);
    ctx.fill();

    ctx.save();
    almond(rx, ry);
    ctx.clip();
    ctx.fillStyle = lid;

    // Tapa superior
    const upRot = s.upRot + look.upRotExtra;
    const yu = -ry * 1.3 + clamp(s.upPos, 0, 1) * ry * 2.6;
    ctx.save();
    ctx.rotate(upRot);
    ctx.beginPath();
    ctx.moveTo(-big, -big);
    ctx.lineTo(big, -big);
    ctx.lineTo(big, yu);
    ctx.lineTo(-big, yu);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Tapa inferior (con curvatura de sonrisa)
    const yl = ry * 1.3 - clamp(s.loPos, 0, 1) * ry * 2.6;
    ctx.save();
    ctx.rotate(s.loRot + look.loRotExtra);
    ctx.beginPath();
    ctx.moveTo(-big, big);
    ctx.lineTo(big, big);
    ctx.lineTo(big, yl);
    ctx.quadraticCurveTo(0, yl - 2 * s.bow * ry, -big, yl);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
    ctx.restore();
  };

  // ─── Estado emocional: disparadores reactivos ───────────────────────
  // Prioridad: enojo > escaneo > pícara > sueño > ciclo > neutral.
  const pickState = (now, scanning) => {
    if (now < angryUntil) return 'angry';
    if (scanning) return 'scan';
    if (now < playUntil) return 'playful';
    if (now - lastActivityAt > SLEEP_AFTER) return 'sleepy';
    if (cycleState) return cycleState;
    return 'neutral';
  };

  // ─── Render ─────────────────────────────────────────────────────────
  const render = (t) => {
    raf = 0;
    if (!running) return;
    const dt = clamp((t - lastT) / 1000, 0.001, 0.033);
    lastT = t;
    const now = performance.now();
    const tSec = now / 1000;

    if (cards) {
      const maxX = cards.scrollWidth - window.innerWidth;
      if (maxX > 0) p = clamp(-gsap.getProperty(cards, 'x') / maxX, 0, 1);
    }
    const dp = Math.abs(p - lastP);
    const speed = dp / dt;
    lastP = p;
    if (dp > 1e-4) lastPMoveAt = now;
    const scanning = now - lastPMoveAt < SCAN_HOLD;

    // Scroll brusco → enojo. Medido en ventana corta; saltos > JUMP_PX por frame
    // (anclas, scrollTo) no cuentan como gesto.
    const scrollDy = Math.abs(window.scrollY - lastScrollY);
    lastScrollY = window.scrollY;
    if (scrollDy > 0) lastActivityAt = now;
    if (scrollDy > 0 && scrollDy < JUMP_PX) scrollLog.push({ t: now, dy: scrollDy });
    while (scrollLog.length && now - scrollLog[0].t > BRUSQUE_WIN) scrollLog.shift();
    const recentPx = scrollLog.reduce((a, e) => a + e.dy, 0);
    if (recentPx / (BRUSQUE_WIN / 1000) > BRUSQUE_PX) angryUntil = now + ANGRY_MS;

    // Recorrido real del holder
    const hold = Math.max(1, holder.offsetHeight - titleSection.offsetHeight);
    const d = -holder.getBoundingClientRect().top;
    pinP = clamp(d / hold, 0, 1);
    riseP = clamp((d - hold) / H, 0, 1);

    if (titleExit && pinP !== lastPinP) {
      titleExit.progress(pinP);
      lastPinP = pinP;
    }

    // Objetivo de mirada: carta bajo el puntero / centrada (táctil)
    if (!scanning && (dirtyHit || frameN % HIT_EVERY === 0)) {
      dirtyHit = false;
      const card = hitCard();
      if (card && mouse && now - anchorAt > PLAY_MS) playUntil = now + PLAY_HOLD;
      if (card !== lastCard) {
        if (!card) {
          lastCard = null;
        } else if (now - lastSacAt >= SAC_GAP) {
          const to = gazeFor(card);
          anchor = to;
          startSaccade(to, now, rand(...EMOTIONS[curState].sac));
          lastCard = card;
        }
      } else if (card && now - lastSacAt >= REFOCUS_MS) {
        const to = gazeFor(card);
        if (Math.abs(to.x - sacTo.x) > 0.2) {
          anchor = to;
          startSaccade(to, now, rand(...EMOTIONS[curState].sac));
        }
      }
    }
    frameN++;

    // Escaneo: mientras las cards se desplazan, la mirada salta entre cards visibles
    if (scanning) {
      if (now >= scanNext) {
        const targets = scanTargets();
        let to;
        if (targets.length) {
          let i = Math.floor(Math.random() * targets.length);
          if (targets.length > 1 && i === scanLast) i = (i + 1) % targets.length;
          scanLast = i;
          to = targets[i];
        } else {
          to = { x: rand(-0.7, 0.7), y: 0 };
        }
        anchor = to;
        startSaccade(to, now, rand(...EMOTIONS.scan.sac));
        scanNext = now + rand(...SCAN_FIX);
      }
    } else {
      scanNext = 0;
    }

    const mixTarget = lastCard !== null || scanning ? 1 : 0;

    // Ciclo de emociones: sólo con el título fijo y los ojos abiertos
    if (pinP > OPEN_FROM + 0.1 && riseP < 0.05) {
      if (now >= cycleAt) {
        cycleState = CYCLE[Math.floor(Math.random() * CYCLE.length)];
        cycleAt = now + rand(...CYCLE_GAP);
      }
    } else {
      cycleState = null;
      cycleAt = 0;
    }

    // Estado activo y gestos de tapa. Al entrar (e) las tapas van de 50% a la
    // pose del estado; el cuerpo no cambia de tamaño.
    curState = pickState(now, scanning);
    const tgt = FLAT[curState];
    const e = smoothstep(OPEN_FROM, OPEN_TO, pinP);
    const targets = {
      upPos: ENTER_POS * (1 - e) + tgt.upPos * e,
      upRot: tgt.upRot * e,
      loPos: ENTER_POS * (1 - e) + tgt.loPos * e,
      loRot: tgt.loRot * e,
      bow: tgt.bow * e,
      tremor: tgt.tremor * e,
    };
    const g = {};
    for (const k of GEST_KEYS) g[k] = integrate(gest[k], targets[k], S_LID, dt);

    // Microsacádicas alrededor del punto de anclaje
    const cfg = EMOTIONS[curState];
    if (now >= sacT0 + sacDur && now >= nextMicro) {
      const amp = MICRO_AMP * cfg.micro;
      const to = {
        x: clamp(anchor.x + rand(-amp, amp), -1, 1),
        y: clamp(anchor.y + rand(-amp, amp), -1, 1),
      };
      startSaccade(to, now, MICRO_MS, false);
      nextMicro = now + rand(...cfg.microGap);
    }

    const gazeTarget = (1 - 2 * p) * smoothstep(0, 1, riseP);
    const alphaTarget = e > 0.001 ? 1 - smoothstep(0.94, 1, p) : 0;
    const anchorY = titleSection.offsetHeight / 2;
    const eyeCyTarget = anchorY + (H * EYE_TOP - anchorY) * smoothstep(0, 1, riseP);
    if (!cyInit) {
      sCy.v = eyeCyTarget;
      cyInit = true;
    }

    const scrollGazeX = integrate(sGaze, gazeTarget, S_GAZE, dt);
    const eyeCy = integrate(sCy, eyeCyTarget, S_CY, dt);
    const squint = integrate(sSquint, clamp(speed * 0.25, 0, SQUINT_MAX), S_SQUINT, dt);
    const mix = integrate(sMix, mixTarget, S_MIX, dt);
    alpha += (alphaTarget - alpha) * Math.min(1, dt * 8);

    // Mirada: persecución (scroll) + sacádicos (objetivo) + microderiva
    const sac = sacAt(now);
    const driftX = noise(tSec * 1.3, 40) * DRIFT_AMP;
    const gazeX = mix * sac.x + (1 - mix) * scrollGazeX + driftX;
    const gazeY = mix * sac.y;

    // Cobertura final: estado + cierre al final del recorrido + parpadeo + squint
    const closeAmt = smoothstep(0.84, 0.96, p);
    const blink = blinkLevel(now);
    const upCover = clamp(Math.max(g.upPos + squint, closeAmt, blink), 0, 1);
    const loCover = clamp(Math.max(g.loPos, closeAmt, blink * 0.6), 0, 1);

    // Tapas con mirada lateral: el lado externo se inclina algo más
    const lookUpRot = -gazeX * MAX_A;
    const lookLoRot = gazeX * MAX_A;

    // Ojo derecho sigue un poco después (LAG_RIGHT); el izquierdo es exacto
    for (const eye of eyes) {
      const f = eye.lag > 0 ? 1 - Math.exp(-dt / eye.lag) : 1;
      eye.s.upPos += (upCover - eye.s.upPos) * f;
      eye.s.loPos += (loCover - eye.s.loPos) * f;
      eye.s.upRot += (g.upRot - eye.s.upRot) * f;
      eye.s.loRot += (g.loRot - eye.s.loRot) * f;
      eye.s.bow += (g.bow - eye.s.bow) * f;
      eye.s.tremor = g.tremor;
    }

    ctx.clearRect(0, 0, W, H);

    // Sin nada visible: se pausa el loop hasta el próximo scroll
    const idle = e <= 0.001 && alpha < 0.004;
    if (idle) {
      running = false;
      return;
    }

    if (alpha > 0.004) {
      ctx.globalAlpha = alpha;
      const R = Math.min(W * 0.055, H * 0.085);
      const cx = W / 2;
      const gap = R * 4.4;
      // Temblor fino sólo en enojo
      const tremorRot = Math.sin(tSec * TREMOR_HZ * Math.PI * 2) * 0.03 * eyes[0].s.tremor;
      for (const eye of eyes) {
        drawEye(eye, eye.dir < 0 ? cx - gap / 2 : cx + gap / 2, eyeCy, R, {
          dx: -gazeX * R * 0.45, // ambos ojos se desplazan hacia el lado de la mirada
          upRotExtra: lookUpRot + tremorRot,
          loRotExtra: lookLoRot,
        });
      }
      ctx.globalAlpha = 1;
    }

    raf = requestAnimationFrame(render);
  };

  const start = () => {
    if (running) return;
    running = true;
    lastT = performance.now();
    raf = requestAnimationFrame(render);
  };

  // ─── Salida del título (mismo efecto de entrada, en reversa) ────────
  let titleExit = null;
  const buildTitleExit = (chars) => {
    if (!chars || !chars.length) return;
    titleExit?.kill();
    const offsets = chars.map(() => (Math.random() < 0.5 ? -100 : 100));
    titleExit = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
    titleExit.to(chars, { yPercent: (i) => offsets[i], stagger: { from: 'random', amount: 0.4 } }, 0);
    titleExit.to(lines, { yPercent: -60 }, 0);
    titleExit.to(titleBlock, { autoAlpha: 0 }, 0.15);
    lastPinP = -1;
  };
  buildTitleExit(titleEl?.__headerChars);
  window.addEventListener('sectionHeaderSplit', (e) => {
    if (e.detail.trigger === titleEl) buildTitleExit(e.detail.chars);
  });

  // Puntero: hit-test inmediato; cuenta como actividad y como quietud
  window.addEventListener(
    'pointermove',
    (e) => {
      const now = performance.now();
      mouse = e.pointerType === 'mouse';
      px = e.clientX;
      py = e.clientY;
      lastActivityAt = now;
      if (Math.hypot(px - anchorX, py - anchorY) > STILL_PX) {
        anchorX = px;
        anchorY = py;
        anchorAt = now;
      }
      dirtyHit = true;
      start();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('mouseleave', () => {
    mouse = false;
    dirtyHit = true;
  });

  const wake = () => start();
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', () => {
    measure();
    dirtyHit = true;
    wake();
  });
  start();
};
