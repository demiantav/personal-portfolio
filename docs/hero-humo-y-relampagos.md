# Hero: humo, relámpagos y los ojos del subtítulo

Reemplazo de las líneas 2D del hero (`waves.js`) por humo WebGL con relámpagos
rojos aleatorios, en la dirección visual de Stranger Things. El humo iluminado
usa el mismo lenguaje que el finale de la sección de proceso, así el hero y el
cierre comparten técnica.

La interacción principal del hero es otra: el subtítulo se despierta y se pliega
en dos ojos de brasas que miran al cursor. El humo y las esporas quedan de fondo.

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
  pegado al bloque, partículas muestreadas del texto real, párpados con resortes
  y mirada al cursor.
- **`src/js/eyeEmotions.js`**: tabla compartida de emociones (neutral, enojo,
  pícara, sueño, parpadeo) entre los ojos del hero y los del finale.

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
despierta, se pliega en dos ojos de brasas y mira al cursor. Al salir (o a los
6 s de inactividad) los ojos se cierran, las brasas vuelven a sus glifos y el
texto reaparece. En mobile el disparador es un tap; en `prefers-reduced-motion`
no existe.

### Rig de partículas

- **Sin tocar el DOM.** El texto no se splitea para el efecto: se renderiza con
  la fuente computada en un canvas offscreen y se muestrean los píxeles opacos.
  El `SplitText` de la salida (`hero-zoom-transition.js`) queda intacto y el
  subtítulo sigue siendo texto real para lectores de pantalla.
- **Presupuesto.** 800 brasas en desktop y 520 en mobile, en un canvas 2D que
  cubre sólo el bloque del subtítulo + 30 px de aire por lado. DPR máximo 2.
  Sprites radiales pre-renderizados y `globalCompositeOperation = 'lighter'`;
  el loop se apaga en reposo. Todos los sprites son rojo puro, sin núcleos
  blancos: la suma aditiva nunca puede virar a blanco.
- **El pliegue.** La línea de arriba se convierte en los párpados superiores y
  la de abajo en los inferiores. La banda central de cada mitad no se condensa
  en una pupila: se dispersa por el cuerpo de la almendra. Los extremos del
  texto, en las comisuras. Las partículas se reparten por rango de píxeles (no
  por punto medio geométrico) para que los dos ojos tengan la misma densidad
  aunque el subtítulo esté alineado a la derecha.
- **La almendra.** Cada ojo usa la proporción y el `TILT` del finale, con una
  curva asimétrica tipo cat-eye; el párpado superior y el inferior comparten el
  mismo parámetro `t` (comisura interna 0 → externa 1), así el cierre y la media
  luna funcionan con una sola pose. El cuerpo se reparte entre las dos tapas y
  se apaga con la abertura real del ojo: sin máscara, al cerrar no quedan brasas
  rojas flotando sobre el párpado.
- **Sin pupila.** El ojo es rojo puro y no tiene centro brillante. La mirada la
  hace el cuerpo completo, como el ojo del finale, con resortes, microsacádicas
  y la inclinación de las tapas.
- **Vuelo.** Las brasas salen del glifo con un bezier de dos tramos (levantan y
  se abren antes de entrar al ojo). El ojo derecho llega ~40 ms más tarde, como
  en el finale.

### Coreografía

- **Trigger.** Sólo al entrar al subtítulo (con 8 px de tolerancia) o con un tap
  en mobile. Una vez despierto, la mirada sigue al cursor mientras siga dentro
  del bloque de título + 24 px.
- **Despertar.** El ojo nace en rendija (`upPos 0.55`), abre a los ~0.46 s y
  queda abierto. El primer despertar de la carga regala una medialuna pícara a
  los ~1.25 s, una sola vez.
- **Emociones.** Se comparten con el finale vía `eyeEmotions.js`: neutral,
  enojo (swipe rápido), pícara (cursor quieto), sueño (6 s de inactividad) y
  parpadeo. Prioridad: enojo > pícara > sueño > neutral. La mirada usa resortes
  con microsacádicas; el parpadeo y los tiempos salen de la misma tabla.
- **Retorno.** Al salir del bloque de título (260 ms de gracia), a los 6 s de
  inactividad, al scrollear, al redimensionar, al ocultar la pestaña o con un
  segundo tap en mobile. El ojo se cierra en 160 ms; a los 170 ms las brasas
  vuelven a los glifos y el texto entra a los 320 ms. El texto del DOM siempre
  vuelve a `opacity: 1`; si hay scroll, se restaura en el mismo frame en que
  empieza la salida.
- **Re-armado.** Sólo saliendo y volviendo a entrar al subtítulo. El primer
  despertar no se repite por carga. En mobile el sueño también se ve: llega a
  los 6 s y devuelve a los ~6.9 s; el auto-retorno de seguridad es a los 7 s y
  el tap devuelve antes.
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
subtítulo está despierto, cierra los ojos y restaura el texto en el mismo frame
(`cancelInstant`). El canvas de los ojos queda limpio y el `SplitText` de los
`h4` sigue su curso.

## Rendimiento y fallbacks

- Media resolución: escala 0.5 en desktop y 0.38 en mobile (el humo es de baja
  frecuencia, no se nota). El loop se pausa con `IntersectionObserver` cuando el
  hero sale de pantalla.
- **Ojos del subtítulo**: 800/520 brasas en un canvas 2D del tamaño del bloque
  (no del viewport), DPR ≤ 2, sprites pre-renderizados y loop apagado en reposo.
  El muestreo del texto corre una vez por build (carga y resize), no por frame.
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
- `src/js/heroSubtitleEyes.js`: el subtítulo que se pliega en ojos.
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
