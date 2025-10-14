import { createNoise3D } from 'simplex-noise';

export class Waves {
  constructor(options) {
    this.container = options.dom;
    this.perlin = createNoise3D();

    this.randomness = [];
    this.parameters = {
      factor: 0.045,
      variation: 0.0004,
      amplitude: 700,
      lines: 10,
      hueBase: 330, // tono base (rosa/fucsia)
      hueRange: 20, // cuánto varía el tono entre líneas
      shadowColor: { r: 255, g: 6, b: 76, a: 0.6 },
      shadowBlur: 3,
      lineStroke: 3,
      speed: 0.002,
      revealSpeed: 10,
    };

    this.progress = 0;
    this.time = 0;

    this.setSizes();
    this.setupCanvas();
    this.setupRandomness();
    this.render();
    this.setupResize();
  }

  setupCanvas() {
    this.context = this.container.getContext('2d');
    if (!this.context) {
      console.error('❌ No se pudo obtener el contexto 2D del canvas.');
      return;
    }

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

    const drawWidth = Math.min(this.progress, this.width);

    for (let i = 0; i < this.parameters.lines; i++) {
      ctx.beginPath();

      // 🌈 tono y brillo dinámicos
      const hue =
        this.parameters.hueBase + i * (this.parameters.hueRange / this.parameters.lines);
      const lightness = 60 + Math.sin(this.time * 2 + i) * 10; // leve variación
      const alpha = 0.25 + i * 0.02; // profundidad: más transparente al fondo

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
    }

    if (this.progress < this.width) this.progress += this.parameters.revealSpeed;
    this.time += this.parameters.speed;
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
    this.animationId = requestAnimationFrame(this.render.bind(this));
  }
}

// Inicialización
new Waves({
  dom: document.getElementById('webgl'),
});
