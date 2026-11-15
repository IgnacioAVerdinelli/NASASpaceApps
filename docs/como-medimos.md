# Cómo medimos · implementación, fuentes y verificación

## Composición actual

Landing independiente en `src/front/sketch/como-medimos.html`, con ocho tarjetas: una referencia documental y siete equipos. La iteración solicitada reemplaza Biodex y DXA por referencias de investigación en vuelo (MARES y Ultrasound 2), elimina completamente el bloque de traje espacial y sus créditos/archivo, y acerca las fotografías conservando el uso humano del instrumento. El dashboard y la lógica de simulación no cambian.

La referencia de interacción es la **segunda sección, con fotografías (CMS)** de [GSAP stacking cards](https://gsap-stacking-cards.webflow.io/). Se inspeccionó y recorrió completa en Chromium antes de esta corrección. Sus dos secciones comparten las clases y la animación; la primera tiene cuatro tarjetas sin fotografías y la segunda cinco tarjetas con imágenes.

La fijación corresponde a CSS `position: sticky; top: 56px`, idéntica para todas las tarjetas. No hay `pin`, pin-spacers ni escalonamiento del borde superior. La separación es 80 px y la altura de escritorio `min(700px, 75vh)`, equivalentes a los `50em` / `max-height:75vh` de la referencia con letra base de 14 px. Se escala desde el centro. ScrollTrigger usa `start: "top 65%"`, `end: "top top"` y `scrub: 0.3` (frente a 1 s en la referencia, ajustado posteriormente para responder con más agilidad). La línea de tiempo tiene **dos fases consecutivas** de 0,5 s con `power1.out`: primero la tarjeta anterior pasa de escala 1 a 0,85 y blur de 0 a 8 px; después aparece la sombra de la entrante, de 0 a `0 -49px 49px rgba(0,0,0,.02)`. Se reserva la primera fase vacía cuando no hay predecesora, sin enviar un target nulo a GSAP.

El mismo efecto se mantiene en móvil. La imagen y el texto se apilan y la altura puede crecer para que el contenido se lea completo. Solo `prefers-reduced-motion: reduce` desactiva las animaciones y sticky. `gsap.matchMedia().revert()` limpia animaciones y ScrollTriggers al desmontar o cambiar esa preferencia. Las fuentes disparan un refresh cuando terminan de cargar; ScrollTrigger recalcula posiciones al redimensionar. El espacio al final de la página permite completar también la sombra de la última tarjeta.

La cabecera se compactó: marca y regreso, título «Cómo medimos» y una sola frase «Equipos en vuelo. Datos simulados en Trama.»; se eliminó el rótulo «Detrás de los datos» y el párrafo introductorio largo. Cada tarjeta conserva imagen, nombre y un único párrafo. Las imágenes ocupan algo más de la mitad del ancho en escritorio, con acercamiento y foco por equipo; el reloj se enfoca en la muñeca, el monitor cardiovascular en la astronauta y sus unidades, y Bio-Monitor en las bandas de las dos astronautas. CEVIS mantiene la fotografía vertical completa dentro de una superficie mucho mayor que en la primera versión para conservar cara y pedales. Los originales se pueden consultar desde créditos.

## Equipos, procedencia y límites

| Tarjeta | Modelo / referencia | Fotografía y evidencia | Relación con Trama |
|---|---|---|---|
| Medición muscular | ESA MARES | [NASA ISS052-E-024957](https://images.nasa.gov/details/iss052e024957); [ESA MARES](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Columbus/Muscle_Atrophy_Research_and_Exercise_System) | Paolo Nespoli en la silla para el protocolo de tobillo Sarcolab-3. Referencia funcional en vuelo; el ajuste de fuerza de Trama sigue procediendo de dinamometría terrestre MR079G, no de MARES. |
| Ecografía muscular | Ultrasound 2, USND-2 | [NASA ISS029-E-025280](https://images.nasa.gov/details/iss029e025280); [NASA SPRINT](https://www.nasa.gov/blogs/stationreport/2017/08/31/iss-daily-summary-report-8-31-2017/) | Mike Fossum realiza autoecografía de pierna en vuelo. Trama no adquiere ni procesa ecografías; MR035G sigue siendo DXA terrestre. Modelo comercial exacto de la unidad fotografiada sin verificar. |
| Cicloergómetro | CEVIS | [NASA ISS036-E-015570](https://images.nasa.gov/details/iss036e015570) | Referencia documentada de vuelo; no se atribuye CEVIS al equipo terrestre de MR080G. |
| Analizador de gases | PPFS con cilindros PFS y bolsa de mezcla | [NASA ISS030-E-132542](https://images.nasa.gov/details/iss030e132542) | Conjunto de vuelo durante VO₂max; fabricante/modelo del analizador terrestre MR080G sin verificar. |
| Monitor cardíaco y tensiómetro | Holter Monitor 2 y unidad ESA Cardio / Blood Pressure | [NASA ISS026-E-015923](https://images.nasa.gov/details/iss026e015923) | Dos instrumentos separados en ICV; no se atribuye procesamiento de ECG crudo a Trama. |
| Reloj de actividad y sueño | Actiwatch, variante de la foto sin confirmar | [NASA Wearable Tech](https://www.nasa.gov/humans-in-space/wearable-tech-for-space-station-research/) · ISS014-E-12135 | Fotografía de Sunita Williams en vuelo. Actividad y sueño estimado; el pulso pertenece al reloj genérico del simulador. No se identifica Spectrum sin evidencia de esa variante en esta foto. |
| Monitor corporal | Carré Technologies / CSA Bio-Monitor | [NASA ISS070-E-007944](https://images.nasa.gov/details/iss070e007944); [CSA Bio-Monitor](https://www.csa-asc.gc.ca/eng/sciences/bio-monitor.asp) | Jasmin Moghbeli y Loral O’Hara llevan las bandas en vuelo. Referencia física, sin integración con Trama. Los canales sintéticos no son una especificación de capacidades del dispositivo. |

MARES y ecografía son referencias de investigación, no reemplazos implementados del dinamómetro y del DXA dentro del simulador. La distinción está en el párrafo de cada tarjeta. No se presentan área muscular, masa magra y fuerza como magnitudes equivalentes. No se afirma conexión con los equipos, certificación clínica ni diagnóstico.

## Recursos visuales y condiciones de uso

Siete fotografías auténticas NASA, con número de imagen y enlace individual en los créditos. Condiciones de reutilización informativa: [NASA Images and Media](https://www.nasa.gov/nasa-brand-center/images-and-media/). No se usa el logotipo de NASA como marca de Trama ni se afirma respaldo institucional.

Los archivos locales son WebP, obtenidos desde originales de NASA y reducidos proporcionalmente a un máximo de 2000 px (2400 para el reloj). El recorte y acercamiento de presentación se realiza mediante CSS. No se reconstruyen partes ocultas, se retocan personas ni se usa IA para editar equipos. Los recursos de Biodex, DXA y traje se retiraron de la página y de su directorio de assets.

`src/front/sketch/como-medimos/assets/manifest.json` registra por imagen procedencia, URL de descarga, crédito, condiciones, relación con el simulador, transformaciones, dimensiones, tamaño y SHA-256. No hay modelos 3D, WebGL ni animaciones de aparato que deban pausarse fuera de pantalla. Las imágenes posteriores a la primera usan carga diferida. El texto permanece disponible si falla una imagen.

## Evidencia de los textos

Se contrastaron documentación general, tres pilares, inventario NLSP, notas locales de fuentes y seguimiento muscular, wearable, Planner, catálogo OCHMO y código de los servicios.

- `sim/fit/fit_params.py`: MR079G, MR035G y MR080G ajustan fuerza, composición y capacidad aeróbica. Reposo (HRsupine, SBPsupine, DBPsupine) se ajusta con CFT70 de MR080G. La referencia a MR001G en la tabla antigua de `wearable.md` no se trasladó porque no coincide con el ajuste ejecutable. MR001G queda como contexto.
- La relación `baseline_factors.size` relaciona valores basales; no convierte porcentajes de pérdida de fuerza en porcentajes de masa magra.
- DXA se mantiene en el ajuste y en el calendario pre/post vuelo del simulador; no se presenta como instrumento en vuelo ni se le adjudican lecturas de ecografía.
- `instruments.py`: reloj cada quince minutos, sueño y descanso percibido; SpO₂ y HRV incorporan supuestos.
- `alerts.py`, `vitals.py`, `findings.py`, `planner/service.py`: comparación personal, ruido, hallazgos, repetición y revisión. Un hallazgo del reloj genera revisión; sueño puede completar una tarea. Una revisión agendada no acredita una consulta realizada.
- OCHMO: ejemplo ISS de 180 días. Las trayectorias sintéticas pueden extrapolar más allá de los históricos de reposo en cama.

## Navegación y comprobaciones

Entrada Vite independiente, sin importar Shell, cuerpo anatómico ni clientes de servicios. Se conserva `crew`, `source`, entrada y vista conocidas en el regreso mediante una lista de destinos locales. La prueba de navegación permanece en `tests/measurement-navigation.test.mjs`.

Verificación y medidas de la corrección: [informe de comparación](como-medimos-stack-verificacion.md). Incluye inspección de referencia, herramientas reutilizadas, capturas al mismo viewport, revisión de transiciones, ida y vuelta, resize, móvil y limpieza al desmontar. La compilación mantiene la advertencia previa por el tamaño del chunk anatómico del dashboard. No se realizó una auditoría exhaustiva con lectores de pantalla ni validación clínica.

El servidor de desarrollo solicitado por Nacho permanece en `http://localhost:5194/como-medimos.html` durante la revisión local. No hay commit ni push de esta landing.

## Simplificación del cierre

Por pedido de Nacho, el cierre visible conserva únicamente la frase sobre mediciones sintéticas con parámetros históricos y supuestos documentados. Se retiraron los enlaces y desplegables del pie; el regreso permanece en la cabecera. Las fuentes y condiciones de uso permanecen registradas en este documento y en `assets/manifest.json`.

## Referencia pública del plan de controles

Se añadió una primera tarjeta con la portada real de OCHMO-STD-100.1A Rev. A (09/09/2024), el documento ya utilizado por el catálogo. Se revisaron la aplicabilidad (§1.2), la introducción a las evaluaciones de misión (§6, p. 28), las tablas 7 y 8 y las evaluaciones de ejercicio y sueño. La fuente oficial consultada presenta la misma revisión y 103 páginas.

El texto público explica que NASA reúne evaluaciones antes, durante y después del vuelo y que los controles se adaptan a la misión. Trama usa el calendario **de ejemplo** de una estancia ISS de 180 días. No se afirma que exista una configuración de software universal de NASA ni que Trama reproduzca su planificación operacional completa.

El botón de la primera tarjeta abre un visor al final del recorrido, en la página 33 de la copia local del PDF, con acceso alternativo al archivo y a su fuente oficial. La copia original se importa desde `docs/references/`, sin duplicarla dentro del repositorio. Vite la incorpora a los recursos de la compilación. El iframe se monta solo al abrir el documento; el enlace alternativo funciona aunque el navegador no disponga de visor PDF embebido. El cierre solicitado se conserva debajo sin cambios.

Se revisaron los siete párrafos para público general: se retiraron nombres de servicios, códigos de estudios y explicaciones de implementación de la vista. Se conservan nombres de equipos, la distinción entre referencias de vuelo y estudios terrestres, y el carácter simulado de las mediciones de Trama. Las fuentes técnicas permanecen en la documentación y en el manifiesto de recursos.

El recurso de portada se registra en `assets/manifest.json`. Los párrafos públicos se encuentran en `content.js` y `missionDocument.js`; el hook de apilado no cambia y toma automáticamente las ocho tarjetas.

Verificación de esta revisión: compilación correcta y PDF incorporado a la salida estática (1,73 MB); tres pruebas de navegación aprobadas; ocho tarjetas sin desbordamiento horizontal a 1440, 1180, 760 y 390 px; sin texto recortado en móvil. Se comprobó que el PDF no se solicite antes de abrir el visor, que entregue contenido PDF auténtico y que cerrar el desplegable retire el iframe. El visor se inspeccionó en Chromium completo mostrando la página 33 de 103; queda un enlace directo alternativo para navegadores sin visor embebido. La primera tarjeta participa del apilado GSAP, sin pins ni duplicados, y el regreso conserva tripulante y vista. No hubo errores JavaScript en la prueba de navegación.

La voz editorial se revisó a primera persona plural: hablamos como el equipo de Trama («nos basamos», «simulamos», «comparamos»). La tarjeta inicial explica qué referencia elegimos y por qué, sin presentar a Trama como una entidad externa ni centrar el relato en NASA.

## Ajuste de fluidez

Por pedido de Nacho, se acortó el scrub de ScrollTrigger a 0,3 s. La recuperación del cabezal usa `power1.out` en vez de la curva exponencial predeterminada, para evitar un inicio demasiado marcado al combinar rueda brusca con un scrub corto. Se configura a través de `getTween()`, sin cambiar los tweens de las tarjetas: siguen sus dos fases, escala, desenfoque y sombra originales. No cambia CSS, geometría ni puntos de inicio/final.

Se comparó el mismo recorrido de rueda y su inversión en Chromium: asentamiento observado de 642 a 274 ms y mayor variación de escala por frame de 0,0444 a 0,0275. Son medidas de esta prueba local, no una garantía de rendimiento para todo hardware. Las ocho posiciones y alturas, gap de 80 px e inicio/final resultaron idénticos antes y después. Se verificó el regreso al estado inicial y ausencia de errores JavaScript. Medidas: `/tmp/trama-scrub-before.json` y `/tmp/trama-scrub-after.json`.

## Traducción pública al inglés

A pedido de Nacho, la landing quedó en inglés. Un subagente dedicado a traducción y edición de comunicación científica pública produjo la versión y revisó de nuevo los archivos integrados. Se conserva nuestra voz en plural y se usan términos contextuales: «health checks», «personal baseline», «monitoring» y «follow-up». No se presenta a Trama como una entidad externa. Se mantienen el carácter simulado de las lecturas, la distinción entre equipos fotografiados e históricos terrestres y el calendario de ejemplo adaptable de 180 días.

Se tradujeron títulos, párrafos, alternativas de imágenes, fallbacks, accesibilidad, visor, fechas, metadatos HTML y botón de acceso desde el dashboard. El PDF original ya está en inglés y no se modifica. Las URLs e identificadores se conservan para mantener los enlaces existentes. Los metadatos de procedencia no renderizados pueden conservar sus notas técnicas en castellano.

Verificación: compilación correcta; Chromium a 1440, 1180, 760 y 390 px sin desbordamiento ni recorte de textos; un párrafo por tarjeta; apertura/cierre del documento y regreso con tripulante y vista conservados; fallback de portada en inglés al bloquear su carga; ausencia de nombres internos y tercera persona sobre Trama en el texto visible; cero errores JavaScript.
