# Comparación del apilado de Cómo medimos

## Herramientas e inspección previa

Se reutilizaron GSAP 3.15.1 y ScrollTrigger de `src/front/sketch/node_modules`, Playwright 1.65.1 de `/tmp/nasa-browser-check/node_modules` y el Chromium ya instalado. No fue necesario instalar otras dependencias.

Antes de cambiar código se abrió [la referencia](https://gsap-stacking-cards.webflow.io/) en Chromium, se recorrió completa hacia abajo y arriba y se inspeccionaron DOM, estilos calculados, hoja CSS e inicialización GSAP accesible. La referencia carga GSAP 3.12.4; la versión del proyecto permanece en 3.15.1.

Hay dos secciones: cuatro tarjetas estáticas con visuales vacíos, y cinco tarjetas con fotos suministradas mediante el CMS de Webflow. **La segunda corresponde a nuestra página**, por su combinación de fotografía y texto. Ambas comparten `.stacking-card` y la misma inicialización; no tienen dos efectos distintos.

## Medidas de referencia y correcciones

A 1440 × 900:

| Propiedad | Referencia CMS | Trama corregida |
|---|---|---|
| Fijación | CSS sticky a 56 px | Igual; se retiraron todos los pins GSAP |
| Separación | 80 px | 80 px |
| Alto | 50 em, máximo 75 vh: 675 px | `min(700px,75vh)`: 675 px |
| Origen de escala | Centro | Centro, reemplazando el origen superior |
| Inicio / final | top al 65 % / top al 0 % del viewport | Igual |
| Suavizado | scrub de 1 s | Igual |
| Fase 1 | Escala 1 → 0,85 y blur 0 → 8 px | Igual |
| Fase 2 | Sombra de entrante de 0 a −49 px / 49 px, alfa 0,02 | Igual; antes faltaba |
| Distribución temporal | Dos tweens consecutivos de 0,5 s, power1.out | Igual; antes la escala ocupaba todo el recorrido |
| Ancho | 1344 px, márgenes laterales de 48 px | 1200 px, márgenes de 120 px: se conserva el contenedor de Trama |
| Cantidad de tarjetas | 5 | 7, conservando los instrumentos solicitados |

El código anima la superficie `.measure-card` dentro de una sección sticky sin transformar. Su centro, escala y desenfoque producen el mismo desplazamiento visible que transformar directamente la tarjeta sticky de la referencia; el layout conserva las medidas sin depender de pin-spacers. La primera línea de tiempo reserva la media duración inicial sin enviar un target nulo a GSAP.

La sombra sigue la referencia mientras el borde, colores y tipografía conservan Trama. Se quitó el `backdrop-filter` redundante de las tarjetas: tienen una base opaca, por lo que ese filtro no aportaba transparencia visible y añadía coste de render. `will-change` prepara las capas de escala y filtro. El espacio inferior permite completar el recorrido de la última tarjeta antes del cierre.

## Diferencias deliberadas de composición y accesibilidad

- Se conservan contenido, fotografía a la izquierda, Frosted glass, Chakra Petch, cabecera y cierre breve. La referencia usa texto a la izquierda, fotografía a la derecha, Arial y colores lisos. La posición horizontal de la foto no cambia la animación.
- La referencia es más ancha. No se amplió el contenedor de Trama porque se pidió conservar el resto del diseño.
- En móvil se mantiene sticky y la animación completa. A 390 × 844, las tarjetas de la referencia miden 310 × 633 px y las de Trama 358 × 633 px, con sus márgenes existentes. En pantallas más bajas, Trama permite que la tarjeta crezca para que el texto no se recorte; la referencia mantiene siempre su límite de 75 vh.
- Con movimiento reducido se usa flujo normal sin animación; la referencia no incluye esa adaptación.

## Método de comparación

Las capturas y mediciones están en `/tmp/trama-stack-audit/`. Se usa la misma ventana Chromium para medir referencia y localhost, con viewports iguales, alineando la sección CMS con nuestra primera tarjeta. Las transiciones se muestrean a 0 %, 25 %, 50 %, 75 % y 100 %. Se espera que la interpolación GSAP llegue a su progreso de ScrollTrigger antes de leer estilos, para que el retraso de scrub o la carga de capturas no se confundan con una diferencia de animación.

- `reference-transition-N-P.png` / `local-transition-N-P.png`: pares por transición y fase.
- `reference-aligned-start.png` / `local-aligned-start.png`: inicio alineado.
- `reference-end.png` / `local-end.png`: final.
- `reference-WxH-start|middle|end.png` / `local-WxH-start|middle|end.png`: pares responsivos.
- `comparison.json`: medidas de escala, blur, sombra, progreso y posición.
- `responsive.json`: geometría, conteo de triggers, desbordamiento y recorte.

Los scripts de verificación reutilizan Playwright desde `/tmp/nasa-browser-check/`: `inspect-reference.cjs`, `compare-single-page.cjs`, `stack-responsive-audit.cjs` y `stack-lifecycle.cjs`.

## Limpieza de React

`gsap.matchMedia().revert()` revierte los tweens y sus ScrollTriggers al desmontar o activar movimiento reducido. La promesa de fuentes comprueba que el componente siga montado antes de refrescar.

Se montó y desmontó tres veces un componente React que usa el mismo hook con tres tarjetas: el contador pasó de 7 a 10 al montar y volvió a 7 al desmontar en las tres iteraciones. No quedaron triggers añadidos.

## Resultados medidos en escritorio

Se capturaron las seis transiciones locales en cinco puntos cada una (30 muestras), además de las cuatro transiciones de la sección CMS de referencia (20 muestras). La comparación de puntos comunes pasó. Diferencias máximas registradas: **0,0001 en escala**, **0,0012 px de blur** y **0,0191 px en los componentes de sombra**; son diferencias de muestreo/interpolación, por debajo del umbral usado para la comparación. No hubo errores JavaScript.

| Progreso normalizado | Escala referencia | Blur referencia | Resultado local |
|---|---:|---:|---|
| 0 % | 1 | 0 px | Coincide |
| 25 % | 0,8876 | ≈5,9932 px | Coincide dentro de las diferencias indicadas |
| 50 % | 0,85 | 8 px | Coincide |
| 75 % | 0,85 | 8 px | Coincide; la sombra está en su segunda fase |
| 100 % | 0,85 | 8 px | Coincide |

Para comparar la salida del último elemento se emparejó la transición 4 de la referencia con la 6 de Trama: las posiciones superiores de la tarjeta entrante fueron **585, 439, 292, 146 y 0 px** en ambos casos, respectivamente para 0 %, 25 %, 50 %, 75 % y 100 %. Esto verifica también que el final de la pila se libera con la misma geometría.

Se recorrieron las transiciones hacia arriba y se inspeccionaron las capturas del inicio restaurado. Los archivos `reference-aligned-start.png` y `local-aligned-start.png` sitúan la primera tarjeta de ambas secciones a 182 px del borde superior de la misma ventana de 1440 × 900.

Compilación del frontend: correcta. Pruebas de navegación: 3 aprobadas. `git diff --check`: correcto. Sigue la advertencia de tamaño del chunk anatómico del dashboard; no bloquea la compilación.

También se recorrieron ambas páginas con eventos nativos de rueda de Playwright, en ambos sentidos. Se comprobó que el scroll avanzara y retrocediera sin inversión ni bloqueo; se guardaron capturas de final y regreso (`reference|local-wheel-end|return.png`). No se usa secuestro de scroll, `ScrollSmoother`, `normalizeScroll` ni un scroller virtual.

## Responsive y movimiento reducido

Se compararon pares al mismo viewport: 1180 × 844, 760 × 844, 390 × 844 y 390 × 667, además de volver a 1440 × 900. Trama se redimensionó sin recargar; para las capturas de referencia se abrió de nuevo el sitio en cada tamaño, evitando arrastrar estados de interpolación de su GSAP 3.12.4 tras un refresh durante resize.

En todos los tamaños de Trama se verificaron siete triggers, cero pin-spacers, ausencia de desbordamiento horizontal y párrafos sin recorte. A 390 × 844 las siete tarjetas mantienen 633 px, como en la referencia. A 390 × 667 la referencia mantiene 500 px; Trama usa entre 509 y 560 px para conservar el texto completo. Esta es la diferencia de altura móvil deliberada, junto con los márgenes y estilos propios ya indicados.

Movimiento reducido se comprobó por separado con `reduced-motion-final.cjs`: **7 triggers → 0 al activar la preferencia → 7 al restaurarla**, con posición relativa mientras está activa. Se evita depender de una variable de inspección persistente del navegador durante cambios de media queries en el servidor Vite.

No quedan diferencias conocidas en las fases, escala, blur, sombra, fijación o liberación del apilado de escritorio dentro de las medidas realizadas. Esto no constituye una prueba de igualdad de cada píxel ni una prueba en todos los navegadores; las diferencias deliberadas de composición, contenido, ancho, altura móvil y movimiento reducido están enumeradas arriba.

## Ampliación posterior: tarjeta de referencia NASA

Se añadió una tarjeta documental antes de los siete equipos. Las mediciones comparativas anteriores corresponden a la versión de siete tarjetas. El hook y las fases de animación no cambian: la nueva versión crea ocho triggers; se comprobó que la portada alcance el desenfoque de salida al entrar MARES. El visor PDF está fuera de la pila y solo se carga al abrirlo. La revisión pública de los textos y la evidencia del PDF están documentadas en `como-medimos.md`.

## Ajuste posterior de respuesta al scroll

La comparación de referencia anterior documenta el efecto con scrub de 1 s. Posteriormente, a pedido de Nacho, se mantuvo toda su geometría y se ajustó únicamente el seguimiento temporal: scrub de 0,3 s y recuperación `power1.out` del tween de scrub. Los valores de escala, blur y sombra, sus fases y sus posiciones siguen intactos. Esta es una diferencia temporal deliberada respecto del ejemplo para reducir el retraso y suavizar inversiones.

En la prueba local de rueda de 260 px seguida por inversión de 180 px, el asentamiento observado bajó de 642 a 274 ms y el mayor paso de escala por frame bajó de 0,0444 a 0,0275. La comparación automática confirmó las mismas ocho posiciones, alturas, separación e inicio/final. Se comprobó también el retorno al estado inicial, sin pin-spacers ni errores JavaScript. Los registros están en `/tmp/trama-scrub-before.json` y `/tmp/trama-scrub-after.json`; el script es `/tmp/nasa-browser-check/scrub-motion.cjs`.
