/**
 * The part of <head> that is the same in all three apps.
 *
 * It is here rather than copied into three index.html files because of one
 * block: the inline theme script. It has to be inline and it has to run before
 * the first paint, so it cannot be imported — and it mirrors applyTheme() in
 * shared/ui/theme.js, which means three copies would be three chances for the
 * dark-mode flash to come back in one app and not the others.
 *
 * Injected by the Vite config; an app's own index.html carries only its title
 * and the one meta tag that names its colour.
 */

export default `
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <!-- Runs before the first paint, so a dark-mode device never gets a white
         flash while the bundle loads. Deliberately inline and tiny: a module
         import here would be fetched and evaluated after paint, which is the
         flash it exists to prevent. Mirrors applyTheme() in shared/ui/theme.js. -->
    <script>
      (function () {
        try {
          var t = localStorage.getItem("urs.theme");
          if (t === "light" || t === "dark") {
            document.documentElement.setAttribute("data-theme", t);
            document.documentElement.style.colorScheme = t;
          } else {
            document.documentElement.style.colorScheme = "light dark";
          }
        } catch (e) { /* storage blocked — the media query still applies */ }
      })();
    </script>`;
