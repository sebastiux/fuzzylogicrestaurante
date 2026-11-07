%% crear_fis_propina.m
% Construye por codigo el sistema difuso Mamdani "propina" y lo guarda como
% propina.fis (el mismo archivo que usa la calculadora web).
%
% Entradas:
%   tiempo  [0 60]   minutos de servicio (desde que ordenas hasta que te sirven)
%   precio  [0 2000] monto de la cuenta en MXN
% Salida:
%   propina [0 25]   porcentaje recomendado
%
% Requiere Fuzzy Logic Toolbox R2018b o posterior (mamfis/addInput/addMF).

clear; clc;

fis = mamfis('Name', 'propina', ...
    'AndMethod', 'min', ...
    'OrMethod', 'max', ...
    'ImplicationMethod', 'min', ...
    'AggregationMethod', 'max', ...
    'DefuzzificationMethod', 'centroid');

%% Entrada 1: tiempo de servicio (min)
fis = addInput(fis, [0 60], 'Name', 'tiempo');
fis = addMF(fis, 'tiempo', 'trapmf', [0 0 10 20],    'Name', 'rapido');
fis = addMF(fis, 'tiempo', 'trimf',  [10 25 40],     'Name', 'normal');
fis = addMF(fis, 'tiempo', 'trapmf', [30 45 60 60],  'Name', 'lento');

%% Entrada 2: precio de la cuenta (MXN)
fis = addInput(fis, [0 2000], 'Name', 'precio');
fis = addMF(fis, 'precio', 'trapmf', [0 0 200 600],         'Name', 'barato');
fis = addMF(fis, 'precio', 'trimf',  [300 800 1300],        'Name', 'moderado');
fis = addMF(fis, 'precio', 'trapmf', [1000 1500 2000 2000], 'Name', 'caro');

%% Salida: porcentaje de propina
fis = addOutput(fis, [0 25], 'Name', 'propina');
fis = addMF(fis, 'propina', 'trapmf', [0 0 3 6],       'Name', 'muy_baja');
fis = addMF(fis, 'propina', 'trimf',  [3 7 11],        'Name', 'baja');
fis = addMF(fis, 'propina', 'trimf',  [9 12.5 16],     'Name', 'media');
fis = addMF(fis, 'propina', 'trimf',  [14 18 22],      'Name', 'alta');
fis = addMF(fis, 'propina', 'trapmf', [20 23 25 25],   'Name', 'muy_alta');

%% Reglas
% Idea central (relacion precio-tiempo): una cuenta cara "justifica" mas
% tiempo de espera (platillos elaborados); una cuenta barata no.
% Formato: [tiempo precio propina peso conector(1=AND)]
reglas = [ ...
    1 1 4 1 1;   % rapido & barato   -> alta
    1 2 4 1 1;   % rapido & moderado -> alta
    1 3 5 1 1;   % rapido & caro     -> muy_alta
    2 1 3 1 1;   % normal & barato   -> media
    2 2 3 1 1;   % normal & moderado -> media
    2 3 4 1 1;   % normal & caro     -> alta
    3 1 1 1 1;   % lento  & barato   -> muy_baja
    3 2 2 1 1;   % lento  & moderado -> baja
    3 3 3 1 1];  % lento  & caro     -> media
fis = addRule(fis, reglas);

showrule(fis)

%% Guardar
carpeta = fileparts(mfilename('fullpath'));
if isempty(carpeta), carpeta = pwd; end
writeFIS(fis, fullfile(carpeta, 'propina'));   % crea propina.fis junto a este script
fprintf('Guardado %s\n', fullfile(carpeta, 'propina.fis'));

%% Prueba rapida
p = evalfis(fis, [15 800]);
fprintf('tiempo = 15 min, precio = $800  ->  propina = %.2f %%\n', p);
