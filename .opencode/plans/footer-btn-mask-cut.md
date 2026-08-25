# Fix: letras del botón "Get in Touch!" cortadas por sus máscaras

## Causa

`.contact-section__btn-contact` combina `font-size: var(--step-3)` (~52px) con
`letter-spacing: -4px` (style.css:755). Con tracking negativo, la tinta de cada
glifo desborda su caja de avance; desde que el burst usa SplitText
`mask: 'chars'`, cada carácter queda dentro de un wrapper `overflow: hidden`
dimensionado a su caja → las máscaras recortan los bordes laterales (y algo de
vertical si el line-box es justo) de las letras. Patrón ya conocido en este
repo: `.contact-title` lo compensa con padding+margen negativo para
descendentes (footer-reveal.js:55-58).

## Cambio — solo `src/js/footer-reveal.js`

En el shot del botón (líneas 121-129), capturar el resultado del split y dar
holgura a cada máscara compensando con márgenes negativos (layout idéntico):

```js
const btnSplit = SplitText.create(btn, { type: 'chars', mask: 'chars' });
// letter-spacing -4px: la tinta desborda la caja de avance y la máscara
// (overflow:hidden) corta los bordes del glifo. Holgura con margen negativo:
// mismo layout, sin recortes (mismo truco que .contact-title)
btnSplit.masks.forEach((m) => {
  m.style.padding = '0.1em 0.07em';
  m.style.margin = '-0.1em -0.07em';
});
addShot(btn, gsap.from(btnSplit.chars, { ...burstDNA, paused: true }));
```

Cubre corte horizontal (-4px) y vertical (ascendentes de G/T/h, signo !).
Torino no se toca (tracking normal, sin quejas).

## Verificación (Playwright headless)

1. Captura recortada del botón asentado al fondo → inspección visual del PNG
   (Read): sin líneas de corte verticales entre caracteres.
2. Captura mid-flight durante el burst → emergencia por máscara sin seams.
3. Regresión rápida: verify5 (asentado Y=0, línea one-shot estable, reloj vivo,
   sin errores de consola).
