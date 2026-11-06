import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { NOISE, SMOKE_FIELD, buildProgram, webglContext } from './gl.js';
import { heroFx } from './textAnimate.js';

gsap.registerPlugin(ScrollTrigger);

const REDUCE = '(prefers-reduced-motion: reduce)';
const COMPACT = 970;
const STATIC_HEIGHT = 700;
const PIN_VH = 0.74;

// El campo NOISE/SMOKE_FIELD es el mismo del Hero. El shader compone la
// superficie negra y la disuelve con humo en el borde que avanza a la izquierda.
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

// fieldAt/macroAt incluyen una deriva vertical común. Se cancela para mantener
// anclado el cuerpo principal; el movimiento visible viene de remolinos locales.
vec2 anchoredFieldPoint(vec2 point, float t) {
  point.y -= t * (1.6 / 2.2) * u_view.y;
  return point;
}

// Campo de flujo divergencia-cero: el gradiente de ruido gira 90 grados para
// producir corrientes suaves que se enrollan en vez de trasladar toda la nube.
vec2 curlFlow(vec2 p) {
  float e = 0.075;
  vec2 gradient = vec2(
    noise(p + vec2(e, 0.0)) - noise(p - vec2(e, 0.0)),
    noise(p + vec2(0.0, e)) - noise(p - vec2(0.0, e))
  );
  float magnitude = length(gradient);
  float strength = smoothstep(0.015, 0.19, magnitude);
  return vec2(gradient.y, -gradient.x) / max(magnitude, 0.0001) * strength;
}

// Tres escalas con ritmos y direcciones distintas: billows amplios, pliegues
// intermedios y filamentos rápidos. Ninguna capa traslada el humo como bloque.
vec2 smokeFlowAt(vec2 point, float time) {
  vec2 p = toNoise(point);
  vec2 broad = curlFlow(p * vec2(0.34, 0.64) + vec2(time * 0.34, -time * 0.19) + vec2(2.7, 5.1));
  vec2 middle = curlFlow(p * vec2(0.52, 1.18) + vec2(-time * 0.76, time * 0.43) + vec2(4.9, 8.3));
  vec2 detail = curlFlow(p * vec2(0.72, 2.05) + vec2(time * 1.24, time * 0.81) + vec2(7.4, 1.8));
  return broad * (u_view.y * 0.1)
       + middle * (u_view.y * 0.035)
       + detail * (u_view.y * 0.015);
}

// La densidad anisotrópica estira los trazos en horizontal. Cada capa se
// advecta a otro ritmo para que los filamentos se abran y se crucen distinto.
float stretchedFilaments(vec2 point, float time) {
  vec2 p = toNoise(point);
  float warpX = noise(p * vec2(0.24, 0.72) + vec2(-time * 0.22, time * 0.11) + vec2(3.1, 6.8));
  float warpY = noise(p * vec2(0.43, 1.34) + vec2(time * 0.39, -time * 0.27) + vec2(8.1, 2.7));
  vec2 warped = p + vec2((warpX - 0.5) * 0.42, (warpY - 0.5) * 0.14);
  float broad = noise(warped * vec2(0.36, 2.15) + vec2(-time * 0.31, time * 0.17) + vec2(4.2, 1.7));
  float fine = noise(warped * vec2(0.62, 4.35) + vec2(time * 0.92, -time * 0.58) + vec2(7.6, 5.3));
  return clamp(broad * 0.62 + fine * 0.38, 0.0, 1.0);
}

void main() {
  vec2 vp = vec2(gl_FragCoord.x / u_res.x, 1.0 - gl_FragCoord.y / u_res.y) * u_view;
  float t = sin(u_time * 0.23) * 0.72 + sin(u_time * 0.097 + 1.4) * 0.28;

  // La cortina empieza con margen suficiente fuera del viewport para que ni
  // sus irregularidades ni la nube filtren píxeles antes de que arranque el
  // scroll. El humo ya se calcula y fluye detrás de esta superficie opaca.
  float start = u_view.x + u_view.y * 0.4;
  float finish = -u_view.y * 0.5;
  float front = mix(start, finish, clamp(u_reveal, 0.0, 1.0));

  vec2 delta = vp - u_pointer;
  float radius = u_view.y * 0.3;
  float influence = exp(-dot(delta, delta) / max(radius * radius, 1.0)) * u_pointerActive;
  vec2 curl = vec2(-delta.y, delta.x) / max(length(delta), 1.0);
  vec2 pointerWarp = curl * influence * u_view.y * 0.11;

  vec2 edgePoint = anchoredFieldPoint(vec2(front, vp.y), t);
  float edgeDistance = (vp.x - front) / max(u_view.y * 0.38, 1.0);
  float edgeEnvelope = exp(-edgeDistance * edgeDistance);
  vec2 edgeFlow = smokeFlowAt(edgePoint, u_motion);
  vec2 localFlow = edgeFlow * edgeEnvelope;
  vec2 samplePoint = anchoredFieldPoint(vp + pointerWarp, t) + localFlow;

  float density = fieldAt(samplePoint, t);
  float macro = macroAt(samplePoint, t);
  float body = bodyAt(density);

  // La silueta se evalúa a lo largo de todo el costado: masas grandes del
  // campo compartido empujan el frente hacia el coral y lo retraen en otras
  // zonas. El detalle local rompe los lóbulos sin volverlos geométricos.
  float edgeMacro = macroAt(edgePoint + edgeFlow, t);
  float plume = (edgeMacro - 0.5) * 1.04 + (macro - 0.5) * 0.72;
  float pointerPull = exp(-abs(u_pointer.x - front) / max(u_view.y * 0.4, 1.0))
                    * exp(-abs(u_pointer.y - vp.y) / max(u_view.y * 0.5, 1.0))
                    * u_pointerActive;
  float deformedFront = front + plume * u_view.y * 0.22
                      + (u_pointer.x - front) * pointerPull * 0.32;

  // La nube vive en un plano más ancho que el viewport. Su centro sigue al
  // frente desde fuera de la derecha, así el scroll la trae físicamente a cuadro.
  float plumeCenter = deformedFront + u_view.y * 0.24;
  float plumeX = (vp.x - plumeCenter) / max(u_view.y * 0.34, 1.0);
  float plumeEnvelope = exp(-plumeX * plumeX);
  vec2 plumePoint = vec2(vp.x - plumeCenter + u_view.x * 0.5, vp.y);
  vec2 plumeSample = anchoredFieldPoint(plumePoint + pointerWarp, t) + edgeFlow;
  float filamentField = stretchedFilaments(plumeSample, u_motion);
  float filaments = smoothstep(0.45, 0.68, filamentField);

  float signedFront = (vp.x - deformedFront) / max(u_view.y, 1.0);
  float edgeNoise = (density - 0.52) * 0.12 + (macro - 0.5) * 0.08;
  float contour = signedFront + edgeNoise;
  float edgeBand = exp(-abs(contour) * 3.8);
  float exposedSide = smoothstep(-0.07, 0.14, contour);
  float coveredSide = 1.0 - exposedSide;
  float smokeReach = exp(-max(contour, 0.0) * 1.25)
                   * exp(-max(-contour, 0.0) * 2.1);
  float cover = 1.0 - smoothstep(-0.035, 0.052, contour);
  float gaps = smoothstep(0.48, 0.77, density) * edgeBand * 0.82 * coveredSide;
  float darkAlpha = cover * (1.0 - gaps);
  float smokeBody = (body * 0.3 + filaments * 0.78) * smokeReach * plumeEnvelope * exposedSide;
  float smokeAlpha = smokeBody * 0.82;
  float alpha = max(darkAlpha, smokeAlpha);

  vec3 ink = vec3(0.0);
  float smokeTone = clamp(body * 0.32 + filaments * 0.92, 0.0, 1.0);
  vec3 soot = mix(vec3(0.09, 0.009, 0.018), vec3(0.56, 0.04, 0.085), smokeTone);
  float rim = clamp((smokeReach * (0.18 + smokeTone * 0.78) + edgeBand * gaps * 0.25) * plumeEnvelope * exposedSide, 0.0, 0.92);
  vec3 color = mix(ink, soot, rim);
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
    const scale = this.compact.matches ? 0.32 : 0.48;
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
