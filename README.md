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
- `src/front/sketch/`: página HBARAI con el visor 3D integrado. El original permanece en `sketch/`.

Para levantar la página HBARAI con el modelo 3D, instalá primero las dependencias del proyecto y luego las de la página:

```bash
npm install
cd src/front/sketch
npm install
npm run dev
```

La página usa por defecto [datos de ejemplo](src/front/sketch/data/dashboard.example.json), sin requerir un backend. Para conectarla a una API implementada por otro integrante, iniciá Vite con la URL completa:

```bash
VITE_DASHBOARD_URL=http://localhost:3000/api/v1/dashboard npm run dev
```

El comando anterior se ejecuta desde `src/front/sketch`. La página consulta cada 3 segundos después de completar la solicitud anterior; si la API falla conserva los últimos datos y muestra un aviso. Si `VITE_DASHBOARD_URL` está configurada, nunca reemplaza silenciosamente un error con datos de ejemplo. Si API y frontend usan distintos orígenes, el backend debe habilitar CORS para el origen del frontend.

El contrato, ejemplos, errores y claves disponibles están documentados en [Integración frontend–backend](docs/frontend-backend.md). Esta implementación **no incluye un servidor** ni una conexión real: otra persona puede implementar el endpoint siguiendo ese contrato.

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
