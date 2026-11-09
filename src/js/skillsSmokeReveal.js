import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { NOISE, buildProgram, webglContext } from './gl.js';
import { heroFx } from './textAnimate.js';

gsap.registerPlugin(ScrollTrigger);

const REDUCE = '(prefers-reduced-motion: reduce)';
const COMPACT = 970;
const STATIC_HEIGHT = 700;
const PIN_VH = 0.74;

// Humo volumétrico anclado al frente: un contorno de campo con lóbulos macro,
// warp de dominio y vórtices lentos. El núcleo es opaco; las capas densa y de
// velo dejan pasar la luz coral en la franja de transición.
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

// Tres octavas para el warp/los lóbulos y cuatro para el cuerpo: el detalle
// mediano es lo que separa una silueta de una voluta.
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

float fbm4(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = m * p + vec2(11.7, 7.3);
    a *= 0.5;
  }
  return v;
}

// Dos vórtices lentos en coordenadas relativas al frente. Giran en sentidos
// opuestos y su fuerza respira: el humo se enrosca sin trasladarse en bloque.
vec2 vortexWarp(vec2 p, float t, float seed, vec2 pointerP, float pointerActive) {
  vec2 c1 = vec2(
    0.18 + 0.22 * sin(t * 0.37 + seed * 0.11),
    0.34 + 0.18 * sin(t * 0.29 + seed * 0.07 + 1.7)
  );
  vec2 d1 = p - c1;
  float w1 = exp(-dot(d1, d1) / 0.070);
  w1 *= 0.38 + 0.12 * sin(t * 0.51 + seed * 0.05);
  p += vec2(-d1.y, d1.x) * w1;

  vec2 c2 = vec2(
    0.32 + 0.24 * cos(t * 0.31 + seed * 0.09 + 2.4),
    0.67 + 0.16 * cos(t * 0.23 + seed * 0.06 + 0.8)
  );
  vec2 d2 = p - c2;
  float w2 = exp(-dot(d2, d2) / 0.052);
  w2 *= 0.30 + 0.10 * cos(t * 0.43 + seed * 0.04 + 1.1);
  p += vec2(d2.y, -d2.x) * w2;

  // El pointer abre un remolino local; no empuja el contorno.
  vec2 dp = p - pointerP;
  float wp = exp(-dot(dp, dp) / 0.065) * pointerActive;
  p += vec2(-dp.y, dp.x) * wp * 0.34;

  return p;
}

void main() {
  vec2 vp = vec2(gl_FragCoord.x / u_res.x, 1.0 - gl_FragCoord.y / u_res.y) * u_view;
  float h = max(u_view.y, 1.0);
  float yn = clamp(vp.y / h, 0.0, 1.0);
  float t = u_motion * 0.55;
  float seed = u_seed;

  // El frente avanza con el scroll y arranca/termina fuera de cuadro. El humo
  // vive en coordenadas relativas a ese frente, así viaja con la cortina. En
  // portrait el recorrido se ancla al lado corto para que el frente no tarde
  // media timeline en entrar.
  float span = min(h, u_view.x * 1.15);
  float start = u_view.x + span * 0.55;
  float finish = -span * 0.72;
  float frontX = mix(start, finish, clamp(u_reveal, 0.0, 1.0));
  // El humo sólo aparece cuando el frente entra en cuadro: el intro detrás de
  // "Skills" queda negro plano, sin velo ni brasa en la esquina.
  float frontVisible = 1.0 - smoothstep(u_view.x - h * 0.40, u_view.x + h * 0.02, frontX);
  float back = frontX - vp.x;
  float reachPx = span * 0.62;
  float u = back / reachPx;

  vec2 p = vec2(back / h, yn);
  vec2 pointerP = vec2((u_pointer.x - frontX) / h, u_pointer.y / h);
  vec2 pv = vortexWarp(p, t, seed, pointerP, u_pointerActive);

  // Doble warp de dominio: el grande orienta las masas, el de detalle las
  // engancha. La escala x es menor que la y para estirar las volutas.
  vec2 q = vec2(
    fbm3(pv * vec2(0.68, 1.15) + vec2(seed + 1.7, t * 0.10 + 3.1)),
    fbm3(pv * vec2(0.78, 1.02) + vec2(seed + 5.2, -t * 0.08 + 1.3))
  );
  vec2 r = pv + (q - 0.44) * 1.15;
  r += (vec2(
    noise(r * vec2(2.1, 2.7) + vec2(seed + 8.3, t * 0.05 + 2.8)),
    noise(r * vec2(2.4, 2.3) + vec2(seed + 1.7, -t * 0.04 + 9.2))
  ) - 0.44) * 0.42;

  // Variedad por zona: en unas el ruido se estira en horizontal; en otras
  // queda compacto y gira. También cambia el ancho de los lóbulos.
  float aniso = smoothstep(0.28, 0.72,
    noise(vec2(yn * 1.35 + seed * 0.07, t * 0.045 + 6.2)));
  float edgeStretch = mix(0.26, 0.50, aniso);
  float edgeYScale = mix(2.8, 5.6, aniso);
  float shear = (noise(vec2(yn * 2.2 + seed * 0.05, t * 0.03 + 7.3)) - 0.5) * 0.30;

  // El contorno se evalúa con una dependencia de x moderada: el negro nunca se
  // perfora, pero las olas se inclinan, se enganchan y forman lenguas.
  float edgeWarpX = (fbm3(vec2(p.x * 0.52 + seed * 0.10, p.y * 1.70 + t * 0.05 + 4.8)) - 0.44) * 0.95;
  float edgeY = yn * edgeYScale
              + (noise(vec2(yn * 1.90 + seed * 0.03, t * 0.035 + 2.2)) - 0.5) * 0.70;
  float body = fbm4(vec2(p.x * edgeStretch + edgeWarpX + shear * yn, edgeY) + vec2(seed + 2.6, 4.1));
  float bodyC = (body - 0.47) * 2.0;

  // Lóbulos macro: zonas donde el humo apenas avanza y otras donde empuja
  // mucho. Esto es lo que convierte una ondulación pareja en respiración.
  float lobe = fbm3(vec2(yn * 1.25 + seed * 0.07, t * 0.05 + 5.1));
  float reach = 0.14 + 1.02 * smoothstep(0.26, 0.72, lobe);

  float front = clamp(reach * (0.52 + bodyC * 0.68), 0.04, 1.06);
  // Ripples finos sobre el contorno grande: rompen la lectura de "blob".
  float edgeDetail = (noise(vec2(yn * 15.0 + seed * 0.2, t * 0.06)) - 0.5) * 0.055
                   + (noise(vec2(yn * 29.0 - seed * 0.1, t * 0.09 + 1.7)) - 0.5) * 0.022;
  front += edgeDetail;
  float depth = u - front;

  // La transición no es un filo: varía entre zonas definidas y otras
  // completamente difusas. El velo exterior se suma después.
  float featherField = fbm3(vec2(yn * 2.00 + seed * 0.06, t * 0.04 + 5.3));
  float soft = mix(0.016, 0.075, smoothstep(0.22, 0.75, featherField));
  float cover = smoothstep(-soft, soft, depth);

  // La luz entra desde la sala en parches irregulares, no de forma uniforme.
  float lightPatch = smoothstep(0.30, 0.75,
    noise(vec2(r.x * 0.55 + seed + 3.4, r.y * 1.60 - t * 0.03 + 8.2)) * 0.70
    + noise(vec2(r.x * 0.90 + 3.1, r.y * 2.40 + 2.7)) * 0.30
  );

  // Densidad de humo: campo mediano + detalle fino. El umbral respira con la
  // luz, así unas volutas se abren mientras otras se cierran.
  float dens = fbm4(vec2(
    r.x * mix(0.90, 1.75, aniso) + seed + 8.4,
    r.y * mix(4.60, 8.20, aniso) + t * 0.02 + 1.9
  ));
  float detail = noise(vec2(r.x * 8.5 + seed + 4.1, r.y * 16.0 - t * 0.05));
  dens = clamp(dens * 0.76 + detail * 0.24, 0.0, 1.0);
  dens = smoothstep(0.40, 0.58, dens + (lightPatch - 0.5) * 0.12);

  // Claros: huecos irregulares donde la luz de la sala atraviesa el humo. Sin
  // ellos la capa densa se lee como una pared lisa.
  float windows = smoothstep(0.32, 0.54,
    noise(vec2(r.x * 2.60 + seed + 9.1, r.y * 2.30 + 1.2)) * 0.60
    + noise(vec2(r.x * 5.20 + 3.3, r.y * 4.60 + 6.7)) * 0.40
  );

  // Bandas alrededor del contorno: el humo se disuelve hacia el coral y se
  // funde hacia el negro. La capa densa es la que tapa el texto.
  float bandDense = exp(-max(depth, 0.0) / 0.40) * exp(min(depth, 0.0) / 0.24);
  float bandVeil  = exp(-max(depth, 0.0) / 0.62) * exp(min(depth, 0.0) / 0.44);

  float smokeFade = 1.0 - smoothstep(0.86, 0.985, u_reveal);
  float smokeGate = smoothstep(0.0, 0.08, u_reveal);

  float denseA = clamp(dens * bandDense * (0.58 + 0.32 * lightPatch), 0.0, 0.88);
  denseA *= smokeFade * smokeGate;
  denseA *= 0.22 + 0.78 * (1.0 - cover);
  denseA *= 0.34 + 0.66 * windows;
  denseA *= frontVisible;

  float veilField = fbm3(vec2(r.x * 1.30 + seed + 6.1, r.y * 4.60 + 7.7 + t * 0.02));
  float veilMask = smoothstep(0.50, 0.585, veilField);
  float veilA = clamp(veilMask * bandVeil * (0.18 + 0.32 * lightPatch), 0.0, 0.55);
  veilA *= smokeFade * smokeGate;
  veilA *= 0.32 + 0.68 * (1.0 - cover);
  veilA *= frontVisible;

  // Filamentos: crestas finas y anisótropas que se enroscan con los vórtices.
  // Son la capa que convierte el degradé en volutas y jirones.
  vec2 filP = r * vec2(mix(1.30, 2.40, aniso), mix(5.6, 9.8, aniso))
            + vec2(seed + 2.0 + t * 0.03, 4.6 - t * 0.05);
  vec2 filWarp = vec2(
    noise(filP * vec2(0.55, 0.85) + vec2(1.3, t * 0.07)) - 0.5,
    noise(filP * vec2(0.65, 0.75) + vec2(5.7, -t * 0.06)) - 0.5
  );
  float filN = fbm3(filP + filWarp * 0.95);
  float fil = 1.0 - smoothstep(0.0, 0.062, abs(filN - 0.50));
  float filMask = smoothstep(0.26, 0.58, dens * 0.55 + lightPatch * 0.45);
  float filBand = exp(-max(depth, 0.0) / 0.40) * exp(min(depth, 0.0) / 0.36);
  float filA = clamp(fil * filMask * filBand * (0.30 + 0.46 * lightPatch), 0.0, 0.72);
  filA *= smokeFade * smokeGate;
  filA *= 0.30 + 0.70 * (1.0 - cover);
  filA *= frontVisible;

  // Color: cuerpo profundo casi negro, ceniza ámbar junto al frente y en los
  // parches donde entra la luz. El negro del intro queda plano (textureGate).
  vec3 blackCol = vec3(0.006, 0.0008, 0.0015);
  vec3 oxblood = vec3(0.16, 0.011, 0.020);
  float textureGate = smoothstep(0.0, 0.10, u_reveal);
  float nearEdge = exp(-max(depth, 0.0) / 0.20);
  float coreTone = clamp(dens * 0.62 + lightPatch * 0.16, 0.0, 1.0);
  vec3 coreCol = mix(blackCol, oxblood, coreTone * nearEdge * textureGate * (0.35 + 0.65 * dens));

  vec3 denseCol = mix(vec3(0.026, 0.0018, 0.0035), vec3(0.22, 0.022, 0.012), lightPatch);
  vec3 veilCol = mix(vec3(0.20, 0.020, 0.016), vec3(0.66, 0.115, 0.048), lightPatch);
  vec3 filCol = mix(vec3(0.36, 0.035, 0.014), vec3(0.95, 0.24, 0.085), lightPatch);

  // Brillo de brasa: ancho, roto por el ruido y sólo en las crestas.
  float rimNoise = smoothstep(0.28, 0.78, noise(vec2(yn * 6.5 + seed, t * 0.09)))
                 * 0.75 + 0.25;
  float rim = exp(-abs(depth) / 0.075)
            * (0.30 + 0.70 * lightPatch)
            * (0.40 + 0.60 * dens)
            * rimNoise
            * frontVisible;
  vec3 rimCol = vec3(0.95, 0.34, 0.14);

  // Composición en orden de profundidad: núcleo, humo denso, velo, jirones.
  vec3 col = coreCol;
  float alpha = cover;
  col = mix(col, denseCol, denseA);
  alpha = denseA + alpha * (1.0 - denseA);
  col = mix(col, veilCol, veilA);
  alpha = veilA + alpha * (1.0 - veilA);
  col = mix(col, filCol, filA);
  alpha = filA + alpha * (1.0 - filA);

  col += rimCol * rim * 0.26 * smokeFade;
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
