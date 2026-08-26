# Fix: animaciones de meta (Torino/hora) invisibles por disparo prematuro

## Diagnóstico

Las ráfagas de Torino/hora SÍ corren, pero terminan antes de que esos píxeles
sean visibles. El wrapper del footer es `100dvh` con `space-around` y la meta es
el primer hijo → vive cerca del techo del footer. El reveal descubre el footer
de abajo hacia arriba (el lienzo de progreso sale hacia arriba): un elemento a
distancia `d` del borde inferior recién emerge cuando el progreso ≈ `d/H`
(~85-95% para la meta). Sus slots hardcodeados (`0.5`) disparan la ráfaga
(~0.8s) mucho antes → texto estático al verse. Línea (`0.12`) y botón (`0.28`)
sufren lo mismo en menor grado.

## Cambio — solo `src/js/footer-reveal.js`

1. Helper `slotFor(el)`: mide con `getBoundingClientRect()` la distancia del
   elemento al borde inferior del footer normalizada por su alto, con
   anticipación `LEAD = 0.03` (la ráfaga arranca al asomar los primeros
   píxeles) y clamp `[0.02, 0.92]`. El rect del footer fijo siempre es
   verídico (inmune a la corrupción de medidas del preloader).
2. `shots` pasa de `{ slot, tween }` a `{ el, tween, done }`; el slot se
   resuelve con memoización perezosa (`shot.slot ??= slotFor(shot.el)`) dentro
   del `onUpdate` existente → un resize previo al disparo usa geometría fresca.
3. Elementos a medir: línea, `<a>` del botón, `<p>` de Torino, `<p class="time">`
   contenedor de las unidades enmascaradas (`timeUnits[0].closest('p')`).
4. Actualizar comentario del bloque de shots (slots ya no son literales).

Sin cambios en HTML/CSS.

## Verificación (Playwright headless)

1. **Mid-flight** (lo que faltaba): scrolleo incremental por la ventana; en
   cuanto la meta es visible (`metaTop >= progressRect.bottom`) los caracteres
   deben tener Y ≠ 0 variando entre frames.
2. Asentado al fondo: todas las Y en 0, línea scaleX 1 (regresión).
3. Una sola vez: re-cruce no reinicia.
4. Reloj vivo con máscaras intactas; sin errores de consola.
