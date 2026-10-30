// Pinta los colores guardados antes de que cargue la app, así no hay flash de otro tema.
(function () {
  try {
    var saved = JSON.parse(localStorage.getItem('fino-theme'));
    if (!saved) return;
    var root = document.documentElement;
    Object.keys(saved.vars).forEach(function (k) { root.style.setProperty(k, saved.vars[k]); });
    root.style.colorScheme = saved.dark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = saved.vars['--bg'];
  } catch (e) {}
})();
