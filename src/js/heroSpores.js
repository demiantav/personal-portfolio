// Esporas del hero: polvo rojo que flota entre el humo y el titular, en dos planos
// de profundidad (lejos: chico, lento y tenue; cerca: más grande y rápido). Es un
// canvas 2D: el humo ya es WebGL y sumar un tercer contexto no aportaba nada.
// Se suman al lenguaje del Upside Down (partículas en suspensión) y dan parallax
// sin tocar el shader. Salen absorbidas hacia la D junto con el humo.
import gsap from 'gsap';

const REDUCE = '(prefers-reduced-motion: reduce)';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, t) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

// Sprite de una espora: núcleo cálido y halo que se apaga. Se dibuja una sola vez
// y se reusa con drawImage (mucho más barato que crear un gradiente por partícula).
const SPRITE_SIZE = 64;
const makeSprite = () => {
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE_SIZE;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const r = SPRITE_SIZE / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255, 198, 198, 0.95)');
  g.addColorStop(0.16, 'rgba(255, 108, 112, 0.6)');
  g.addColorStop(0.45, 'rgba(255, 48, 68, 0.18)');
  g.addColorStop(1, 'rgba(255, 32, 56, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return c;
};

export class HeroSpores {
  constructor() {
    this.host = document.querySelector('.hero-pin');
    if (!this.host) return;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'hero-spores';
    this.canvas.setAttribute('aria-hidden', 'true');
    // Después del humo y antes del titular: el canvas se pinta sobre #webgl y el
    // titular (z-index 1) queda por encima.
    const smoke = document.getElementById('webgl');
    if (smoke && smoke.parentNode === this.host) smoke.after(this.canvas);
    else this.host.prepend(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return;

    this.reduce = window.matchMedia(REDUCE).matches;
    this.compact = window.matchMedia('(max-width: 48rem)');
    this.exitProgress = 0; // lo tweenea hero-zoom-transition.js
    this.started = false;
    this.introStarted = false;
    this.visible = false;
    this.intro = 0;
    this.clock = 0;
    this.last = 0;
    this.raf = 0;
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    this.exitX = 0;
    this.exitY = 0;
    this.sprite = makeSprite();
    this.particles = [];
    this.loop = this.loop.bind(this);

    window.addEventListener('resize', () => {
      this.resize();
      this.measure();
      if (this.started && this.reduce) this.render();
      else this.startLoop();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.startLoop();
    });
    this.observe();
  }

  build() {
    // Menos esporas en mobile: el hero es más chico y el efecto no necesita densidad
    const base = this.compact.matches ? 34 : 62;
    const extra = this.compact.matches ? 8 : 20;
    const n = base + Math.round(Math.random() * extra);
    const particles = [];
    for (let i = 0; i < n; i++) {
      const depth = Math.random(); // 0 = lejos, 1 = cerca
      const x = Math.random();
      const y = Math.random();
      particles.push({
        x,
        y,
        depth, // 0 = lejos, 1 = cerca: tamaño, velocidad y parallax
        size: (2.4 + depth * 5.2 + Math.random() * 2.4) * (this.compact.matches ? 0.8 : 1),
        alpha: 0.1 + depth * 0.2 + Math.random() * 0.12,
        // fracción de la altura por segundo: las de cerca suben más rápido
        speed: 0.005 + depth * 0.02 + Math.random() * 0.008,
        sway: 3 + depth * 11,
        swayFreq: 0.2 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        // parallax con el scroll: las de cerca se desplazan más
        parallax: 0.04 + depth * 0.16,
        // Nacimiento escalonado: las que están más abajo aparecen primero y el
        // resto se reparte al azar. Cada espora funde en ~0.3 de la intro.
        birth: (1 - y) * 0.3 + Math.random() * 0.4,
      });
    }
    return particles;
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.dpr = dpr;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    // Las partículas se guardan normalizadas: sólo cambia el tamaño del canvas
    if (!this.particles.length) this.particles = this.build();
  }

  // Centro de la D en reposo: misma ancla de absorción que el humo
  measure() {
    const cr = this.canvas.getBoundingClientRect();
    const d = document.querySelector('.d-anchor');
    if (d) {
      const r = d.getBoundingClientRect();
      this.exitX = r.left + r.width / 2 - cr.left;
      this.exitY = r.top + r.height / 2 - cr.top;
    } else {
      this.exitX = this.w / 2;
      this.exitY = this.h / 2;
    }
  }

  // Deja las esporas simulando (sin mostrarlas) mientras el preloader todavía
  // tapa el hero. Así el fade revela un campo ya en movimiento.
  prime() {
    if (this.started || !this.ctx) return;
    this.started = true;
    this.resize();
    this.measure();
    if (this.reduce) {
      this.intro = 1;
      this.render();
      return;
    }
    this.startLoop();
  }

  // Entrada: las esporas nacen escalonadas sobre la rampa de `intro` (las de
  // abajo primero). El estado final es el de siempre.
  start() {
    if (this.introStarted) return;
    if (!this.started) this.prime();
    this.introStarted = true;
    if (this.reduce) {
      this.intro = 1;
      this.render();
      return;
    }
    this.intro = 0.18;
    gsap.killTweensOf(this, 'intro');
    gsap.to(this, { intro: 1, duration: 2.4, ease: 'power1.inOut' });
    this.startLoop();
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
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  }

  render() {
    const ctx = this.ctx;
    const W = this.w;
    const H = this.h;
    if (!W || !H) return;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Suma de luz: las esporas se leen como brasas, no como puntos opacos
    ctx.globalCompositeOperation = 'lighter';

    const ex = this.exitProgress;
    const pull = 0.85 * ex * ex;
    const scroll = window.scrollY;
    const t = this.clock;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      // Deriva hacia arriba + parallax por scroll. Rango extendido (-0.06 → 1.06)
      // para que el reciclado ocurra fuera de cuadro.
      let y = p.y - t * p.speed - (scroll * p.parallax) / H;
      y = (((y % 1.12) + 1.12) % 1.12) - 0.06;
      const x = p.x + (Math.sin(t * p.swayFreq + p.phase) * p.sway) / W;

      let px = x * W;
      let py = y * H;

      if (pull > 0) {
        px = mix(px, this.exitX, pull);
        py = mix(py, this.exitY, pull);
      }

      // Aparición/desaparición suave en los bordes del reciclado
      const edge = Math.min(clamp((y + 0.06) / 0.08, 0, 1), clamp((1.06 - y) / 0.08, 0, 1));

      const s = p.size * (1 - 0.55 * ex * ex);
      const birth = smoothstep(p.birth, p.birth + 0.3, this.intro);
      const a = birth * p.alpha * (1 - ex) * edge;
      if (a <= 0.002) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(this.sprite, px - s / 2, py - s / 2, s, s);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

export const heroSporesFx = new HeroSpores();
