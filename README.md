# Calculadora de propina con lógica difusa (Mamdani)

Sistema de inferencia difusa tipo **Mamdani** que recomienda el porcentaje de propina a partir de
**tiempo de servicio** y **precio de la cuenta**. El sistema se define en MATLAB (Fuzzy Logic Designer)
y la calculadora web en GitHub Pages lee directamente el mismo archivo `matlab/propina.fis`.

**Demo:** https://sebastiux.github.io/fuzzylogicrestaurante/

```
.
├── index.html               calculadora (GitHub Pages)
├── css/styles.css
├── js/fuzzy.js              motor Mamdani que lee .fis (replica evalfis)
├── js/app.js                interfaz, gráficas y superficie de control
└── matlab/
    ├── propina.fis          sistema difuso (abrir en Fuzzy Logic Designer)
    ├── abrir_designer.m     abre Fuzzy Logic Designer con todo configurado
    ├── GUIA_DESIGNER.md     guía campo por campo para llenarlo a mano
    ├── crear_fis_propina.m  crea el .fis por código
    └── exportar_datos.m     extrae datos, tablas y gráficas
```

---

## 1. Parámetros del sistema

| Propiedad | Valor |
|---|---|
| Tipo | Mamdani |
| AND | `min` |
| OR | `max` |
| Implicación | `min` |
| Agregación | `max` |
| Defuzzificación | `centroid` (101 puntos) |

### Entrada 1 — `tiempo` (minutos de servicio), rango `[0 60]`

| Conjunto | Tipo | Parámetros |
|---|---|---|
| rapido | `trapmf` | `[0 0 10 20]` |
| normal | `trimf` | `[10 25 40]` |
| lento | `trapmf` | `[30 45 60 60]` |

### Entrada 2 — `precio` (cuenta en MXN), rango `[0 2000]`

| Conjunto | Tipo | Parámetros |
|---|---|---|
| barato | `trapmf` | `[0 0 200 600]` |
| moderado | `trimf` | `[300 800 1300]` |
| caro | `trapmf` | `[1000 1500 2000 2000]` |

### Salida — `propina` (%), rango `[0 25]`

| Conjunto | Tipo | Parámetros |
|---|---|---|
| muy_baja | `trapmf` | `[0 0 3 6]` |
| baja | `trimf` | `[3 7 11]` |
| media | `trimf` | `[9 12.5 16]` |
| alta | `trimf` | `[14 18 22]` |
| muy_alta | `trapmf` | `[20 23 25 25]` |

### Reglas (relación precio–tiempo)

Idea: una cuenta **cara** justifica esperar más (platillos elaborados), una **barata** no.
Por eso el mismo tiempo lento castiga menos cuando el precio es alto.

| tiempo \ precio | barato | moderado | caro |
|---|---|---|---|
| **rapido** | alta | alta | muy_alta |
| **normal** | media | media | alta |
| **lento** | muy_baja | baja | media |

1. Si tiempo es rapido y precio es barato → propina alta
2. Si tiempo es rapido y precio es moderado → propina alta
3. Si tiempo es rapido y precio es caro → propina muy_alta
4. Si tiempo es normal y precio es barato → propina media
5. Si tiempo es normal y precio es moderado → propina media
6. Si tiempo es normal y precio es caro → propina alta
7. Si tiempo es lento y precio es barato → propina muy_baja
8. Si tiempo es lento y precio es moderado → propina baja
9. Si tiempo es lento y precio es caro → propina media

---

## 2. Definirlo en Fuzzy Logic Designer (a mano)

> Guía detallada campo por campo (app nueva y editor clásico): [`matlab/GUIA_DESIGNER.md`](matlab/GUIA_DESIGNER.md).
> Para abrirlo ya configurado: entra a `matlab/` y corre `abrir_designer`.

1. En MATLAB escribe `fuzzyLogicDesigner` (R2023a+) o `fuzzy` (versiones anteriores).
2. **Nuevo sistema → Mamdani** con 2 entradas y 1 salida.
3. Renombra las variables: `input1 → tiempo`, `input2 → precio`, `output1 → propina`.
4. Para cada variable pon el **Range** y agrega/edita las funciones de pertenencia con las tablas de arriba
   (nombre, tipo y parámetros exactos).
5. En **Rules** agrega las 9 reglas con conector **and** y peso 1.
6. Verifica en **System Properties**: And `min`, Or `max`, Implication `min`, Aggregation `max`,
   Defuzzification `centroid`.
7. Exporta: **Export → To File** → `propina.fis` (o `writeFIS(fis,'propina')` desde el workspace).

> Atajo: abre directamente el archivo del repo con `fuzzyLogicDesigner('matlab/propina.fis')`
> o córrelo por código con `crear_fis_propina.m`.

---

## 3. Sacar los datos en MATLAB (Mamdani)

```matlab
cd matlab
crear_fis_propina      % (opcional) regenera propina.fis por código
exportar_datos         % evalúa, exporta CSV/MAT y grafica
```

Lo que hace `exportar_datos.m`, paso a paso, por si quieres hacerlo en la Command Window:

```matlab
fis  = readfis('propina.fis');
opts = evalfisOptions('NumSamplePoints', 101);

% Un caso: 15 min de servicio, cuenta de $800
p = evalfis(fis, [15 800], opts)                     % -> 15.89

% Detalle de la inferencia (ruleFiring requiere R2019b+)
[p, fuzzIn, ruleOut, aggOut, ruleFiring] = evalfis(fis, [15 800], opts);
% fuzzIn     : grado de pertenencia por regla y entrada (9x2)
% ruleFiring : fuerza de disparo de cada regla (9x1)
% aggOut     : conjunto de salida agregado (101x1)

% Varios casos a la vez
casos = [5 150; 25 800; 50 1800];
evalfis(fis, casos, opts)

% Superficie completa a CSV
[T, P] = meshgrid(0:1:60, 0:50:2000);
Z = reshape(evalfis(fis, [T(:) P(:)], opts), size(T));
writetable(table(T(:), P(:), Z(:), ...
    'VariableNames', {'tiempo_min','precio_mxn','propina_pct'}), 'superficie_propina.csv');

% Gráficas
plotmf(fis, 'input', 1); plotmf(fis, 'input', 2); plotmf(fis, 'output', 1);
gensurf(fis)      % superficie 3D
plotfis(fis)      % diagrama del sistema
ruleview(fis)     % visor de reglas (en R2023a+ usa fuzzyLogicDesigner)
```

Archivos que genera: `casos_prueba.csv`, `superficie_propina.csv`, `superficie_propina.mat`.

### Valores de referencia (centroide, 101 puntos)

Calculados con el motor web, que replica `evalfis`; deben coincidir con MATLAB:

| tiempo (min) | precio (MXN) | propina (%) |
|---|---|---|
| 5 | 150 | 18.00 |
| 5 | 800 | 18.00 |
| 5 | 1800 | 23.21 |
| 25 | 150 | 12.50 |
| 25 | 800 | 12.50 |
| 25 | 1800 | 18.00 |
| 50 | 150 | 2.27 |
| 50 | 800 | 7.00 |
| 50 | 1800 | 12.50 |
| 15 | 450 | 15.60 |
| 15 | 800 | 15.89 |
| 35 | 1100 | 11.66 |

---

## 4. Calculadora web

- Lee `matlab/propina.fis`, así que si cambias el sistema en MATLAB, exportas y haces push,
  la página se actualiza sola.
- Muestra fuzzificación, conjunto agregado con el centroide, disparo de cada regla y la superficie de control.
- Montos mayores a $2,000 se saturan en el sistema difuso (cuentan como "caro"), pero la propina se calcula
  sobre el monto real.

Probar localmente (el `fetch` del `.fis` necesita servidor):

```bash
python3 -m http.server 8000   # abre http://localhost:8000
```

### Publicar en GitHub Pages

El workflow `.github/workflows/pages.yml` corre las pruebas del motor difuso (`npm test`) y publica el sitio
en cada push. Solo la primera vez: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
El sitio queda en `https://sebastiux.github.io/fuzzylogicrestaurante/`.
