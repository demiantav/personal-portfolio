# Bug: animaciones "ya completadas" al recargar la página

> Caso real del portfolio (GSAP ScrollTrigger + SplitText + preloader con pin).
> Verificado con navegador automatizado (Puppeteer): 6/6 recargas estables tras el fix.

## Síntoma

Al recargar la pestaña (F5) y scrollear, las animaciones debajo del hero
(HELLO!, textos, secciones) aparecían **ya completadas**, como si se hubieran
saltado. De forma intermitente: a veces funcionaba, a veces no.
La primera visita siempre funcionaba perfecto.

Pista clave: si se eliminaba el script del zoom del hero (el único pin en el
tope de la página), el problema desaparecía por completo.

## Diagnóstico (con evidencia)

Se reprodujo el bug en Chrome headless con Puppeteer e instrumentando
ScrollTrigger. Los datos fueron contundentes:

| Trigger        | Primera carga | Recarga fallida |
| -------------- | ------------- | --------------- |
| `HELLO!`       | start=1890    | **start=90**    |
| texto about    | start=2823    | **start=1023**  |

- El layout físico era idéntico en ambos casos (`HELLO!` estaba realmente a
  2700px del tope), pero los triggers "recordaban" posiciones fantasma.
- Un trigger de prueba creado *sin* SplitText después del desbloqueo medía
  siempre correcto → el problema era **cuándo y contra qué layout se creaban
  los triggers**, no las librerías.

### Causa raíz (dos capas)

1. **Creación contra un layout fantasma**: los ScrollTriggers se creaban en
   `DOMContentLoaded`, mientras el preloader mantenía
   `body { position: fixed }` bloqueando el scroll. Eso colapsaba el
   documento a altura ~0, así que `HELLO!` nacía con `start=90px` en lugar de
   `1890px`.
2. **El refresh global no corrige nada**: `ScrollTrigger.refresh()` mide todos
   los triggers mientras revierte el pin del hero (el pin-spacer queda sin su
   padding durante esa ventana), por lo que recalculaba los mismos starts
   corruptos una y otra vez. El refresh **individual** de cada trigger
   (`t.refresh()`) sí mide contra el layout real y devolvía `1890`.
3. Bonus: la web "funcionaba" a veces por accidente — cuando el font-swap
   disparaba un re-split de SplitText que recreaba los triggers con medidas
   frescas (y dejaba huérfanos viejos sin limpiar, porque los `onSplit` no
   retornaban limpieza).

## Solución

1. **Creación diferida**: todos los ScrollTriggers se crean recién cuando el
   preloader termina (`onReady` callback), con el layout final y scroll en 0.
   Ningún trigger vuelve a nacer contra el documento colapsado.
2. **Refresh escalonado por-trigger**: inmediato tras crearlos +
   `requestAnimationFrame` + 300ms, y también en hitos de layout (`load`,
   `fonts.ready`, cada `img.load`). Nunca el refresh global.
3. **Limpieza en `onSplit`**: cada SplitText retorna una función que mata el
   tween **y su ScrollTrigger** (`tween.scrollTrigger?.kill()`), evitando
   triggers huérfanos en cada re-split (resize / font-swap).

## Lecciones aprendidas

- No crear ScrollTriggers mientras el layout está alterado (locks de scroll,
  overlays, `position: fixed`): sus posiciones quedan calcadas de ese momento.
- `ScrollTrigger.refresh()` global puede medir con los pins revertidos; el
  refresh individual por trigger es más seguro para recalcular posiciones.
- Si `SplitText.autoSplit` está activo, el `onSplit` debería retornar una
  función de limpieza que mate tween y ScrollTrigger, o acumularás huérfanos.
- Ante bugs intermitentes de timing: reproducir en navegador automatizado y
  medir (starts, posiciones físicas, conteo de triggers) vale más que cualquier
  teoría. El caso vanilla mínimo fue clave para absolver a GSAP y apuntar al
  código propio.
