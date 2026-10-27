import gsap from 'gsap';
import { createNoise2D } from 'simplex-noise';
import { EMOTIONS, FLAT, GEST_KEYS, TILT } from './eyeEmotions.js';
import { drawEye } from './eyeRender.js';

// Los ojos del subtítulo. El texto no "desaparece": se rompe en fragmentos que
// son el propio texto. La línea de arriba se convierte en los párpados
// superiores, la de abajo en los inferiores y la banda central de cada mitad se
// reparte por el cuerpo de la almendra. El ojo despierto es la almendra sólida
// del finale; las brasas coral del subtítulo son su textura y su estado
// anterior. Dos capas, una sola materia: la almendra es el cuerpo, las brasas
// se condensan en ella y vuelven a salir como los glifos que eran.
//
// Reglas:
//  · aparece sólo al entrar al subtítulo; una vez despierto mira al cursor
//    mientras el puntero siga dentro del bloque de título;
//  · al alejarse (o a los ~8,5 s de inactividad) se duerme y vuelve al texto;
//  · mobile: tap para despertar, tap para volver, auto-retorno de seguridad a
//    los ~9 s (el sueño llega a los ~7,4 s y devuelve antes);
//  · reduced motion: no existe;
//  · cualquier scroll > 2 px cancela en el mismo frame y restaura el texto
//    antes de que el SplitText de salida empiece a moverlo.
const REDUCE = '(prefers-reduced-motion: reduce)';
const COARSE = '(hover: none)';
const PAD = 30; // aire del canvas para que los arcos no se recorten
const N_FINE = 800;
const N_COARSE = 520;
const HIT_PAD = 8;
const ZONE_PAD = 24;
const PATCH = 10; // recorte de texto que lleva cada brasa al posarse
const INIT_UP = 0.55; // el ojo nace en rendija
const OPEN_AT = 0.42; // s desde el engage hasta que la rendija despierta
const OPEN_DUR = 0.24;
const FLIGHT = 0.32;
const ENTER_SOLID_AT = 0.385; // la última brasa ya aterrizó
const ENTER_SOLID_DUR = 0.035;
const ENTER_IGNITE_DUR = 0.09; // el ojo ya abrió en coral y se enciende el rojo
const ENTER_GLOW = 1.45; // la rendija coral necesita más cuerpo que el ojo despierto
const RETURN_COLOR_OUT = 0.08; // rojo → coral antes de deshacerse
const RETURN_PARTICLE_IN = 0.035; // las brasas recién se encienden con el coral
const RETURN_SOLID_FADE_AT = 0.06;
const RETURN_SOLID_FADE_END = 0.18;
const RETURN_FLIGHT_AT = 0.1; // las brasas arrancan mientras la almendra cede
const RETURN_DUR = 0.38;
const RETURN_TOTAL = 0.8;
const IDLE_MS = 7400;
const SLEEP_HOLD = 1100;
const AWAY_HOLD = 140;
const ANGRY_ATTACK = 0.12;
const ANGRY_HOLD = 0.32;
const ANGRY_DECAY = 0.45;
const ANGRY_COOLDOWN = 2200;
const COARSE_HOLD = 9000;
const HELLO_AT = 1350;
const SLOW_BLINK_MS = 320;
const SLOW_BLINK_AMP = 0.8;
const FOCUS_AT = 3000;
const FOCUS_STILL = 2200;
const FOCUS_RESET = 900;
const SACCADE_DEAD = 0.075;
const SACCADE_GAP = 420;
// La banda central del texto no es pupila: es masa para el cuerpo del ojo.
const BODY_FROM = 0.25;
const BODY_TO = 0.75;

// El coral del subtítulo y el rojo puro del finale. La almendra interpola entre
// ambos: el rojo sólo se enciende a medida que el ojo termina de abrir.
const CORAL_RGB = [243, 80, 95];
const RED_RGB = [255, 0, 0];

// Almendra asimétrica (cat-eye), en unidades de rx/ry. Las dos curvas van de la
// comisura interna a la externa; así el mismo t sirve para el párpado de arriba
// y el de abajo.
const A = {
  inner: [-0.95, 0.1],
  outer: [1.0, -0.28],
  up1: [-0.55, -1.3],
  up2: [0.3, -1.5],
  lo1: [0.45, 0.85],
  lo2: [-0.4, 1.05],
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, t) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rand = (a, b) => a + Math.random() * (b - a);
const bez = (a, b, c, d, t) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

// Resorte amortiguado (mismo integrador que processEyes)
const mkSpring = (settle, zeta) => {
  const w = (2 * Math.PI) / settle;
  return { k: w * w, c: 2 * zeta * w };
};
const integrate = (s, target, sp, dt) => {
  const n = Math.ceil(dt * 120);
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    s.vel += ((target - s.v) * sp.k - s.vel * sp.c) * h;
    s.v += s.vel * h;
  }
  return s.v;
};

// Sprite de brasa: núcleo caliente + halo. Se dibuja una vez y se reusa con
// drawImage; nada de crear gradientes por partícula.
const makeSprite = (core, mid, edge) => {
  const S = 32;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  if (!g) return c;
  const r = S / 2;
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0, core);
  grd.addColorStop(0.22, mid);
  grd.addColorStop(0.55, edge);
  grd.addColorStop(1, 'rgba(243, 80, 95, 0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  return c;
};

const cornerY = (x) =>
  A.inner[1] + ((x - A.inner[0]) / (A.outer[0] - A.inner[0])) * (A.outer[1] - A.inner[1]);

export const initHeroSubtitleEyes = () => {
  if (window.matchMedia(REDUCE).matches) return;

  const wrap = document.querySelector('.hero-subtitle');
  const titles = document.querySelector('.main__container-titles');
  if (!wrap || !titles) return;
  const h4s = [...wrap.querySelectorAll('h4')];
  if (h4s.length !== 2) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'hero-eyes';
  canvas.setAttribute('aria-hidden', 'true');
  wrap.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Capa aparte para la almendra sólida. Así las tapas pueden borrar el rojo
  // con destination-out sin comerse las brasas de la transición.
  const solidCanvas = document.createElement('canvas');
  const solidCtx = solidCanvas.getContext('2d');
  if (!solidCtx) return;

  const coarse = window.matchMedia(COARSE).matches;
  const reduceMq = window.matchMedia(REDUCE);
  const noise = createNoise2D();
  // El subtítulo es coral (#f3505f); las brasas heredan ese color y el ojo
  // despierto se enciende con el rojo puro del finale.
  const sprites = [
    makeSprite('rgba(243, 80, 95, 0.92)', 'rgba(243, 80, 95, 0.58)', 'rgba(243, 80, 95, 0.12)'), // 0: párpado
    makeSprite('rgba(243, 80, 95, 0.82)', 'rgba(243, 80, 95, 0.46)', 'rgba(243, 80, 95, 0.1)'), // 1: inferior
    makeSprite('rgba(243, 80, 95, 0.62)', 'rgba(243, 80, 95, 0.32)', 'rgba(243, 80, 95, 0.08)'), // 2: cuerpo
  ];

  // ─── Medidas ────────────────────────────────────────────────────────
  let W = 0;
  let H = 0;
  let CW = 0;
  let CH = 0;
  let dpr = 1;
  let wrapRect = wrap.getBoundingClientRect();
  let zoneRect = titles.getBoundingClientRect();
  let rx = 1;
  let ry = 1;
  let eyeR = 1;
  let eyeCy = 0;
  let eyeCx = [0, 0];
  let eyeDir = [-1, 1];
  let particles = [];
  let textAtlas = null;
  let textVisible = false;
  let armed = false;
  let disabled = false;

  const measure = () => {
    textAtlas = null;
    wrapRect = wrap.getBoundingClientRect();
    zoneRect = titles.getBoundingClientRect();
    W = Math.max(1, Math.round(wrapRect.width));
    H = Math.max(1, Math.round(wrapRect.height));
    CW = W + PAD * 2;
    CH = H + PAD * 2;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.left = `${-PAD}px`;
    canvas.style.top = `${-PAD}px`;
    canvas.style.width = `${CW}px`;
    canvas.style.height = `${CH}px`;
    canvas.width = Math.max(1, Math.round(CW * dpr));
    canvas.height = Math.max(1, Math.round(CH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    solidCanvas.width = canvas.width;
    solidCanvas.height = canvas.height;
    solidCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const eyeW = clamp(W * 0.3, 40, 54);
    const gap = eyeW * 0.26;
    rx = eyeW / 2;
    // Misma proporción que la almendra del finale (rx = 1.9R, ry = 0.82R).
    ry = rx * (0.82 / 1.9);
    eyeR = rx / 1.9;
    const pairCx = PAD + W / 2;
    const pairCy = PAD + H / 2;
    eyeCx = [pairCx - (eyeW + gap) / 2, pairCx + (eyeW + gap) / 2];
    // La almendra no es simétrica en y (-1.5ry .. +1.05ry): correr el origen
    // local para que la caja visible quede centrada en el bloque.
    eyeCy = pairCy + ry * 0.225;
  };

  // ─── Muestreo del texto ─────────────────────────────────────────────
  // Se renderiza el texto real con la fuente computada en un canvas offscreen y
  // se toman píxeles opacos. No se toca el DOM: el SplitText de salida sigue
  // intacto y el subtítulo permanece accesible para lectores de pantalla.
  const sampleText = () => {
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const g = off.getContext('2d', { willReadFrequently: true });
    if (!g) return [];
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#fff';
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    const rects = h4s.map((h) => {
      const r = h.getBoundingClientRect();
      return { top: r.top - wrapRect.top, right: r.right - wrapRect.left, h: r.height };
    });
    h4s.forEach((h, i) => {
      const cs = getComputedStyle(h);
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      if ('letterSpacing' in g) {
        g.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      }
      const text = (h.textContent || '').replace(/\s+/g, ' ').trim();
      g.fillText(text, rects[i].right - 0.5, rects[i].top + rects[i].h / 2);
    });
    const data = g.getImageData(0, 0, off.width, off.height).data;
    const splitY = Math.max(1, rects[1].top);
    const pts = [];
    for (let y = 0; y < off.height; y++) {
      for (let x = 0; x < off.width; x++) {
        if (data[(y * off.width + x) * 4 + 3] > 110) {
          pts.push({ x, y, line: y < splitY ? 0 : 1 });
        }
      }
    }
    return pts;
  };

  // Atlas de texto para los fragmentos. Se renderiza a DPR para que los
  // recortes que lleva cada brasa mantengan la tipografía nítida.
  const makeTextAtlas = () => {
    textAtlas = null;
    if (!W || !H) return;
    const atlas = document.createElement('canvas');
    // Margen de un patch por lado: los recortes de los glifos que tocan el
    // borde del bloque no se cortan ni se reescalan.
    atlas.width = Math.max(1, Math.round((W + PATCH * 2) * dpr));
    atlas.height = Math.max(1, Math.round((H + PATCH * 2) * dpr));
    const g = atlas.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W + PATCH * 2, H + PATCH * 2);
    g.fillStyle = getComputedStyle(h4s[0]).color || '#f3505f';
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    const rects = h4s.map((h) => {
      const r = h.getBoundingClientRect();
      return { top: r.top - wrapRect.top, right: r.right - wrapRect.left, h: r.height };
    });
    h4s.forEach((h, i) => {
      const cs = getComputedStyle(h);
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      if ('letterSpacing' in g) {
        g.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      }
      const text = (h.textContent || '').replace(/\s+/g, ' ').trim();
      g.fillText(
        text,
        PATCH + rects[i].right - 0.5,
        PATCH + rects[i].top + rects[i].h / 2,
      );
    });
    textAtlas = atlas;
  };

  // Cada partícula recibe un recorte propio del atlas. Los píxeles del glifo
  // se reparten por cercanía, sin solaparse: en reposo la suma de fragmentos
  // reproduce el texto exacto, no una versión más gruesa por transparencias.
  const buildTextPatches = () => {
    if (!textAtlas || !particles.length) return;
    const patchPx = Math.max(1, Math.round(PATCH * dpr));
    const atlasCtx = textAtlas.getContext('2d', { willReadFrequently: true });
    if (!atlasCtx) return;
    const src = atlasCtx.getImageData(0, 0, textAtlas.width, textAtlas.height).data;
    for (const p of particles) {
      p.patchCanvas = document.createElement('canvas');
      p.patchCanvas.width = patchPx;
      p.patchCanvas.height = patchPx;
      p.patchCtx = p.patchCanvas.getContext('2d');
      if (!p.patchCtx) {
        p.patchCanvas = null;
        continue;
      }
      p.patchData = p.patchCtx.createImageData(patchPx, patchPx);
      p.patchSx = Math.round((p.tx - PATCH / 2) * dpr);
      p.patchSy = Math.round((p.ty - PATCH / 2) * dpr);
    }
    for (let y = 0; y < textAtlas.height; y++) {
      for (let x = 0; x < textAtlas.width; x++) {
        const si = (y * textAtlas.width + x) * 4;
        if (src[si + 3] <= 0) continue;
        const cssX = (x + 0.5) / dpr;
        const cssY = (y + 0.5) / dpr;
        let best = null;
        let bestD = Infinity;
        for (const p of particles) {
          const dx = p.tx - cssX;
          const dy = p.ty - cssY;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
        if (!best || !best.patchData) continue;
        const rx = x - best.patchSx;
        const ry = y - best.patchSy;
        if (rx < 0 || ry < 0 || rx >= patchPx || ry >= patchPx) continue;
        const di = (ry * patchPx + rx) * 4;
        best.patchData.data[di] = src[si];
        best.patchData.data[di + 1] = src[si + 1];
        best.patchData.data[di + 2] = src[si + 2];
        best.patchData.data[di + 3] = src[si + 3];
      }
    }
    for (const p of particles) {
      if (p.patchCtx && p.patchData) p.patchCtx.putImageData(p.patchData, 0, 0);
      p.patchData = null;
    }
  };

  const build = () => {
    makeTextAtlas();
    const cand = sampleText();
    if (!cand.length) {
      particles = [];
      return;
    }
    const n = coarse ? N_COARSE : N_FINE;
    let pick = cand;
    if (cand.length > n) {
      pick = cand.slice();
      for (let i = pick.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [pick[i], pick[j]] = [pick[j], pick[i]];
      }
      pick = pick.slice(0, n);
    }
    // El subtítulo está alineado a la derecha: la mitad derecha tiene más
    // glifos. Si repartiéramos por punto medio geométrico, el ojo derecho
    // quedaría más denso. Partimos por cantidad de píxeles: cada ojo recibe la
    // misma cantidad de brasas y la mitad izquierda/derecha real del texto.
    pick = pick.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const half = Math.ceil(pick.length / 2);
    const groups = [pick.slice(0, half), pick.slice(half)];
    const sizeScale = coarse ? 0.82 : 1;
    particles = [];
    for (let eye = 0; eye < 2; eye++) {
      const group = groups[eye];
      if (!group.length) continue;
      const nGroup = group.length;
      for (let gi = 0; gi < nGroup; gi++) {
        const c = group[gi];
        // u por rango, no por píxel: reparte las brasas en partes iguales a lo
        // largo de la tapa y del cuerpo aunque el texto sea más denso de un
        // lado. El origen sigue siendo el píxel real del glifo.
        const u = (gi + 0.5) / nGroup;
        let role;
        let param = 0;
        let bt = 0;
        let bv = 0;
        if (u >= BODY_FROM && u <= BODY_TO) {
          // La banda central no es pupila: se dispersa por toda la almendra
          // para darle cuerpo rojo, sin crear un punto brillante en el centro.
          role = 2;
          bt = rand(0.06, 0.94);
          bv = rand(0.08, 0.92);
        } else {
          role = c.line === 0 ? 0 : 1;
          // t=0 comisura interna, t=1 externa. El borde externo del texto es
          // la comisura externa; el borde que mira al centro, la interna. La
          // banda central (cuerpo) se saltea y la tapa se reparte en las dos
          // mitades, así el párpado queda continuo incluso en el medio.
          const edge =
            u < BODY_FROM ? u / BODY_FROM : (u - BODY_TO) / (1 - BODY_TO);
          if (eye === 0) {
            param = u < BODY_FROM ? 1 - edge * 0.5 : 0.5 - edge * 0.5;
          } else {
            param = u < BODY_FROM ? edge * 0.5 : 0.5 + edge * 0.5;
          }
          param = clamp(param + rand(-0.018, 0.018), 0, 1);
        }
        const size =
          (role === 2
            ? rand(4.0, 5.8)
            : role === 0
              ? rand(3.8, 5.8)
              : rand(3.2, 5.2)) * sizeScale;
        const aBase =
          role === 2 ? rand(0.4, 0.58) : role === 0 ? rand(0.26, 0.42) : rand(0.22, 0.36);
        // Sin jitter en reposo: cada fragmento cae exactamente sobre el píxel
        // del glifo. El temblor empieza recién cuando la brasa despega.
        const sx = c.x + PAD;
        const sy = c.y + PAD;
        particles.push({
          sx,
          sy,
          tx: c.x + PATCH,
          ty: c.y + PATCH,
          patchCanvas: null,
          eye,
          role,
          line: c.line,
          t: param,
          bt,
          bv,
          pick: Math.random(),
          seed: Math.random() * 10,
          size,
          s0: size * 1.45,
          aBase,
          sprite: sprites[role],
          x: sx,
          y: sy,
          alpha: 0,
          textAlpha: 0,
          sizeNow: size * 1.45,
          delay: 0,
          c1x: 0,
          c1y: 0,
          lat: 0,
          lift: 0,
          ret: false,
        });
      }
    }
    buildTextPatches();
  };

  // ─── Estado ─────────────────────────────────────────────────────────
  let state = 'idle'; // idle | waking | awake | returning
  let solidMix = 0;
  let particleMix = 0;
  let solidColorMix = 1;
  let curState = 'hooded';
  let engagedAt = 0;
  let openStart = 0;
  let openEnd = 0;
  let returnAt = 0;
  let returnStarted = false;
  let returnStartAt = 0;
  let helloAt = Infinity;
  let helloPlayed = false;
  let lastMoveAt = 0;
  let lastPX = 0;
  let lastPY = 0;
  let lastMoveT = 0;
  let angerStart = -Infinity;
  let angerCooldownUntil = 0;
  let waryLevel = 0;
  let slowBlinkStart = -1;
  let sleepySince = 0;
  let awayAt = 0;
  let wasInside = false;
  let cooldownUntil = 0;
  let raf = 0;
  let lastT = 0;
  let blinkStart = -1;
  let blinkMsActive = 0;
  let nextBlink = 0;
  const pointer = { x: 0, y: 0 };
  // La mirada es por ojo: el objetivo nace en el centro de cada almendra, no
  // en el centro del par. Eso produce convergencia natural y evita que los dos
  // ojos se sientan como un bloque que se desliza.
  const gaze = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  const saccades = [null, null];
  const lastSaccadeAt = [0, 0];
  const nextMicro = [0, 0];
  const microX = [0, 0];
  const microY = [0, 0];
  const S_LID = mkSpring(0.18, 1);
  const WAKE = FLAT.hooded || FLAT.neutral;
  const gest = Object.fromEntries(
    GEST_KEYS.map((k) => [k, { v: k === 'upPos' ? INIT_UP : 0, vel: 0 }]),
  );
  const eyePose = [0, 1].map(() =>
    Object.fromEntries(GEST_KEYS.map((k) => [k, k === 'upPos' ? INIT_UP : 0])),
  );
  const returnPose = [{}, {}];
  const eyeFrame = [{}, {}];

  // ─── Curvas del ojo ─────────────────────────────────────────────────
  const upperPoint = (t, pose, time, k) => {
    const u = clamp(pose.upPos, 0, 1);
    const brow = -pose.upRot * 0.85;
    const tr =
      pose.tremor *
      (noise(time * 5.2, k * 11 + 1.3) * 0.06 + noise(time * 11, k * 11 + 7.7) * 0.025);
    const c1y = mix(A.up1[1], cornerY(A.up1[0]), u) + brow + tr;
    const c2y = mix(A.up2[1], cornerY(A.up2[0]), u) + brow * 0.18 + tr * 0.6;
    return {
      x: bez(A.inner[0], A.up1[0], A.up2[0], A.outer[0], t),
      y: bez(A.inner[1], c1y, c2y, A.outer[1], t),
    };
  };

  const lowerPoint = (t, pose, time, k) => {
    const u = clamp(pose.loPos, 0, 1);
    const bow = pose.bow;
    const tr =
      pose.tremor *
      (noise(time * 5.2, k * 11 + 4.1) * 0.04 + noise(time * 9, k * 11 + 2.2) * 0.02);
    const c1y = mix(A.lo2[1], cornerY(A.lo2[0]), u) - bow * 0.5 + tr;
    const c2y = mix(A.lo1[1], cornerY(A.lo1[0]), u) - bow * 0.5 + tr;
    return {
      x: bez(A.inner[0], A.lo2[0], A.lo1[0], A.outer[0], t),
      y: bez(A.inner[1], c1y, c2y, A.outer[1], t),
    };
  };

  const curveY = (fn, x, pose, time, k) => {
    let prev = fn(0, pose, time, k);
    for (let i = 1; i <= 12; i++) {
      const p = fn(i / 12, pose, time, k);
      if ((prev.x <= x && p.x >= x) || (prev.x >= x && p.x <= x)) {
        const d = p.x - prev.x;
        const f = d === 0 ? 0 : (x - prev.x) / d;
        return prev.y + (p.y - prev.y) * f;
      }
      prev = p;
    }
    return prev.y;
  };

  const buildFrames = (time) => {
    for (let k = 0; k < 2; k++) {
      const pose = state === 'returning' ? returnPose[k] : eyePose[k];
      const localX = clamp(gaze[k].x * 0.34 * eyeDir[k], -0.9, 0.95);
      const top = curveY(upperPoint, localX, pose, time, k);
      const bottom = curveY(lowerPoint, localX, pose, time, k);
      const aperture = Math.max(0, bottom - top);
      // Sin máscara, el cuerpo se apaga a medida que las tapas lo cierran:
      // así no quedan brasas rojas flotando sobre el ojo cerrado.
      const bodyVis = smoothstep(0.04, 0.72, aperture);
      eyeFrame[k] = { bodyVis };
    }
  };

  const targetFor = (p, time) => {
    const k = p.eye;
    const frame = eyeFrame[k];
    const gz = gaze[k];
    // En la salida, las brasas conservan la pose congelada del ojo: la
    // almendra es la que cede y las deja ver, sin abrir un ojo de puntos.
    const pose = state === 'returning' ? returnPose[k] : eyePose[k];
    // Antes de que la almendra tome el relevo, la rendija de brasas necesita
    // algo más de cuerpo para leerse como una sola materia coral.
    const glow = state === 'waking' ? ENTER_GLOW : 1;
    const bodyX = gz.x * rx * 0.22;
    const bodyY = gz.y * ry * 0.14;
    const jitterY = Math.sin(time * 1.15 + p.seed * 2.3) * 0.22;
    const ca = Math.cos(-TILT);
    const sa = Math.sin(-TILT);
    if (p.role === 2) {
      // Cuerpo: se reparte entre la tapa de arriba y la de abajo. No hay
      // centro ni pupila; la densidad hace que se lea como una sola almendra.
      const top = upperPoint(p.bt, pose, time, k);
      const bottom = lowerPoint(p.bt, pose, time, k);
      const lx = mix(top.x, bottom.x, p.bv) * rx;
      const ly = mix(top.y, bottom.y, p.bv) * ry;
      const rxr = lx * ca - ly * sa;
      const ryr = lx * sa + ly * ca;
      return {
        x: eyeCx[k] + eyeDir[k] * rxr + bodyX,
        y: eyeCy + ryr + bodyY + jitterY * 0.35,
        a: p.aBase * frame.bodyVis * glow,
      };
    }
    const pt =
      p.role === 0
        ? upperPoint(p.t, pose, time, k)
        : lowerPoint(p.t, pose, time, k);
    let lx = pt.x * rx;
    let ly = pt.y * ry;
    // Mirada lateral: las tapas se inclinan como en el finale. Sin pupila, este
    // gesto (más el desplazamiento del cuerpo) es lo que hace legible la mirada.
    const lookRot = gz.x * (p.role === 0 ? -0.12 : 0.12);
    const lc = Math.cos(lookRot);
    const ls = Math.sin(lookRot);
    const ltx = lx * lc - ly * ls;
    ly = lx * ls + ly * lc;
    lx = ltx;
    const rxr = lx * ca - ly * sa;
    const ryr = lx * sa + ly * ca;
    const lowerFade =
      p.role === 1 ? 1 - smoothstep(0.8, 1, pose.upPos) : 1;
    return {
      x: eyeCx[k] + eyeDir[k] * rxr + bodyX,
      y: eyeCy + ryr + bodyY + jitterY,
      a: p.aBase * lowerFade * glow,
    };
  };

  // ─── Emociones y párpados ───────────────────────────────────────────
  const blinkLevel = (now) => {
    if (state !== 'awake') return 0;
    if (blinkStart < 0 && now >= nextBlink) {
      const cfg = EMOTIONS[curState] || EMOTIONS.hooded;
      blinkStart = now;
      blinkMsActive = cfg.blinkMs;
    }
    if (blinkStart < 0) return 0;
    const ph = (now - blinkStart) / blinkMsActive;
    if (ph >= 1) {
      const cfg = EMOTIONS[curState] || EMOTIONS.hooded;
      blinkStart = -1;
      nextBlink = now + rand(...cfg.blinkGap);
      return 0;
    }
    return Math.sin(ph * Math.PI);
  };

  // Único parpadeo "de personaje": lento y una sola vez. Los cambios de base
  // no usan blink; se resuelven con un morph de párpados.
  const slowBlinkLevel = (now) => {
    if (state !== 'awake' || slowBlinkStart < 0) return 0;
    const ph = (now - slowBlinkStart) / SLOW_BLINK_MS;
    if (ph >= 1) {
      slowBlinkStart = -1;
      return 0;
    }
    return Math.sin(ph * Math.PI) * SLOW_BLINK_AMP;
  };

  // Enojo como impulso: ataque rápido, meseta corta y caída. No cambia la base
  // ni dispara parpadeo.
  const angerLevel = (now) => {
    const t = (now - angerStart) / 1000;
    if (t < 0) return 0;
    if (t < ANGRY_ATTACK) return t / ANGRY_ATTACK;
    if (t < ANGRY_ATTACK + ANGRY_HOLD) return 1;
    const d = clamp((t - ANGRY_ATTACK - ANGRY_HOLD) / ANGRY_DECAY, 0, 1);
    return 1 - smoothstep(0, 1, d);
  };

  const updatePose = (now, dt) => {
    // En la salida la pose queda congelada: la almendra no se cierra, se
    // deshace en las brasas que ya están debajo. Es un solo cambio de materia.
    if (state === 'returning') {
      buildFrames(now / 1000);
      return;
    }

    let target;
    if (state === 'waking') {
      const e = smoothstep(openStart, openEnd, now);
      target = {
        upPos: mix(INIT_UP, WAKE.upPos, e),
        upRot: mix(0, WAKE.upRot, e),
        loPos: mix(0, WAKE.loPos, e),
        loRot: mix(0, WAKE.loRot, e),
        bow: mix(0, WAKE.bow, e),
        tremor: WAKE.tremor * e,
      };
    } else if (state === 'awake') {
      target = FLAT[curState] || WAKE;
    } else {
      target = WAKE;
    }
    const g = {};
    for (const key of GEST_KEYS) g[key] = integrate(gest[key], target[key], S_LID, dt);

    const blink = Math.max(blinkLevel(now), slowBlinkLevel(now));
    const anger = angerLevel(now);
    const cfg = EMOTIONS[curState] || EMOTIONS.hooded;
    const asym = cfg.asym || {};
    const edge = Math.max(Math.abs(gaze[0].x), Math.abs(gaze[1].x));
    const waryTarget = state === 'awake' ? smoothstep(0.55, 0.9, edge) : 0;
    waryLevel += (waryTarget - waryLevel) * (1 - Math.exp(-dt * 7));

    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? 1 : -1;
      // El ojo que mira más al costado se entorna apenas: la mirada se siente
      // con intención, no como una calcomanía que se desplaza.
      const focus =
        state === 'awake' ? Math.min(1, Math.abs(gaze[k].x)) : 0;
      const focusUp = focus * 0.03 + Math.min(1, Math.abs(gaze[k].y)) * 0.012;
      const wary = waryLevel;
      const up = clamp(
        Math.max(
          g.upPos +
            (asym.upPos || 0) * side +
            focusUp +
            wary * 0.035 * side +
            anger * 0.035,
          blink,
        ),
        0,
        1,
      );
      const lo = clamp(
        Math.max(
          g.loPos +
            (asym.loPos || 0) * side +
            wary * 0.018 * side +
            anger * 0.035,
          blink * 0.6,
        ),
        0,
        1,
      );
      const upRot =
        g.upRot + (asym.upRot || 0) * side - wary * 0.035 * side - anger * 0.1;
      const loRot = g.loRot + (asym.loRot || 0) * side + wary * 0.02 * side + anger * 0.02;
      const bow = g.bow + (asym.bow || 0) * side + anger * 0.05;
      // El ojo derecho llega un pelo más tarde, incluso en el morph de párpado.
      const f = k === 1 ? 1 - Math.exp(-dt / 0.028) : 1;
      const pose = eyePose[k];
      pose.upPos += (up - pose.upPos) * f;
      pose.upRot += (upRot - pose.upRot) * f;
      pose.loPos += (lo - pose.loPos) * f;
      pose.loRot += (loRot - pose.loRot) * f;
      pose.bow += (bow - pose.bow) * f;
      pose.tremor = (g.tremor + anger * 0.26) * (k === 1 ? 0.85 : 1);
    }

    buildFrames(now / 1000);
  };

  // ─── Mirada ─────────────────────────────────────────────────────────
  const updateGaze = (now, dt) => {
    if (state === 'returning') return;
    const eyePageY = wrapRect.top + (eyeCy - PAD);
    for (let k = 0; k < 2; k++) {
      const eyePageX = wrapRect.left + (eyeCx[k] - PAD);
      const dxPage = pointer.x - eyePageX;
      // El subtítulo vive a la derecha: normalizamos por el espacio disponible
      // de cada lado y por cada ojo. Al apuntar desde centros distintos, la
      // mirada converge cuando el cursor está cerca y se vuelve paralela lejos.
      const rangeX =
        dxPage >= 0
          ? Math.max(120, window.innerWidth - eyePageX - 16)
          : Math.max(220, eyePageX * 0.55);
      const rangeY = Math.max(150, window.innerHeight * 0.3);
      let tx = clamp(dxPage / rangeX, -1, 1);
      let ty = clamp((pointer.y - eyePageY) / rangeY, -1, 1) * 0.7;
      tx = Math.sign(tx) * Math.pow(Math.abs(tx), 0.9);
      ty = Math.sign(ty) * Math.pow(Math.abs(ty), 0.9);

      const cfg = EMOTIONS[curState] || EMOTIONS.hooded;
      if (state === 'awake' && now >= nextMicro[k]) {
        microX[k] = rand(-0.03, 0.03) * cfg.micro;
        microY[k] = rand(-0.018, 0.018) * cfg.micro;
        nextMicro[k] = now + rand(...cfg.microGap);
      }

      const gz = gaze[k];
      if (state === 'awake') {
        const dx = tx - gz.x;
        const dy = ty - gz.y;
        const dist = Math.hypot(dx, dy);
        const gap = Math.max(SACCADE_GAP, (cfg.sac?.[0] || 40) * 1.1);
        if (!saccades[k] && dist > SACCADE_DEAD && now - lastSaccadeAt[k] > gap) {
          const sac = cfg.sac || [40, 90];
          const dur = clamp(rand(sac[0], sac[1]) + dist * 16, 35, 240);
          saccades[k] = {
            fromX: gz.x,
            fromY: gz.y,
            toX: tx,
            toY: ty,
            overX: clamp(dx * 0.04, -0.02, 0.02),
            start: now,
            dur,
            delay: k === 1 ? rand(20, 35) : 0,
          };
          lastSaccadeAt[k] = now;
        }
        const sac = saccades[k];
        if (sac) {
          const ph = (now - sac.start - sac.delay) / sac.dur;
          if (ph >= 1) {
            gz.x = sac.toX + sac.overX;
            gz.y = sac.toY;
            saccades[k] = null;
          } else if (ph > 0) {
            const e = easeOutCubic(ph);
            gz.x = mix(sac.fromX, sac.toX + sac.overX, e);
            gz.y = mix(sac.fromY, sac.toY, e);
          }
        } else {
          // Fixación / seguimiento lento: el resorte sólo corrige lo que la
          // sacada dejó pendiente. Las microsacádicas son independientes y
          // espaciadas: el ojo tiene que sostener la mirada, no vibrar.
          const rate = k === 1 ? 9 : 11;
          const follow = 1 - Math.exp(-dt * rate);
          gz.x += (tx + microX[k] - gz.x) * follow;
          gz.y += (ty + microY[k] - gz.y) * follow;
        }
      } else {
        const follow = 1 - Math.exp(-dt * 14);
        gz.x += (tx - gz.x) * follow;
        gz.y += (ty - gz.y) * follow;
      }
      gz.x = clamp(gz.x, -1.05, 1.05);
      gz.y = clamp(gz.y, -0.85, 0.85);
    }
  };

  // ─── Estado de la interacción ───────────────────────────────────────
  const startLoop = () => {
    if (raf || disabled) return;
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  };
  const stopLoop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const engage = (px, py) => {
    if (disabled) return;
    if (!particles.length) {
      measure();
      build();
    }
    if (!particles.length) return;
    const now = performance.now();
    state = 'waking';
    solidMix = 0;
    particleMix = 1;
    solidColorMix = 0;
    curState = 'hooded';
    engagedAt = now;
    openStart = now + OPEN_AT * 1000;
    openEnd = openStart + OPEN_DUR * 1000;
    helloAt = helloPlayed ? Infinity : now + HELLO_AT;
    lastMoveAt = now;
    lastPX = px;
    lastPY = py;
    lastMoveT = now;
    pointer.x = px;
    pointer.y = py;
    awayAt = 0;
    sleepySince = 0;
    angerStart = -Infinity;
    angerCooldownUntil = 0;
    waryLevel = 0;
    slowBlinkStart = -1;
    blinkStart = -1;
    nextBlink = openEnd + 4200 + rand(0, 800);
    for (let k = 0; k < 2; k++) {
      nextMicro[k] = now + 900 + rand(0, 300);
      microX[k] = 0;
      microY[k] = 0;
      saccades[k] = null;
      lastSaccadeAt[k] = 0;
      gaze[k].x = 0;
      gaze[k].y = 0;
    }
    for (const key of GEST_KEYS) {
      gest[key].v = key === 'upPos' ? INIT_UP : 0;
      gest[key].vel = 0;
      for (let k = 0; k < 2; k++) {
        eyePose[k][key] = key === 'upPos' ? INIT_UP : 0;
      }
    }
    for (const p of particles) {
      p.x = p.sx;
      p.y = p.sy;
      p.alpha = 0;
      p.textAlpha = 1;
      p.sizeNow = p.s0;
      // Onda coherente por línea: la brasa no llega por azar, se pliega desde
      // el texto como una cortina. La línea de arriba inicia primero. El último
      // delay deja todas las brasas apoyadas antes de que aparezca la almendra.
      const xNorm = clamp((p.sx - PAD) / Math.max(1, W), 0, 1);
      p.delay =
        (p.line === 0 ? 0 : 0.02) + xNorm * 0.035 + p.pick * 0.01;
      p.lat = rand(-9, 9);
      p.lift = p.role === 1 ? rand(5, 14) : rand(8, 22);
      p.c1x = p.sx + p.lat * 0.55;
      p.c1y = p.sy - p.lift;
      p.ret = false;
    }
    // El DOM se oculta recién después de que los fragmentos ya están dibujados
    // encima. No hay fade de texto: el texto es la misma materia que va a volar.
    if (!showParticleText()) {
      cancelInstant();
      return;
    }
    startLoop();
  };

  const release = (reason) => {
    // Un roce durante la entrada no debe mostrar un ojo a medio formar:
    // devolvemos el texto limpio en el mismo frame.
    if (state === 'waking') {
      cancelInstant();
      return;
    }
    if (state !== 'awake') return;
    state = 'returning';
    // La almendra no se cierra: primero se enfría a coral y después cede su
    // opacidad. Las brasas ya están debajo, con la misma pose, así que el ojo
    // se deshace sin aparecer como una segunda silueta.
    for (let k = 0; k < 2; k++) {
      returnPose[k] = { ...eyePose[k] };
    }
    solidMix = 1;
    particleMix = 0;
    solidColorMix = 1;
    // El ojo despierto usa alphas bajos para leerse como brasa. Al soltar hay
    // que subirlos: el coral es la textura visible cuando la almendra cede.
    for (const p of particles) {
      p.aRet = Math.min(0.98, Math.max(0.68, p.aBase * 2.3));
      p.textAlpha = 0;
    }
    // El texto que vuelve ya no es el h4: es la unión de los recortes que
    // aterrizan. El DOM sigue oculto para que no haya crossfade entre capas.
    textVisible = true;
    returnAt = performance.now();
    returnStarted = false;
    returnStartAt = 0;
    awayAt = 0;
    slowBlinkStart = -1;
  };

  const cancelInstant = () => {
    // Aunque el estado ya sea idle, puede haber texto en partículas: hay que
    // devolver el DOM antes de que el scroll lo entregue al SplitText de salida.
    const wasActive = state !== 'idle' || textVisible;
    state = 'idle';
    stopLoop();
    textVisible = false;
    for (const p of particles) p.textAlpha = 0;
    if (wasActive) {
      gsap.killTweensOf(h4s);
      gsap.set(h4s, { clearProps: 'opacity' });
      cooldownUntil = performance.now() + 320;
      wasInside = false;
    }
    solidMix = 0;
    particleMix = 0;
    ctx.clearRect(0, 0, CW, CH);
    solidCtx.clearRect(0, 0, CW, CH);
  };

  const finishReturn = (now) => {
    state = 'idle';
    solidMix = 0;
    particleMix = 0;
    textVisible = true;
    stopLoop();
    for (const p of particles) {
      p.x = p.sx;
      p.y = p.sy;
      p.alpha = 0;
      p.textAlpha = 1;
    }
    ctx.clearRect(0, 0, CW, CH);
    solidCtx.clearRect(0, 0, CW, CH);
    // El subtítulo queda como fragmentos de texto. El h4 sigue en el DOM para
    // lectores de pantalla, pero no participa del dibujo ni de ningún fade.
    drawTextParticles();
    gsap.set(h4s, { opacity: 0 });
    cooldownUntil = now + 160;
    // Si el puntero quedó adentro, hay que salir y volver a entrar para
    // despertarlos de nuevo (wasInside se actualiza en el próximo move).
  };

  const setBase = (next) => {
    if (next === curState) return;
    curState = next;
  };

  const updateAwake = (now) => {
    if (now >= helloAt && !helloPlayed) {
      helloPlayed = true;
      helloAt = Infinity;
      // Saludo A24: el único blink de personaje. Después, el ojo se queda
      // quieto hasta el parpadeo natural de la sesión.
      slowBlinkStart = now;
      nextBlink = Math.max(nextBlink, now + 900);
    }
    const stillFor = now - lastMoveAt;
    const awakeFor = now - engagedAt;

    // Sólo tres bases. El enojo y la desconfianza son capas aditivas, no
    // estados: no cambian la silueta de golpe ni disparan parpadeos.
    if (stillFor >= IDLE_MS) {
      setBase('sleepy');
    } else if (curState === 'sleepy') {
      // Si el cursor vuelve mientras dormita, despierta antes de irse.
      setBase(awakeFor > FOCUS_AT && stillFor >= FOCUS_STILL ? 'focus' : 'hooded');
      sleepySince = 0;
    } else if (awakeFor > FOCUS_AT && stillFor >= FOCUS_STILL) {
      setBase('focus');
    } else if (stillFor < FOCUS_RESET) {
      setBase('hooded');
    }

    if (curState === 'sleepy') {
      if (!sleepySince) sleepySince = now;
      else if (now - sleepySince > SLEEP_HOLD) release('idle');
    } else {
      sleepySince = 0;
    }
    if (coarse && now - engagedAt > COARSE_HOLD) release('timeout');
    if (awayAt && now - awayAt > AWAY_HOLD) release('away');
  };

  // ─── Partículas ─────────────────────────────────────────────────────
  const updateParticles = (now, dt) => {
    const tSec = (now - engagedAt) / 1000;
    const kFollow = 1 - Math.exp(-dt * 22);
    const time = now / 1000;
    for (const p of particles) {
      if (state === 'returning' && returnStarted) {
        const flightT = (now - returnStartAt) / 1000;
        const rp = clamp((flightT - p.rdelay) / RETURN_DUR, 0, 1);
        if (rp <= 0) {
          p.textAlpha = 0;
          continue;
        }
        const e = easeInOutCubic(rp);
        p.x = bez(p.rx0, p.rc1x, p.rc2x, p.sx, e);
        p.y = bez(p.ry0, p.rc1y, p.rc2y, p.sy, e);
        // Cada brasa lleva su recorte del texto: al acercarse al glifo deja de
        // ser brasa y vuelve a ser la letra que le corresponde. No hay una
        // segunda capa de texto apareciendo por detrás.
        const textIn = smoothstep(0.58, 0.95, e);
        p.textAlpha = textIn;
        p.alpha = p.aRet * (1 - textIn);
        p.sizeNow = mix(p.sizeRet, p.size, smoothstep(0, 0.9, e));
        continue;
      }
      if (state === 'returning') {
        // Antes del vuelo las brasas ya están en la pose del ojo, ocultas
        // debajo de la almendra. No forman una segunda silueta visible.
        p.alpha = p.aRet;
        p.textAlpha = 0;
        continue;
      }
      const fp = clamp((tSec - p.delay) / FLIGHT, 0, 1);
      const T = targetFor(p, time);
      if (fp <= 0) {
        p.x = p.sx;
        p.y = p.sy;
        p.alpha = 0;
        p.textAlpha = 1;
        p.sizeNow = p.s0;
      } else if (fp < 1) {
        const e = easeOutCubic(fp);
        const c2x = T.x + p.lat * 0.6;
        const c2y = T.y - p.lift * 0.3;
        p.x = bez(p.sx, p.c1x, c2x, T.x, e);
        p.y = bez(p.sy, p.c1y, c2y, T.y, e);
        // El recorte se apaga a medida que la brasa despega: el texto se
        // deshace en la misma materia, no se desvanece debajo de ella.
        p.textAlpha = 1 - smoothstep(0.04, 0.3, e);
        p.alpha =
          mix(0.95, T.a, smoothstep(0, 0.75, e)) *
          smoothstep(0, 0.3, e);
        p.sizeNow = mix(p.s0, p.size, smoothstep(0, 0.85, e));
      } else {
        p.x += (T.x - p.x) * kFollow;
        p.y += (T.y - p.y) * kFollow;
        p.alpha += (T.a - p.alpha) * kFollow;
        p.textAlpha = 0;
        p.sizeNow += (p.size - p.sizeNow) * kFollow;
      }
    }
  };

  const updateMix = (now) => {
    if (state === 'waking') {
      const t = (now - engagedAt) / 1000;
      // Las brasas aterrizaron. La almendra se condensa en coral debajo y se
      // abre sin que las partículas se apaguen: el reveal sigue siendo coral.
      solidMix = smoothstep(ENTER_SOLID_AT, ENTER_SOLID_AT + ENTER_SOLID_DUR, t);
      const igniteEnd = openEnd + ENTER_IGNITE_DUR * 1000;
      particleMix = 1 - smoothstep(openEnd, igniteEnd, now);
      // El rojo recién aparece cuando el ojo terminó de cubrirse; no antes.
      solidColorMix = smoothstep(openEnd, igniteEnd, now);
    } else if (state === 'awake') {
      solidMix = 1;
      particleMix = 0;
      solidColorMix = 1;
    } else if (state === 'returning') {
      const rt = (now - returnAt) / 1000;
      // El ojo se enfría de rojo a coral y después cede opacidad. Las brasas
      // recién se encienden debajo cuando el coral ya reemplazó al rojo.
      solidColorMix = 1 - smoothstep(0, RETURN_COLOR_OUT, rt);
      solidMix =
        1 - smoothstep(RETURN_SOLID_FADE_AT, RETURN_SOLID_FADE_END, rt);
      particleMix = smoothstep(
        RETURN_COLOR_OUT,
        RETURN_COLOR_OUT + RETURN_PARTICLE_IN,
        rt,
      );
    } else {
      solidMix = 0;
      particleMix = 0;
    }
  };

  const solidColor = () => {
    const m = clamp(solidColorMix, 0, 1);
    const r = Math.round(mix(CORAL_RGB[0], RED_RGB[0], m));
    const g = Math.round(mix(CORAL_RGB[1], RED_RGB[1], m));
    const b = Math.round(mix(CORAL_RGB[2], RED_RGB[2], m));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const drawSolid = () => {
    solidCtx.clearRect(0, 0, CW, CH);
    const color = solidColor();
    for (let k = 0; k < 2; k++) {
      const gz = gaze[k];
      const look = {
        dx: gz.x * rx * 0.22,
        dy: gz.y * ry * 0.14,
        upRotExtra: -gz.x * 0.12,
        loRotExtra: gz.x * 0.12,
      };
      drawEye(
        solidCtx,
        { s: eyePose[k], dir: eyeDir[k] },
        eyeCx[k],
        eyeCy,
        eyeR,
        look,
        color,
      );
    }
  };

  const drawParticles = () => {
    if (particleMix <= 0.004) return;
    // source-over: las brasas coral mantienen su matiz aunque se superpongan;
    // con 'lighter' la suma de G/B podía virar a blanco.
    ctx.globalCompositeOperation = 'source-over';
    for (const p of particles) {
      const a = p.alpha * particleMix;
      if (a <= 0.004) continue;
      ctx.globalAlpha = a;
      const s = p.sizeNow;
      ctx.drawImage(p.sprite, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  };

  // Texto compuesto por los mismos fragmentos que vuelan. No hay un h4
  // apareciendo por detrás: cada brasa lleva su recorte y lo devuelve al
  // posarse. En reposo, la unión de los recortes es el subtítulo.
  const drawTextParticles = () => {
    if (!textVisible) return;
    ctx.globalCompositeOperation = 'source-over';
    for (const p of particles) {
      if (p.textAlpha <= 0.004 || !p.patchCanvas) continue;
      ctx.globalAlpha = p.textAlpha;
      ctx.drawImage(
        p.patchCanvas,
        p.x - PATCH / 2,
        p.y - PATCH / 2,
        PATCH,
        PATCH,
      );
    }
    ctx.globalAlpha = 1;
  };

  const showParticleText = () => {
    if (!textAtlas || !particles.length || !particles.some((p) => p.patchCanvas)) {
      return false;
    }
    for (const p of particles) {
      p.x = p.sx;
      p.y = p.sy;
      p.textAlpha = 1;
    }
    textVisible = true;
    // Primero se dibuja el texto de fragmentos y sólo después se oculta el
    // h4: el intercambio ocurre en el mismo frame, sin hueco ni fundido.
    ctx.clearRect(0, 0, CW, CH);
    drawTextParticles();
    gsap.killTweensOf(h4s);
    gsap.set(h4s, { opacity: 0 });
    return true;
  };

  const drawSolidLayer = () => {
    if (solidMix <= 0.004) return;
    drawSolid();
    ctx.globalAlpha = solidMix;
    ctx.drawImage(solidCanvas, 0, 0, CW, CH);
    ctx.globalAlpha = 1;
  };

  const draw = () => {
    ctx.clearRect(0, 0, CW, CH);
    if (state === 'waking') {
      // La almendra es el cuerpo que se condensa debajo; las brasas quedan
      // encima como textura hasta que el ojo abre y el coral se enciende.
      drawSolidLayer();
      drawParticles();
      drawTextParticles();
    } else {
      // En la salida la almendra cubre a las brasas y cede opacidad: así el
      // coral aparece como textura del mismo ojo, no como una segunda silueta.
      drawParticles();
      drawSolidLayer();
      drawTextParticles();
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  const loop = (now) => {
    raf = 0;
    if (state === 'idle' || disabled || document.hidden) return;
    const dt = clamp((now - lastT) / 1000, 0.001, 0.033);
    lastT = now;

    if (state === 'returning' && !returnStarted && now - returnAt >= RETURN_FLIGHT_AT * 1000) {
      returnStarted = true;
      returnStartAt = now;
      for (const p of particles) {
        p.rx0 = p.x;
        p.ry0 = p.y;
        // aRet se guardó al soltar: el coral ya está formado y con brillo.
        if (p.aRet <= 0.004) p.aRet = p.alpha;
        // Arco espejado de la entrada: primero sale del ojo, después cae en el
        // glifo. La línea de arriba sale antes que la de abajo.
        const dir =
          Math.sign(p.sx - eyeCx[p.eye]) || (Math.random() < 0.5 ? -1 : 1);
        p.rout = dir * rand(5, 12) + rand(-2, 2);
        p.rup = p.role === 1 ? rand(10, 18) : rand(14, 28);
        p.rc1x = p.rx0 + p.rout;
        p.rc1y = p.ry0 - p.rup;
        p.rc2x = p.sx + p.rout * 0.45;
        p.rc2y = p.sy - p.rup * 0.55;
        p.rdelay = (p.line === 0 ? 0 : 0.025) + rand(0, 0.04);
        p.sizeRet = Math.max(p.size * 1.04, p.sizeNow * 1.08);
      }
    }

    // La cobertura termina con la apertura. El rojo recién se enciende al
    // completar el coral: el reveal sigue en las brasas hasta ese momento.
    if (state === 'waking' && now >= openEnd + ENTER_IGNITE_DUR * 1000) {
      state = 'awake';
    }
    if (state === 'awake') updateAwake(now);
    // Si el puntero se va antes de que el ojo abra, no vale la pena completar
    // la entrada para volver: se restaura el texto en el mismo frame.
    if (state === 'waking' && awayAt && now - awayAt > AWAY_HOLD) {
      cancelInstant();
      return;
    }
    if (state === 'returning' && now >= returnAt + RETURN_TOTAL * 1000) {
      finishReturn(now);
      return;
    }

    updateGaze(now, dt);
    updatePose(now, dt);
    updateParticles(now, dt);
    updateMix(now);
    draw();
    if (state !== 'idle') raf = requestAnimationFrame(loop);
  };

  // ─── Puntero / tap ──────────────────────────────────────────────────
  const insideRect = (x, y, r, pad) =>
    x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;

  const onMove = (e) => {
    if (disabled || coarse) return;
    const now = performance.now();
    const x = e.clientX;
    const y = e.clientY;
    if (state === 'idle') {
      const inside = insideRect(x, y, wrapRect, HIT_PAD);
      if (inside && !wasInside && now > cooldownUntil && window.scrollY < 2) {
        engage(x, y);
      }
      wasInside = inside;
      return;
    }
    if (state === 'returning') {
      wasInside = insideRect(x, y, wrapRect, HIT_PAD);
      return;
    }
    const dtm = Math.max(1, now - lastMoveT);
    const dx = x - lastPX;
    const dy = y - lastPY;
    const dist = Math.hypot(dx, dy);
    if (dist > 4) {
      lastMoveAt = now;
      for (let k = 0; k < 2; k++) {
        microX[k] = 0;
        microY[k] = 0;
        nextMicro[k] = now + 2400 + rand(0, 800);
      }
    }
    // Gesto de enojo: un swipe corto y rápido, no un salto después de una
    // pausa (dtm filtra los teleports del cursor). Es un impulso one-shot.
    if (state === 'awake' && now - engagedAt > 700 && dist > 15 && dtm < 100) {
      const speed = dist / (dtm / 1000);
      if (speed > 2800 && now > angerCooldownUntil) {
        angerStart = now;
        angerCooldownUntil = now + ANGRY_COOLDOWN;
      }
    }
    lastPX = x;
    lastPY = y;
    lastMoveT = now;
    pointer.x = x;
    pointer.y = y;
    const inZone = insideRect(x, y, zoneRect, ZONE_PAD);
    if (inZone) awayAt = 0;
    else if (!awayAt) awayAt = now;
    wasInside = insideRect(x, y, wrapRect, HIT_PAD);
  };

  const onDown = (e) => {
    if (disabled || !coarse) return;
    const now = performance.now();
    if (state === 'idle') {
      if (now < cooldownUntil || window.scrollY > 2) return;
      engage(e.clientX, e.clientY);
    } else if (state === 'waking' || state === 'awake') {
      release('tap');
    }
  };

  const onLeave = () => {
    wasInside = false;
    if (state === 'waking' || state === 'awake') release('away');
  };

  const onScroll = () => {
    if (window.scrollY > 2) {
      cancelInstant();
      wasInside = false;
    }
  };

  let resizeTimer = 0;
  const onResize = () => {
    cancelInstant();
    cooldownUntil = 0;
    clearTimeout(resizeTimer);
    particles = [];
    measure();
    ctx.clearRect(0, 0, CW, CH);
    solidCtx.clearRect(0, 0, CW, CH);
    resizeTimer = setTimeout(() => {
      if (state !== 'idle') return;
      build();
      wasInside = false;
    }, 180);
  };

  const onVisibility = () => {
    if (document.hidden) cancelInstant();
  };

  const onReduceChange = (e) => {
    if (!e.matches) return;
    cancelInstant();
    disabled = true;
    canvas.style.display = 'none';
  };

  const arm = () => {
    if (armed) return;
    armed = true;
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    if (coarse) wrap.addEventListener('pointerdown', onDown, { passive: true });
    reduceMq.addEventListener?.('change', onReduceChange);
  };

  // Arranca recién con la intro terminada y las fuentes listas: así el muestreo
  // toma el subtítulo en su posición final y nunca compite con el preloader.
  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  fontsReady.then(() => {
    measure();
    build();
    arm();
  });
};
