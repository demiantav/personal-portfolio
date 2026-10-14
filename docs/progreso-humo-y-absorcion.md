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
| E | Secuencia del finale: centrado por scroll, anillo por tiempo, absorción por scroll con brillo de los ojos | Implementada. Pendiente de prueba del usuario en movimiento |
| D | Fin sin cortina: fade del velo y del humo, pie en tiempo | Implementada. Pendiente de prueba del usuario |
| F | Aro que revela el pie: velo con agujero, entrada del footer por distancia | Implementada. Pendiente de prueba con scroll real |

Orden acordado: se avanza por fase y el usuario prueba cada una antes de seguir.

## Decisiones cerradas

- **Ojos:** siguen siendo rojo puro, en su propio canvas 2D, sin pupila.
- **Tapas:** transparentes. Se borra el rojo con `destination-out`, así el párpado cerrado deja ver el humo.
- **Humo del título:** arranca con la apertura de los ojos (bloom), no antes.
- **Humo:** sólo de fondo. Se eliminaron el cono de luz y los god rays. Se mantiene el halo que sale de los ojos.
- **Cards:** pin de 1.25 vh por carta en desktop y 1.0 vh en mobile. Separación lateral alternada. Blur sólo en las no activas.
- **Cards 3D:** escenario con `perspective` y `preserve-3d`. Mobile también es 3D, con profundidad y rotación reducidas.
- **Ojos en reposo:** centro en 0.30H durante cards y finale.
- **Finale:** pin de 1.5 vh, con esta secuencia (ver Fase E):
  1. Centrado de los ojos por scroll (0 a 0.15 del finale). Se ven moverse del 0.30H al centro.
  2. Anillo disparado por tiempo fijo (1.6 s) al quedar centrados. Se invierte si el usuario sube antes de que termine.
  3. Absorción por scroll, desde donde esté el scroll al terminar el anillo, hasta 0.9. Un frente de succión se contrae hacia el ojo y no queda humo al final.
  4. Entre 0.9 y 1 los párpados cierran por scroll. Se emite `eyesClosed` al pasar 0.95.
- **Brillo sólo en el halo:** el cuerpo del ojo sigue rojo puro. El halo es luz pura, sin la textura del humo, y crece con la absorción.
- **Salida al footer:** sin cortina. Al cerrar los ojos, el velo y el humo se desvanecen y el pie entra con su coreografía en tiempo. Si los ojos se reabren, todo se revierte.

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

## Fase C3: frente radial con anillo (implementada)

Motivo: en C2 el humo giraba como espejo alrededor del ojo y no se consumía. Con `drain` y el retardo por dirección, el humo seguía denso hasta casi el final, y el `hole` alrededor del ojo se leía como una sombra.

Cambios en `progressFog.js` (shader):

- **Frente radial:** `frontR = 1.3 · smoothstep(0.15, 0.85, absorb)`. Todo el humo dentro de `frontR` (con borde ruidoso de ±0.08) se borra con `eaten`.
- **Tirón en el borde:** `pull = 1 + 1.6 · smoothstep(0.15, 0.85, absorb) · gauss(rEye − frontR, 0.25)`. El humo junto al frente muestrea de más lejos, así parece que cae hacia el ojo.
- **Anillo brillante:** `rim` es una gaussiana angosta (ancho 0.035) en el frente. Se pinta con el color caliente y sube la densidad. Visto por el usuario: gusta, se mantiene.
- **Fundido global:** `left = 1 − smoothstep(0.6, 0.85, absorb)`.
- **Halo del ojo:** se apaga entre 0.85 y 1.
- **Eliminados:** `drain`, `hole`, `absorbDelay`, `twist` y `stretch`.

Cambios en `processEyes.js`:

- `CLOSE_AT` pasa de 0.97 a 0.95.
- `closeAmt = smoothstep(0.85, 0.95, absorb)`, así los párpados cierran después de que el humo se apagó.

Verificación:

- `npm run build` sin errores.
- Visto por el usuario: el anillo brillante se ve bien. Al hacer scroll se ve una sombra radial que crece desde el ojo y, al cerrarse, el humo se apaga y entra el footer.
- No verificado con capturas en serie. El tirón del humo hacia el ojo no se percibe como movimiento.

Estado: la animación de absorción todavía no se lee como humo que se succiona hacia los ojos. Lo que se ve es el anillo y el fundido, no el recorrido del humo.

## Fase E: secuencia del finale y absorción (implementada)

Motivo: el anillo y la absorción iban atados al mismo scroll, y el anillo se leía como máscara. Ahora el anillo es un momento que se reproduce solo y la absorción es lo que el usuario controla, con los ojos reaccionando al esfuerzo.

Estado compartido (`progressState.js`): `center`, `ring`, `absorb`, `close`, `inhale`.

Cambios en `progressCards3D.js`:

- `ABSORB_VH = 1.5`. El finale ocupa 1.5 vh después de las cards.
- `center = ease(f / 0.15)`: los ojos se desplazan al centro por scroll.
- `ring`: `gsap.to({}, { duration: 1.6, paused: true })`. Se hace `play()` cuando `f ≥ 0.15` y `reverse()` cuando baja.
- `absorb = (f − absorbFrom) / (0.9 − absorbFrom)`, sólo cuando el anillo terminó. `absorbFrom` es `max(0.15, f)` al terminar el anillo, así no hay zona muerta ni salto.
- `close = clamp((f − 0.9) / 0.1)`.
- `inhale`: 3 % con el anillo, +12 % con `absorb²` (el ojo crece al tragar, con ease-in), −12 % con `close`.

Cambios en `progressFog.js` (shader):

- Uniforms `u_ring` (tiempo fijo, mismas fórmulas del anillo aprobado con `RING_R = 1.3`), `u_absorb` (scroll) y `u_close`.
- Frente de succión: `reach = 1.4 · (1 − smoothstep(0, 0.9, absorb))`. Lo que queda fuera del frente se descarta, así que a `absorb = 1` no queda humo. Reemplaza al fundido global.
- El humo gira y se estira hacia el ojo. La deriva hacia arriba se apaga durante la absorción.
- Calor en el borde del frente y hilos de luz radiales que caen hacia el ojo.
- Halo: crece con el anillo y la absorción, es luz pura (sin la textura del humo) y se apaga con `close`.
- El velo y el canvas hacen fade al recibir `eyesClosed` y vuelven con `eyesOpened`.

Cambios en `processEyes.js`:

- El centro de reposo pasa de 0.30H a H/2 según `center`.
- Los párpados cierran según `close`.
- Latido mientras absorbe: amplitud 1.2 % del radio, más rápido cuanto más humo queda, apagado al cerrar.
- `integrate` usa subpasos de 1/120 s. A frames lentos (dt > 1/60) el resorte de la mirada divergía a `NaN` y los ojos salían desplazados.

Cambios en `footer-reveal.js` (fase D): se quitó `liftCurtain` y el plugin `ScrollToPlugin`. El pie entra en tiempo al recibir `eyesClosed`.

Verificación (Chrome headless, `npm run build` sin errores, sin errores de consola):

- El canvas del humo compila y linkea.
- Centrado, anillo (1.6 s), absorción por scroll y cierre llegan a su valor esperado.
- Con scroll lento, la absorción se ve: el humo se contrae hacia el ojo con hilos de luz, el ojo crece y el halo se enciende.
- Al final el humo desaparece y el pie entra sin cortina.
- No verificado: fluidez en movimiento real en mobile y dispositivos lentos. Scroll brusco dispara el enojo (comportamiento existente).

Pendiente de esta fase:

- Revisar la fluidez con scroll real en desktop y mobile.
- Ajustar el tamaño del ojo (+12 %), el brillo y el latido según la prueba.
- Revisar la reversibilidad completa: subir desde el pie y desde la absorción.

## Fase D: fin sin cortina (implementada)

- Se quitó `liftCurtain` y el scrub del reveal en `footer-reveal.js`.
- Con `eyesClosed`: el velo y el canvas del humo hacen fade a 0 en unos 0.2 s (exponencial) y la escena del pie corre en tiempo.
- Con `eyesOpened`: se revierte la escena del pie y el humo vuelve.
- Pendiente: revisar `footerRevealSettled`, que lo usa `footerTitleMagnet.js`, con scroll real.

## Ajustes de absorción (sesión posterior a la fase E, sin verificar en movimiento)

Todo lo siguiente se hizo por ajustes sucesivos guiados por la prueba del usuario. Ninguno se verificó con capturas en serie; la validación fue visual con scroll real.

**Humo (`progressFog.js`, shader):**

- **Flujo hacia el ojo:** `inflow = exp(1.1·ab)` multiplica el muestreo de `src`. A diferencia del `fa` anterior, no se satura en 0.6, así que el humo sigue avanzando hacia el ojo durante toda la absorción.
- **Borde del consumo:** `inside = 1 − smoothstep(reach − 0.2, reach + 0.05, rEye)`, más suave que el ±0.05 original.
- **Velocidad del humo:** `t = u_flow · 0.1`. `u_flow` es un acumulador en JS (`flow`) que integra `speed · dt`. Con `t` en reposo el humo se mueve; antes casi no se notaba.
- **Velocidad suavizada (JS):** `speed` se acerca a `1 + 7·ab²` con `1 − exp(−dt·2.5)`. Acelera hacia el final, cuando el humo casi desaparece, y el scroll cambia la velocidad sin saltos.
- **Luces (hilos):** la fase usa `u_light`, un reloj propio que integra la misma `speed`: `log(r)·3 + u_light·0.25`. Ya no depende de la posición del scroll, así que las luces siguen moviéndose hacia el centro aunque el scroll esté quieto.
- **Halo amplio (`lit`):**
  - `u_lag` es `ab` suavizado con `1 − exp(−dt·0.6)`, así que el halo va detrás del humo.
  - `haloK = 1 − smoothstep(0.25, 1.0, u_lag)` controla el radio `glowR = u_view.y·(0.3 + 0.35·rg)·(0.35 + 0.65·haloK)` y el brillo `(0.3 + 0.7·haloK)`.
- **Giro del humo:** `spin = 1.5 · smoothstep(0, 1, ab) / (rEye + 0.15)`. Es la versión que confirmaste. Se intentó sumar un giro continuo (`u_spin`, con compuertas `spinGate` y `spinNear`). Produjo patrones circulares en cada variante y se retiró. Ver pendientes.

**Scroll (`progressCards3D.js`):**

- `ABSORB_VH` pasó de `1.5` a `3`. La absorción completa necesita el doble de scroll. Las cards no cambian porque su recorrido depende de `stepVh`.

**Estado de las luces y del humo:** el término de tiempo del hilo (`u_time · 0.5`) y los términos de absorción de la fase de los hilos fueron reemplazados por `u_light`. La fase de los hilos ya no tiene término de scroll.

## Fase F: aro que revela el pie (implementada)

Secuencia del finale completo:

1. La absorción llega a 1 (scroll, `absorb`). Los ojos cierran por scroll entre 0.9 y 1.
2. Al cerrarse (`eyesClosed`, `close ≥ 0.95`), `revealTween` arranca solo: 1.6 s (`REVEAL_S`) de tiempo fijo. Si el usuario sube, `eyesOpened` lo revierte.
3. El aro se escribe en `progressState.reveal` (0 a 1) y su radio es `reveal · revealMax`.

Cambios por archivo:

- **`progressCards3D.js`:** `revealTween` y listeners de `eyesClosed`/`eyesOpened`. Escribe `progressState.reveal`.
- **`progressState.js`:** campos `reveal`, `revealMax`, `revealX`, `revealY`.
- **`progressFog.js`:** el velo es un **segundo canvas WebGL** (`.progress-veil`, `z-index: 1`), debajo del humo (`z-index: 2`). Así el contenido de las secciones (`z-index: 1`) queda encima del velo.
  - Shader del velo: borde ruidoso (fbm, ±90 px), transición de 60 px, resplandor rojo que sólo tiñe el velo.
  - `REVEAL_MARGIN = 210`: el radio llega más allá de la esquina más lejana, así a 1 el velo desaparece del todo.
  - El origen del aro se **congela** al empezar el aro (`revealX/Y`); los ojos siguen moviéndose con su resorte y eso cambiaba la distancia de los elementos del footer.
  - **Mientras corre el aro, el velo ocupa toda la pantalla** (`updateVeilStage`): así el scroll no sube el borde del velo y el pie no aparece por dos vías.
  - **Residuo del humo:** `u_gone` apaga el humo y el halo entre `absorb` 0.85 y 0.95, y durante el aro. Sin esto quedaba un punto de humo centrado sobre el footer.
- **`footer-reveal.js`:** cada elemento (línea, CTA, meta, bloque inferior, reloj, nav, título) tiene su propia animación de duración fija. Arranca cuando el radio del aro alcanza su distancia al origen congelado y se revierte al retroceder. No hay scrub. El `wrapper` ya no se mueve: su `yPercent` causaba el "scroll hacia arriba" durante el aro. Las máscaras del título se liberan y se dispara `footerRevealSettled` al llegar el aro a 1.

Verificación hecha:

- Build sin errores. Los shaders del humo y del velo compilan en Chrome headless.
- Prueba con el aro simulado (valores de `reveal` fijados desde la página, origen en el centro): cada elemento arranca cuando el aro lo alcanza, termina su animación completa y queda quieto con el aro en 1; al retroceder se revierte.
- **No verificado:** el scroll real del finale. En el harness, el pin no se activaba con `scrollTo` y el estado de progreso quedaba en 0.

Notas de la sesión de prueba:

- El harness con Chrome headless (CDP por WebSocket) necesita esperar a que la página esté lista antes de medir. El render por software de WebGL es lento y bloquea `Runtime.evaluate` si se hacen muchos scrolls seguidos.
- No dejar hooks de depuración en `window` al terminar (se usó `window.__progressState` temporalmente y se quitó).

## Pendientes y deuda técnica

- [ ] Fase F: probar el finale con scroll real (subir y bajar) y confirmar que el velo, el aro y la entrada del footer se ven como se espera.
- [ ] Fase F: los elementos lejanos al ojo empiezan más tarde y pueden terminar después de que el aro llega a 1 (se ve como "acomodo" final). Opciones: acortar la duración de los elementos lejanos o escalar la duración para que terminen con el aro.
- [ ] Fase F: bloquear el scroll mientras corre el aro si el movimiento de scroll sigue afectando la lectura. Hoy no está bloqueado.
- [ ] Fase F: mobile. El agujero tiene que cubrir la pantalla completa y el borde no debe verse cortado.
- [ ] Fase F: fallback sin WebGL. Hoy sin WebGL no hay velo ni humo, igual que antes del aro.

- [ ] Probar la fase A y confirmar la costura entre título y cards con el humo fijo.
- [ ] Probar la fase B: composición de ojos y cards en escritorio y mobile.
- [ ] Mobile: los ojos miden 12–30 px de alto. Revisar el tamaño de los ojos en pantallas angostas (hoy sale de `min(0.055W, 0.085H)`).
- [ ] Ojos por encima de Skills al scrollear hacia atrás. Los ojos están en `z-index: 4` y Skills en 3. Revisar después de la fase D.
- [ ] Borde rojo fino alrededor del almendro al estar casi cerrado. Verificar si sigue apareciendo con tapas transparentes.
- [ ] Densidad del humo del título, que se ve más tenue que en las cards.
- [x] Fase C3 / E: el scroll mueve el humo hacia los ojos y los ojos lo absorben (frente de succión, hilos de luz, sumidero). Resuelto en la fase E, pendiente de prueba con scroll real.
- [x] Fase E: el inhale del ojo ahora llega a +12 % al absorber y −12 % al cerrar.
- [ ] Fase E: verificar en capturas en serie en mobile.
- [x] Fase E: el halo se apaga con `close` y no sobrevive al cierre.
- [ ] Mobile: medir frames por segundo en un dispositivo real. Si hace falta, bajar octavas del fbm base o del warp.
- [ ] Mobile: ojos en reposo, que no pisen el título.
- [ ] Fallbacks: sin WebGL y `prefers-reduced-motion` todavía no tienen una capa estática de respaldo.
- [ ] Reversibilidad completa (subir y bajar desde el pie y desde la absorción).
- [x] Transición de las cards al footer después de la fase D: capturas de la salida (verificada en Chrome headless).
- [ ] Rotación continua del humo: sigue sin resolverse. Las variantes con término de tiempo (`u_spin`) producen patrones circulares. La hipótesis es que el giro diferencial (velocidad que depende del radio) genera anillos concéntricos; las variantes con giro rígido alrededor del ojo también se vieron circulares. Hace falta una captura o video del momento en que aparecen los círculos antes de volver a intentarlo.
- [ ] Verificar con scroll real: velocidad del humo y de los hilos (`speed`, `u_light`), retraso del halo (`lag` 0.6, `haloK` 0.25–1.0) y duración de la absorción con `ABSORB_VH = 3`.
- [ ] Commits: separar por etapa (cards 3D, humo y luz, tapas transparentes, fix del loop, humo fijo, ojos y cards, absorción por sector e inhale (C2), fin sin cortina).

## Ya resuelto

- Loop de los ojos: se pausa al pasar la sección (0 frames en 2 s, verificado).
- Separación alternada de las cards, con beat y mood por carta.
- Eliminado `horizontalAnimation.js`; los comentarios que lo mencionaban se actualizaron.

## Archivos a leer para retomar

Leer sólo lo que haga falta para la tarea:

- `docs/progreso-humo-y-absorcion.md`: este documento. Siempre.
- `src/js/progressFog.js`: humo, velo y absorción (shader). Para cualquier cambio de humo o de finale.
- `src/js/progressState.js`: estado compartido (`p`, `active`, `absorb`, `inhale`, `eyes`, `eyeX`, `eyeY`, `reveal`, `revealMax`, `revealX`, `revealY`).
- `src/js/footer-reveal.js`: entrada del footer por distancia al aro (fase F).
- `src/js/progressCards3D.js`: pin de las cards, `paint` (calcula `p`, `absorb` e `inhale`) y escena 3D.
- `src/js/processEyes.js`: ojos y tapas. Para cambios de ojos, leer `render` (radio `R` con `inhale`, cierre con `eyesClosed`). No hace falta leer el resto.
- `src/js/footer-reveal.js`: sólo para la fase D.
- `src/style.css`: sólo para humo, velo, `body.progress-stage` y cards. Buscar por esos selectores en vez de leerlo completo.
- `src/index.js`: orden de montaje. Leer sólo si se agrega un módulo nuevo.
