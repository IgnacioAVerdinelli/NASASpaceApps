# Traspaso para el DataService (`sim/`)

Para: dueño del DataService y del generador `gravsim` (`sim/`, en `main` desde el PR #7).
Desde: diseño de las pestañas "Mediciones en vuelo" (fuerza y capacidad aeróbica).
Actualizado: 2026-11-14.

La implementación queda a tu criterio. Acá va lo que las vistas necesitan, por qué y una propuesta de cómo. Nada de esto rompe lo que ya está en `main`.

## Lo que ya está bien (revisado contra los datos)

- `vo2peak` en ml/kg/min desde `REL VO2PK`, con el mínimo NASA de 32,9 en `astronaut_standards`. Es la misma métrica que usa la vista.
- Ya usás solo `REL VO2PK` porque las otras columnas pico están corridas en algunas filas. Lo confirmamos: en CFT70 son los sujetos 5210, 9682, 7036 y 6791 (la FC pico real está en `MAX WKLD`; `HRPK` tiene el VO₂ redondeado; `VO2PK` tiene el VCO₂).
- El calendario `nasa` del cicloergómetro sigue la Tabla 8 [6028] (FD14, FD75, FD165, FD255…, R−14, R+5, R+30).
- Las mediciones de fuerza en N·m y sus seis pruebas coinciden con las de la vista de fuerza.

## Pedidos

### 1. Guardar los datos de validez de cada prueba de cicloergómetro (prioridad alta)

**Qué:** además del valor de `vo2peak`, guardar por prueba la FC pico (lpm), el RER pico (VCO₂/VO₂), la carga pico (W), el Borg pico (6–20), el motivo de corte y si el valor fue **medido** con gases o **estimado** por FC.

**Por qué:** NASA valida una prueba como máxima con RER ≥ 1,1 y Borg ≥ 17. Si no se cumple, el VO₂pico registrado subestima el real, y una caída podría ser una prueba incompleta y no una pérdida real. La vista muestra una tabla "Validez de cada prueba" con estos campos.

**Cómo (propuesta):**
- `CycleErgometer.session()` ya genera FC, carga y Borg por etapa, pero no se persiste y no tiene RER. Opciones: (a) nuevas medidas `hr_peak`, `rer_peak`, `workload_peak`, `rpe_peak` con el mismo `timestamp` que `vo2peak`; o (b) un bloque `test` dentro de la lectura de `vo2peak` (por ejemplo, en `status`), con `hr_peak_bpm`, `rer_peak`, `workload_w`, `rpe_peak`, `termination` y `method`.
- RER pico simulado: en CFT70, 32 de 34 pruebas válidas tuvieron RER ≥ 1,1. Conviene que algunas pruebas queden submáximas (RER < 1,1) para que la vista y las alertas tengan casos para mostrar.
- Datos de CFT70 para calibrar: FC pico sin cambio tras el reposo (0 lpm en el grupo control); carga pico −24 % en el grupo control y −1 % con ejercicio.

### 2. Marcar los valores estimados (prioridad media)

**Qué:** un campo `method: "measured" | "estimated"` y un fallo de instrumento nuevo, por ejemplo `gas_analyser_unavailable`, que obligue a estimar por FC.

**Por qué:** si el PFS (analizador de gases) falla, NASA estima el VO₂pico extrapolando la relación FC–VO₂. En Campaign 3 comparamos 43 pruebas con ambos valores: la estimación erró una mediana del **23 %** en valor absoluto, con un sesgo de −5,9 % (p90: 53 %). Mostrar un valor estimado como si fuera medido puede disparar falsas alarmas.

**Cómo:** con ese fallo activo, devolver `vo2peak` con un error de ese orden y `method: "estimated"`. Los datos están en `data/nlsp/MR080G_aerobic_capacity/MR080G_Campaign_3_Aerobic_Capacity_ReadMe/*calcs_readme.txt` (campos `VO2pk Rel` y `Pred VO2pk Rel`).

### 3. Forma de la curva de VO₂pico en vuelo (prioridad media)

**Qué:** hoy `vo2peak` usa el modelo `saturating` (pérdida que crece hasta un tope, atenuada por la adherencia). En la ISS la forma publicada es otra: **caída fuerte al inicio (~17 % en FD15), recuperación parcial durante el vuelo sin volver al valor previo, −15 % en R+1 y casi recuperado en R+30** (Moore y col. 2014, 14 astronautas). La variación entre personas va de +5 % a −30 % (Downs y col.).

**Por qué:** el reposo en cama no tiene la redistribución de fluidos de las primeras semanas de vuelo (pérdida rápida de plasma), por eso subestima la caída inicial. La vista y las alertas comparan contra lo que se espera en vuelo.

**Cómo (propuesta):** sumar a `vo2peak` en vuelo un componente de caída temprana (constante de tiempo de pocos días) que se adapta en parte con el ejercicio, y marcarlo como `extrapolated` (ya lo hacés pasando los 90 días). Si preferís no tocar el modelo, alcanza con documentar la diferencia en el README.

### 4. Datos de referencia por grupo (prioridad baja)

**Qué:** exponer las estadísticas de referencia de CFT70 que muestran las vistas, por ejemplo `GET /api/v1/reference?measure=vo2peak`.

**Por qué:** hoy el frontend las lee de dos JSON estáticos generados por scripts. Si el DataService es dueño de los datos ajustados, la referencia debería salir de la misma fuente para no desincronizarse.

**Cómo:** los scripts que las generan son `scripts/build-cft70-reference.py` (fuerza) y `scripts/build-cft70-aerobic-reference.py` (VO₂pico). La salida está en `src/front/sketch/data/cft70-reference.json` y `cft70-aerobic-reference.json`. Cifras clave de VO₂pico (POST1 frente a PRE, % de cambio):

| Grupo | Cambio (media ± DE) | n | Bajo 32,9 (PRE → POST1) | Caída ≥ 20 % |
|---|---|---|---|---|
| Sin contramedida | −22,4 ± 11,2 | 10 | 3 → 9 | 6 |
| Con ejercicio | −3,7 ± 8,2 | 19 | 1 → 3 | 0 |
| FLY | −3,1 ± 5,7 | 8 | 0 → 0 | 0 |

### 5. Consulta sobre el calendario

En una misión de 180 días, FD165 y R−14 caen en los días 164 y 166 de la misión: dos pruebas máximas con dos días de diferencia. La Tabla 8 lista ambas. ¿Es intencional o convendría unificarlas cuando quedan a menos de N días? La vista hoy muestra las dos como "próximas".

## Fuentes

- NLSP MR080G Aerobic Capacity, CFT70 y Campaign 3, DOI 10.83263/w056-8t76.
- OCHMO-STD-100.1A Rev A, Tabla 8 [6028].
- Moore y col., *Peak Oxygen Uptake During and After Long-Duration Space Flight* (NTRS 20140003748).
- Detalle del análisis: [investigacion-gravedad.md](../investigacion-gravedad.md) §5.5.3 (repo principal).
