# Sección de proceso: humo, ojos, cards y finale

Plan y estado de la sección de proceso (título → cards → absorción → footer).
Todo está en el working tree, sin commits.

## Estado por fase

| Fase | Descripción | Estado |
|---|---|---|
| A | Humo fijo en el viewport, velo y pie | Implementada. Pendiente de prueba del usuario |
| B | Ojos en reposo a 0.30H y cards más chicas y más abajo | Implementada. Pendiente de prueba del usuario |
| C | Absorción con dos brazos | Reemplazada por C2 (histórico) |
| C2 | Absorción por sector, estiramiento radial e inhale del ojo | Reemplazada por C3 (histórico) |
| C3 | Absorción por frente radial con anillo brillante | Implementada. Anillo aprobado. Falta que la animación se lea como absorción (ver pendientes) |
| D | Fin sin cortina: fade de las secciones y pie en tiempo | Pendiente |

Orden acordado: se avanza por fase y el usuario prueba cada una antes de seguir.

## Decisiones cerradas

- **Ojos:** siguen siendo rojo puro, en su propio canvas 2D, sin pupila.
- **Tapas:** transparentes. Se borra el rojo con `destination-out`, así el párpado cerrado deja ver el humo.
- **Humo del título:** arranca con la apertura de los ojos (bloom), no antes.
- **Humo:** sólo de fondo. Se eliminaron el cono de luz y los god rays. Se mantiene el halo que sale de los ojos.
- **Cards:** pin de 1.25 vh por carta en desktop y 1.0 vh en mobile. Separación lateral alternada. Blur sólo en las no activas.
- **Cards 3D:** escenario con `perspective` y `preserve-3d`. Mobile también es 3D, con profundidad y rotación reducidas.
- **Ojos en reposo:** centro en 0.30H durante cards y finale.
- **Finale:** ritmo contemplativo, de aproximadamente 1 viewport. Absorción por frente radial con anillo brillante (C3).
  - 0 a 0.15: anticipación. El humo se aleja un instante del ojo y el ojo se abre un 3 %.
  - 0.15 a 0.85: un frente radial crece desde el ojo (0 a 1.3 alturas de viewport). Dentro del frente no queda humo. En el borde, el humo se tira hacia el ojo y se enciende en un anillo.
  - 0.6 a 0.85: fundido global del humo restante.
  - 0.85 a 1: el halo del ojo se apaga. El ojo se estrecha un 2 %.
  - Los párpados cierran entre 0.85 y 0.95 y se emite `eyesClosed` en 0.95.
- **Salida al footer:** sin cortina. Al cerrar los ojos, las secciones con humo hacen fade y el pie entra con su coreografía en tiempo. Si los ojos se reabren, todo se revierte.

## Fase A: humo fijo (implementada)

- `progressFog.js` monta un único canvas `position: fixed` en el body. El campo de ruido se muestrea en coordenadas de viewport, sin `u_scroll`. El scroll sólo controla la intensidad.
- Media resolución (0.5 del CSS).
- Velo `.progress-veil`: fondo fijo del color de la sección, desde el top hasta el borde inferior de la sección de cards. Tapa el pie como antes.
- Canvas y velo se recortan con el mismo borde (`clip-path` y `height`), así el humo nunca pinta sobre el pie.
- `body.progress-stage` pone transparente el fondo de `.progress-title-section` y `.main__progress-section`.
- `titleFog()` se eliminó: hay un solo humo.

Archivos: `src/js/progressFog.js`, `src/index.js`, `src/style.css`.

Verificación hecha: título a pin 100% con humo y párpados transparentes, cards con humo fijo, salida con el pie limpio, sin errores de consola.

## Fase B: ojos y cards (implementada)

Cambios:

- **Ojos:** `EYE_TOP = 0.30`. Quedan en reposo durante cards y finale. Se quitó la interpolación hacia el centro del finale.
- **Cards** (`style.css`, bloque `.progress-section--3d .progress__card`):
  - Alto `min(38dvh, 360px)` con proporción 5:7. El ancho sale del alto.
  - Centro vertical en 66% (`top: 66%`).
  - Contenido escalado con unidades de contenedor (`cqh`), con `container-type: size`.
  - Mobile (≤48rem): ancho 62vw, alto automático.
- **Profundidad** (`progressCards3D.js`): `nearZ` pasa de 500 a 220.
- **Offset vertical** alternado: ±0.015H.

Verificación (medida en el navegador, pasos del pin):

- Escritorio 1440×900: ojos entre 0.22H y 0.35H, sin recorte. La carta más alta queda unos 70 px debajo del borde inferior de los ojos.
- Mobile 390×844: ojos en ~0.28H, cards debajo de ellos.
- Sin errores de consola.

Pendiente de esta fase: en mobile el ojo mide sólo 12–30 px de alto porque el tamaño sale de `min(0.055W, 0.085H)`. Ver pendientes.

## Ajustes posteriores a la fase B (implementados)

- **Cards:** vuelven al layout original (430 px, 560 px desde 970 px). Se quitaron los overrides en `cqh` y `min(38dvh, 360px)`. Escala base `min(1, H·0.48 / alto)`.
  - Entrada: surgen desde el fondo (`z = −2200`), chicas (0.4×), desde abajo, rotadas en X e Y, y suben mientras crecen hasta asentarse de frente.
  - Salida: suben por arriba de la pantalla, rotan y se desvanecen al final.
  - Cada carta tiene su tramo de scroll y se solapan.
  - Offset vertical sólo hacia abajo (lejos de los ojos). Centro en 64%.
- **Humo:** la base sube desde el borde inferior, con la fuente más densa junto al pie. Capa de contrapeso que cae en la franja superior (35%).
- **Temblor de enojo:** ruido a ritmo 5 con amplitud 0.009 rad, multiplicado por la envolvente. Reemplaza al senoidal de 22 Hz.

Verificación: capturas en 6 pasos del pin. Sin errores de consola.

Pendiente de esta parte: mobile de las cards con la nueva escala.

## Fase C: absorción con dos brazos (reemplazada por C2)

Histórico. Usaba un trace-back de hasta 10 pasos y una espiral de dos brazos. Se retiró en C2 porque el resultado era un remolino que se apagaba en lugar de absorberse. Ya no existe en el código.


## Fase C2: absorción por sector, estiramiento e inhale (implementada)

Motivo: la fase C se veía como un remolino que se apagaba. El fundido global (`gone`) apagaba todo el humo y el giro tangencial competía con la succión cerca del ojo. Verificar con capturas fijas no alcanzaba para detectarlo.

Cambios en `progressFog.js`:

- Se quitan `traceBack`, `spiralArms`, el uniform `u_steps` y `compact`. El costo de la absorción ya no depende de pasos iterativos.
- **Mapeo de fuente:** cada píxel muestrea el humo que viene de más lejos. `zoom = 1 + 1.5·qe + antic`, con `qe = qa^1.6`.
- **Giro:** la fuente gira `1.1·qe` radianes, así que los brazos salen del propio mapeo.
- **Estirado radial:** `stretch = 1 + 1.5·qe·near`. El radio se divide por `stretch`, con lo que los rasgos se alargan hacia el ojo sin muestras de ruido extra.
- **Retardo por sector (stagger):** `qa = clamp((absorb − 0.15 − delay(θ)) / 0.45)`, con `delay(θ) ∈ [0, 0.4]` tomado de ruido continuo sobre el ángulo. Cada dirección empieza y termina su succión en su momento, sin costuras.
- **Sumidero:** `drain` consume primero el humo cercano al ojo (`front` 0.4 cerca, 1.0 lejos). Se quita el fundido global.
- En reposo (`absorb = 0`) el mapeo es la identidad, así que el humo no cambia fuera del finale.

Cambios en `progressState.js`, `progressCards3D.js` y `processEyes.js`:

- `progressState.inhale`: +3 % entre 0 y 0.15, vuelve a 0 en 0.3, −2 % entre 0.85 y 1. Se calcula en `paint` con los mismos tiempos de la anticipación del shader.
- `processEyes.js`: `R = min(W·0.055, H·0.085) · (1 + inhale)`. Escala el ojo entero y el `gap` entre ojos.

Desviación respecto al plan: el retardo es por dirección angular y no por puff individual. Con ruido continuo no hay costuras entre celdas y el costo es mínimo.

Verificación:

- `npm run build` sin errores.
- Chrome headless con CDP: el canvas `.progress-fog` existe (el shader compila y linkea), `eyesClosed` se dispara una vez, sin errores de consola (los `SplitText called before fonts loaded` son previos).
- Capturas en desktop (0.5 a 1) y mobile (0.5 a 1). Se ven el humo concentrado en el ojo, los estirados radiales y el sumidero.
- No verificado: la fluidez real y el inhale en movimiento. Las capturas fijas no lo muestran; hay que revisarlo con el scroll.
- La reversibilidad es por construcción (sin estado), pero no se comparó con capturas.

Pendiente de esta fase: revisar la fluidez con el scroll real y ajustar `1.5` (zoom), `1.1` (giro) y `0.4` (retardo) si hace falta.

## Fase D: fin sin cortina (pendiente)

- Eliminar `liftCurtain` y el scrub del reveal en `footer-reveal.js`.
- Al disparar `eyesClosed`: fade a 0 de `.progress-veil` y del canvas en unos 0.6 s. La escena del pie corre en tiempo.
- Al disparar `eyesOpened`: se revierte la escena del pie y el humo vuelve.
- Revisar `footerRevealSettled`, que lo usa `footerTitleMagnet.js`.
- Verificación: subir y bajar para comprobar la reversibilidad, y revisar que el pie quede completo.

## Pendientes y deuda técnica

- [ ] Probar la fase A y confirmar la costura entre título y cards con el humo fijo.
- [ ] Probar la fase B: composición de ojos y cards en escritorio y mobile.
- [ ] Mobile: los ojos miden 12–30 px de alto. Revisar el tamaño de los ojos en pantallas angostas (hoy sale de `min(0.055W, 0.085H)`).
- [ ] Ojos por encima de Skills al scrollear hacia atrás. Los ojos están en `z-index: 4` y Skills en 3. Revisar después de la fase D.
- [ ] Borde rojo fino alrededor del almendro al estar casi cerrado. Verificar si sigue apareciendo con tapas transparentes.
- [ ] Densidad del humo del título, que se ve más tenue que en las cards.
- [ ] Fase C2: revisar la fluidez de la absorción y del inhale con el scroll real. Si hace falta, ajustar zoom (`1.5`), giro (`1.1`) y retardo (`0.4`).
- [ ] Mobile: medir frames por segundo en un dispositivo real. Si hace falta, bajar octavas del fbm base o del warp.
- [ ] Mobile: ojos en reposo, que no pisen el título.
- [ ] Fallbacks: sin WebGL y `prefers-reduced-motion` todavía no tienen una capa estática de respaldo.
- [ ] Reversibilidad completa (subir y bajar desde el pie y desde la absorción).
- [ ] Transición de las cards al footer después de la fase D: capturas de la salida.
- [ ] Commits: separar por etapa (cards 3D, humo y luz, tapas transparentes, fix del loop, humo fijo, ojos y cards, absorción por sector e inhale (C2), fin sin cortina).

## Ya resuelto

- Loop de los ojos: se pausa al pasar la sección (0 frames en 2 s, verificado).
- Separación alternada de las cards, con beat y mood por carta.
- Eliminado `horizontalAnimation.js`; los comentarios que lo mencionaban se actualizaron.

## Archivos a leer para retomar

Leer sólo lo que haga falta para la tarea:

- `docs/progreso-humo-y-absorcion.md`: este documento. Siempre.
- `src/js/progressFog.js`: humo, velo y absorción (shader). Para cualquier cambio de humo o de finale.
- `src/js/progressState.js`: estado compartido (`p`, `active`, `absorb`, `inhale`, `eyes`, `eyeX`, `eyeY`).
- `src/js/progressCards3D.js`: pin de las cards, `paint` (calcula `p`, `absorb` e `inhale`) y escena 3D.
- `src/js/processEyes.js`: ojos y tapas. Para cambios de ojos, leer `render` (radio `R` con `inhale`, cierre con `eyesClosed`). No hace falta leer el resto.
- `src/js/footer-reveal.js`: sólo para la fase D.
- `src/style.css`: sólo para humo, velo, `body.progress-stage` y cards. Buscar por esos selectores en vez de leerlo completo.
- `src/index.js`: orden de montaje. Leer sólo si se agrega un módulo nuevo.
