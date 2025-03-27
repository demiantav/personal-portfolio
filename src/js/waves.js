import { createNoise3D } from 'simplex-noise';

export class Waves {
  constructor(options) {
    this.container = options.dom;
    this.perlin = createNoise3D();

    this.randomness = [];
    this.parameters = [];
    this.parameters.factor = 0.045;
    this.parameters.variation = 0.0004;
    this.parameters.amplitude = 700;
    this.parameters.lines = 8;
    this.parameters.waveColor = { r: 239, g: 46, b: 72, a: 1 };
    this.parameters.shadowColor = { r: 13, g: 14, b: 76, a: 1 };
    this.parameters.shadowBlur = 2;
    this.parameters.lineStroke = 3;
    this.parameters.speed = 0.00058;

    this.setupCanvas();
    this.setSizes();
    this.setupRandomness();
    this.drawPaths();
    this.render();
    this.setupResize();
  }

  setupCanvas() {
    this.context = this.container.getContext('2d');

    if (!this.context) {
      console.error('❌ No se pudo obtener el contexto 2D del canvas.');
      return;
    }

    console.log('✅ Canvas y contexto creados con éxito.');
    this.container.width = this.width * this.pixelRatio;
    this.container.height = this.height * this.pixelRatio;
    this.context.scale(this.pixelRatio, this.pixelRatio);
  }

  setSizes() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    this.container.width = this.width;
    this.container.height = this.height;
  }

  setupRandomness() {
    for (let i = 0, rand = 0; i < this.parameters.lines; i++, rand += this.parameters.factor) {
      this.randomness[i] = rand;
    }
  }

  drawPaths() {
    this.context.shadowColor =
      'rgba(' +
      this.parameters.shadowColor.r +
      ', ' +
      this.parameters.shadowColor.g +
      ', ' +
      this.parameters.shadowColor.b +
      ',' +
      this.parameters.shadowColor.a +
      ')';
    this.context.shadowBlur = this.parameters.shadowBlur;
    this.context.lineWidth = this.parameters.lineStroke;

    for (let i = 0; i <= this.parameters.lines; i++) {
      this.context.beginPath();
      this.context.moveTo(0, this.height / 2);

      let randomY = 0;
      for (let x = 0; x <= this.width; x++) {
        randomY = this.perlin(
          x * this.parameters.variation + this.randomness[i],
          x * this.parameters.variation,
          1
        );
        this.context.lineTo(
          x,
          this.height / 2 + (this.parameters.amplitude + Math.random() * 0.005) * randomY
        );
      }

      this.alpha = Math.min(Math.abs(randomY) + 0.001, 0.3);
      this.context.strokeStyle =
        'rgba(' +
        this.parameters.waveColor.r +
        ', ' +
        this.parameters.waveColor.g +
        ', ' +
        this.parameters.waveColor.b +
        ',' +
        this.alpha * 2 +
        ')';
      this.context.stroke();
      this.context.closePath();
      this.randomness[i] += this.parameters.speed;
    }
  }

  setupResize() {
    window.addEventListener('resize', this.resize.bind(this));
  }

  resize() {
    this.setSizes();
  }

  render() {
    this.context.clearRect(0, 0, this.width, this.height);
    this.drawPaths();

    setTimeout(() => {
      window.requestAnimationFrame(this.render.bind(this));
    }, 1000 / 60);
  }
}

new Waves({
  dom: document.getElementById('webgl'),
});
