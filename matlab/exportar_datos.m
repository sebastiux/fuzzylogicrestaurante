%% exportar_datos.m
% Extrae todos los datos del FIS Mamdani "propina":
%   1) evaluacion de un caso, con grados de pertenencia y disparo de reglas
%   2) casos de prueba (para comparar con la calculadora web)
%   3) malla completa tiempo x precio -> propina (CSV + MAT)
%   4) graficas: funciones de pertenencia, superficie, visor de reglas
%
% Ejecutar en la carpeta donde esta propina.fis.

clear; clc; close all;
fis = readfis('propina.fis');

% Mismo muestreo de salida que usa la web (101 puntos es el default de MATLAB)
opts = evalfisOptions('NumSamplePoints', 101);

%% 1) Un caso individual con todo el detalle
entrada = [15 800];   % [tiempo(min) precio(MXN)]
[salida, fuzzIn, ruleOut, aggOut, ruleFiring] = evalfis(fis, entrada, opts);

fprintf('Entrada: tiempo = %g min, precio = $%g\n', entrada);
fprintf('Propina recomendada: %.2f %%\n\n', salida);

disp('Grado de pertenencia de cada regla (columnas: tiempo, precio):');
disp(array2table(fuzzIn, 'VariableNames', {'mu_tiempo', 'mu_precio'}, ...
    'RowNames', compose('R%d', 1:size(fuzzIn,1))));

disp('Fuerza de disparo (min de los antecedentes):');
disp(array2table(ruleFiring, 'VariableNames', {'disparo'}, ...
    'RowNames', compose('R%d', 1:numel(ruleFiring))));

xOut = linspace(fis.Outputs(1).Range(1), fis.Outputs(1).Range(2), 101)';
figure('Name', 'Salida agregada');
area(xOut, aggOut, 'FaceAlpha', 0.35); hold on;
xline(salida, '--', sprintf('centroide = %.2f%%', salida));
xlabel('propina (%)'); ylabel('\mu'); ylim([0 1.05]); grid on;
title('Conjunto agregado y defuzzificacion por centroide');

%% 2) Casos de prueba
casos = [ 5  150;  5 800;  5 1800;
         25  150; 25 800; 25 1800;
         50  150; 50 800; 50 1800;
         15  450; 35 1100];
res = evalfis(fis, casos, opts);
tablaCasos = array2table([casos res], ...
    'VariableNames', {'tiempo_min', 'precio_mxn', 'propina_pct'});
disp(tablaCasos);
writetable(tablaCasos, 'casos_prueba.csv');

%% 3) Malla completa (superficie de control)
t = 0:1:60;           % 61 valores de tiempo
p = 0:50:2000;        % 41 valores de precio
[T, P] = meshgrid(t, p);
Z = evalfis(fis, [T(:) P(:)], opts);
Z = reshape(Z, size(T));

tablaMalla = table(T(:), P(:), Z(:), ...
    'VariableNames', {'tiempo_min', 'precio_mxn', 'propina_pct'});
writetable(tablaMalla, 'superficie_propina.csv');
save('superficie_propina.mat', 'T', 'P', 'Z');
fprintf('Exportados %d puntos a superficie_propina.csv / .mat\n', numel(Z));

%% 4) Graficas
figure('Name', 'Funciones de pertenencia');
subplot(3,1,1); plotmf(fis, 'input', 1);  title('tiempo (min)');
subplot(3,1,2); plotmf(fis, 'input', 2);  title('precio (MXN)');
subplot(3,1,3); plotmf(fis, 'output', 1); title('propina (%)');

figure('Name', 'Superficie');
surf(T, P, Z); shading interp; colorbar;
xlabel('tiempo (min)'); ylabel('precio (MXN)'); zlabel('propina (%)');
title('Superficie de control Mamdani');
% Alternativa directa del toolbox:  gensurf(fis)

figure('Name', 'Estructura'); plotfis(fis);

% Visor de reglas interactivo (en R2023a+ abre dentro de Fuzzy Logic Designer)
try
    ruleview(fis);
catch
    fuzzyLogicDesigner(fis);
end
