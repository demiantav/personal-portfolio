# Sección de proceso: humo, ojos, cards y finale

Estado de la sección de proceso: título → cards 3D → absorción del humo → cierre de
los ojos → aro que revela el footer.

## Estado general

- Secuencia del finale completa (centrado, anillo, absorción, cierre, aro): implementada.
- **Aprobado por el usuario en movimiento**: el ritmo del giro del humo (`spin`) y la
  coordinación cierre de ojos / humo / aro.
- **Último ajuste, pendiente de prueba en movimiento**: la banda de tirón (`pull`) ahora
  sigue al frente de succión y se atenúa al contraerse. Implementado y medido; falta verlo
  con scroll real.
- Commits por etapa hasta `f67c2de`. El ajuste de la banda de tirón está **sin commitear**.
- Pendientes gruesos: mobile (tamaño de los ojos, fps, aro a pantalla completa) y
  fallbacks (sin WebGL y `prefers-reduced-motion`).

## Secuencia del finale

Pin: `total = (stepVh·N + ABSORB_VH)·H`. Escritorio `stepVh = 1.25`, mobile `1.0`;
`N = 4` cards; `ABSORB_VH = 3`. `f` es la fracción del finale (después de las cards), 0→1.

1. **Centrado** (scroll, `f` 0→0.15): los ojos van de `0.30H` a `H/2`. `center = ease(f/0.15)`.
2. **Anillo** (tiempo fijo, `RING_S = 1.6 s`): arranca al llegar `f ≥ 0.15`. Se invierte si
   se sube. Se escribe en `ring`.
3. **Absorción** (scroll, de `absorbFrom` a `f = 0.9`):
   `absorb = (f − absorbFrom)/(0.9 − absorbFrom)`. `absorbFrom` se fija al terminar el
   anillo, así no hay zona muerta ni salto.
4. **Cierre** (tiempo fijo, `SHUT_S = 1.0 s`): arranca cuando `absorb = 1`. Un solo progreso
   `close` maneja párpados, apagado del humo y halo. Al terminar se dispara `eyesClosed`.
5. **Aro** (tiempo fijo, `REVEAL_S = 1.6 s`): arranca al recibir `eyesClosed`. Revela el pie.

Todas las etapas de tiempo (anillo, cierre, aro) se revierten al subir (`reverse()`).

## Estado compartido (`progressState.js`)

- `p`, `active`: fase de las cards.
- `center`: ojos al centro 0→1 (scroll).
- `ring`, `absorb`: anillo y absorción.
- `close`: cierre de los ojos 0→1. Lo escribe el tween de `progressCards3D`; maneja
  párpados, apagado del humo y halo.
- `reveal`, `revealMax`, `revealX`, `revealY`: aro que revela el pie y su origen congelado.
- `inhale`: escala relativa del ojo en el finale.
- `eyes`, `eyeX`, `eyeY`: apertura, centro de los ojos y su posición en pantalla.

## Archivos y responsabilidad

- **`progressFog.js`**: humo y velo (dos canvas WebGL) y la absorción. Cualquier cambio de
  humo o de finale toca acá.
- **`progressCards3D.js`**: pin de las cards y `paint`, que calcula `p`, `f`, `center`,
  `ring`, `absorb`, `close`, `reveal` e `inhale`.
- **`processEyes.js`**: ojos y tapas (canvas 2D). El cierre se lee de `close`.
- **`footer-reveal.js`**: entrada del pie por distancia al aro.
- **`progressState.js`**: estado compartido.
- **`style.css`**: humo, velo, `body.progress-stage` y cards.
- **`index.js`**: orden de montaje.

## Humo (`progressFog.js`, shader)

Dos canvas fijos, media resolución (`SCALE = 0.5`): `.progress-veil` (z-index 1) y
`.progress-fog` (z-index 2). Se recortan con el borde inferior de la sección de cards
(`clip-path`), así el humo nunca pinta sobre el pie.

Bloques del finale:

- **Frente de succión**: `reach = 1.4 · (1 − smoothstep(0, 0.9, ab))`. A `ab = 1` llega a 0
  y el humo ya no tiene dónde estar (`inside`).
- **Banda de tirón (`pull`)**: multiplica el radio de muestreo cerca del frente.
  - Durante el anillo (aprobado): sale del frente del anillo, fuerza `1.6`, ancho `0.25`.
  - En la absorción: se pega a `reach`, y **fuerza y ancho bajan con el radio**
    (`pullAmp = 0.45·(reach/1.4)`, `pullW = 0.25·max(reach/1.4, 0.3)`).
  - Motivo del ajuste: con la fuerza plena y la banda sobre el humo visible, el campo
    "corría" 2–3× más rápido (leído como giro acelerado). Ver Mediciones.
- **Giro**: `spin = 1.5 · ab / (rEye + 0.15)`. Antes usaba `smoothstep(0, 1, ab)`, que
  saturaba a mitad y frenaba el giro al contraerse la esfera; con `ab` el ritmo se mantiene
  y se acelera al acercarse al ojo.
- **Flujo hacia el ojo**: `inflow = exp(1.1·ab)`, sin saturar.
- **Máscaras**: `eaten` (borde ruidoso del anillo), `inside` (frente), `sink` (junto al ojo).
- **Halo**: luz pura (sin textura de humo), crece con el anillo y la absorción, se apaga con
  `close`.
- **Apagado final**: `u_gone = max(close, reveal)`. El humo se apaga **junto con los
  párpados** (no antes) y queda apagado durante el aro.

Loop JS: `speed → 1 + 7·ab²`, `flow` y `light` integran `speed·dt`, `inV → 0.1 + 0.6·ab³`,
`lag → ab` suavizado (`1 − exp(−dt·0.6)`).

## Velo y aro (`VEIL_FRAG`)

- Borde ruidoso (fbm, ±90 px), transición de 60 px, resplandor rojo que sólo tiñe el velo.
- `REVEAL_MARGIN = 210`: el radio del aro pasa la esquina más lejana, así a `reveal = 1` el
  velo desaparece del todo.
- El origen del aro se congela (`revealX/Y`) al empezar; los ojos siguen con su resorte.
- Mientras corre el aro, el velo ocupa toda la pantalla (`updateVeilStage`), así el scroll
  no levanta el borde y el pie sólo aparece por el aro.

## Ojos (`processEyes.js`)

- Radio `R = min(0.055·W, 0.085·H) · (1 + inhale + beat)`. Canvas 2D, rojo puro, sin pupila.
- Tapas transparentes: el rojo se borra con `destination-out`, así el párpado cerrado deja
  ver el humo.
- Cierre: `closeAmt = smoothstep(0, 1, close)`. `eyesClosed` se emite al llegar a
  `CLOSE_AT = 0.999` (final del tween de cierre).
- `inhale`: +3 % con el anillo, +12 %·`absorb²` al tragar, −12 %·`ease(close)`.
- `integrate` usa subpasos de 1/120 s (a frames lentos el resorte de la mirada divergía).

## Footer (`footer-reveal.js`)

- Cada elemento (línea, CTA, meta, bloque inferior, reloj, nav, título) tiene su entrada de
  duración fija. Arranca cuando el radio del aro alcanza su distancia al origen congelado y
  se revierte al retroceder. Sin scrub.
- Las máscaras del título se liberan y se dispara `footerRevealSettled` al llegar el aro a 1.
  Al revertir se restauran en `overflow: clip` (el valor que deja SplitText), **no** `hidden`:
  `hidden` le da al inline-block su propia baseline y cambia el alto del título (~60 px) y,
  con el `space-around` del pie, reacomoda todos los elementos en vertical (bug de desajuste).

## Mediciones

Harness: Chrome headless con CDP por WebSocket (WebSocket nativo de Node). Se intercepta
`gl.uniform1f` para leer los uniforms del humo en orden fijo (`reveal`, `alpha`, `ring`,
`absorb`, `close`, `gone`); `absorb` es el 12.º `uniform1f` del frame. El scroll se anima por
`requestAnimationFrame` para que los tweens de tiempo corran de verdad. Scripts en el temp
del harness: `drive.mjs`, `capture.mjs`, `measure-coord.mjs`, `reverse.mjs`,
`measure-swirl.mjs`, `measure-pull.mjs`.

**Coordinación cierre / humo / aro** (scroll real, desktop 1440×900):

| hito | tiempo |
|---|---|
| absorción completa (`absorb=1`) | 21.51 s |
| empieza el cierre | 21.55 s (+0.036 s) |
| ojos cerrados (`close=1`) | 22.53 s (cierre ≈ 0.98 s = `SHUT_S`) |
| arranca el aro (`reveal>0`) | 22.56 s (+0.030 s ≈ 1 frame) |

`gone === close` en todas las muestras (el humo se apaga con los párpados). Reversibilidad
verificada: al subir, `close` y `reveal` bajan juntos y el humo vuelve.

**Giro** (`d spin/d ab` a `rEye = 0.3`), antes vs después del cambio a `ab`:

| ab | 0.1 | 0.3 | 0.5 | 0.7 | 0.9 |
|---|---|---|---|---|---|
| `smoothstep` (antes) | 1.8 | 4.2 | 5.0 | 4.2 | 1.8 |
| `ab` (ahora) | 3.3 | 3.3 | 3.3 | 3.3 | 3.3 |

**Banda de tirón** (`K = pull · (1+1.4·fa·near) · inflow` en el borde `reach`):

| ab | radio | K sin tirón | tirón 1.6 | tirón atenuado |
|---|---|---|---|---|
| 0.4 | 0.82 | 2.0 | 5.1 | 2.5 |
| 0.5 | 0.58 | 2.9 | 7.6 | 3.5 |
| 0.7 | 0.18 | 5.0 | 13.0 | 5.3 |

Con 1.6 el corrimiento del humo era 2–3× el previo; el atenuado queda al nivel original.

## Decisiones cerradas

- **Ojos**: rojo puro, canvas 2D propio, sin pupila. Tapas transparentes (`destination-out`).
- **Humo**: sólo de fondo. Se eliminaron el cono de luz y los god rays. Se mantiene el halo.
- **Brillo**: sólo en el halo (luz pura); el cuerpo del ojo sigue rojo puro.
- **Absorción**: hacia el punto **medio entre los ojos** (`eyeX = W/2`), no hacia cada ojo.
- **Cierre y aro**: tiempo fijo, disparados por umbral, reversibles al subir.
- **Salida al footer**: sin cortina; el humo se apaga con el cierre y el aro revela el pie.

## Pendientes

- [ ] Probar en movimiento el ajuste de la banda de tirón (¿la velocidad del giro vuelve a
      sentirse como antes?). Si sigue rápido, bajar `0.45`; si se nota poco, subirlo.
- [ ] Mobile: los ojos miden 12–30 px de alto (`min(0.055W, 0.085H)`). Revisar tamaño.
- [ ] Mobile: el agujero del aro tiene que cubrir la pantalla completa sin borde cortado.
- [ ] Mobile: medir fps en un dispositivo real. Si hace falta, bajar octavas del fbm.
- [ ] Mobile: ojos en reposo, que no pisen el título.
- [ ] Rotación continua del humo: sin resolver. Las variantes con término de tiempo (`u_spin`)
      producen patrones circulares concéntricos. Hace falta una captura del momento en que
      aparecen antes de reintentar.
- [ ] Probar el finale con scroll real de punta a punta y confirmar velo, aro y entrada del pie.
- [ ] Footer: los elementos lejanos al ojo pueden terminar después de que el aro llega a 1
      ("acomodo" final). Opciones: acortar duración o escalarla al aro.
- [ ] Footer: evaluar bloquear el scroll mientras corre el aro.
- [ ] Fallbacks: sin WebGL y `prefers-reduced-motion` no tienen capa estática de respaldo.
- [ ] Verificar con scroll real: velocidad del humo y de los hilos (`speed`, `u_light`),
      retraso del halo (`lag` 0.6, `haloK` 0.25–1.0) y la duración de la absorción.
- [ ] Ojos por encima de Skills al scrollear hacia atrás (`z-index` 4 vs 3).
- [ ] Borde rojo fino alrededor del almendro casi cerrado: verificar con tapas transparentes.
- [ ] Densidad del humo del título, que se ve más tenue que en las cards.

## Archivos para leer para retomar

Leer sólo lo que haga falta:

- `docs/progreso-humo-y-absorcion.md`: este documento. Siempre.
- `src/js/progressFog.js`: humo, velo, absorción y banda de tirón (shader + loop JS).
- `src/js/progressCards3D.js`: `paint` (los tweens de anillo, cierre y aro) y la escena 3D.
- `src/js/processEyes.js`: ojos y tapas; en particular `render` (radio `R`, cierre).
- `src/js/progressState.js`: campos compartidos.
- `src/js/footer-reveal.js`: entrada del pie por distancia al aro.
- `src/style.css`: sólo humo, velo, `body.progress-stage` y cards.
- `src/index.js`: sólo si se agrega un módulo nuevo.
