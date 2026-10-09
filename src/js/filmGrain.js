// Grano de película a pantalla completa. Una sola textura de ruido generada una
// vez (canvas → dataURL) y desplazada por CSS con steps() a ~10 fps: barato y
// sin repintar nada por frame. Va por encima del contenido y por debajo del
// header; pointer-events: none. Reduced-motion: no se muestra.
const REDUCE = '(prefers-reduced-motion: reduce)';
const SIZE = 180;

export const filmGrain = () => {
  if (window.matchMedia(REDUCE).matches) return;

  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  if (!g) return;
  const img = g.createImageData(SIZE, SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * 255;
  }
  g.putImageData(img, 0, 0);

  const el = document.createElement('div');
  el.className = 'film-grain';
  el.setAttribute('aria-hidden', 'true');
  el.style.backgroundImage = `url(${c.toDataURL('image/png')})`;
  document.body.appendChild(el);
};
