# Hero: humo, relámpagos y los ojos del subtítulo

Reemplazo de las líneas 2D del hero (`waves.js`) por humo WebGL con relámpagos
rojos aleatorios, en la dirección visual de Stranger Things. El humo iluminado
usa el mismo lenguaje que el finale de la sección de proceso, así el hero y el
cierre comparten técnica.

La interacción principal del hero es otra: el subtítulo se despierta, las brasas
coral se pliegan en dos ojos y encienden la almendra roja del finale. El humo y
las esporas quedan de fondo.

## Piezas

- **`src/js/heroSmoke.js`**: el efecto. Canvas WebGL que llena `.hero-pin`.
  - `start()` (lo llama la intro al terminar el titular) revela el humo.
  - `exitProgress` (0→1, lo tweenea `hero-zoom-transition.js`) pliega el humo
    hacia la D del titular y lo traga, como la absorción del finale.
- **`src/js/gl.js`**: helpers WebGL compartidos. Exporta `NOISE` (campo de ruido),
  `buildProgram` (triángulo que cubre el viewport, un solo draw call) y
  `webglContext`. `progressFog.js` también los usa: antes duplicaba el ruido y el
  compilador.
- **`src/js/heroSubtitleEyes.js`**: la interacción del subtítulo. Canvas 2D
  pegado al bloque, partículas muestreadas del texto real, almendra sólida al
  despertar, párpados con resortes y mirada al cursor.
- **`src/js/eyeRender.js`**: renderer compartido de la almendra del finale. El
  ojo del hero y los ojos de `processEyes.js` dibujan exactamente la misma forma.
- **`src/js/eyeEmotions.js`**: tabla compartida de emociones. El finale usa
  `neutral`, `scan`, `playful`, `angry` y `sleepy`; el hero usa `hooded`,
  `focus` y `sleepy` como bases, más `angry` y `wary` como impulsos.

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

## Los ojos del subtítulo (`heroSubtitleEyes.js`)

La interacción principal del hero es el subtítulo. Los dos `h4` son la forma
dormida de la criatura que aparece en el finale: al entrar al bloque, el texto se
despierta, las brasas coral se pliegan en dos ojos y la almendra se enciende en
rojo. Al salir (o a los ~8,5 s de inactividad) el ojo sólido se deshace en las
brasas, que vuelven a sus glifos y reconstruyen el texto. En mobile el
disparador es un tap; en `prefers-reduced-motion` no existe.

### Rig híbrido: brasas + almendra

- **Sin tocar el DOM.** El texto no se splitea para el efecto: se renderiza con
  la fuente computada en un canvas offscreen y se muestrean los píxeles opacos.
  El `SplitText` de la salida (`hero-zoom-transition.js`) queda intacto y el
  subtítulo sigue siendo texto real para lectores de pantalla.
- **Presupuesto.** 800 brasas coral en desktop y 520 en mobile para el pliegue y
  el retorno. El ojo despierto no usa partículas: usa la almendra sólida del
  finale. El canvas cubre sólo el bloque + 30 px de aire por lado y el DPR
  máximo es 2.
- **Brasas coral.** Los sprites radiales heredan el coral del subtítulo
  (`#f3505f`), con el último stop transparente del mismo color. Se dibujan con
  `source-over` (no aditivo) para que la superposición no vire a blanco. El loop
  se apaga en reposo.
- **Almendra sólida.** Se dibuja en un canvas offscreen del mismo tamaño con
  `drawEye` de `eyeRender.js`: misma silueta, proporción, `TILT`, tapas y
  emociones que el finale. Se compone con alpha sobre las brasas; las tapas usan
  `destination-out` sólo dentro de ese canvas, así no recortan la transición.
- **El pliegue.** La línea de arriba se convierte en los párpados superiores y
  la de abajo en los inferiores. La banda central de cada mitad no se condensa
  en una pupila: se dispersa por el cuerpo de la almendra. Los extremos del
  texto, en las comisuras. Las partículas se reparten por rango de píxeles (no
  por punto medio geométrico) para que los dos ojos tengan la misma densidad
  aunque el subtítulo esté alineado a la derecha.
- **La silueta.** La almendra de partículas usa la misma curva asimétrica
  cat-eye; el párpado superior y el inferior comparten el mismo parámetro `t`
  (comisura interna 0 → externa 1). El cuerpo se apaga con la abertura real, así
  al cerrar no quedan brasas flotando sobre el párpado.
- **Sin pupila.** El ojo despierto es `#ff0000` plano, sin centro brillante ni
  puntos blancos. La mirada la hace el cuerpo completo, con resortes,
  microsacádicas y la inclinación de las tapas.
- **Vuelo + encendido.** Las brasas salen del glifo con un bezier de dos tramos
  y una onda por línea, no con delays aleatorios. A los ~0.30 s la rendija de
  brasas empieza a encenderse en la almendra sólida; el crossfade termina a los
  ~0.50 s, cuando ya no queda ninguna brasa en vuelo. El ojo derecho llega ~20–35
  ms más tarde, como en el finale.

### Coreografía

- **Trigger.** Sólo al entrar al subtítulo (con 8 px de tolerancia) o con un tap
  en mobile. Una vez despierto, la mirada sigue al cursor mientras siga dentro
  del bloque de título + 24 px.
- **Despertar.** El texto se desprende por líneas entre 0.04 y 0.26 s; no
  desaparece de golpe. Las brasas pliegan en una onda por línea, la rendija
  sólida se enciende entre 0.30 y 0.50 s y el ojo abre entre 0.50 y 0.72 s,
  cuando las partículas ya terminaron. Queda en `hooded`. El primer despertar
  de la carga regala un parpadeo lento de saludo a los ~1.35 s, una sola vez.
- **Emociones.** Tres bases: `hooded`, `focus` (a los ~3 s si el cursor se
  quedó quieto) y `sleepy` (a los ~7,4 s). El enojo es un impulso de ~0,9 s con
  cooldown de 2,2 s después de un swipe rápido; la desconfianza es una capa
  aditiva cuando la mirada va al borde. Ninguno dispara un parpadeo ni cambia
  la silueta de golpe. La mirada es por ojo, con microsacádicas espaciadas
  (2,6–5 s), sacadas de 60–110 ms, zona muerta de 0,075 y un retardo de 20–35
  ms en el ojo derecho. El único parpadeo de personaje es el saludo; el natural
  cae cerca de los 5 s.
- **Retorno.** Al salir del bloque de título (140 ms de gracia), a los ~8,5 s de
  inactividad, al scrollear, al redimensionar, al ocultar la pestaña o con un
  segundo tap en mobile. La almendra no se cierra: se deshace en el ojo coral
  que ya está debajo entre 0 y 140 ms; hay un micro-hold de ~80 ms y el vuelo
  arranca a los 220 ms. El texto entra desde los 580 ms, línea por línea, con
  50 ms de diferencia. El retorno total dura ~820 ms. El texto del DOM siempre
  vuelve a `opacity: 1`; si hay scroll, se restaura en el mismo frame en que
  empieza la salida.
- **Re-armado.** Sólo saliendo y volviendo a entrar al subtítulo. El primer
  despertar no se repite por carga. En mobile el sueño también se ve: llega a
  los ~7,4 s y devuelve a los ~8,5 s; el auto-retorno de seguridad es a los
  ~9 s, el texto empieza a volver cerca de 9,1 s y termina cerca de 9,3 s. El
  tap devuelve antes.
- **Accesibilidad.** El canvas es `aria-hidden`; el texto sigue en el DOM; el
  aro custom se oculta sobre el subtítulo y el cursor nativo (flecha) es el que
  los ojos miran. `prefers-reduced-motion` no monta el efecto; el CSS también
  oculta `.hero-eyes`.

## Interacción

La interacción principal es el subtítulo: objeto-céntrica, sin un efecto global
de cursor. El humo y las esporas quedan ambientales; el aro custom sigue
existiendo para el resto del sitio, pero sobre el subtítulo se oculta y el
cursor nativo es el que los ojos leen.

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

Antes de que el zoom empiece, `heroSubtitleEyes.js` escucha el scroll: si el
subtítulo está despierto, lo deshace y restaura el texto en el mismo frame
(`cancelInstant`). El canvas de los ojos queda limpio y el `SplitText` de los
`h4` sigue su curso.

## Rendimiento y fallbacks

- Media resolución: escala 0.5 en desktop y 0.38 en mobile (el humo es de baja
  frecuencia, no se nota). El loop se pausa con `IntersectionObserver` cuando el
  hero sale de pantalla.
- **Ojos del subtítulo**: 800/520 brasas sólo durante el pliegue y el retorno;
  el ojo despierto es una almendra sólida en un canvas offscreen del tamaño del
  bloque (no del viewport), DPR ≤ 2, sprites pre-renderizados y loop apagado en
  reposo. El muestreo del texto corre una vez por build (carga y resize), no por
  frame.
- **Reduced motion**: sin relámpagos ni bucle; se dibuja un solo frame estático
  (verificado: `reduce = true`, sin errores).
- **Sin WebGL**: el canvas queda vacío y se ve el degradado de respaldo de
  `.hero-pin`.

## Estructura del hero (CSS)

`.hero-pin` es `position: relative` y reserva la altura del titular con
`padding-block-start: 50dvh` (el padding no colapsa como sí haría un margen con
`overflow: clip`). `#webgl` es `position: absolute; inset: 0`, así cubre toda la
sección sin empujar el layout; el titular queda por encima con `z-index: 1`.

`.hero-subtitle` es un bloque `width: fit-content` alineado a la derecha;
contiene los dos `h4` y el canvas `.hero-eyes` (`position: absolute`,
`pointer-events: none`). El canvas se mide contra ese bloque y no contra el
hero, así el presupuesto de píxeles queda chico.

## Archivos

- `src/js/heroSmoke.js`: humo (shader) y relámpagos.
- `src/js/heroSpores.js`: esporas en canvas 2D, con parallax y salida hacia la D.
- `src/js/heroSubtitleEyes.js`: el subtítulo que se pliega en ojos; brasas coral
  y almendra sólida.
- `src/js/eyeRender.js`: renderer compartido de la almendra del finale.
- `src/js/eyeEmotions.js`: emociones compartidas con `processEyes.js`.
- `src/js/gl.js`: helpers y ruido compartidos.
- `src/js/textAnimate.js`: instancia el humo y las esporas (`heroFx`, `heroSporesFx`),
  llama `start()` a los dos al terminar el titular y expone `whenIntroDone`.
- `src/js/hero-zoom-transition.js`: tweenea `exitProgress` en la salida.
- `index.html`: el wrapper `.hero-subtitle` alrededor de los dos `h4`.
- `src/index.js`: inicializa los ojos después de la intro, junto al cursor.
- `src/js/cursor.js`: oculta el aro custom sobre `.hero-subtitle`.
- `src/style.css`: `.hero-pin`, `#webgl`, `.hero-spores`, `.hero-subtitle` y
  `.hero-eyes`.
- `src/js/waves.js`: eliminado.

## Pendiente

- Compartir un solo contexto WebGL entre el hero y el finale (hoy hay seis
  canvas en la página: humo, esporas y ojos del hero; humo, velo y ojos del
  finale).
- Medir FPS en un dispositivo real, sobre todo mobile, con las esporas y los
  ojos.
- Validar el tap de los ojos en un teléfono real: tamaño del target, selección
  de texto y retorno automático.
- Validar la magnitud del destello contra la pauta WCAG si se sube la intensidad.
- Comparar en movimiento la nube del hero contra la sección de los ojos. Si hace
  falta, subir/bajar la amplitud macro (`0.5`) o el ambiente (`0.55`).
- El portal D interactivo (más allá de la absorción de la salida) quedó para otra
  iteración.
