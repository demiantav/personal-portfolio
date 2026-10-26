import gsap from 'gsap';
import { NOISE, buildProgram, webglContext } from './gl.js';

// Humo del hero: un canvas WebGL que llena la sección. Reemplaza a las líneas
// 2D (waves.js) y usa el mismo campo de ruido que el humo del finale, así el
// hero y la sección de proceso comparten lenguaje.
//
// Luz: relámpagos rojos aleatorios que iluminan el humo. La normal falsa sale de
// comparar la densidad con la del vecino hacia el origen del destello, así el
// humo se lee como volumen y no como una mancha que parpadea.
//
// Salida: al scrollear, el humo se pliega hacia la D del titular (misma idea que
// la absorción del finale). Lo maneja hero-zoom-transition.js tweeneando
// `exitProgress` de 0 a 1.
const REDUCE = '(prefers-reduced-motion: reduce)';
const COMPACT = '(max-width: 48rem)';
const SCALE_DESKTOP = 0.5;
const SCALE_COMPACT = 0.38;

// Pauta WCAG 2.3.1: nunca más de 3 destellos por segundo. Cada descarga emite
// 2 pulsos dentro de ~0.35 s y hay al menos 2.5 s entre descargas, así el límite
// queda holgado (2 destellos por descarga, muy por debajo de 3/s). El intervalo
// aleatorio da el delay orgánico.
const FLASH_MIN_GAP = 2.5;
const FLASH_MAX_GAP = 6;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_res;      // canvas en px de buffer
uniform vec2 u_view;     // viewport en px CSS
uniform float u_time;    // tiempo de flujo del humo
uniform float u_alpha;   // apertura de la intro 0→1
uniform float u_exit;    // salida hacia la D 0→1 (scroll)
uniform vec2 u_exitPos;  // centro de la D, px de viewport
uniform float u_flash;   // luz del relámpago 0→1
uniform vec2 u_flashPos; // origen del relámpago, px de viewport
${NOISE}

// Coordenadas de ruido desde px de viewport: el campo queda fijo en la pantalla
vec2 toNoise(vec2 vp) {
  return vec2((vp.x - u_view.x * 0.5) / u_view.y, vp.y / u_view.y) * 2.2;
}

// Densidad visible a partir del campo. Misma curva que el humo de la sección de
// los ojos: núcleos definidos y silueta de nube. Se usa también para el vecino
// del relámpago, así la normal falsa compara la misma curva.
float bodyAt(float d) {
  return smoothstep(0.30, 0.85, d);
}

// Capa macro: dos ruidos de baja frecuencia con deriva lenta que modulan la
// densidad a gran escala. Rompen la repetición del warping sin volver a
// filamentos: masas de nube, no una textura única.
float macroAt(vec2 vp, float t) {
  vec2 p = toNoise(vp);
  p.y += t * 1.6;
  return noise(p * 0.42 + vec2(1.3, 4.7) + vec2(0.0, t * 0.5)) * 0.65
       + noise(p * 0.85 + vec2(7.7, 2.1) - vec2(t * 0.3, 0.0)) * 0.35;
}

// Campo de densidad del humo. Sube desde el borde inferior (la coordenada crece
// hacia abajo) y usa domain warping en dos pasos, igual que el humo del finale.
float fieldAt(vec2 vp, float t) {
  vec2 p = toNoise(vp);
  p.y += t * 1.6;
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
  // El tiempo va escalado por 0.1 igual que el humo del finale (progressFog.js):
  // sin ese factor la deriva y el warping corrían ~8-10x más rápido.
  float t = u_time * 0.1;

  // Salida: el muestreo se pliega hacia la D y el humo se traga (absorción)
  float ex = smoothstep(0.0, 1.0, u_exit);
  vec2 src = mix(vp, u_exitPos + (vp - u_exitPos) * exp(1.1 * ex), ex);

  float d = fieldAt(src, t);

  // Contrapeso: volutas que caen en la franja superior, así el humo se disipa
  // arriba y no queda una columna uniforme
  vec2 pd = toNoise(vp) * 0.8;
  pd.y -= t * 1.6;
  float dn = fbm(pd + vec2(3.7, 1.9));
  float topBand = 1.0 - smoothstep(0.25, 0.9, vy);
  d = mix(d, dn, topBand * 0.35);
  // Capa macro: modula la densidad a gran escala después del contrapeso. Es lo
  // que hace que las masas cambien de tamaño y no se repita el mismo patrón.
  float macro = macroAt(src, t);
  d += (macro - 0.5) * 0.5;

  // Rampa del finale: núcleos definidos, silueta de nube
  float body = bodyAt(d);
  // Fuente en el borde inferior: el humo nace del pie del hero
  float floorBias = mix(0.35, 1.0, smoothstep(0.0, 1.0, vy));

  // Luz del relámpago. Sólo se muestrea el vecino cuando hay destello: fuera de
  // eso el costo es el del campo base.
  float lit = 0.0;
  float sky = 0.0;
  if (u_flash > 0.001) {
    vec2 toL = u_flashPos - vp;
    float ld = length(toL);
    vec2 ldir = toL / max(ld, 1e-4);
    vec2 lp = vp - ldir * u_view.y * 0.03;
    // El vecino también lleva la capa macro: la normal compara la misma densidad
    float dL = fieldAt(lp, t) + (macroAt(lp, t) - 0.5) * 0.5;
    float ndl = clamp(body - bodyAt(dL), 0.0, 1.0);
    float fall = exp(-ld / (u_view.y * 0.8));
    lit = ndl * (0.4 + 1.5 * body) * fall * u_flash;
    // Resplandor de cielo: el brillo no vive sólo en el humo, también en el aire,
    // pero acotado al entorno del origen para que no lave la pantalla
    sky = exp(-ld / (u_view.y * 0.95)) * u_flash;
  }

  // Ambiente: con el destello el campo sube apenas, como un cielo que se enciende
  // detrás del humo. La luz protagonista es la direccional, no esta. Un poco más
  // de presencia que antes para acercarlo a la densidad de la sección de los ojos.
  float ambient = body * floorBias * (0.55 + 0.28 * u_flash);
  float density = (ambient + lit * 1.5 + sky * 0.16) * u_alpha;

  vec3 tint = mix(vec3(0.07, 0.008, 0.012), vec3(0.34, 0.032, 0.052), body);
  // Sombreado interno: la capa macro varía apenas el brillo del cuerpo, así las
  // masas tienen zonas más cálidas y no se leen como una textura plana.
  tint *= 0.87 + 0.22 * macro;
  vec3 hot = vec3(0.9, 0.16, 0.16);
  float heat = clamp(lit * 2.0 + u_flash * 0.1 + sky * 0.1, 0.0, 1.0);

  density = clamp(density * (1.0 - ex), 0.0, 1.0);
  vec3 col = mix(tint, hot, heat);

  gl_FragColor = vec4(col * density, density);
}
`;

export class HeroSmoke {
  constructor({ dom }) {
    this.canvas = dom;
    this.reduce = window.matchMedia(REDUCE).matches;
    this.compact = window.matchMedia(COMPACT);
    // Tweeneado desde hero-zoom-transition.js
    this.exitProgress = 0;
    this.started = false;
    this.visible = false;
    this.alpha = 0;
    this.flow = 0;
    this.clock = 0;
    this.flash = 0;
    this.flashTarget = 0;
    this.pulses = [];
    this.nextFlashAt = 0;
    this.flashPos = { x: 0, y: 0 };
    this.exitPos = { x: 0, y: 0 };
    this.raf = 0;
    this.last = 0;

    this.loop = this.loop.bind(this);
    if (!this.setup()) return;

    window.addEventListener('resize', () => {
      this.resize();
      this.startLoop();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.startLoop();
    });
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    });
    this.observe();
  }

  setup() {
    const gl = webglContext(this.canvas);
    if (!gl) return false;
    const program = buildProgram(gl, FRAG);
    if (!program) return false;
    this.gl = gl;
    this.program = program;
    this.u = {
      res: gl.getUniformLocation(program, 'u_res'),
      view: gl.getUniformLocation(program, 'u_view'),
      time: gl.getUniformLocation(program, 'u_time'),
      alpha: gl.getUniformLocation(program, 'u_alpha'),
      exit: gl.getUniformLocation(program, 'u_exit'),
      exitPos: gl.getUniformLocation(program, 'u_exitPos'),
      flash: gl.getUniformLocation(program, 'u_flash'),
      flashPos: gl.getUniformLocation(program, 'u_flashPos'),
    };
    this.resize();
    return true;
  }

  // La intro recién muestra el humo al terminar el titular (textAnimate.js), así
  // el primer frame no compite con el vuelo de las letras.
  start() {
    if (this.started) return;
    this.started = true;
    this.measureExit();
    if (this.reduce) {
      this.alpha = 1;
      this.render();
      return;
    }
    gsap.to(this, { alpha: 1, duration: 1.6, ease: 'power2.out' });
    this.startLoop();
  }

  observe() {
    if (!('IntersectionObserver' in window)) {
      this.visible = true;
      return;
    }
    new IntersectionObserver(
      ([entry]) => {
        this.visible = entry.isIntersecting;
        if (this.visible) this.startLoop();
      },
      { threshold: 0 },
    ).observe(this.canvas);
  }

  resize() {
    const gl = this.gl;
    if (!gl) return;
    const scale = this.compact.matches ? SCALE_COMPACT : SCALE_DESKTOP;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * scale));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * scale));
    this.canvas.width = w;
    this.canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(this.u.res, w, h);
    gl.uniform2f(this.u.view, window.innerWidth, window.innerHeight);
  }

  // Centro de la D en reposo: es el ancla de la salida del humo
  measureExit() {
    const d = document.querySelector('.d-anchor') || document.querySelector('.zoom-effect');
    if (!d) return;
    const r = d.getBoundingClientRect();
    this.exitPos.x = r.left + r.width / 2;
    this.exitPos.y = r.top + r.height / 2;
  }

  startLoop() {
    if (this.raf || this.reduce || !this.started) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  loop(now) {
    this.raf = 0;
    if (!this.started || !this.visible || document.hidden) return;
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.clock += dt;
    this.flow += dt * (1 + 0.4 * this.exitProgress);
    this.updateFlash(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  }

  // Envolvente del relámpago: pulsos gaussianos cortos más una cola de luz. El
  // resultado se suaviza con constantes distintas de ataque y salida para que la
  // luz suba de golpe y baje despacio (fluida, sin saltos entre frames).
  updateFlash(dt) {
    if (this.clock >= this.nextFlashAt) this.triggerFlash();
    let e = 0;
    for (let i = 0; i < this.pulses.length; i++) {
      const p = this.pulses[i];
      const d = this.clock - p.at;
      if (d < -0.3) continue;
      e = Math.max(e, p.a * Math.exp(-(d * d) / (p.w * p.w)));
      if (d > 0) e = Math.max(e, 0.22 * p.a * Math.exp(-d * 3.2));
    }
    this.flashTarget = Math.min(1, e);
    const rate = this.flashTarget > this.flash ? 26 : 7;
    this.flash += (this.flashTarget - this.flash) * (1 - Math.exp(-dt * rate));
    if (this.pulses.length && this.clock - this.pulses[0].at > 3) this.pulses.length = 0;
  }

  triggerFlash() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    // Origen en la franja superior: el rayo cae desde el cielo
    this.flashPos.x = W * (0.1 + Math.random() * 0.8);
    this.flashPos.y = H * (0.04 + Math.random() * 0.34);
    const at = this.clock + 0.02;
    // Dos pulsos por descarga (siempre): el segundo destello del mismo relámpago
    this.pulses = [
      { at, w: 0.05 + Math.random() * 0.05, a: 0.65 + Math.random() * 0.35 },
      {
        at: at + 0.1 + Math.random() * 0.14,
        w: 0.035 + Math.random() * 0.035,
        a: 0.35 + Math.random() * 0.3,
      },
    ];
    this.nextFlashAt = this.clock + FLASH_MIN_GAP + Math.random() * (FLASH_MAX_GAP - FLASH_MIN_GAP);
  }

  render() {
    const gl = this.gl;
    if (!gl) return;
    gl.useProgram(this.program);
    gl.uniform1f(this.u.time, this.flow);
    gl.uniform1f(this.u.alpha, this.alpha);
    gl.uniform1f(this.u.exit, this.exitProgress);
    gl.uniform2f(this.u.exitPos, this.exitPos.x, this.exitPos.y);
    gl.uniform1f(this.u.flash, this.flash);
    gl.uniform2f(this.u.flashPos, this.flashPos.x, this.flashPos.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
