# Atlas muscular 3D

Explorador web del cuerpo humano por capas, con intensidad simulada editable de 0 a 100 por grupo muscular. Los colores no representan salud ni criterios clínicos.

## Ejecutar

Requiere Node.js 20.19+ o 22.12+.

```bash
npm install
npm run dev
```

Abrí la dirección local que indique Vite. Para verificar y generar la versión estática:

```bash
npm test
npm run build
npm run preview
```

## Organización

- `src/front/body-3d/`: visor 3D, catálogo anatómico, geometría y mapas de regiones.
- `src/front/web/`: página, controles, estilos y estado de intensidades.
- `src/front/sketch/`: página Trama con el visor 3D integrado. El original permanece en `sketch/`.

Para levantar la página Trama con el modelo 3D, instalá primero las dependencias del proyecto y luego las de la página:

```bash
npm install
cd src/front/sketch
npm install
npm run dev
```

La demostración de alertas para wearable está disponible en `/alerts/` desde el mismo servidor. Sus alertas son ejemplos simulados y se pueden seleccionar para explorar el reloj.

La página principal (`/` o `/vuelo.html`) abre **Health overview**. Muestra el modelo 3D, los indicadores de fuerza y capacidad aeróbica, el reloj y la agenda del tripulante. La barra superior permite entrar al detalle de músculos, capacidad aeróbica, wearable, plan de misión y mapa corporal. Los enlaces conservan la pestaña y el tripulante (`?crew=CM-3#vitales`, por ejemplo). `/overview.html` sigue abriendo el mapa corporal.

**Forma rápida:** `bash scripts/demo.sh` levanta todo en una terminal y deja la página en `http://127.0.0.1:5190/vuelo.html`. Ver la [guía de la demo](docs/guia-demo.md) (instalación, qué mostrar y problemas comunes) y el [contexto de lo construido](docs/handoff/planner-y-reloj.md).

La página consulta por defecto el HealthService y permite elegir un tripulante. Para iniciar el sistema completo a mano, instalá las dependencias de Python y levantá los servicios en terminales separadas desde la raíz:

También podés iniciar todos los servicios juntos desde la raíz con `bash scripts/start.sh`. El script instala las dependencias faltantes y se detiene con `Ctrl+C`.

```bash
python3 -m venv health/.venv
health/.venv/bin/pip install -e ./sim -e './health[dev]' -e './planner[dev]'
health/.venv/bin/python -m gravsim.serve --day 95 --speed 20 --db /tmp/nasa-data.sqlite --queue /tmp/nasa-queue.sqlite
```

En otra terminal:

```bash
health/.venv/bin/python -m healthservice --queue /tmp/nasa-queue.sqlite
```

En otra terminal, iniciar los consumidores de eventos y las entregas simuladas:

```bash
health/.venv/bin/python -m healthservice.demo --queue /tmp/nasa-queue.sqlite
```

En otra terminal, el Planner (puerto 3001), que arma el plan de cada tripulante a partir de OCHMO-STD-100.1A ([diseño](docs/planner.md)). `--simulate-crew` marca como hechas las tareas que cierra la tripulación, a mitad de su ventana:

```bash
health/.venv/bin/python -m planner --queue /tmp/nasa-queue.sqlite --simulate-crew
```

En otra terminal, después de instalar las dependencias de Node indicadas arriba:

```bash
cd src/front/sketch
npm run dev
```

Vite redirige `/api/v1/plan` y `/api/v1/routines` al Planner (puerto 3001) y el resto de `/api` al HealthService local en el puerto 3000; el DataService escucha en el puerto 8000. Los datos de gravsim son sintéticos. Para usar solo los [datos de ejemplo](src/front/sketch/data/dashboard.example.json), iniciar Vite con `VITE_DASHBOARD_MODE=example npm run dev`. Para otro servidor, usar `VITE_DASHBOARD_URL=https://servidor/api/v1/dashboard npm run dev`; definir la misma variable al generar el build. El servidor remoto debe habilitar CORS para el origen del frontend. El proxy de Vite solo funciona en desarrollo; el build requiere una URL accesible o un proxy del servidor de despliegue.

La página de mediciones en vuelo (`/vuelo.html`) tiene la pestaña **Vital signs** y, arriba del Health summary, el panel **Now · from your watch**: los signos del reloj comparados con las dos últimas semanas de la propia persona, y la frecuencia cardíaca del día contra ayer, hace una semana o antes del vuelo ([diseño](docs/wearable.md)). Para ver un desvío en la demo, agregar al DataService `--fatigue CM-3:126:7` (un episodio de fatiga que solo ve el reloj).

Las entregas simuladas se consultan en `http://localhost:3000/api/v1/deliveries`; no se envían a dispositivos. El plan está en `http://localhost:3001/api/v1/plan?crew=CM-1` y las rutinas de la norma en `/api/v1/routines`. Los archivos SQLite conservan datos y cursores entre reinicios: para comenzar otra misión desde cero, detené todos los servicios y usá rutas nuevas para ambos archivos. No reutilices la misma base con otra semilla, misión o tripulación.

La página consulta cada 3 segundos después de completar la solicitud anterior; si la API falla conserva los últimos datos del tripulante seleccionado y muestra un aviso, sin sustituirlos por el ejemplo. El contrato y las claves disponibles están documentados en [Integración frontend–backend](docs/frontend-backend.md).

## Explorar

- **Superficie:** piel lisa con 27 regiones coloreables alrededor del cuerpo. Seleccioná una región con clic o desde la lista.
- **Músculos:** muestra las 41 estructuras del modelo. El mismo valor de cada grupo controla la piel y su malla interna; los grupos profundos se pueden editar desde el panel y visualizar aquí.
- **Huesos:** muestra el esqueleto como referencia, sin aplicar intensidades musculares.
- **Aislar selección:** en la vista muscular, deja visible el grupo seleccionado junto al esqueleto. Al salir de esa capa se desactiva.
- **Modo de testeo:** pinta todas las estructuras con intensidades variadas. Podés editar o limpiar esos valores; al salir se restauran los valores anteriores.
- **Centrar selección:** acerca la cámara a la región elegida. Arrastrá para girar y usá rueda o pellizco para acercar o alejar.

Los modelos masculino y femenino comparten selección y valores; cambiar de cuerpo reencuadra la cámara. Cambiar de capa mantiene la orientación. La región seleccionada se identifica en el panel sin dibujar un borde sobre la piel. Los datos permanecen únicamente mientras la página está abierta; «Limpiar valores» los vuelve a cero.

## Mapas de piel

Los mapas asignan una región por triángulo de piel. El visor suaviza esas etiquetas sobre vértices vecinos y usa los mismos pesos interpolados para pintar y resolver clics. Son independientes para ambos cuerpos y no usan proyecciones frontales/posteriores. El modelo está fijado en `open-anatomy-3d@0.1.0` porque los mapas dependen del orden de sus triángulos.

```bash
npm run generate:surfaces
npm test
```

La generación es reproducible y no requiere red. Las pruebas comprueban el hash del GLB, la cantidad de triángulos, los identificadores, la cobertura de regiones y la lateralidad. Después de regenerar se debe revisar visualmente el cuerpo completo. Ver [preparación y límites de las regiones](docs/surface-regions.md).

Algunas estructuras agrupan varios músculos: por ejemplo, el brazo no permite seleccionar bíceps y tríceps individualmente. Los límites de la piel son aproximados y su resolución depende de la malla; no son segmentaciones anatómicas exactas. Los nombres del catálogo se conservan en inglés.

## Créditos y licencias

Anatomía: BodyParts3D © The Database Center for Life Science (CC BY 4.0); órganos femeninos: Human Reference Atlas 3D Reference Organs, HuBMAP (CC BY 4.0); cuerpo femenino: MakeHuman (CC0). Adaptados por [Open Anatomy 3D](https://github.com/MervinR07/open-anatomy-3d), CC BY 4.0. Código de Open Anatomy: MIT; modelos y catálogo: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Fuentes y modificaciones originales en `node_modules/open-anatomy-3d/ATTRIBUTION.md`.

Este proyecto añade mapas derivados de regiones de superficie, materiales de intensidad y controles por capas; no modifica los GLB originales. Los mapas derivados se distribuyen bajo CC BY 4.0.

[MuscleMap](https://github.com/Jsplice/MuscleMap) (MIT) inspira el coloreado por intensidad. No incorporamos su código, imágenes ni SVG.
