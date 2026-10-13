// Estado compartido por el humo (progressFog.js), los ojos (processEyes.js) y el
// footer (footer-reveal.js).
// p: progreso de las cards 0→1. active: índice de la carta en foco.
// absorb: finale de absorción 0→1 (el humo se va hacia los ojos).
// inhale: escala relativa del ojo durante el finale (anticipación de la succión).
// eyes: apertura de los ojos 0→1 (bloom); el humo del título arranca con ella.
// eyeX/eyeY: centro de los ojos en px de viewport.
export const progressState = {
  p: 0,
  active: 0,
  absorb: 0,
  inhale: 0,
  eyes: 0,
  eyeX: 0,
  eyeY: 0,
};
