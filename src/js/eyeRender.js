import { TILT } from './eyeEmotions.js';

// Dibujo compartido de la almendra del finale. El hero lo usa para el ojo
// sólido que enciende la transición de partículas; processEyes lo usa para sus
// ojos rojos. El cuerpo es fijo: sólo se dibujan las tapas encima, recortadas
// al ojo. Tapas transparentes: el párpado cerrado deja ver el humo de fondo.
const EYE_RED = '#ff0000';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const almond = (ctx, rx, ry) => {
  ctx.beginPath();
  ctx.moveTo(-rx * 0.95, ry * 0.1);
  ctx.bezierCurveTo(-rx * 0.55, -ry * 1.3, rx * 0.3, -ry * 1.5, rx, -ry * 0.28);
  ctx.bezierCurveTo(rx * 0.45, ry * 0.85, -rx * 0.4, ry * 1.05, -rx * 0.95, ry * 0.1);
  ctx.closePath();
};

// Tapa superior: su borde está en y = -1.3ry + pos·2.6ry (pos 0 = retirada,
// 1 = cubre todo). Rotación positiva = canto interno (x<0 local) sube.
// Tapa inferior: su borde sube con pos, y `bow` lo curva hacia arriba.
export const drawEye = (ctx, eye, cx, cy, R, look = {}) => {
  const rx = R * 1.9;
  const ry = R * 0.82;
  const s = eye.s;
  const big = ry * 6;

  ctx.save();
  ctx.translate(cx + (look.dx || 0), cy + (look.dy || 0));
  ctx.scale(eye.dir, 1); // el ojo izquierdo es espejo: canto externo hacia fuera
  ctx.rotate(-TILT); // cat-eye: canto externo elevado

  // Cuerpo: almendra roja plana, sin glow. No escala nunca.
  ctx.fillStyle = EYE_RED;
  almond(ctx, rx, ry);
  ctx.fill();

  ctx.save();
  almond(ctx, rx, ry);
  ctx.clip();
  // Tapas transparentes: borran el rojo y dejan ver el humo detrás.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';

  // Tapa superior
  const upRot = s.upRot + (look.upRotExtra || 0);
  const yu = -ry * 1.3 + clamp(s.upPos, 0, 1) * ry * 2.6;
  ctx.save();
  ctx.rotate(upRot);
  ctx.beginPath();
  ctx.moveTo(-big, -big);
  ctx.lineTo(big, -big);
  ctx.lineTo(big, yu);
  ctx.lineTo(-big, yu);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Tapa inferior (con curvatura de sonrisa)
  const yl = ry * 1.3 - clamp(s.loPos, 0, 1) * ry * 2.6;
  ctx.save();
  ctx.rotate(s.loRot + (look.loRotExtra || 0));
  ctx.beginPath();
  ctx.moveTo(-big, big);
  ctx.lineTo(big, big);
  ctx.lineTo(big, yl);
  ctx.quadraticCurveTo(0, yl - 2 * s.bow * ry, -big, yl);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();
  ctx.restore();
};
