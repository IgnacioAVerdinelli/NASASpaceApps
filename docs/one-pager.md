# Trama — conocer tu cuerpo, incluso lejos de la Tierra

**Prototipo de seguimiento muscular para astronautas en misiones prolongadas**

> Cuando la ayuda está lejos, entender cómo cambia tu cuerpo no debería depender de esperar una respuesta desde la Tierra.

## El desafío

Durante una misión espacial, la tripulación vive y trabaja en condiciones que pueden afectar su salud muscular. El seguimiento combina mediciones, ejercicio y apoyo especializado desde Tierra. En misiones más lejanas, las demoras de comunicación y el acceso limitado a especialistas hacen especialmente valioso que cada astronauta pueda consultar e interpretar su propia información a bordo.

La pregunta que nos hacemos es: **¿cómo puede una persona entender qué está cambiando en su cuerpo y compartir información útil con el equipo médico, aun cuando no dispone de asistencia inmediata?**

## Nuestra propuesta

Trama propone un seguimiento muscular centrado en la persona. Un mapa anatómico interactivo permite explorar una región y consultar su evolución frente a una referencia personal previa a la misión. La intención es reunir en un solo lugar la medición, su fecha, el método utilizado y el contexto necesario para interpretarla.

En vez de presentar un número aislado como diagnóstico, buscamos responder preguntas concretas: **¿qué se midió?, ¿cómo cambió respecto de mi referencia?, ¿las mediciones son comparables? y ¿qué información falta?** La visión a futuro incluye acompañar la adquisición de una medición y preparar un resumen para compartir con especialistas.

## Una escena de uso

Una astronauta selecciona su cuádriceps en el modelo 3D y consulta una tendencia respecto de su referencia personal. Puede identificar la región, ver la evolución y revisar qué información sostiene esa comparación. En el prototipo actual, esta escena usa **valores simulados**: ilustra la experiencia deseada y no representa una evaluación médica real.

## Qué aporta

- **Comprensión personal:** convierte una serie de mediciones en una historia que el astronauta puede explorar desde su propio punto de partida.
- **Contexto para colaborar:** propone organizar información clara para que la tripulación y los especialistas puedan revisarla juntos.
- **Diseño para la autonomía:** orienta el producto hacia el acceso y la interpretación a bordo cuando la asistencia inmediata no esté disponible.
- **Claridad sobre los límites:** distingue las mediciones disponibles de las regiones no evaluadas y evita confundir un cambio local con la salud muscular de todo el cuerpo.

## Estado y próximos pasos

Hoy el repositorio incluye un visor anatómico 3D, selección de regiones y una pantalla con tendencias de ejemplo. Los colores del visor son intensidades simuladas, no indicadores de salud; la pantalla usa datos de ejemplo y no incluye una conexión real a sensores ni un servidor integrado.

El siguiente paso es demostrar un flujo completo para **una región y una magnitud bien definidas**: incorporar una medición cuantificada, compararla con una referencia compatible, mostrar su procedencia y calidad, y presentar un siguiente paso respaldado por un procedimiento. La adquisición guiada, el funcionamiento sin conexión de extremo a extremo y la validación con especialistas son objetivos pendientes, no capacidades ya demostradas.

## Fundamento

El enfoque parte de los [riesgos del vuelo espacial investigados por NASA](https://www.nasa.gov/hrp/risks/) y de trabajos como [Tele-SUS](https://pmc.ncbi.nlm.nih.gov/articles/PMC8047175/), que estudió el seguimiento muscular mediante ecografía en astronautas. Estos antecedentes orientan la propuesta; no validan clínicamente el prototipo. Más detalle y fuentes en [contexto del seguimiento muscular](contexto-final-seguimiento-muscular.md) y [contexto del desafío](contexto-challenge.md).

## El punch

**Trama busca que, incluso lejos de la Tierra, cada astronauta pueda entender cómo cambia su cuerpo y participar con más autonomía en el cuidado de su salud.**
