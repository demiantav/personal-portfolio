import { createNoise3D } from 'simplex-noise';

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

// Distorsión reactiva al cursor: las líneas se apartan alrededor del puntero con
// falloff gaussiano y vuelven solas al alejarse.
const DISTORT_SIGMA = 210; // radio de influencia, en unidades de dibujo
const DISTORT_PUSH = 130; // amplitud máxima del empuje (px de dibujo)
const POINTER_EASE = 0.14; // suavizado de la posición del puntero
const STRENGTH_EASE = 0.08; // suavizado de entrada/salida de la distorsión

export class Waves {
  constructor(options) {
    this.container = options.dom;
    this.perlin = createNoise3D();

    this.parameters = {
      factor: 0.045,
      variation: 0.0004,
      amplitude: 700,
      lines: 10,
      hueBase: 330,
      hueRange: 20,
      shadowColor: { r: 255, g: 6, b: 76, a: 0.6 },
      shadowBlur: 3,
      lineStroke: 3,
      speed: 0.002,
      revealSpeed: 0.03,
      waveDelay: 0.03,
      exitStagger: 0.07, // 🔥 solapamiento entre líneas al salir
      exitArcY: 40, // 🔥 deriva vertical en arco durante la salida
      exitFadeStart: 0.8, // 🔥 último 20% del recorrido con fade
    };

    this.time = 0;
    this.isStarted = false;
    this.exitProgress = 0; // 0→1, animado por GSAP desde la timeline del hero
    this.prevExitOffsets = Array(this.parameters.lines).fill(0);

    // 🔹 progreso individual por línea
    this.revealProgress = Array(this.parameters.lines).fill(0);
    this.randomness = [];

    // Puntero (coords en espacio de dibujo) + estado suavizado de la distorsión.
    this.pointer = { x: 0, y: 0, strength: 0 };
    this.pointerTarget = { x: 0, y: 0, strength: 0 };
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    this.isRendering = false;
    this.rafId = 0;

    this.setSizes();
    this.setupCanvas();
    this.setupRandomness();
    this.setupResize();
    this.setupPointer();
    this.setupVisibility();

    this.loop = this.loop.bind(this);
    this.startLoop();
  }

  start() {
    this.isStarted = true;
  }

  // Loop controlable: se pausa cuando el hero sale de pantalla (IO) para no
  // dibujar de fondo el resto de la sesión.
  startLoop() {
    this.isRendering = true;
    if (!this.rafId) this.rafId = requestAnimationFrame(this.loop);
  }

  stopLoop() {
    this.isRendering = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  loop() {
    this.rafId = 0;
    if (!this.isRendering) return;
    this.context.clearRect(0, 0, this.width, this.height);
    this.smoothPointer();
    this.drawPaths();
    this.rafId = requestAnimationFrame(this.loop);
  }

  // El puntero real va un paso por delante; el visible lo persigue para que la
  // deformación no tiemble ni salte.
  smoothPointer() {
    const p = this.pointer;
    const t = this.pointerTarget;
    p.x += (t.x - p.x) * POINTER_EASE;
    p.y += (t.y - p.y) * POINTER_EASE;
    p.strength += (t.strength - p.strength) * STRENGTH_EASE;
  }

  setupPointer() {
    // Solo desktop con puntero fino y sin reduce-motion: en táctil y en
    // reduce-motion las waves quedan como estaban.
    if (this.reduceMotion.matches || !this.finePointer.matches) return;

    this.onPointerMove = (e) => {
      const rect = this.container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      // El canvas se dibuja a innerHeight pero se muestra a 50dvh: mapear de
      // CSS a unidades de dibujo en ambos ejes.
      this.pointerTarget.x = (e.clientX - rect.left) * (this.width / rect.width);
      this.pointerTarget.y = (e.clientY - rect.top) * (this.height / rect.height);
      this.pointerTarget.strength = 1;
    };
    // relatedTarget null también dispara al eliminar nodos: solo al salir de la
    // ventana se apaga la distorsión.
    this.onPointerOut = (e) => {
      if (e.relatedTarget) return;
      this.pointerTarget.strength = 0;
    };

    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerout', this.onPointerOut);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pointerTarget.strength = 0;
    });
  }

  setupVisibility() {
    if (!('IntersectionObserver' in window)) return;
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) this.startLoop();
        else this.stopLoop();
      },
      { threshold: 0 },
    );
    this.observer.observe(this.container);
  }

  setupCanvas() {
    this.context = this.container.getContext('2d');
    if (!this.context) return;

    this.pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    this.container.width = this.width * this.pixelRatio;
    this.container.height = this.height * this.pixelRatio;
    this.context.scale(this.pixelRatio, this.pixelRatio);
  }

  setSizes() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.container.width = this.width;
    this.container.height = this.height;
    this.parameters.amplitude = Math.min(this.height / 2.5, 700);
  }

  setupRandomness() {
    this.randomness = [];
    for (let i = 0, rand = 0; i < this.parameters.lines; i++, rand += this.parameters.factor) {
      this.randomness[i] = rand;
    }
  }

  drawPaths() {
    const ctx = this.context;
    const { lines, exitStagger, exitFadeStart, exitArcY } = this.parameters;
    const totalStagger = (lines - 1) * exitStagger;

    // Distorsión: mismas variables para todas las líneas del frame.
    const px = this.pointer.x;
    const py = this.pointer.y;
    const ps = this.pointer.strength;
    const sigmaTerm = 2 * DISTORT_SIGMA * DISTORT_SIGMA;

    ctx.shadowColor = `rgba(${this.parameters.shadowColor.r}, ${this.parameters.shadowColor.g}, ${this.parameters.shadowColor.b}, ${this.parameters.shadowColor.a})`;
    ctx.lineWidth = this.parameters.lineStroke;

    for (let i = 0; i < lines; i++) {
      // 🔥 salida escalonada: cada línea deriva su progreso del global
      const local = clamp01((this.exitProgress - i * exitStagger) / (1 - totalStagger));
      if (local >= 1) continue; // ya salió, no dibujar

      const eased = easeInOutCubic(local);

      ctx.beginPath();

      const hue = this.parameters.hueBase + i * (this.parameters.hueRange / lines);
      const lightness = 60 + Math.sin(this.time * 2 + i) * 10;
      const fadeOut = 1 - clamp01((eased - exitFadeStart) / (1 - exitFadeStart));
      const alpha = (0.25 + i * 0.02) * fadeOut;

      // 🔥 barrido hacia la derecha + latigeo vertical en arco
      const offsetX = eased * (this.width + this.parameters.amplitude);
      const arcDir = i % 2 === 0 ? 1 : -1;
      const offsetY = Math.sin(eased * Math.PI) * exitArcY * arcDir;

      // 🔥 fake motion blur: glow proporcional a la velocidad
      const velocity = Math.abs(offsetX - this.prevExitOffsets[i]);
      this.prevExitOffsets[i] = offsetX;

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = this.parameters.shadowBlur + Math.min(velocity * 0.2, 22);

      // 🔥 retracción de cola: el borde izquierdo avanza mientras la cabeza sale
      const lineProgress = this.revealProgress[i];
      const drawWidth = this.width * lineProgress * (1 - eased);

      // El puntero vive en coords de canvas; la línea se dibuja local y luego se
      // traduce, así que se compensa el offset para deformar bajo el cursor real.
      const localPx = px - offsetX;
      const localPy = py - offsetY;

      for (let x = 0; x <= drawWidth; x += 2) {
        const noiseValue = this.perlin(
          x * this.parameters.variation + this.randomness[i],
          x * this.parameters.variation,
          this.time,
        );
        let y = this.height / 2 + this.parameters.amplitude * noiseValue;

        if (ps > 0.001) {
          const ddx = x - localPx;
          const ddy = y - localPy;
          const d2 = ddx * ddx + ddy * ddy;
          const falloff = Math.exp(-d2 / sigmaTerm);
          y += (ddy / (Math.sqrt(d2) + 1)) * falloff * DISTORT_PUSH * ps;
        }

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.strokeStyle = `hsla(${hue}, 80%, ${lightness}%, ${alpha})`;
      ctx.stroke();
      ctx.closePath();
      ctx.restore();

      this.randomness[i] += this.parameters.speed * 0.02;

      // 🔥 reveal progresivo con delay por línea
      if (this.isStarted && this.revealProgress[i] < 1) {
        this.revealProgress[i] +=
          this.parameters.revealSpeed * (1 + i * this.parameters.waveDelay);
        if (this.revealProgress[i] > 1) this.revealProgress[i] = 1;
      }
    }

    if (this.isStarted) this.time += this.parameters.speed;
  }

  setupResize() {
    window.addEventListener('resize', this.resize.bind(this));
  }

  resize() {
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.setSizes();
    this.setupCanvas();
    this.setupRandomness();
  }
}
