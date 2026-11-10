import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { NOISE, buildProgram, webglContext } from './gl.js';
import { heroFx } from './textAnimate.js';

gsap.registerPlugin(ScrollTrigger);

const REDUCE = '(prefers-reduced-motion: reduce)';
const COMPACT = 970;
const STATIC_HEIGHT = 700;
const PIN_VH = 0.74;

// Humo de frente: el negro del intro retrocede en bloque con el título y sólo
// la franja de disolución tiene humo. La masa es un campo de densidad 2D en tres
// capas (masa, crestas y hebras) que se erosiona contra un umbral que barre la
// pantalla de derecha a izquierda. Lejos del frente no hay humo: o negro sólido
// o sala limpia.
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_res;
uniform vec2 u_view;
uniform vec2 u_pointer;
uniform float u_time;
uniform float u_motion;
uniform float u_reveal;
uniform float u_pointerActive;
uniform float u_seed;
${NOISE}

// Tres octavas suaves para el warp y los pliegues del umbral.
float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = m * p + vec2(11.7, 7.3);
    a *= 0.5;
  }
  return v;
}

// fBm de rugosidad alta: las octavas altas conservan peso, así el campo tiene
// hebras finas y no sólo manchas. Devuelve ~0..1 centrado en 0.5.
float fbmRough(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  float norm = 0.0;
  mat2 m = mat2(1.62, 1.18, -1.18, 1.62);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    norm += a;
    p = m * p + vec2(7.3, 3.1);
    a *= 0.68;
  }
  return v / norm;
}

// Vórtices en coordenadas de pantalla normalizadas por la altura. Giran despacio,
// en sentidos alternos, y sus centros derivan: el humo se enrosca sin
// trasladarse en bloque.
vec2 vortexWarp(vec2 p, float t, float seed, vec2 pointerP, float pointerActive, float ax) {
  vec2 c1 = vec2(
    ax * (0.20 + 0.16 * sin(t * 0.72 + seed * 0.11)),
    0.30 + 0.18 * sin(t * 0.58 + seed * 0.07 + 1.7)
  );
  vec2 d1 = p - c1;
  float w1 = exp(-dot(d1, d1) / 0.120);
  w1 *= 0.52 + 0.20 * sin(t * 0.92 + seed * 0.05);
  p += vec2(-d1.y, d1.x) * w1;

  vec2 c2 = vec2(
    ax * (0.62 + 0.20 * cos(t * 0.63 + seed * 0.09 + 2.4)),
    0.64 + 0.16 * cos(t * 0.48 + seed * 0.06 + 0.8)
  );
  vec2 d2 = p - c2;
  float w2 = exp(-dot(d2, d2) / 0.095);
  w2 *= 0.40 + 0.16 * cos(t * 0.82 + seed * 0.04 + 1.1);
  p += vec2(d2.y, -d2.x) * w2;

  // Tercer remolino chico y veloz: engancha los jirones cerca de la disolución.
  vec2 c3 = vec2(
    ax * (0.40 + 0.24 * sin(t * 1.10 + seed * 0.13 + 4.1)),
    0.46 + 0.26 * cos(t * 1.02 + seed * 0.10 + 0.6)
  );
  vec2 d3 = p - c3;
  float w3 = exp(-dot(d3, d3) / 0.050);
  w3 *= 0.24 + 0.10 * sin(t * 1.30 + seed * 0.08);
  p += vec2(-d3.y, d3.x) * w3;

  // El pointer abre un remolino local; no desplaza el humo en bloque.
  vec2 dp = p - pointerP;
  float wp = exp(-dot(dp, dp) / 0.070) * pointerActive;
  p += vec2(-dp.y, dp.x) * wp * 0.42;

  return p;
}

void main() {
  vec2 vp = vec2(gl_FragCoord.x / u_res.x, 1.0 - gl_FragCoord.y / u_res.y) * u_view;
  float h = max(u_view.y, 1.0);
  float yn = clamp(vp.y / h, 0.0, 1.0);
  float ax = max(u_view.x / h, 0.001);
  float xnorm = clamp(vp.x / max(u_view.x, 1.0), 0.0, 1.0);
  // Movimiento lento: el humo se enrosca, no corre.
  float t = u_motion * 0.18;
  float seed = u_seed;
  float s = clamp(u_reveal, 0.0, 1.0);

  vec2 p = vec2(vp.x / h, yn);

  // --- Frente de revelado --------------------------------------------------
  // El negro del intro acompaña al título (que sale hacia la izquierda). La
  // franja de humo vive sólo en ese borde; detrás queda negro sólido y delante,
  // sala limpia. El frente arranca fuera de pantalla y acelera al final para
  // dejar la sala completamente descubierta.
  float front = 1.24 - 1.34 * s - 0.48 * smoothstep(0.72, 0.99, s);
  float wob = fbmRough(vec2(yn * 2.35 + seed * 0.11, t * 0.06 + 2.3)) - 0.5;
  float wob2 = fbmRough(vec2(yn * 7.2 - seed * 0.07, t * 0.09 + 7.1)) - 0.5;
  float wobT = 1.0 - smoothstep(0.82, 0.96, s);
  float frontShape = front + (wob * 0.10 + wob2 * 0.032) * wobT;

  // Advección + vórtices: circulación lenta que enrosca la franja, sin
  // trasladarla en bloque.
  vec2 flow = vec2(p.x - t * 0.045, yn - t * 0.014);
  vec2 pointerP = vec2(u_pointer.x / h, u_pointer.y / h);
  flow = vortexWarp(flow, t, seed, pointerP, u_pointerActive, ax);

  // Doble warp de dominio: el grueso orienta las volutas y el fino las
  // deshilacha con una escala que no comparten.
  vec2 q = vec2(
    fbm3(flow * vec2(0.72, 1.15) + vec2(seed + 1.7, t * 0.11 + 3.1)),
    fbm3(flow * vec2(0.82, 1.02) + vec2(seed + 5.2, -t * 0.09 + 1.3))
  );
  vec2 r = flow + (q - 0.44) * 1.55;
  r += (vec2(
    noise(r * vec2(2.7, 3.6) + vec2(seed + 8.3, t * 0.16 + 2.8)),
    noise(r * vec2(3.1, 3.0) + vec2(seed + 1.7, -t * 0.13 + 9.2))
  ) - 0.46) * 0.55;

  // --- Campo de densidad ---------------------------------------------------
  // Tres escalas: masa, crestas ridged y hebras finas. Al cruzar el umbral, las
  // crestas y hebras son las que convierten el borde en humo y no en un filo.
  float base = fbmRough(r * vec2(1.85, 2.80) + vec2(seed + 3.4, t * 0.04 + 1.1));
  float ridgeN = 1.0 - abs(2.0 * fbmRough(r * vec2(5.60, 9.20) + vec2(seed + 7.1, t * 0.09 + 4.6)) - 1.0);
  ridgeN *= ridgeN;
  float threadN = 1.0 - abs(2.0 * fbmRough(r * vec2(15.0, 31.0) + vec2(seed + 2.0 - t * 0.16, 5.6 - t * 0.25)) - 1.0);
  float thread = threadN * threadN;
  float grit = noise(r * vec2(13.0, 27.0) + vec2(seed + 3.0, -t * 0.30));

  float F = base * 0.58 + ridgeN * 0.28 + thread * 0.14;
  F += (grit - 0.50) * 0.045;
  F = clamp(F, 0.0, 1.0);

  // --- Umbral de disolución ------------------------------------------------
  // En vez de un umbral global, barre sólo una franja alrededor del frente: a la
  // izquierda el umbral es tan bajo que todo es negro; a la derecha, tan alto
  // que todo es sala. El cruce lo decide el campo fractal.
  float xf = (xnorm - frontShape) / 0.22;
  float k = smoothstep(-1.15, 1.15, xf);
  float lag = fbm3(p * vec2(1.90, 2.30) + vec2(seed + 2.7, t * 0.05 + 4.3)) - 0.44;
  float th = mix(-0.24, 1.16, k);
  th += lag * 0.18 * smoothstep(0.02, 0.10, s);
  th += (fbm3(p * vec2(5.0, 7.0) + vec2(seed + 14.0, -t * 0.08 + 2.0)) - 0.44)
      * 0.05 * smoothstep(0.02, 0.10, s);

  // Feather chico: el campo ya es irregular; el borde no debe ser un filo duro.
  float soft = mix(0.012, 0.030, smoothstep(0.20, 0.80, base));
  float presence = smoothstep(th - soft, th + soft, F);

  // Cuánto adentro de la masa está este píxel: gobierna opacidad y color.
  float core = smoothstep(th + soft, th + 0.20, F);

  // Densidad: el núcleo es opaco y la translucidez vive sólo en la franja.
  float body = 0.20 + 1.30 * core;
  body *= 0.90 + 0.20 * ridgeN;
  body += 0.38 * thread * core;
  float dens = presence * body;
  dens *= 1.0 - smoothstep(0.95, 1.0, s);
  float alpha = 1.0 - exp(-max(dens, 0.0) * 1.05);

  // El interior lejos del frente es negro plano, opaco. Nada de humo ahí.
  float deep = smoothstep(0.60, 0.94, core);
  alpha = mix(alpha, 1.0, deep);

  // Color: cuerpo casi negro; el ámbar entra sólo por el borde y las hebras.
  float lightPatch = smoothstep(0.30, 0.75,
    noise(vec2(r.x * 0.55 + seed + 3.4, r.y * 1.60 - t * 0.05 + 8.2)) * 0.70
    + noise(vec2(r.x * 0.90 + 3.1, r.y * 2.40 + 2.7 + t * 0.04)) * 0.30
  );
  float colorGate = smoothstep(0.010, 0.080, s);
  float rim = 1.0 - core;
  vec3 blackCol = vec3(0.0045, 0.0007, 0.0012);
  vec3 deepCol = vec3(0.022, 0.0018, 0.0032);
  vec3 oxblood = vec3(0.200, 0.0140, 0.0190);
  vec3 ember = vec3(1.000, 0.260, 0.090);
  vec3 smokeCol = mix(deepCol, oxblood, clamp(core * 0.90 + ridgeN * 0.22, 0.0, 1.0));
  // El interior profundo se apaga hacia negro: da contraste contra el borde.
  smokeCol = mix(smokeCol, ember, rim * (0.18 + 0.78 * lightPatch));
  smokeCol = mix(smokeCol, ember, ridgeN * thread * rim * 0.40 * lightPatch);
  smokeCol = mix(smokeCol, blackCol, deep * 0.98);
  vec3 col = mix(blackCol, smokeCol, colorGate);

  // Jirones rezagados: hilos ámbar en el filo, del lado de la sala. Se apagan
  // lejos del frente para que el resto de la pantalla quede limpio.
  float outside = (1.0 - presence) * smoothstep(th - 0.22, th - 0.01, F);
  float wisp = thread * outside * (0.55 + 0.45 * lightPatch);
  float wispA = wisp * (0.22 + 0.55 * lightPatch);
  wispA *= colorGate * (1.0 - smoothstep(0.82, 0.98, s));
  wispA = clamp(wispA, 0.0, 0.34);
  vec3 wispCol = mix(vec3(0.55, 0.070, 0.030), vec3(1.00, 0.36, 0.12), lightPatch);
  col = mix(col, wispCol, wispA);
  alpha = max(alpha, wispA * 0.70);

  alpha = clamp(alpha, 0.0, 1.0);
  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

class SkillsSmoke {
  constructor(canvas) {
    this.canvas = canvas;
    this.compact = window.matchMedia('(max-width: 48rem)');
    this.reveal = 0;
    this.flow = heroFx?.flow ?? 0;
    this.motionTime = 0;
    this.seed = Math.random() * 64;
    this.pointer = { x: -10000, y: -10000, active: 0 };
    this.pointerTarget = { x: -10000, y: -10000, active: 0 };
    this.visible = false;
    this.started = false;
    this.lost = false;
    this.raf = 0;
    this.last = 0;
    this.loop = this.loop.bind(this);

    this.ready = this.setup();
    if (this.ready) this.observe();
  }

  setup() {
    const gl = webglContext(this.canvas);
    if (!gl) return false;
    const program = buildProgram(gl, FRAG);
    if (!program) return false;

    this.gl = gl;
    this.program = program;
    gl.clearColor(0, 0, 0, 0);
    this.u = {
      res: gl.getUniformLocation(program, 'u_res'),
      view: gl.getUniformLocation(program, 'u_view'),
      pointer: gl.getUniformLocation(program, 'u_pointer'),
      pointerActive: gl.getUniformLocation(program, 'u_pointerActive'),
      time: gl.getUniformLocation(program, 'u_time'),
      motion: gl.getUniformLocation(program, 'u_motion'),
      reveal: gl.getUniformLocation(program, 'u_reveal'),
      seed: gl.getUniformLocation(program, 'u_seed'),
    };
    this.resize();
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.lost = true;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.canvas.classList.remove('is-active');
    });
    return true;
  }

  observe() {
    if (!('IntersectionObserver' in window)) {
      this.visible = true;
      return;
    }
    new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) {
        if (this.started) this.startLoop();
        else this.start();
      }
    }, { rootMargin: '100% 0px' }).observe(this.canvas);
  }

  start() {
    if (this.started) return;
    this.started = true;
    if (!window.matchMedia(REDUCE).matches) this.startLoop();
    else this.render();
  }

  resize() {
    if (!this.gl) return;
    const scale = this.compact.matches ? 0.72 : 0.82;
    const width = Math.max(1, Math.round(this.canvas.clientWidth * scale));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * scale));
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    this.gl.uniform2f(this.u.res, width, height);
    this.gl.uniform2f(this.u.view, this.canvas.clientWidth, this.canvas.clientHeight);
    this.render();
  }

  setPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerTarget.x = event.clientX - rect.left;
    this.pointerTarget.y = event.clientY - rect.top;
    this.pointerTarget.active = 1;
  }

  clearPointer() {
    this.pointerTarget.active = 0;
  }

  startLoop() {
    if (
      !this.raf && this.started && this.visible && !document.hidden
      && (this.canvas.classList.contains('is-active') || this.reveal < 0.999)
    ) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  loop(now) {
    this.raf = 0;
    if (
      !this.started || !this.visible || document.hidden
      || (!this.canvas.classList.contains('is-active') && this.reveal >= 0.999)
    ) return;
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.flow += dt;
    this.motionTime += dt;
    const ease = 1 - Math.exp(-dt * 7);
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * ease;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * ease;
    this.pointer.active += (this.pointerTarget.active - this.pointer.active) * ease;
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  }

  render() {
    const gl = this.gl;
    if (!gl) return;
    if (this.reveal >= 0.999) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    gl.useProgram(this.program);
    gl.uniform1f(this.u.time, this.flow);
    gl.uniform1f(this.u.motion, this.motionTime);
    gl.uniform1f(this.u.reveal, this.reveal);
    gl.uniform1f(this.u.seed, this.seed);
    gl.uniform1f(this.u.pointerActive, this.pointer.active);
    gl.uniform2f(this.u.pointer, this.pointer.x, this.pointer.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

const initAccordion = (room, reduceMotion) => {
  const categories = [...room.querySelectorAll('.skills-category')];
  const frontend = categories.find((item) => item.classList.contains('skills-category--frontend'));
  if (frontend) frontend.open = true;
  room.dataset.active = 'frontend';

  let refreshFrame = 0;
  categories.forEach((category) => {
    category.addEventListener('toggle', () => {
      if (category.open) {
        categories.forEach((sibling) => {
          if (sibling !== category) sibling.open = false;
        });
        const name = category.querySelector('.skill-category__name')?.textContent.trim().toLowerCase();
        if (name) room.dataset.active = name;
        const lines = category.querySelectorAll('.skill-list li');
        if (!reduceMotion && lines.length) {
          gsap.fromTo(lines, { x: 18, autoAlpha: 0 }, {
            x: 0,
            autoAlpha: 1,
            duration: 0.32,
            stagger: 0.018,
            ease: 'power2.out',
            overwrite: true,
            delay: 0.04,
          });
        }
      }

      const active = categories.find((item) => item.open);
      room.dataset.active = active?.querySelector('.skill-category__name')
        ?.textContent.trim().toLowerCase() ?? '';
      if (!reduceMotion) {
        gsap.to(categories, {
          z: (_index, item) => (active ? (item === active ? 24 : -80) : 0),
          scale: (_index, item) => (active && item !== active ? 0.97 : 1),
          rotationY: (_index, item) => (active && item !== active ? 1 : 0),
          autoAlpha: (_index, item) => (active && item !== active ? 0.86 : 1),
          filter: (_index, item) => (active && item !== active ? 'blur(0.5px)' : 'blur(0px)'),
          duration: 0.38,
          ease: 'power3.out',
          overwrite: true,
        });
      }
      cancelAnimationFrame(refreshFrame);
      refreshFrame = requestAnimationFrame(() => {
        ScrollTrigger.getAll().forEach((trigger) => trigger.refresh());
      });
    });
  });
};

export const skillsSmokeReveal = () => {
  const skills = document.querySelector('.main__skills-section');
  const room = skills?.querySelector(':scope > .skills-room');
  const canvas = skills?.querySelector(':scope > .skills-smoke');
  const intro = skills?.querySelector(':scope > .skills-intro');
  if (!skills || !room || !canvas || !intro) return null;

  const reduceMotion = window.matchMedia(REDUCE).matches;
  const compact = window.innerWidth < COMPACT || window.innerHeight < STATIC_HEIGHT;
  const categories = [...room.querySelectorAll('.skills-category')];

  initAccordion(room, reduceMotion);
  if (reduceMotion) return null;

  const smoke = new SkillsSmoke(canvas);
  if (!smoke.ready) return null;
  skills.classList.add('skills-scroll-ready');
  room.inert = true;
  smoke.render();
  canvas.addEventListener('webglcontextlost', () => {
    intro.classList.remove('is-active');
    skills.classList.remove('skills-scroll-ready');
    skills.classList.remove('skills-smoke-active');
    room.inert = false;
  }, { once: true });
  smoke.start();

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer && !compact) {
    skills.addEventListener('pointermove', (event) => smoke.setPointer(event), { passive: true });
    skills.addEventListener('pointerleave', () => smoke.clearPointer());
  }
  window.addEventListener('resize', () => smoke.resize());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) smoke.startLoop();
  });

  const pinned = !compact;
  const syncRoomInert = () => {
    room.inert = skills.classList.contains('skills-scroll-ready') && smoke.reveal < 0.94;
  };
  const timeline = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: syncRoomInert,
    scrollTrigger: {
      trigger: skills,
      start: pinned ? 'top top' : 'top 88%',
      end: pinned
        ? () => '+=' + Math.round(window.innerHeight * PIN_VH)
        : 'top 34%',
      pin: pinned ? skills : false,
      pinSpacing: true,
      anticipatePin: 1,
      scrub: 0.22,
      invalidateOnRefresh: true,
      onToggle: (self) => {
        if (smoke.lost) {
          canvas.classList.remove('is-active');
          intro.classList.remove('is-active');
          skills.classList.remove('skills-scroll-ready');
          skills.classList.remove('skills-smoke-active');
          room.inert = false;
          return;
        }
        canvas.classList.toggle('is-active', self.isActive);
        intro.classList.toggle('is-active', self.isActive);
        skills.classList.toggle('skills-smoke-active', self.isActive);
        syncRoomInert();
        if (self.isActive) smoke.startLoop();
      },
      onRefresh: () => smoke.resize(),
      onLeave: () => {
        smoke.reveal = 1;
        canvas.classList.remove('is-active');
        intro.classList.remove('is-active');
        skills.classList.remove('skills-smoke-active');
        syncRoomInert();
        smoke.render();
      },
      onLeaveBack: () => {
        smoke.reveal = 0;
        canvas.classList.remove('is-active');
        intro.classList.remove('is-active');
        skills.classList.remove('skills-smoke-active');
        syncRoomInert();
        smoke.render();
      },
    },
  });

  timeline
    .to(smoke, { reveal: 1, duration: 1 }, 0)
    .fromTo(intro, { xPercent: 0 }, {
      xPercent: -100,
      duration: 1,
      ease: 'none',
    }, 0);

  ScrollTrigger.create({
    trigger: skills,
    start: 'top 88%',
    end: () => timeline.scrollTrigger.end + (pinned ? Math.round(window.innerHeight * 0.1) : 0),
    onEnter: () => document.body.classList.add('skills-intro-active'),
    onEnterBack: () => document.body.classList.add('skills-intro-active'),
    onLeave: () => document.body.classList.remove('skills-intro-active'),
    onLeaveBack: () => document.body.classList.remove('skills-intro-active'),
    invalidateOnRefresh: true,
  });

  if (pinned) return timeline.scrollTrigger;
  return null;
};
