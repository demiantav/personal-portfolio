import { progressState } from './progressState.js';

// Humo rojizo: un único canvas fijo en el viewport, detrás del contenido. El
// campo se muestrea en coordenadas de viewport, así el humo no viaja con el
// scroll: el scroll sólo controla la intensidad. Media resolución: el humo es de
// baja frecuencia y el escalado por CSS no se nota.
// Velo: un fondo fijo del color de la sección, hasta el borde inferior de la
// sección de cards. Tapa el pie como antes y, junto con el canvas, se recorta
// con el mismo borde para que el humo nunca pinte sobre el pie.
// Luz motivada: los ojos iluminan la niebla con un halo suave que se apaga hacia
// afuera; en el finale la absorción tira del humo hacia ellos.
const REDUCE = '(prefers-reduced-motion: reduce)';
const SCALE = 0.5;

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

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
uniform float u_light;  // reloj de las luces: avanza con la misma velocidad que el humo
uniform float u_close;  // finale: cierre de los ojos 0→1 (apaga el halo)
const float RING_R = 1.3; // radio máximo del anillo (aprobado): sale del viewport antes de la absorción

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

// Coordenadas de ruido desde px de viewport: el campo queda fijo en la pantalla
vec2 toNoise(vec2 vp) {
  return vec2((vp.x - u_view.x * 0.5) / u_view.y, vp.y / u_view.y) * 2.2;
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

  // Mapeo de la fuente: el humo junto al frente se tira hacia el ojo
  vec2 off = vp - u_eye;
  float rad = max(length(off), 1e-4);
  float rEye = rad / u_view.y;
  float pull = 1.0 + 1.6 * smoothstep(0.15, 0.85, rg) * exp(-pow((rEye - frontR) / 0.25, 2.0));

  // Absorción: el humo gira y se estira hacia el ojo, más fuerte cuanto más cerca
  float fa = smoothstep(0.0, 0.6, ab);
  float near = 1.0 - smoothstep(0.0, 1.2, rEye);
  // Giro con velocidad inversa al radio: arranca suave con el scroll y se acelera al acercarse al ojo
  float spin = 1.5 * smoothstep(0.0, 1.0, ab) / (rEye + 0.15);
  mat2 swirl = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
  // Flujo continuo hacia el ojo: el muestreo se acerca en escala log-polar con ab, sin saturarse
  float inflow = exp(1.1 * ab);
  vec2 src = u_eye + swirl * off * ((pull + antic) * (1.0 + 1.4 * fa * near) * inflow);

  vec2 p = toNoise(src);
  float t = u_flow * 0.1;
  // base ascendente: el humo sube desde el borde inferior (la coordenada crece hacia abajo).
  // Durante la absorción la deriva se apaga: el humo cae hacia el ojo
  p.y += t * 2.0 * (1.0 - fa);

  // domain warping en dos pasos: remolinos y estratificación, no nubes blandas
  vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
  vec2 r = vec2(
    fbm(p + 2.0 * q + vec2(1.7, 9.2) + 0.3 * t),
    fbm(p + 2.0 * q + vec2(8.3, 2.8) - 0.2 * t)
  );
  float d = fbm(p + 2.5 * r);

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
  // Frente de succión: se contrae desde los bordes hacia el ojo. Lo que queda
  // fuera del frente ya fue absorbido; a absorb = 1 no queda humo
  float reach = 1.4 * (1.0 - smoothstep(0.0, 0.9, ab));
  float inside = 1.0 - smoothstep(reach - 0.2, reach + 0.05, rEye);
  float sinkR = 0.2 * fa;
  float sink = smoothstep(sinkR - 0.03, sinkR + 0.03, rEye);
  // Halo del ojo: crece con el anillo y la absorción, se apaga al cerrar
  float glowR = u_view.y * (0.3 + 0.35 * max(rg, ab));
  float lit = exp(-length(vp - u_eye) / glowR) * u_eyeAmt * (1.0 + 1.2 * max(rg, ab)) * (1.0 - smoothstep(0.0, 1.0, u_close));
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
  float density = clamp((base + rim * body * 0.9 + glow * 0.9 + lit * 0.35) * u_alpha, 0.0, 1.0);
  vec3 tint = mix(vec3(0.14, 0.01, 0.02), vec3(0.42, 0.03, 0.05), body);
  vec3 hot = vec3(0.6, 0.05, 0.07);
  vec3 col = mix(tint, hot, clamp(max(max(lit, rim), glow), 0.0, 1.0));
  gl_FragColor = vec4(col * density, density);
}
`;

const compile = (gl, type, src) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

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

  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  const vs = gl && compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = gl && compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = vs && fs && gl.createProgram();
  if (!program) return;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  // Triángulo que cubre el viewport: un solo draw call
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

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
    flow: gl.getUniformLocation(program, 'u_flow'),
    light: gl.getUniformLocation(program, 'u_light'),
  };

  const veil = document.createElement('div');
  veil.className = 'progress-veil';
  veil.setAttribute('aria-hidden', 'true');

  document.body.prepend(canvas);
  document.body.append(veil);
  document.body.classList.add('progress-stage');

  const resize = () => {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const w = Math.max(1, Math.round(cw * SCALE));
    const h = Math.max(1, Math.round(ch * SCALE));
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
    gl.uniform2f(u.view, window.innerWidth, window.innerHeight);
  };
  resize();

  // Borde inferior de la zona: el velo y el canvas se recortan con la sección de
  // cards, así el pie queda tapado exactamente como antes.
  let stageH = -1;
  const updateStage = () => {
    const H = window.innerHeight;
    const s = clamp(sec.getBoundingClientRect().bottom, 0, H);
    if (s !== stageH) {
      stageH = s;
      veil.style.height = `${s}px`;
      canvas.style.clipPath = `inset(0 0 ${H - s}px 0)`;
    }
    return s;
  };

  const t0 = performance.now();
  let last = t0;
  let alpha = 0;
  let raf = 0;
  // Cierre de los ojos: el velo y el humo se desvanecen y el pie entra en tiempo
  let hidden = false;
  let fade = 1;
  let flow = 0;
  let light = 0;
  let speed = 1;

  // El loop corre sólo mientras hay humo visible o un fade en curso; el scroll lo
  // despierta para que el velo y el recorte sigan a la sección.
  const frame = (now) => {
    raf = 0;
    const dt = (now - last) / 1000;
    last = now;
    const stage = updateStage();
    const lit = stage > 0 ? Math.max(progressState.eyes, progressState.p > 0.001 ? 1 : 0) : 0;
    alpha += (lit - alpha) * (1 - Math.exp(-dt * 2.5));
    const target = hidden ? 0 : 1;
    fade += (target - fade) * (1 - Math.exp(-dt * 6));
    veil.style.opacity = String(fade);
    canvas.style.opacity = String(fade);
    const ab = progressState.absorb;
    speed += (1 + 7 * ab * ab - speed) * (1 - Math.exp(-dt * 2.5));
    flow += dt * speed;
    light += dt * speed;
    gl.uniform1f(u.time, (now - t0) / 1000);
    gl.uniform1f(u.flow, flow);
    gl.uniform1f(u.light, light);
    gl.uniform1f(u.alpha, alpha);
    gl.uniform2f(u.eye, progressState.eyeX, progressState.eyeY);
    gl.uniform1f(u.eyeAmt, progressState.eyes);
    gl.uniform1f(u.ring, progressState.ring);
    gl.uniform1f(u.absorb, progressState.absorb);
    gl.uniform1f(u.close, progressState.close);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (lit > 0 || alpha > 0.002 || Math.abs(target - fade) > 0.002) raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  window.addEventListener('eyesClosed', () => {
    hidden = true;
    start();
  });
  window.addEventListener('eyesOpened', () => {
    hidden = false;
    start();
  });

  window.addEventListener('scroll', start, { passive: true });
  window.addEventListener('resize', () => {
    resize();
    stageH = -1;
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
