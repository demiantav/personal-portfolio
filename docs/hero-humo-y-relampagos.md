# Hero: humo y relámpagos

Reemplazo de las líneas 2D del hero (`waves.js`) por humo WebGL con relámpagos
rojos aleatorios, en la dirección visual de Stranger Things. El humo iluminado
usa el mismo lenguaje que el finale de la sección de proceso, así el hero y el
cierre comparten técnica.

## Piezas

- **`src/js/heroSmoke.js`**: el efecto. Canvas WebGL que llena `.hero-pin`.
  - `start()` (lo llama la intro al terminar el titular) revela el humo.
  - `exitProgress` (0→1, lo tweenea `hero-zoom-transition.js`) pliega el humo
    hacia la D del titular y lo traga, como la absorción del finale.
- **`src/js/gl.js`**: helpers WebGL compartidos. Exporta `NOISE` (campo de ruido),
  `buildProgram` (triángulo que cubre el viewport, un solo draw call) y
  `webglContext`. `progressFog.js` también los usa: antes duplicaba el ruido y el
  compilador.

## Campo: nube + capa macro

El campo del hero vuelve al mismo lenguaje que la sección de los ojos
(`progressFog.js`): domain warping en dos pasos y la rampa del finale
(`bodyAt(d) = smoothstep(0.30, 0.85, d)`), con núcleos definidos y silueta de
nube. La mejora es una capa que no cambia ese lenguaje:

- **Capa macro** (`macroAt`): dos ruidos de baja frecuencia (0.42 y 0.85) con
  deriva lenta que suman `(macro − 0.5) · 0.5` al campo. Modula la densidad a
  escala de pantalla: las masas cambian de tamaño y el patrón no se repite.
- **Sombreado interno**: el tinte se multiplica por `0.87 + 0.22 · macro`, así
  las masas tienen zonas más cálidas y no se leen como una textura plana.
- **Presencia**: el ambiente sube de 0.5 a 0.55 y el tinte se acerca apenas al
  del finale (`0.34, 0.032, 0.052` en el cuerpo), sin competir con el titular.
- El vecino que ilumina el relámpago también suma la capa macro, así la normal
  falsa compara la misma densidad.

El resto de la luz y el apagado en la salida no cambian.

## Esporas (`heroSpores.js`)

Canvas 2D insertado después de `#webgl` y antes del titular: se pinta sobre el
humo y por debajo del texto (mismo `z-index: 0`, orden del DOM).

- Unas 62–82 esporas en desktop y 34–42 en mobile. Cada una elige profundidad
  (0 lejos → 1 cerca) que controla tamaño, alfa, velocidad, sway y parallax.
- Deriva hacia arriba, oscilación lateral y parallax con el scroll. Reciclado
  fuera de cuadro con fundido en los bordes.
- Sprite radial pre-renderizado + `globalCompositeOperation = 'lighter'`: brasas
  rojas, sin crear gradientes por partícula.
- Entrada al mismo ritmo que el humo (1.6 s). `exitProgress` lo tweenea
  `hero-zoom-transition.js` junto con `heroFx`: las esporas se pliegan hacia la
  D, se achican y se apagan con el humo.
- Reduced motion: un cuadro estático. `IntersectionObserver` pausa el loop
  cuando el hero sale de pantalla.

## Interacción con el cursor

El hero reacciona al puntero sin agregar luz ni otro evento: **la niebla se abre a
su paso y las esporas se apartan y vuelven**.

- **Apertura del humo**: el muestreo del campo se corre hacia afuera alrededor del
  puntero y la densidad baja hasta un 32 % en el centro. El borde es irregular
  (ruido de baja frecuencia), así no se lee como un círculo. Radio `0.18·H` en
  desktop y `0.16·H` en mobile; desplazamiento `0.34·r`.
- **Esporas**: cada una guarda un offset; el empuje máximo es ~18 % del radio y
  escala con la profundidad. Vuelven con una constante más lenta (~2.2/s) que la
  ida (~8/s), así el retorno es elástico.
- **Sin luz**: no hay halo ni `heat` extra; el relámpago sigue siendo el único
  evento brillante.
- **Puntero**: `heroPointer.js` (singleton) escucha `pointermove/down/up/cancel`
  con listeners pasivos; se apaga sobre links/botones y al salir del hero.
- **Mobile**: el dedo hace de puntero mientras se arrastra; el gesto no bloquea
  el scroll y `pointercancel` cierra la interacción.
- **Reduced motion**: no se inicializa; la escena queda estática.

Implementación: `heroSmoke.js` suma `u_pointer`/`u_pointerAmt` (suavizado a 12/s y
fade 6/2.5 por segundo); `heroSpores.js` suma el offset por partícula. No hay
canvas, loop ni contexto nuevos.

## Relámpagos

- **Disparo**: intervalo aleatorio de 2.5 a 6 s (delay orgánico, "fluido"). Cada
  descarga emite 2 pulsos gaussianos dentro de ~0.35 s más una cola de luz,
  y el resultado se suaviza con constantes distintas de ataque y salida.
- **Iluminación**: dentro del shader, la normal falsa sale de comparar la densidad
  del humo con la del vecino hacia el origen del destello. Se calcula **solo**
  cuando hay destello (`u_flash > 0`), así el costo normal es el del campo base.
  El brillo es direccional y local; el levantamiento global es chico.
- **Accesibilidad**: pensado para no superar los 3 destellos por segundo de la
  pauta WCAG 2.3.1 (2 pulsos por descarga, 2.5 s mínimo entre descargas).

## Salida (scroll)

`hero-zoom-transition.js` tweenea `exitProgress` de 0 a 1 durante el primer 28 %
del pin. El muestreo del campo se pliega hacia el centro de la D
(`.d-anchor`) y la densidad cae a 0, así el humo desaparece antes del zoom. La
idea es la misma que la absorción del finale.

## Rendimiento y fallbacks

- Media resolución: escala 0.5 en desktop y 0.38 en mobile (el humo es de baja
  frecuencia, no se nota). El loop se pausa con `IntersectionObserver` cuando el
  hero sale de pantalla.
- **Reduced motion**: sin relámpagos ni bucle; se dibuja un solo frame estático
  (verificado: `reduce = true`, sin errores).
- **Sin WebGL**: el canvas queda vacío y se ve el degradado de respaldo de
  `.hero-pin`.

## Estructura del hero (CSS)

`.hero-pin` es `position: relative` y reserva la altura del titular con
`padding-block-start: 50dvh` (el padding no colapsa como sí haría un margen con
`overflow: clip`). `#webgl` es `position: absolute; inset: 0`, así cubre toda la
sección sin empujar el layout; el titular queda por encima con `z-index: 1`.

## Archivos

- `src/js/heroSmoke.js`: humo (shader) y relámpagos; usa el puntero del hero.
- `src/js/heroSpores.js`: esporas en canvas 2D, con parallax, repulsión del
  puntero y salida hacia la D.
- `src/js/heroPointer.js`: estado del puntero compartido por humo y esporas.
- `src/js/gl.js`: helpers y ruido compartidos.
- `src/js/textAnimate.js`: instancia el humo y las esporas (`heroFx`, `heroSporesFx`),
  inicializa el puntero del hero y llama `start()` a los dos al terminar el titular.
- `src/js/hero-zoom-transition.js`: tweenea `exitProgress` en la salida.
- `src/style.css`: `.hero-pin`, `#webgl` y `.hero-spores`.
- `src/js/waves.js`: eliminado.

## Pendiente

- Compartir un solo contexto WebGL entre el hero y el finale (hoy hay cinco
  canvas en la página: humo y esporas del hero; humo, velo y ojos del finale).
- Medir FPS en un dispositivo real, sobre todo mobile, con las esporas.
- Probar la interacción del cursor en un dispositivo real: que la abertura del
  humo y el retorno de las esporas se sientan bien en touch y no traben el scroll.
- Validar la magnitud del destello contra la pauta WCAG si se sube la intensidad.
- Comparar en movimiento la nube del hero contra la sección de los ojos. Si hace
  falta, subir/bajar la amplitud macro (`0.5`) o el ambiente (`0.55`).
