# LinkedIn — Hero: el subtítulo que se convierte en ojos + navbar

Post enfocado en la interacción principal del hero: el subtítulo que se pliega
en dos ojos de brasas y mira al cursor. El humo WebGL queda como atmósfera y el
navbar como contrapunto silencioso. La versión corta va sólo a los ojos.

---

## EN — versión principal

```
The detail I keep coming back to in my portfolio is a line of text that turns into eyes.

The subtitle "+5 years of experience / Available worldwide" isn't static. Hover it and the letters break into embers, fold into two small eyes, and the eyes follow your cursor. They blink. Stay still and they squint. Swipe fast and they get annoyed. Wait long enough and they get sleepy, close, and the text comes back.

No video, no 3D model: ~800 Canvas 2D particles sampled from the real text, spring-driven lids, and an emotion table shared with the eyes at the end of the page. The DOM text is never split for the effect, so it stays accessible. On mobile it's a tap. Reduced motion opts out.

Behind it, the hero breathes with WebGL smoke and red lightning. It stays ambient.

The navbar is the quieter counterpoint: two masked copies per letter, a coral roll on hover, a cursor ring that magnetizes to the item you're on, and a View Transition bubble that glides between links.

The best microinteractions are felt before they're understood. Which would you try first — the eyes or the navbar?

Built with Canvas 2D, GSAP, WebGL and the View Transitions API.

#webdevelopment #gsap #frontend #uiux #microinteractions #canvas #webgl #viewtransitions
```

## EN — versión corta

```
A line of text that turns into eyes.

Hover the subtitle and the letters break into embers, fold into two small eyes, and follow your cursor. They blink, squint when you stay, get angry on a fast swipe, get sleepy if you wait, then close and the text returns. Mobile: tap. Reduced motion: no morph. The DOM text stays accessible.

The navbar is the quiet counterpoint: masked letter rolls, a magnetic cursor ring, a View Transition bubble.

Built with Canvas 2D, GSAP and the View Transitions API.

#webdevelopment #gsap #frontend #uiux #canvas #viewtransitions
```

## ES — versión principal

```
El detalle de mi portfolio al que vuelvo una y otra vez es una línea de texto que se convierte en ojos.

El subtítulo "+5 years of experience / Available worldwide" no es estático. Al hover, las letras se deshacen en brasas, se pliegan en dos ojos chiquitos y los ojos siguen al cursor. Parpadean. Si te quedás, entrecierran. Si hacés un swipe rápido, se enojan. Si esperás, se duermen, cierran y el texto vuelve.

Sin video ni modelo 3D: ~800 partículas en Canvas 2D muestreadas del texto real, párpados con resortes y una tabla de emociones compartida con los ojos del finale. El texto del DOM no se parte para el efecto: sigue accesible. En mobile es un tap. Con reduced motion no existe.

Detrás, el hero respira con humo WebGL y relámpagos rojos. Queda de fondo.

El navbar es el contrapunto silencioso: dos copias enmascaradas por letra, roll coral al hover, un aro de cursor que se imanta al ítem donde estás y una burbuja con View Transition que se desliza entre links.

Las mejores microinteracciones se sienten antes de entenderse. ¿Cuál probarías primero, los ojos o el navbar?

Hecho con Canvas 2D, GSAP, WebGL y la View Transitions API.

#webdevelopment #gsap #frontend #uiux #microinteractions #canvas #webgl #viewtransitions
```

## ES — versión corta

```
Una línea de texto que se convierte en ojos.

Al hover, las letras se deshacen en brasas, se pliegan en dos ojos chiquitos y siguen al cursor. Parpadean, entrecierran si te quedás, se enojan con un swipe rápido, se duermen si esperás; después cierran y el texto vuelve. En mobile es un tap. Con reduced motion no hay morph. El texto del DOM sigue accesible.

El navbar es el contrapunto silencioso: letras enmascaradas, aro imán y burbuja con View Transition.

Hecho con Canvas 2D, GSAP y la View Transitions API.

#webdevelopment #gsap #frontend #uiux #canvas #viewtransitions
```

---

## Notas técnicas (por si querés mencionarlas)

- **Hero — ojos del subtítulo:** el texto se muestrea con `fillText` en un canvas offscreen; el DOM no se parte para el efecto. Las partículas se reparten por rango de píxeles para que los dos ojos tengan la misma densidad. La línea de arriba se convierte en el párpado superior, la de abajo en el inferior; la banda central de cada mitad, en el cuerpo de la almendra; los extremos, en las comisuras. Sin pupila y con rojo puro: la misma almendra y el mismo `TILT` que el ojo del finale, pero hecha de brasas.
- **Hero — presupuesto:** 800 brasas en desktop y 520 en mobile; canvas 2D del tamaño del bloque + 30 px; DPR ≤ 2; sprites radiales pre-renderizados en rojo puro (sin núcleos blancos) con `globalCompositeOperation = 'lighter'`; loop apagado en reposo.
- **Hero — emociones:** tabla compartida con `processEyes.js` (`eyeEmotions.js`): neutral, enojo, pícara, sueño y parpadeo. Prioridad enojo > pícara > sueño > neutral. El primer despertar regala una medialuna pícara a los ~1.25 s, una vez por carga; el ojo derecho llega ~40 ms más tarde.
- **Hero — trigger y retorno:** despierta al entrar al subtítulo o con un tap; la mirada sigue al cursor mientras esté en el bloque de título + 24 px. Vuelve al texto al salir (260 ms de gracia), a los 6 s de inactividad, con scroll, resize, pestaña oculta o un segundo tap. En mobile el sueño llega a los 6 s y devuelve a los ~6.9 s; el auto-retorno de seguridad es a los 7 s y el tap devuelve antes. El re-armado exige salir y volver a entrar.
- **Hero — accesibilidad:** el canvas es `aria-hidden`, el texto sigue en el DOM y el aro custom se oculta sobre el subtítulo para que el cursor nativo sea el que los ojos miran. `prefers-reduced-motion` no monta el efecto.
- **Hero — humo:** WebGL, un triángulo que cubre el viewport y un solo draw call. Ruido fbm + domain warping en dos pasos; la rampa `bodyAt` define núcleos y silueta; una capa macro de baja frecuencia rompe la repetición. Queda ambiental.
- **Hero — relámpagos:** intervalo aleatorio de 2.5–6 s; 2 pulsos gaussianos por descarga; la normal falsa compara la densidad con la del vecino hacia el origen. Pauta WCAG 2.3.1.
- **Hero — esporas:** Canvas 2D, sprite radial pre-renderizado + `globalCompositeOperation = 'lighter'`, deriva y parallax; se absorben hacia la D con `exitProgress`.
- **Navbar — letras (roll):** dos capas por letra dentro de una máscara; stagger de **35 ms** por letra vía CSS (`transition-delay: calc(var(--i) * 35ms)`) con un easing `linear()` propio (`--bounce`).
- **Navbar — aro imán (cursor custom):** al pasar por un ítem del navbar, el aro lee el rect del `<li>`, se redimensiona a esa caja y **se imanta a su centro** con `gsap.to(..., ease: 'back.out(1.4)')` (overshoot); el `border-radius` copia el de la bubble. Es GSAP puro.
- **Navbar — bubble (View Transitions):** la burbuja coral del ítem activo y el link seleccionado comparten `view-transition-name`; `document.startViewTransition` interpola posición/forma al **seleccionar** (morph real del elemento compartido, no un cambio de clase).
- **Cursor:** el aro custom es global; se imanta a los ítems del navbar y a otros `data-cursor`. El humo y las esporas no reaccionan al puntero; los ojos del subtítulo sí, mientras el puntero esté en el bloque de título.
