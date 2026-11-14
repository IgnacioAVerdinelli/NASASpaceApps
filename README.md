# Atlas muscular 3D

Prototipo web para explorar y colorear regiones musculares sobre un modelo humano 3D. Los valores iniciales son simulados y la escala es visual, sin interpretación clínica.

## Ejecutar

Requiere Node.js 20.19+ o 22.12+.

```bash
npm install
npm run dev
```

Abrí la dirección local que indique Vite. Para generar una versión estática:

```bash
npm run build
npm run preview
```

Elegí el modelo masculino o femenino desde el selector del visor. Seleccioná una región en la lista o haciendo clic sobre el cuerpo y ajustá el deslizador. Arrastrá el modelo para girarlo y usá la rueda o el gesto de pellizcar para acercarlo. «Limpiar valores» vuelve todas las intensidades a cero. Los cambios se mantienen solo mientras la página esté abierta.

## Alcance

Los modelos masculino y femenino contienen 41 estructuras o grupos musculares; algunos reúnen varios músculos. La piel es opaca y las regiones se proyectan de forma aproximada sobre su superficie. Los músculos profundos, como el diafragma, pueden no aparecer o ser poco visibles. El mapa usa puntuaciones de 0 a 100 inspiradas en MuscleMap, pero no incorpora su código ni sus SVG. Los nombres de las estructuras provienen del catálogo original en inglés. Los valores de demostración no son mediciones ni umbrales médicos.

## Créditos y licencias

- Modelo: [Open Anatomy 3D](https://github.com/MervinR07/open-anatomy-3d), código MIT y modelos CC BY 4.0. Anatomía: BodyParts3D © The Database Center for Life Science, CC BY 4.0; adaptada por Open Anatomy 3D, CC BY 4.0. Ver el archivo `node_modules/open-anatomy-3d/ATTRIBUTION.md` para las fuentes y modificaciones completas.
- Inspiración para la visualización por intensidad: [MuscleMap](https://github.com/Jsplice/MuscleMap), MIT. No se incluye código ni material gráfico de ese proyecto.
