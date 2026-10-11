import { progressState } from './progressState.js';

// Humo rojizo: un fragment shader sobre un quad fullscreen por sección.
// El campo se muestrea en coordenadas de documento, así el título y las cards
// comparten la misma niebla y no se nota la costura entre los dos canvas. Media
// resolución: el humo es de baja frecuencia y el escalado por CSS no se nota.
// Luz motivada: los ojos iluminan la niebla con un halo suave que se apaga hacia
// afuera.
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
uniform vec2 u_css;     // canvas en px CSS
uniform vec2 u_base;    // (0, posición de documento del borde superior del canvas)
uniform vec2 u_view;    // viewport en px CSS
uniform float u_scroll;
uniform float u_time;
uniform float u_alpha;
uniform vec2 u_eye;     // centro de los ojos, px de viewport
uniform float u_eyeAmt; // apertura de los ojos 0→1
uniform float u_absorb; // finale: los ojos absorben el humo 0→1

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

float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

// Coordenadas de ruido desde px de viewport (mismo mapeo en todos los canvas)
vec2 toNoise(vec2 vp) {
  return vec2((vp.x - u_view.x * 0.5) / u_view.y, (vp.y + u_scroll) / u_view.y) * 2.2;
}

// Absorción: el campo se muestrea desde más lejos del ojo y girando, así las
// volutas se contraen hacia él y giran al acercarse. El giro y la contracción
// crecen con la proximidad (1/r); una turbulencia leve evita el remolino perfecto.
vec2 sinkWarp(vec2 vp, float a) {
  if (a < 0.001) return vp;
  vec2 d = vp - u_eye;
  float R = u_view.y;
  float r = length(d);
  float near = 1.0 / (1.0 + r / (0.5 * R));
  float k = 1.0 + a * (0.9 * near + 0.15);
  float ang = a * 3.0 * near;
  float c = cos(ang);
  float s = sin(ang);
  vec2 rd = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  vec2 turb = (vec2(noise(vp / (0.25 * R) + u_time * 0.2), noise(vp / (0.25 * R) - u_time * 0.17)) - 0.5) * 0.12 * R * a;
  return u_eye + rd * k + turb;
}

void main() {
  vec2 local = vec2(gl_FragCoord.x / u_res.x, 1.0 - gl_FragCoord.y / u_res.y) * u_css;
  vec2 world = local + u_base;
  vec2 vp = vec2(world.x, world.y - u_scroll);
  float vy = vp.y / u_view.y;
  vec2 p = toNoise(sinkWarp(vp, u_absorb));
  float t = u_time * 0.05;
  p.y -= t * 2.0;

  // domain warping en dos pasos: remolinos y estratificación, no nubes blandas
  vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
  vec2 r = vec2(
    fbm(p + 2.0 * q + vec2(1.7, 9.2) + 0.3 * t),
    fbm(p + 2.0 * q + vec2(8.3, 2.8) - 0.2 * t)
  );
  float d = fbm(p + 2.5 * r);

  float body = smoothstep(0.30, 0.85, d);
  float floorBias = mix(0.35, 1.0, clamp(vy, 0.0, 1.0));
  // Hueco de densidad junto al ojo y apagado final: el humo se vacía hacia él
  float rEye = length(vp - u_eye) / u_view.y;
  float hole = mix(1.0, smoothstep(0.04, 0.3, rEye), u_absorb);
  float gone = 1.0 - smoothstep(0.55, 1.0, u_absorb);
  // Halo del ojo: crece con lo absorbido (energía acumulada)
  float glowR = u_view.y * (0.3 + 0.35 * u_absorb);
  float lit = exp(-length(vp - u_eye) / glowR) * u_eyeAmt * (1.0 + 1.2 * u_absorb);
  float base = body * floorBias * 0.6 * hole * gone;
  float density = clamp((base + lit * (0.25 + 0.35 * body)) * u_alpha, 0.0, 1.0);
  vec3 tint = mix(vec3(0.14, 0.01, 0.02), vec3(0.42, 0.03, 0.05), body);
  vec3 hot = vec3(0.6, 0.05, 0.07);
  vec3 col = mix(tint, hot, clamp(lit, 0.0, 1.0));
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

// Monta el humo dentro de `host`. `target()` devuelve la intensidad deseada
// (0→1) mientras la sección está en pantalla.
const mountFog = (host, target) => {
  if (!host) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'progress-fog';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);

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
  if (!program) {
    canvas.remove();
    return;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    canvas.remove();
    return;
  }
  gl.useProgram(program);

  // Triángulo que cubre el viewport: un solo draw call
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = {
    res: gl.getUniformLocation(program, 'u_res'),
    css: gl.getUniformLocation(program, 'u_css'),
    base: gl.getUniformLocation(program, 'u_base'),
    view: gl.getUniformLocation(program, 'u_view'),
    scroll: gl.getUniformLocation(program, 'u_scroll'),
    time: gl.getUniformLocation(program, 'u_time'),
    alpha: gl.getUniformLocation(program, 'u_alpha'),
    eye: gl.getUniformLocation(program, 'u_eye'),
    eyeAmt: gl.getUniformLocation(program, 'u_eyeAmt'),
    absorb: gl.getUniformLocation(program, 'u_absorb'),
  };

  const resize = () => {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const w = Math.max(1, Math.round(cw * SCALE));
    const h = Math.max(1, Math.round(ch * SCALE));
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
    gl.uniform2f(u.css, cw, ch);
    gl.uniform2f(u.view, window.innerWidth, window.innerHeight);
  };
  resize();
  window.addEventListener('resize', resize);

  const t0 = performance.now();
  let last = t0;
  let alpha = 0;
  let visible = false;
  let raf = 0;

  // Fade propio por frame (dt-based), siguiendo la intensidad de la sección
  const frame = (now) => {
    raf = 0;
    const dt = (now - last) / 1000;
    last = now;
    const goal = visible ? target() : 0;
    alpha += (goal - alpha) * (1 - Math.exp(-dt * 2.5));
    const rect = canvas.getBoundingClientRect();
    gl.uniform2f(u.base, 0, window.scrollY + rect.top);
    gl.uniform1f(u.scroll, window.scrollY);
    gl.uniform1f(u.time, (now - t0) / 1000);
    gl.uniform1f(u.alpha, alpha);
    gl.uniform2f(u.eye, progressState.eyeX, progressState.eyeY);
    gl.uniform1f(u.eyeAmt, progressState.eyes);
    gl.uniform1f(u.absorb, progressState.absorb);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (visible || alpha > 0.002) raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  // Sólo renderiza mientras la sección está en pantalla
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  }).observe(host);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && visible) start();
  });

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
  });
};

// Cards: humo completo mientras la sección está en pantalla
export const progressFog = () => {
  if (window.matchMedia(REDUCE).matches) return;
  mountFog(document.querySelector('.main__progress-section'), () => 1);
};

// Título: el humo arranca con la apertura de los ojos (no antes)
export const titleFog = () => {
  if (window.matchMedia(REDUCE).matches) return;
  mountFog(document.querySelector('.progress-title-section'), () => progressState.eyes);
};
