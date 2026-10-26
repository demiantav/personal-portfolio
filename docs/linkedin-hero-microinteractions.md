# LinkedIn — Hero: humo + relámpagos y navbar hover

Post enfocado en dos detalles: la **atmósfera del hero** (humo WebGL, relámpagos y esporas) y el **hover del navbar** (roll de letras + **aro imán** + bubble). El hero no tiene interacción con el cursor.

---

## EN — versión principal

```
Two details in my portfolio I keep coming back to.

The hero isn't a video. It's a WebGL smoke field: fbm noise with two-step domain warping, lit by random red lightning. In front of it, red spores drift in two depth layers. On scroll, the smoke and spores fold into the D of the title and disappear into the next section. It doesn't need the cursor — it breathes on its own.

The navbar is the opposite of loud. On hover, each letter is two stacked copies inside a mask — the top one leaves and a coral one rolls in, one letter at a time, 35ms apart. My custom cursor ring doesn't just follow the pointer: it magnetizes to the item you're on and hugs it. And when you select one, a coral bubble glides from the old item to the new, like a magnet.

Microinteractions are felt, not seen. The best ones you don't notice; you just feel the page responding.

Which would you try first — the hero or the navbar? Link in the comments 👇

Built with GSAP, WebGL, Canvas 2D and the View Transitions API.

#webdevelopment #gsap #frontend #uiux #microinteractions #webgl #viewtransitions
```

## EN — versión corta

```
Microinteractions are felt, not seen.

My hero is a WebGL smoke field lit by random red lightning, with spores drifting in front. On scroll, it all folds into the D of the title. It doesn't need the cursor — it breathes on its own.

The navbar: each letter is two masked copies — the coral one rolls in on hover, 35ms apart. My custom cursor ring magnetizes to the item you're on, and the active bubble glides between links.

Built with GSAP, WebGL, Canvas 2D and View Transitions. Which one do you notice first? 👇

#webdevelopment #gsap #frontend #uiux #webgl #viewtransitions
```

## ES — versión principal

```
Dos detalles de mi portfolio a los que vuelvo una y otra vez.

El hero no es un video: es un campo de humo en WebGL, ruido fbm con domain warping en dos pasos, iluminado por relámpagos rojos aleatorios. Delante flotan esporas rojas en dos planos de profundidad. Al scrollear, el humo y las esporas se pliegan hacia la D del titular y desaparecen en la sección siguiente. No necesita el cursor: respira solo.

El navbar es lo opuesto a lo ruidoso. Al hover, cada letra son dos copias apiladas dentro de una máscara: la de arriba se va y entra una coral — una letra por vez, con 35ms de separación. Mi aro de cursor no solo sigue al puntero: se imanta al ítem donde estás y lo abraza. Y al elegir uno, la burbuja coral se desliza del ítem viejo al nuevo, como un imán.

Las microinteracciones se sienten, no se ven. Las mejores no las notás; simplemente sentís que la página te responde.

¿Cuál probarías primero, el hero o el navbar? Link en comentarios 👇

Hecho con GSAP, WebGL, Canvas 2D y la View Transitions API.

#webdevelopment #gsap #frontend #uiux #microinteractions #webgl #viewtransitions
```

---

## Notas técnicas (por si querés mencionarlas)

- **Hero — humo:** WebGL, un triángulo que cubre el viewport y un solo draw call. Ruido fbm + domain warping en dos pasos; la rampa `bodyAt` define núcleos y silueta; una capa macro de baja frecuencia rompe la repetición. Sin interacción con el cursor.
- **Hero — relámpagos:** intervalo aleatorio de 2.5–6 s; 2 pulsos gaussianos por descarga; la normal falsa compara la densidad con la del vecino hacia el origen. Pauta WCAG 2.3.1.
- **Hero — esporas:** Canvas 2D, sprite radial pre-renderizado + `globalCompositeOperation = 'lighter'`, deriva y parallax; se absorben hacia la D con `exitProgress`.
- **Navbar — letras (roll):** dos capas por letra dentro de una máscara; stagger de **35 ms** por letra vía CSS (`transition-delay: calc(var(--i) * 35ms)`) con un easing `linear()` propio (`--bounce`).
- **Navbar — aro imán (cursor custom):** al pasar por un ítem del navbar, el aro lee el rect del `<li>`, se redimensiona a esa caja y **se imanta a su centro** con `gsap.to(..., ease: 'back.out(1.4)')` (overshoot); el `border-radius` copia el de la bubble. Es GSAP puro.
- **Navbar — bubble (View Transitions):** la burbuja coral del ítem activo y el link seleccionado comparten `view-transition-name`; `document.startViewTransition` interpola posición/forma al **seleccionar** (morph real del elemento compartido, no un cambio de clase).
- **Cursor:** el aro custom es global; se imanta a los ítems del navbar y a otros `data-cursor`, pero el humo y las esporas del hero no reaccionan al puntero.
