import { createNoise3D } from 'simplex-noise';

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
      revealSpeed: 0.02, // 🔥 más rápido que antes
      waveDelay: 0.05, // 🔥 delay entre cada línea
    };

    this.time = 0;
    this.isStarted = false;

    // 🔹 progreso individual por línea
    this.revealProgress = Array(this.parameters.lines).fill(0);
    this.randomness = [];

    this.setSizes();
    this.setupCanvas();
    this.setupRandomness();
    this.render();
    this.setupResize();
  }

  start() {
    this.isStarted = true;
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
    ctx.shadowColor = `rgba(${this.parameters.shadowColor.r}, ${this.parameters.shadowColor.g}, ${this.parameters.shadowColor.b}, ${this.parameters.shadowColor.a})`;
    ctx.shadowBlur = this.parameters.shadowBlur;
    ctx.lineWidth = this.parameters.lineStroke;

    for (let i = 0; i < this.parameters.lines; i++) {
      ctx.beginPath();

      const hue =
        this.parameters.hueBase + i * (this.parameters.hueRange / this.parameters.lines);
      const lightness = 60 + Math.sin(this.time * 2 + i) * 10;
      const alpha = 0.25 + i * 0.02;

      const lineProgress = this.revealProgress[i];
      const drawWidth = this.width * lineProgress;

      for (let x = 0; x <= drawWidth; x += 2) {
        const noiseValue = this.perlin(
          x * this.parameters.variation + this.randomness[i],
          x * this.parameters.variation,
          this.time
        );
        const y = this.height / 2 + this.parameters.amplitude * noiseValue;

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.strokeStyle = `hsla(${hue}, 80%, ${lightness}%, ${alpha})`;
      ctx.stroke();
      ctx.closePath();

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

  render() {
    this.context.clearRect(0, 0, this.width, this.height);
    this.drawPaths();
    requestAnimationFrame(this.render.bind(this));
  }
}
