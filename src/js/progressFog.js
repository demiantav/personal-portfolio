import { progressState } from './progressState.js';
import { NOISE, buildProgram, webglContext } from './gl.js';

// Humo rojizo: un único canvas fijo en el viewport, detrás del contenido. El
// campo se muestrea en coordenadas de viewport, así el humo no viaja con el
// scroll: el scroll sólo controla la intensidad. Media resolución: el humo es de
// baja frecuencia y el escalado por CSS no se nota.
// Velo: un segundo canvas fijo, debajo del humo y encima del pie, con el color de
// la sección hasta el borde inferior de las cards. Ambos se recortan con el mismo
// borde para que el humo nunca pinte sobre el pie. El velo tiene un agujero (aro)
// que crece desde los ojos y revela el pie.
// Luz motivada: los ojos iluminan la niebla con un halo suave que se apaga hacia
// afuera; en el finale la absorción tira del humo hacia ellos.
const REDUCE = '(prefers-reduced-motion: reduce)';
const SCALE = 0.5;
// Margen del aro: borde suave (60 px) más la variación del borde ruidoso (±90 px)
const REVEAL_MARGIN = 210;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_res;     // canvas en px de buffer
uniform vec2 u_view;    // viewport en px CSS
uniform float u_time;
uniform float u_alpha;
uniform vec2 u_eye;     // centro de los ojos, px de viewport
uniform float u_eyeAmt; // apertura de los ojos 0→1
uniform float u_ring;   // finale: anillo 0→1 (tiempo fijo)
uniform float u_absorb; // finale: absorción del humo restante 0→1 (scroll)
uniform float u_flow;   // tiempo de flujo del humo: acelera con la absorción
uniform float u_inPhase; // fase de succión en ciclos (0→1): más ciclos por segundo al final
uniform float u_light;  // reloj de las luces: avanza con la misma velocidad que el humo
uniform float u_lag;    // absorción con retraso suavizado: el halo se contrae con el humo
uniform float u_close;  // finale: cierre de los ojos 0→1 (apaga el halo)
uniform float u_gone;   // residuo: 0→1 con el cierre de los ojos y durante el aro (apaga todo el humo)
const float RING_R = 1.3; // radio máximo del anillo (aprobado): sale del viewport antes de la absorción
${NOISE}

// Coordenadas de ruido desde px de viewport: el campo queda fijo en la pantalla
vec2 toNoise(vec2 vp) {
  return vec2((vp.x - u_view.x * 0.5) / u_view.y, vp.y / u_view.y) * 2.2;
}

// Campo de densidad del humo muestreado en src (coordenadas de ruido)
float fieldAt(vec2 src, float t, float fa) {
  vec2 p = toNoise(src);
  // base ascendente: el humo sube desde el borde inferior (la coordenada crece hacia abajo).
  // Durante la absorción la deriva se apaga: el humo cae hacia el ojo
  p.y += t * 2.0 * (1.0 - fa);

  // domain warping en dos pasos: remolinos y estratificación, no nubes blandas
  vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
  vec2 r = vec2(
    fbm(p + 2.0 * q + vec2(1.7, 9.2) + 0.3 * t),
    fbm(p + 2.0 * q + vec2(8.3, 2.8) - 0.2 * t)
  );
  return fbm(p + 2.5 * r);
}

void main() {
  vec2 vp = vec2(gl_FragCoord.x / u_res.x, 1.0 - gl_FragCoord.y / u_res.y) * u_view;
  float vy = vp.y / u_view.y;
  // Anillo (u_ring, tiempo fijo): el frente crece desde el ojo y limpia el humo que
  // toca. Antes del frente, la anticipación aleja el humo un instante. Después, con
  // u_absorb (scroll), el humo de afuera se succiona hacia el ojo
  float rg = u_ring;
  float ab = u_absorb;
  float antic = -0.12 * smoothstep(0.0, 0.15, rg) * (1.0 - smoothstep(0.15, 0.3, rg));
  float frontR = RING_R * smoothstep(0.15, 0.85, rg);
  // Frente de succión: se contrae desde los bordes hacia el ojo. Lo que queda
  // fuera del frente ya fue absorbido; a absorb = 1 no queda humo
  float reach = 1.4 * (1.0 - smoothstep(0.0, 0.9, ab));
  // Banda de tirón. Durante el anillo (aprobado) sale del frente del anillo con su
  // fuerza 1.6. Al arrancar la absorción se pega al frente que se contrae, pero con
  // fuerza y ancho que bajan con el radio: así el estirado viaja con el borde visible
  // sin acelerar el corrimiento del humo (antes la banda estaba lejos del borde)
  float abBlend = smoothstep(0.0, 0.15, ab);
  float pullK = clamp(reach / 1.4, 0.0, 1.0);
  float pullR = mix(frontR, reach, abBlend);
  float pullW = 0.25 * mix(1.0, max(pullK, 0.3), abBlend);
  float pullAmp = mix(1.6, 0.45 * pullK, abBlend);

  // Mapeo de la fuente: el humo junto al frente se tira hacia el ojo
  vec2 off = vp - u_eye;
  float rad = max(length(off), 1e-4);
  float rEye = rad / u_view.y;
  float pull = 1.0 + pullAmp * smoothstep(0.15, 0.85, rg) * exp(-pow((rEye - pullR) / pullW, 2.0));

  // Absorción: el humo gira y se estira hacia el ojo, más fuerte cuanto más cerca
  float fa = smoothstep(0.0, 0.6, ab);
  float near = 1.0 - smoothstep(0.0, 1.2, rEye);
  // Giro con velocidad inversa al radio: crece lineal con la absorción, así mantiene
  // su ritmo y se acelera al contraerse la esfera (antes saturaba a mitad de camino)
  float spin = 1.5 * ab / (rEye + 0.15);
  mat2 swirl = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
  // Flujo continuo hacia el ojo: el muestreo se acerca en escala log-polar con ab, sin saturarse
  float inflow = exp(1.1 * ab);
  vec2 srcBase = u_eye + swirl * off * ((pull + antic) * (1.0 + 1.4 * fa * near) * inflow);
  float t = u_flow * 0.1;
  // Succión por tiempo: dos muestras desfasadas medio ciclo se mezclan con pesos
  // triangulares, así el humo avanza hacia el ojo sin saltos al reiniciar el ciclo
  float s1 = fract(u_inPhase);
  float s2 = fract(u_inPhase + 0.5);
  float w1 = 1.0 - abs(2.0 * s1 - 1.0);
  float d = fieldAt(u_eye + (srcBase - u_eye) * exp(0.5 * fa * s1), t, fa);
  if (fa > 0.0) {
    d = mix(fieldAt(u_eye + (srcBase - u_eye) * exp(0.5 * fa * s2), t, fa), d, w1);
  }

  // contrapeso: volutas que caen suave sólo en la franja superior, así el humo se
  // disipa arriba y no queda una columna uniforme que sube
  vec2 pd = toNoise(vp) * 0.8;
  pd.y -= t * 2.0 * (1.0 - fa);
  float dn = fbm(pd + vec2(3.7, 1.9));
  float topBand = 1.0 - smoothstep(0.3, 0.9, vy);
  d = mix(d, dn, topBand * 0.35);

  float body = smoothstep(0.30, 0.85, d);
  // fuente en el borde inferior, donde está la costura con el pie
  float floorBias = mix(0.3, 1.0, smoothstep(0.0, 1.0, vy));
  // Frente con borde ruidoso: dentro del radio del anillo no queda humo. Después,
  // ese espacio queda abierto para el humo que llega desde afuera
  float edge = (noise(vp / u_view.y * 6.0 + vec2(0.0, t)) - 0.5) * 0.16;
  float eaten = mix(smoothstep(frontR + edge - 0.04, frontR + edge + 0.04, rEye), 1.0, fa);
  // Frente de succión: dentro del frente el humo está disponible; fuera, ya fue absorbido
  float inside = 1.0 - smoothstep(reach - 0.2, reach + 0.05, rEye);
  float sinkR = 0.2 * fa;
  float sink = smoothstep(sinkR - 0.03, sinkR + 0.03, rEye);
  // Halo del ojo: crece con el anillo y la absorción, se apaga al cerrar
  float haloK = 1.0 - smoothstep(0.25, 1.0, u_lag);
  float glowR = u_view.y * (0.3 + 0.35 * rg) * (0.35 + 0.65 * haloK);
  float lit = exp(-length(vp - u_eye) / glowR) * u_eyeAmt * (1.0 + 1.2 * max(rg, u_lag)) * (0.3 + 0.7 * haloK) * (1.0 - smoothstep(0.0, 1.0, u_close));
  // Borde del frente: humo que se está tragando, se ve encendido mientras cae
  float rim = exp(-pow((rEye - frontR - edge) / 0.035, 2.0)) * smoothstep(0.15, 0.3, rg) * (1.0 - smoothstep(0.8, 0.95, rg));
  // Calor del frente de succión: el borde que se contrae se enciende
  float front = exp(-pow((rEye - reach) / 0.05, 2.0)) * fa;
  // Hilos de luz: corrientes radiales que caen hacia el ojo al ritmo de la absorción
  float ang = atan(off.y, off.x);
  float strandT = log(max(rEye, 1e-3)) * 3.0 + u_light * 0.25;
  float strands = smoothstep(0.6, 0.85, noise(vec2(ang * 9.0, strandT))) * fa * inside;
  float glow = (front * 0.9 + strands * 0.7) * body;
  float base = body * floorBias * 0.6 * eaten * sink * inside;
  // El halo es luz pura: sin la textura del humo, así no se lee como humo residual
  float density = clamp((base + rim * body * 0.9 + glow * 0.9 + lit * 0.35) * u_alpha * (1.0 - u_gone), 0.0, 1.0);
  vec3 tint = mix(vec3(0.14, 0.01, 0.02), vec3(0.42, 0.03, 0.05), body);
  vec3 hot = vec3(0.6, 0.05, 0.07);
  vec3 col = mix(tint, hot, clamp(max(max(lit, rim), glow), 0.0, 1.0));
  gl_FragColor = vec4(col * density, density);
}
`;

// Velo con agujero: tapa el pie fuera del aro. El borde es ruidoso (como el humo)
// y tiene un resplandor rojo que sólo tiñe el velo
const VEIL_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_res;      // canvas en px de buffer
uniform vec2 u_view;     // viewport en px CSS
uniform vec2 u_eye;      // centro de los ojos, px de viewport
uniform vec3 u_veil;     // color del velo (--bg-color) 0→1
uniform float u_stage;   // borde inferior de la zona del velo, px de viewport
uniform float u_reveal;  // aro del pie 0→1 (tiempo fijo)
uniform float u_revealR; // radio del aro, px de viewport
${NOISE}

void main() {
  vec2 vp = vec2(gl_FragCoord.x / u_res.x, 1.0 - gl_FragCoord.y / u_res.y) * u_view;
  float rvOn = step(0.0001, u_reveal);
  float edgeN = (fbm(vp / u_view.y * 3.0 + vec2(4.1, 2.3)) - 0.5) * 180.0;
  float re = u_revealR + edgeN;
  float dv = length(vp - u_eye);
  float inStage = 1.0 - step(u_stage, vp.y);
  float veilA = mix(1.0, smoothstep(re - 60.0, re + 60.0, dv), rvOn) * inStage;
  float ringGlow = (exp(-pow((dv - re) / 16.0, 2.0)) + 0.5 * exp(-max(dv - re, 0.0) / 70.0)) * rvOn;
  vec3 hotV = vec3(0.6, 0.05, 0.07);
  vec3 col = mix(u_veil, hotV, clamp(ringGlow * veilA * 2.0, 0.0, 1.0));
  gl_FragColor = vec4(col * veilA, veilA);
}
`;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Humo fijo para el título y las cards. Se enciende con la apertura de los ojos
// (título) y queda a plena intensidad con las cards. Fuera de la zona no se dibuja.
export const progressFog = () => {
  if (window.matchMedia(REDUCE).matches) return;
  const sec = document.querySelector('.main__progress-section');
  if (!sec) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'progress-fog';
  canvas.setAttribute('aria-hidden', 'true');
  const veilCanvas = document.createElement('canvas');
  veilCanvas.className = 'progress-veil';
  veilCanvas.setAttribute('aria-hidden', 'true');

  const gl = webglContext(canvas);
  const veilGl = webglContext(veilCanvas);
  const program = gl && buildProgram(gl, FRAG);
  const veilProgram = veilGl && buildProgram(veilGl, VEIL_FRAG);
  if (!program || !veilProgram) return;

  const u = {
    res: gl.getUniformLocation(program, 'u_res'),
    view: gl.getUniformLocation(program, 'u_view'),
    time: gl.getUniformLocation(program, 'u_time'),
    alpha: gl.getUniformLocation(program, 'u_alpha'),
    eye: gl.getUniformLocation(program, 'u_eye'),
    eyeAmt: gl.getUniformLocation(program, 'u_eyeAmt'),
    ring: gl.getUniformLocation(program, 'u_ring'),
    absorb: gl.getUniformLocation(program, 'u_absorb'),
    close: gl.getUniformLocation(program, 'u_close'),
    gone: gl.getUniformLocation(program, 'u_gone'),
    flow: gl.getUniformLocation(program, 'u_flow'),
    inPhase: gl.getUniformLocation(program, 'u_inPhase'),
    light: gl.getUniformLocation(program, 'u_light'),
    lag: gl.getUniformLocation(program, 'u_lag'),
  };
  const vu = {
    res: veilGl.getUniformLocation(veilProgram, 'u_res'),
    view: veilGl.getUniformLocation(veilProgram, 'u_view'),
    eye: veilGl.getUniformLocation(veilProgram, 'u_eye'),
    veil: veilGl.getUniformLocation(veilProgram, 'u_veil'),
    stage: veilGl.getUniformLocation(veilProgram, 'u_stage'),
    reveal: veilGl.getUniformLocation(veilProgram, 'u_reveal'),
    revealR: veilGl.getUniformLocation(veilProgram, 'u_revealR'),
  };

  // Color del velo: el mismo --bg-color que usaba el elemento DOM
  const probe = document.createElement('div');
  probe.style.color = 'var(--bg-color)';
  probe.style.display = 'none';

  document.body.prepend(canvas);
  document.body.append(veilCanvas);
  document.body.append(probe);
  document.body.classList.add('progress-stage');
  const veilRGB = [0.03, 0.03, 0.03];
  const readVeil = () => {
    const m = getComputedStyle(probe).color.match(/[\d.]+/g);
    if (m && m.length >= 3) {
      veilRGB[0] = m[0] / 255;
      veilRGB[1] = m[1] / 255;
      veilRGB[2] = m[2] / 255;
    }
  };

  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * SCALE));
    const h = Math.max(1, Math.round(canvas.clientHeight * SCALE));
    canvas.width = w;
    canvas.height = h;
    veilCanvas.width = w;
    veilCanvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
    gl.uniform2f(u.view, window.innerWidth, window.innerHeight);
    veilGl.viewport(0, 0, w, h);
    veilGl.uniform2f(vu.res, w, h);
    veilGl.uniform2f(vu.view, window.innerWidth, window.innerHeight);
  };
  resize();

  // Borde inferior de la zona: el velo y el humo se recortan con la sección de
  // cards, así el pie queda tapado exactamente como antes.
  let stageH = -1;
  const updateStage = () => {
    const H = window.innerHeight;
    const s = clamp(sec.getBoundingClientRect().bottom, 0, H);
    if (s !== stageH) {
      stageH = s;
      canvas.style.clipPath = `inset(0 0 ${H - s}px 0)`;
    }
    return s;
  };
  // El velo sigue a la sección salvo mientras corre el aro: así el scroll no levanta
  // el borde y el pie sólo aparece por el aro
  let veilStageH = -1;
  const updateVeilStage = (stage, rv) => {
    const H = window.innerHeight;
    const s = rv > 0 && rv < 1 ? H : stage;
    if (s !== veilStageH) {
      veilStageH = s;
      veilCanvas.style.clipPath = `inset(0 0 ${H - s}px 0)`;
    }
    return s;
  };

  const t0 = performance.now();
  let last = t0;
  let alpha = 0;
  let raf = 0;
  let flow = 0;
  let light = 0;
  let speed = 1;
  let inPhase = 0;
  let inV = 0.1;
  let lag = 0;

  // El loop corre sólo mientras hay humo visible o un aro en curso; el scroll lo
  // despierta para que el velo y el recorte sigan a la sección.
  const frame = (now) => {
    raf = 0;
    const dt = (now - last) / 1000;
    last = now;
    const stage = updateStage();
    const lit = stage > 0 ? Math.max(progressState.eyes, progressState.p > 0.001 ? 1 : 0) : 0;
    alpha += (lit - alpha) * (1 - Math.exp(-dt * 2.5));
    // Aro del pie: el radio llega más allá de la esquina más lejana, con margen para
    // el borde ruidoso, así a 1 el velo desaparece del todo
    const rv = progressState.reveal;
    const ex = progressState.eyeX;
    const ey = progressState.eyeY;
    // El origen del aro se congela mientras corre: los ojos siguen moviéndose y el
    // footer usa esa misma distancia, así sus elementos no cambian de tiempo
    if (rv <= 0) {
      progressState.revealX = ex;
      progressState.revealY = ey;
    }
    const ox = progressState.revealX;
    const oy = progressState.revealY;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const revealMax = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy)) + REVEAL_MARGIN;
    progressState.revealMax = revealMax;

    readVeil();
    veilGl.useProgram(veilProgram);
    veilGl.uniform3f(vu.veil, veilRGB[0], veilRGB[1], veilRGB[2]);
    veilGl.uniform2f(vu.eye, ox, oy);
    veilGl.uniform1f(vu.stage, updateVeilStage(stage, rv));
    veilGl.uniform1f(vu.reveal, rv);
    veilGl.uniform1f(vu.revealR, rv * revealMax);
    veilGl.drawArrays(veilGl.TRIANGLES, 0, 3);

    const ab = progressState.absorb;
    speed += (1 + 7 * ab * ab - speed) * (1 - Math.exp(-dt * 2.5));
    flow += dt * speed;
    light += dt * speed;
    inV += (0.1 + 0.6 * ab * ab * ab - inV) * (1 - Math.exp(-dt * 2.5));
    inPhase = (inPhase + dt * inV) % 1;
    lag += (ab - lag) * (1 - Math.exp(-dt * 0.6));
    gl.useProgram(program);
    gl.uniform1f(u.time, (now - t0) / 1000);
    gl.uniform1f(u.flow, flow);
    gl.uniform1f(u.inPhase, inPhase);
    gl.uniform1f(u.light, light);
    gl.uniform1f(u.lag, lag);
    gl.uniform1f(u.alpha, alpha);
    gl.uniform2f(u.eye, ex, ey);
    gl.uniform1f(u.eyeAmt, progressState.eyes);
    gl.uniform1f(u.ring, progressState.ring);
    gl.uniform1f(u.absorb, progressState.absorb);
    gl.uniform1f(u.close, progressState.close);
    // El humo restante se apaga con el cierre de los ojos (close): desaparece junto
    // con los párpados, sin hueco entre fin de absorción y cierre. Con el aro (rv) queda apagado
    gl.uniform1f(u.gone, Math.max(progressState.close, rv));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const revealing = rv > 0 && rv < 1;
    if (lit > 0 || alpha > 0.002 || revealing) raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  window.addEventListener('eyesClosed', start);
  window.addEventListener('eyesOpened', start);

  window.addEventListener('scroll', start, { passive: true });
  window.addEventListener('resize', () => {
    resize();
    stageH = -1;
    veilStageH = -1;
    start();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) start();
  });
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
  });

  start();
};
