%% verificar_octave.m
% Ejecuta matlab/propina.fis en GNU Octave (fuzzy-logic-toolkit), genera las
% figuras de configuracion del reporte y exporta los resultados a CSV.
%
% El toolkit de Octave exige a < b en trapmf (MATLAB acepta a = b). Los
% hombros se extienden 1 unidad fuera del rango, lo que no cambia ningun
% valor dentro del dominio de la variable.
%
% Uso (desde reporte/octave):  octave --no-gui verificar_octave.m

pkg load fuzzy-logic-toolkit
graphics_toolkit('gnuplot');
set(0, 'defaultfigurevisible', 'off');

fis = readfis('../../matlab/propina.fis');
vars = {'input', 'input', 'output'};
idx  = [1 2 1];
for k = 1:3
  v = fis.(vars{k})(idx(k));
  for m = 1:numel(v.mf)
    p = v.mf(m).params;
    if strcmp(v.mf(m).type, 'trapmf')
      if p(1) == p(2), p(1) = p(1) - 1; end
      if p(3) == p(4), p(4) = p(4) + 1; end
    end
    fis.(vars{k})(idx(k)).mf(m).params = p;
  end
end

figs = '../figuras/';

%% Funciones de pertenencia
titulos = {'tiempo (min)', 'precio (MXN)', 'propina (%)'};
nombres = {'oct_mf_tiempo', 'oct_mf_precio', 'oct_mf_propina'};
for k = 1:3
  figure('position', [0 0 900 380]);
  plotmf(fis, vars{k}, idx(k));
  title(titulos{k});
  print([figs nombres{k} '.png'], '-dpng', '-r150');
  close;
end

%% Superficie de control
figure('position', [0 0 900 650]);
gensurf(fis);
title('Superficie de control Mamdani');
print([figs 'oct_superficie.png'], '-dpng', '-r150');
close;

%% Casos de prueba
casos = [5 150; 5 800; 5 1800; 25 150; 25 800; 25 1800; ...
         50 150; 50 800; 50 1800; 15 450; 15 800; 35 1100; 42 1500];
y = evalfis(casos, fis, 101);
fid = fopen('casos_octave.csv', 'w');
fprintf(fid, 'tiempo_min,precio_mxn,propina_pct\n');
fprintf(fid, '%g,%g,%.6f\n', [casos y]');
fclose(fid);
printf('%5g %6g  -> %8.4f %%\n', [casos y]');

%% Detalle de un caso: grados de pertenencia y disparo de reglas
[out, irr, orr, arr] = evalfis([15 800], fis, 101);
disparo = min(irr, [], 2);
fid = fopen('detalle_15_800.csv', 'w');
fprintf(fid, 'regla,mu_tiempo,mu_precio,disparo\n');
fprintf(fid, '%d,%.6f,%.6f,%.6f\n', [(1:rows(irr))' irr disparo]');
fclose(fid);
printf('Caso [15 800] -> %.4f %%\n', out);

%% Malla completa
[T, P] = meshgrid(0:1:60, 0:50:2000);
Z = reshape(evalfis([T(:) P(:)], fis, 101), size(T));
csvwrite('superficie_octave.csv', [T(:) P(:) Z(:)]);
printf('Malla: %d puntos, min %.4f, max %.4f\n', numel(Z), min(Z(:)), max(Z(:)));

%% Visor de reglas (equivalente a ruleview) para [15 800]
entrada = [15 800];
[out, irr, orr, arr] = evalfis(entrada, fis, 101);
nr = numel(fis.rule);
xo = linspace(fis.output(1).range(1), fis.output(1).range(2), 101);
figure('position', [0 0 1000 1250]);
for r = 1:nr
  ant = fis.rule(r).antecedent;
  for i = 1:2
    v = fis.input(i);
    x = linspace(v.range(1), v.range(2), 301);
    mf = v.mf(ant(i));
    y = evalmf(x, mf.params, mf.type);
    subplot(nr + 1, 3, (r - 1) * 3 + i);
    area(x, min(y, irr(r, i)), 'facecolor', [0.65 0.80 0.97], 'edgecolor', 'none'); hold on;
    plot(x, y, 'color', [0.16 0.47 0.84], 'linewidth', 1.2);
    plot([entrada(i) entrada(i)], [0 1], 'r', 'linewidth', 1);
    axis([v.range 0 1.05]); set(gca, 'ytick', [], 'xtick', [], 'fontsize', 7);
    if r == 1, title(sprintf('%s = %g', v.name, entrada(i))); end
    if i == 1, ylabel(sprintf('R%d', r)); end
  end
  mfo = fis.output(1).mf(fis.rule(r).consequent);
  yo = evalmf(xo, mfo.params, mfo.type);
  subplot(nr + 1, 3, (r - 1) * 3 + 3);
  area(xo, min(yo, min(irr(r, :))), 'facecolor', [0.65 0.80 0.97], 'edgecolor', 'none'); hold on;
  plot(xo, yo, 'color', [0.16 0.47 0.84], 'linewidth', 1.2);
  axis([fis.output(1).range 0 1.05]); set(gca, 'ytick', [], 'xtick', [], 'fontsize', 7);
  if r == 1, title('propina'); end
end
subplot(nr + 1, 3, nr * 3 + 3);
area(xo, arr, 'facecolor', [0.16 0.47 0.84], 'edgecolor', 'none'); hold on;
plot([out out], [0 1], 'r', 'linewidth', 1.5);
axis([fis.output(1).range 0 1.05]); set(gca, 'ytick', [], 'fontsize', 7);
title(sprintf('propina = %.2f %%', out));
print([figs 'oct_ruleview.png'], '-dpng', '-r150');
close;
