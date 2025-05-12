import { createNoise3D } from 'simplex-noise';

export class Waves {
  constructor(options) {
    this.container = options.dom;
    this.perlin = createNoise3D();

    this.randomness = [];
    this.parameters = {
      factor: 0.045,
      variation: 0.0004,
      amplitude: 700, // será sobrescrito dinámicamente luego
      lines: 20,
      waveColor: { r: 239, g: 46, b: 72, a: 1 },
      shadowColor: { r: 13, g: 14, b: 76, a: 1 },
      shadowBlur: 2,
      lineStroke: 3,
      speed: 0.00058,
    };

    this.setupCanvas();
    this.setSizes();
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
    this.pixelRatio = Math.min(window.devicePixelRatio, 1.5); // Ajustar para pantallas de alta densidad
    this.container.width = this.width * this.pixelRatio;
    this.container.height = this.height * this.pixelRatio;
    this.context.scale(this.pixelRatio, this.pixelRatio);
  }

  setSizes() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.container.width = this.width;
    this.container.height = this.height;

    // Ajustar la amplitud para que no se desborde
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

    for (let i = 0; i <= this.parameters.lines; i++) {
      ctx.beginPath();
      ctx.moveTo(0, this.height / 2);

      let randomY = 0;
      for (let x = 0; x <= this.width; x++) {
        randomY = this.perlin(
          x * this.parameters.variation + this.randomness[i],
          x * this.parameters.variation,
          1
        );

        const y = this.height / 2 + this.parameters.amplitude * randomY;
        ctx.lineTo(x, y);
      }

      const alpha = Math.min(Math.abs(randomY) * 2 + 0.002, 0.3);
      ctx.strokeStyle = `rgba(${this.parameters.waveColor.r}, ${this.parameters.waveColor.g}, ${this.parameters.waveColor.b}, ${alpha})`;
      ctx.stroke();
      ctx.closePath();

      this.randomness[i] += this.parameters.speed;
    }
  }

  setupResize() {
    window.addEventListener('resize', this.resize.bind(this));
  }

  resize() {
    // Reset context transform antes de redimensionar
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

new Waves({
  dom: document.getElementById('webgl'),
});
