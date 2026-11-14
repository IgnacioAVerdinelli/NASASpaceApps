# Visor muscular por capas

Implementado con React y Three.js sobre Open Anatomy 3D:

- Piel con mapas de regiones por triángulo para ambos cuerpos, compartidos por colores y clics.
- Capas de superficie, músculos y huesos; aislamiento muscular con contexto óseo.
- Selección, intensidad 0–100, centrado y controles accesibles fuera del canvas.
- Generador reproducible de regiones y pruebas de correspondencia con los GLB y lateralidad.

El modelo ofrece 41 grupos musculares, 27 con representación superficial. Las regiones de piel son aproximadas, con límites condicionados por la resolución de la malla. No hay mediciones clínicas, diagnóstico, sensores ni persistencia. Ver README.md y docs/surface-regions.md para ejecución, reproducción, licencias y límites.
