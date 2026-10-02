(function () {
        try {
          var pref = localStorage.getItem('valen-modo-tema');
          if (pref !== 'claro' && pref !== 'escuro' && pref !== 'auto') pref = 'auto';
          var prefereEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
          var modo = pref === 'auto' ? (prefereEscuro ? 'escuro' : 'claro') : pref;
          document.documentElement.setAttribute('data-tema', modo);
          document.documentElement.style.colorScheme = modo === 'escuro' ? 'dark' : 'light';
        } catch (e) {
          var prefereEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
          var modo = prefereEscuro ? 'escuro' : 'claro';
          document.documentElement.setAttribute('data-tema', modo);
          document.documentElement.style.colorScheme = modo === 'escuro' ? 'dark' : 'light';
        }
      })();
