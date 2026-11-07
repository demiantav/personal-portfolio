import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { NOISE, SMOKE_FIELD, buildProgram, webglContext } from './gl.js';
import { heroFx } from './textAnimate.js';

gsap.registerPlugin(ScrollTrigger);

const REDUCE = '(prefers-reduced-motion: reduce)';
const COMPACT = 970;
const STATIC_HEIGHT = 700;
const PIN_VH = 0.74;

// El campo NOISE/SMOKE_FIELD viene del Hero (con una octava menos para esta
// cortina). La superficie negra es opaca y solo se abre por una silueta de
// humo que avanza a la izquierda y deforma todo el lateral.
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
${NOISE}
${SMOKE_FIELD}

// El campo del hero incluye una deriva vertical común. Se cancela para mantener
// anclado el cuerpo principal; el movimiento visible viene de remolinos locales.
vec2 anchoredFieldPoint(vec2 point, float t) {
  point.y -= t * (1.6 / 2.2) * u_view.y;
  return point;
}

// Tres octavas del mismo ruido, más baratas que el fbm de 5. La cortina dura
// pocos segundos de scroll: alcanza para conservar la silueta del hero.
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

// Mismo campo que el hero, con una octava menos. Suficiente para las masas
// grandes; el detalle vive en los filamentos anclados al borde.
float stormField(vec2 vp, float t) {
  vec2 p = toNoise(vp);
  p.y += t * 1.6;
  vec2 q = vec2(fbm3(p), fbm3(p + vec2(5.2, 1.3)));
  return fbm3(p + 2.2 * q + vec2(1.7, 9.2) + 0.3 * t);
}

// Silueta del borde: tres escalas a lo largo de la altura. La grande hace los
// lóbulos que deforman todo el lateral; las otras rompen el contorno.
float edgeWave(float yn, float t) {
  float a = noise(vec2(yn * 1.55 + 1.7, t * 0.11 + 3.1));
  float b = noise(vec2(yn * 4.40 - 4.3, t * 0.23 + 7.7));
  float c = noise(vec2(yn * 10.0 + 8.9, t * 0.37 + 1.9));
  return (a - 0.5) * 0.64 + (b - 0.5) * 0.26 + (c - 0.5) * 0.10;
}

// Segunda escala lenta para abrir bahías amplias, no sólo una onda regular.
float edgeCarve(float yn, float t) {
  float a = noise(vec2(yn * 1.32 - 2.1, t * 0.07 + 5.3));
  float b = noise(vec2(yn * 3.10 + 6.7, t * 0.13 + 8.1));
  return (a - 0.5) * 0.70 + (b - 0.5) * 0.30;
}

// Humo anclado al frente: se evalúa en coordenadas relativas al borde, así la
// textura viaja con la cortina en vez de quedar fija a la pantalla.
float edgeFilaments(vec2 p, float t) {
  vec2 warp = vec2(
    noise(p * 0.63 + vec2(1.7, -t * 0.22)) - 0.5,
    noise(p * 0.81 + vec2(5.3, t * 0.18)) - 0.5
  );
  return fbm3(p + warp * 1.45 + vec2(2.6, 4.1));
}

void main() {
  vec2 vp = vec2(gl_FragCoord.x / u_res.x, 1.0 - gl_FragCoord.y / u_res.y) * u_view;
  float h = max(u_view.y, 1.0);
  float yn = vp.y / h;
  float t = u_motion * 0.55;

  // El frente arranca fuera de cuadro a la derecha y termina fuera a la
  // izquierda. La silueta se suma después, así el lateral entero se deforma
  // en vez de moverse como un bloque.
  float start = u_view.x + h * 0.75;
  float finish = -h * 0.60;
  float front = mix(start, finish, clamp(u_reveal, 0.0, 1.0));

  float shape = edgeWave(yn, t) * h * 0.80
              + edgeCarve(yn, t) * h * 0.20;

  vec2 delta = vp - u_pointer;
  float pointerField = exp(-dot(delta, delta) / max(h * h * 0.075, 1.0)) * u_pointerActive;
  float pointerNearFront = exp(-pow((u_pointer.x - front) / (h * 0.35), 2.0));
  float pointerPush = clamp((u_pointer.x - front) / h, -0.22, 0.22)
                    * pointerField * pointerNearFront * h * 0.55;

  float deformedFront = front + shape + pointerPush;
  // Filo fino: evita que el borde sea un corte perfectamente limpio.
  deformedFront += (noise(vec2(yn * 37.0, t * 1.6)) - 0.5) * h * 0.006;

  float signedEdge = (vp.x - deformedFront) / h;
  // 1 = negro (izquierda), 0 = coral (derecha). Alpha 1 en todo el lado negro:
  // acá no hay "gaps", la sala de atrás nunca se transparenta.
  float cover = 1.0 - smoothstep(-0.0035, 0.0025, signedEdge);

  // Masa de ceniza sobre el negro: campo grande para las volutas y filamentos
  // finos pegados al filo. La ceniza nunca perfora el negro.
  float edgeEnvelope = exp(-pow(signedEdge / 0.30, 2.0));
  vec2 curl = vec2(
    noise(vp * 0.0022 + vec2(1.7, t * 0.40)) - 0.5,
    noise(vp * 0.0027 + vec2(5.3, -t * 0.31)) - 0.5
  );
  vec2 samplePoint = anchoredFieldPoint(vp + curl * edgeEnvelope * h * 0.12, t);
  float density = stormField(samplePoint, t);
  float body = smoothstep(0.36, 0.62, density);

  // Filamentos anclados al filo: la textura viaja con la cortina, no con la
  // pantalla. El muestreo es anisótropo (mucho más fino en y) para que el humo
  // se lea como jirones arrastrados en horizontal, no como manchas redondas.
  vec2 pEdge = vec2(signedEdge * 3.4, yn * 13.5 + t * 0.40 + max(signedEdge, 0.0) * 2.6);
  float filA = edgeFilaments(pEdge, t);
  float filB = fbm3(pEdge * vec2(2.10, 1.90) + vec2(-4.3, 7.7 - t * 0.12));
  float vein = filA * 0.55 + filB * 0.45;
  float strands = smoothstep(0.535, 0.585, vein);
  // clumps abre huecos anchos entre volutas: rompe el degradé continuo.
  float clumps = smoothstep(0.36, 0.60, filA);

  // Ceniza del lado negro: oscura en el cuerpo, encendida junto al filo.
  float sootMask = exp(-max(-signedEdge, 0.0) * 3.4)
                 * exp(-max(signedEdge, 0.0) * 16.0);
  float sootTone = clamp(body * 0.62 + strands * 0.50, 0.0, 1.0);
  vec3 soot = mix(vec3(0.014, 0.0015, 0.003), vec3(0.33, 0.028, 0.048), sootTone);
  vec3 ember = vec3(0.88, 0.12, 0.14);
  float rim = exp(-abs(signedEdge) * 30.0) * (0.20 + sootTone * 0.90);
  vec3 coveredCol = soot * sootMask + ember * rim * 0.48;

  // Lado coral: el humo nace en el filo y se corta en ~8% de la altura. La
  // máscara de volutas deja claros de coral en vez de una franja uniforme.
  float reach = exp(-max(signedEdge, 0.0) * 14.0);
  float smokeA = strands * (0.28 + clumps * 0.72) * reach;
  smokeA *= smoothstep(-0.004, 0.014, signedEdge);
  smokeA = clamp(smokeA, 0.0, 0.84);
  // La cola se funde antes del clear en reveal 1: no hay pop al salir.
  smokeA *= 1.0 - smoothstep(0.86, 0.985, u_reveal);

  vec3 smokeCol = mix(vec3(0.024, 0.002, 0.004), vec3(0.55, 0.042, 0.062), sootTone * 0.85);
  smokeCol = mix(smokeCol, ember, rim * 0.60);

  float alpha = cover + smokeA * (1.0 - cover);
  vec3 color = mix(smokeCol, coveredCol, cover);
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

class SkillsSmoke {
  constructor(canvas) {
    this.canvas = canvas;
    this.compact = window.matchMedia('(max-width: 48rem)');
    this.reveal = 0;
    this.flow = heroFx?.flow ?? 0;
    this.motionTime = 0;
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
