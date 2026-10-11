// Estado compartido por el humo (progressFog.js), los ojos (processEyes.js) y el
// footer (footer-reveal.js).
// p: progreso de las cards 0→1. active: índice de la carta en foco.
// absorb: finale de absorción 0→1 (los ojos bajan al centro y se llevan el humo).
// eyes: apertura de los ojos 0→1 (bloom); el humo del título arranca con ella.
// eyeX/eyeY: centro de los ojos en px de viewport.
export const progressState = {
  p: 0,
  active: 0,
  absorb: 0,
  eyes: 0,
  eyeX: 0,
  eyeY: 0,
};
