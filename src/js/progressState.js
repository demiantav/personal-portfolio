// Estado compartido por el humo (progressFog.js) y los ojos (processEyes.js).
// p: progreso del pin 0→1. active: índice de la carta en foco.
// eyes: apertura de los ojos 0→1 (bloom); el humo del título arranca con ella.
export const progressState = { p: 0, active: 0, eyes: 0 };
