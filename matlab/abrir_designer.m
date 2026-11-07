%% abrir_designer.m
% Abre Fuzzy Logic Designer con el sistema "propina" ya configurado
% (entradas, funciones de pertenencia, reglas y metodos).
%
% Uso: abre este archivo en MATLAB y presiona Run (o escribe abrir_designer).
% Si propina.fis no esta en esta carpeta, lo crea con crear_fis_propina.m.

carpeta = fileparts(mfilename('fullpath'));
if isempty(carpeta), carpeta = pwd; end
archivo = fullfile(carpeta, 'propina.fis');

if ~isfile(archivo)
    fprintf('No encontre %s, lo creo...\n', archivo);
    run(fullfile(carpeta, 'crear_fis_propina.m'));
    carpeta = fileparts(mfilename('fullpath'));   % crear_fis_propina hace "clear"
    if isempty(carpeta), carpeta = pwd; end
    archivo = fullfile(carpeta, 'propina.fis');
end

fis = readfis(archivo);
fprintf('Sistema "%s": %d entradas, %d salida, %d reglas\n', ...
    fis.Name, numel(fis.Inputs), numel(fis.Outputs), numel(fis.Rules));

if exist('fuzzyLogicDesigner', 'file')
    fuzzyLogicDesigner(fis);   % app nueva (R2023a o posterior)
else
    fuzzy(fis);                % editor clasico (R2022b o anterior)
end
