// Estado compartido por el humo (progressFog.js), los ojos (processEyes.js) y el
// footer (footer-reveal.js).
// p: progreso de las cards 0→1. active: índice de la carta en foco.
// center: los ojos se desplazan al centro de la pantalla 0→1 (scroll).
// ring: anillo del finale 0→1 (tiempo fijo, disparado al quedar centrados).
// absorb: absorción del humo 0→1 (scroll, después del anillo).
// close: cierre de los ojos 0→1 (scroll, al final del pin).
// inhale: escala relativa del ojo durante el finale (anticipación de la succión).
// eyes: apertura de los ojos 0→1 (bloom); el humo del título arranca con ella.
// eyeX/eyeY: centro de los ojos en px de viewport.
export const progressState = {
  p: 0,
  active: 0,
  center: 0,
  ring: 0,
  absorb: 0,
  close: 0,
  inhale: 0,
  eyes: 0,
  eyeX: 0,
  eyeY: 0,
};
