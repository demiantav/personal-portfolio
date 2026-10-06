# LinkedIn — Hero: waves hover + navbar hover

Post enfocado en dos microinteracciones: la **reacción de las waves al cursor** y el **hover del navbar** (roll de letras + **aro imán** + bubble).

---

## EN — versión principal

```
Two hover moments in my portfolio I keep coming back to.

The waves aren't a video. They're ten lines of simplex noise drawn on a canvas, point by point, every frame. Move your cursor and the lines part around it with a soft falloff — like water noticing you're there. Move away, and they close back in.

The navbar has three layers of detail. On hover, each letter is two stacked copies inside a mask — the top one leaves and a coral one rolls in, one letter at a time, 35ms apart. My custom cursor ring doesn't just follow the pointer: it magnetizes to the item you're on and hugs it. And when you select one, a coral bubble glides from the old item to the new, like a magnet.

Microinteractions are felt, not seen. The best ones you don't notice; you just feel the page responding.

Which would you try first — the waves or the navbar? Link in the comments 👇

Built with GSAP, Canvas 2D (simplex-noise) and the View Transitions API.

#webdevelopment #gsap #frontend #uiux #microinteractions #viewtransitions
```

## EN — versión corta

```
Microinteractions are felt, not seen.

Hover my hero waves: ten lines of simplex noise on a canvas that part around your cursor and close back in.

Hover the navbar: each letter is two stacked copies in a mask — the coral one rolls in, one letter at a time, 35ms apart. My custom cursor ring magnetizes to the item you're on and hugs it. And when you select one, a coral bubble glides to it, like a magnet.

Built with GSAP, Canvas 2D (simplex-noise) and the View Transitions API. Which one do you notice first? 👇

#webdevelopment #gsap #frontend #uiux #viewtransitions
```

## ES — versión principal

```
Dos momentos de hover en mi portfolio a los que vuelvo una y otra vez.

Las waves no son un video: son diez líneas de simplex noise dibujadas en un canvas, punto por punto, frame a frame. Movés el cursor y las líneas se abren a su alrededor con un falloff suave — como agua que nota que estás ahí. Al alejarte, se cierran de nuevo.

El navbar tiene tres capas de detalle. Al hover, cada letra son dos copias apiladas dentro de una máscara: la de arriba se va y entra una coral — una letra por vez, con 35ms de separación. Mi aro de cursor no solo sigue al puntero: se imanta al ítem donde estás y lo abraza. Y al elegir uno, la burbuja coral se desliza del ítem viejo al nuevo, como un imán.

Las microinteracciones se sienten, no se ven. Las mejores no las notás; simplemente sentís que la página te responde.

¿Cuál probarías primero, las waves o el navbar? Link en comentarios 👇

Hecho con GSAP, Canvas 2D (simplex-noise) y la View Transitions API.

#webdevelopment #gsap #frontend #uiux #microinteractions #viewtransitions
```

---

## Notas técnicas (por si querés mencionarlas)

- **Waves:** Canvas 2D + `simplex-noise`, 10 líneas dibujadas punto a punto; la reacción al cursor usa un **falloff gaussiano** (las líneas se abren y vuelven). Se pausan fuera de pantalla (`IntersectionObserver`) y respetan `prefers-reduced-motion`.
- **Navbar — letras (roll):** dos capas por letra dentro de una máscara; stagger de **35 ms** por letra vía CSS (`transition-delay: calc(var(--i) * 35ms)`) con un easing `linear()` propio (`--bounce`).
- **Navbar — aro imán (cursor custom):** al pasar por un ítem del navbar, el aro lee el rect del `<li>`, se redimensiona a esa caja y **se imanta a su centro** con `gsap.to(..., ease: 'back.out(1.4)')` (overshoot); el `border-radius` copia el de la bubble. Es GSAP puro.
- **Navbar — bubble (View Transitions):** la burbuja coral del ítem activo y el link seleccionado comparten `view-transition-name`; `document.startViewTransition` interpola posición/forma al **seleccionar** (morph real del elemento compartido, no un cambio de clase).
