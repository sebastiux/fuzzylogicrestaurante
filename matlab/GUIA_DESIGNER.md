# Guía: configurar "propina" en Fuzzy Logic Designer

## Opción A: que aparezca todo ya llenado

1. Descarga el repo (**Code → Download ZIP**) y descomprímelo.
2. En MATLAB, entra a la carpeta `matlab/` del repo (en el panel *Current Folder*).
3. Escribe en la Command Window:

   ```matlab
   abrir_designer
   ```

   O directamente: `fuzzyLogicDesigner('propina.fis')`.

Si abres el diseñador **vacío** (`fuzzyLogicDesigner` sin nada), puedes cargarlo desde el menú:
- **R2023a o posterior:** pestaña *Design* → **Open** → *Open FIS from File* → `propina.fis`.
- **R2022b o anterior:** **File → Import → From File…** → `propina.fis`.

---

## Opción B: llenarlo a mano, campo por campo

### Valores que vas a capturar

**Sistema**

| Campo | Valor |
|---|---|
| Name | `propina` |
| Type | Mamdani (Type-1) |
| And method | `min` |
| Or method | `max` |
| Implication | `min` |
| Aggregation | `max` |
| Defuzzification | `centroid` |

**Entrada 1**: Name `tiempo`, Range `[0 60]`

| MF Name | Type | Params |
|---|---|---|
| rapido | trapmf | `[0 0 10 20]` |
| normal | trimf | `[10 25 40]` |
| lento | trapmf | `[30 45 60 60]` |

**Entrada 2**: Name `precio`, Range `[0 2000]`

| MF Name | Type | Params |
|---|---|---|
| barato | trapmf | `[0 0 200 600]` |
| moderado | trimf | `[300 800 1300]` |
| caro | trapmf | `[1000 1500 2000 2000]` |

**Salida**: Name `propina`, Range `[0 25]`

| MF Name | Type | Params |
|---|---|---|
| muy_baja | trapmf | `[0 0 3 6]` |
| baja | trimf | `[3 7 11]` |
| media | trimf | `[9 12.5 16]` |
| alta | trimf | `[14 18 22]` |
| muy_alta | trapmf | `[20 23 25 25]` |

**Reglas** (todas con conector `and` y peso `1`)

| # | tiempo | precio | propina |
|---|---|---|---|
| 1 | rapido | barato | alta |
| 2 | rapido | moderado | alta |
| 3 | rapido | caro | muy_alta |
| 4 | normal | barato | media |
| 5 | normal | moderado | media |
| 6 | normal | caro | alta |
| 7 | lento | barato | muy_baja |
| 8 | lento | moderado | baja |
| 9 | lento | caro | media |

> Las *Params* se escriben con corchetes y espacios, como `[0 0 10 20]`. **trimf lleva 3 números y trapmf lleva 4**.
> Si eliges el *Type* y luego pegas *Params* con otra cantidad de números, MATLAB marca error.

---

### B1. MATLAB R2023a o posterior (app nueva)

1. `fuzzyLogicDesigner` → en la pantalla de inicio elige **Mamdani Type-1**.
2. **Sistema:** en el *System Browser* (izquierda) selecciona el nodo raíz del FIS. En el *Property Editor* (derecha) pon
   Name `propina` y los 5 métodos (And `min`, Or `max`, Implication `min`, Aggregation `max`, Defuzzification `centroid`).
3. **Variables:** el sistema nuevo trae entradas/salidas por defecto. Asegúrate de tener **2 entradas y 1 salida**:
   usa **Add Input** de la barra superior si te falta una, o clic derecho → **Delete** si sobra.
4. **Entrada 1:** selecciónala en el *System Browser* → *Property Editor*: Name `tiempo`, Range `[0 60]`.
5. **MFs de tiempo:** en el *System Browser* despliega `tiempo` y selecciona cada MF (`mf1`, `mf2`, `mf3`).
   Para cada una cambia Name, Type y Params según la tabla. Si faltan MFs: **Add MF**; si sobran: clic derecho → **Delete**.
6. Repite los pasos 4–5 con la **Entrada 2** (`precio`, `[0 2000]`).
7. **Salida:** selecciónala → Name `propina`, Range `[0 25]`. Necesitas **5 MFs**: agrega las que falten con **Add MF**
   y llena las 5 con la tabla.
8. **Reglas:** abre el panel **Rules** (en el *System Browser* o con **Add Rule** en la barra superior). Para cada regla
   elige en los menús: tiempo, precio, propina, Connection `and`, Weight `1`. Repite hasta tener las 9.
9. **Verificar:** en el toolstrip abre **Rule Inference** (visor de reglas): pon tiempo `15` y precio `800` y debe dar
   **≈ 15.89**. En **Control Surface** ves la superficie.
10. **Guardar:** **Export → Export to File** → `propina.fis` (para la página web). También puedes **Export to Workspace** como `fis`.

### B2. MATLAB R2022b o anterior (editor clásico, `fuzzy`)

1. Escribe `fuzzy`. Se abre el *FIS Editor* con `input1` (amarillo), el bloque Mamdani (blanco) y `output1` (azul).
2. **Agregar segunda entrada:** menú **Edit → Add Variable → Input**. Aparece `input2`.
3. **Nombres:** da un clic en el cuadro `input1` y en el campo **Name** (abajo a la derecha) escribe `tiempo` + Enter.
   Haz lo mismo: `input2` → `precio`, `output1` → `propina`.
4. **Métodos** (menús abajo a la izquierda): And method `min`, Or method `max`, Implication `min`,
   Aggregation `max`, Defuzzification `centroid`.
5. **Funciones de pertenencia:** doble clic en el cuadro `tiempo` → se abre el *Membership Function Editor*.
   - Campo **Range**: `[0 60]` + Enter. Pon el mismo valor en **Display Range**.
   - Trae 3 MFs `mf1`, `mf2`, `mf3`. Da clic en cada curva (se pone roja) y llena abajo:
     **Name**, **Type** (menú) y **Params** según la tabla + Enter.
6. Sin cerrar esa ventana, da clic en `precio` (arriba a la izquierda, *FIS Variables*) y repite: Range `[0 2000]` y las 3 MFs.
7. Da clic en `propina`: Range `[0 25]`. Necesita 5 MFs: **Edit → Add MFs…** → MF type `trimf`, Number of MFs `2` → OK.
   Llena las 5 según la tabla.
8. **Reglas:** en el FIS Editor, **Edit → Rules…** (o doble clic en el bloque blanco central). En el *Rule Editor*:
   - En la lista de `tiempo` elige `rapido`, en `precio` elige `barato`, en `propina` elige `alta`.
   - Connection: **and**, Weight: **1** → botón **Add rule**.
   - Repite para las 9 reglas. Si te equivocas: selecciona la regla → ajusta → **Change rule**, o **Delete rule**.
9. **Verificar:** **View → Rules** (Rule Viewer). En el campo *Input* escribe `[15 800]` + Enter → propina **≈ 15.89**.
   **View → Surface** muestra la superficie 3D.
10. **Guardar:** en el FIS Editor, **File → Export → To File…** → `propina.fis`.
    (Opcional: **File → Export → To Workspace** → nombre `fis`.)

---

## Comprobar que quedó igual al del repo

```matlab
fis = readfis('propina.fis');
evalfis(fis, [15 800])    % 15.89
evalfis(fis, [50 150])    % 2.27
evalfis(fis, [5 1800])    % 23.21
showrule(fis)             % lista las 9 reglas
```

Si los números coinciden, sube tu `propina.fis` a `matlab/` del repo y la calculadora web usará tu versión.
