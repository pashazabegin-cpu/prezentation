/* ═══════════════════════════════════════════════════════════════
   Презентация «Будем знакомы».

   Порядок запуска внизу файла значим: initCut режет заголовки на буквы,
   и только после этого их можно мерить. Появление узлов и параллакс ведёт
   один rAF-цикл в initParallax — он и так каждый кадр знает положение секций.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var slides = [].slice.call(document.querySelectorAll('.slide'));
  var tiles = [].slice.call(document.querySelectorAll('.tile'));

  /* ───────── появление: каждый узел проявляется, выходя снизу ───────── */

  /* Кто именно показывает узлы — rAF-цикл в initParallax: он и так каждый кадр
     знает положение всех слайдов, так что второй механизм только развёл бы
     источники правды. Здесь остаётся страховка: если цикл почему-то не пошёл,
     через две с половиной секунды показываем всё разом — пустой презентация
     не останется ни при каком раскладе. */

  /* ───────── текст акцентного цвета: режем на буквы под маски ───────── */

  /* Режем по словам, а внутри слова по буквам. Если резать сразу на буквы,
     каждая станет инлайн-блоком и строка сможет переноситься посреди слова. */

  function initCut() {
    [].slice.call(document.querySelectorAll('.cut, .a')).forEach(function (el) {
      var text = el.textContent;
      var frag = document.createDocumentFragment();
      var c = 0;

      text.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) {          /* пробелы и переносы оставляем как есть */
          frag.appendChild(document.createTextNode(part));
          return;
        }
        var word = document.createElement('span');
        word.className = 'w';
        part.split('').forEach(function (ch) {
          var mask = document.createElement('span');
          mask.className = 'm';
          mask.style.setProperty('--c', c++);
          var glyph = document.createElement('i');
          glyph.textContent = ch;
          mask.appendChild(glyph);
          word.appendChild(mask);
        });
        frag.appendChild(word);
      });

      el.textContent = '';
      el.appendChild(frag);
      el.classList.add('cut');            /* .a получает механику заодно с цветом */
    });
  }

  var revealables = [].slice.call(document.querySelectorAll('.rv, .tile, .cut, .a'));

  function show(node) { node.classList.add('is-vis'); }

  /* Положение секции берём из потока (offsetTop) и считаем от скрола: так в
     кадре не нужен getBoundingClientRect на каждую секцию. */
  function measure() {
    slides.forEach(function (s) { s._top = s.offsetTop; s._h = s.offsetHeight; });
  }
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);

  function initReveal() {
    setTimeout(function () {
      if (!document.querySelector('.is-vis')) revealables.forEach(show);
    }, 2500);
  }

  /* ───────── параллакс: скрол задаёт глубину, мышь её качает ───────── */

  function initParallax() {
    if (reduceMotion || !tiles.length) return;

    /* цель и текущее положение указателя в долях от центра окна */
    var mtx = 0, mty = 0, mx = 0, my = 0;

    if (hasMouse) {
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        mtx = (e.clientX / window.innerWidth - 0.5) * 2;
        mty = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    /* Каждому слою — своя доля проявления, чтобы коллаж собирался по глубине.
       Тем, кто размечен видимым сразу (портрет обложки), ставим единицу:
       иначе они всё равно проедут путь выезда снизу. */
    tiles.forEach(function (t) {
      var ready = t.classList.contains('is-vis');
      t._rv = ready ? 1 : 0;
      if (ready) { t._shown = true; t._t0 = 0; }
      /* скорость доезда: ближние слои подбираются быстрее дальних */
      t._sp = 0.03 + (parseFloat(t.style.getPropertyValue('--d')) || 0.1) * 0.08;
    });

    /* Раскладываем узлы по слайдам один раз: в кадре нельзя ни искать по DOM,
       ни читать getBoundingClientRect у каждого — это принудительный пересчёт
       вёрстки семьдесят раз за кадр. Положение считаем из --y и геометрии сцены. */
    slides.forEach(function (slide) {
      slide._tiles = [].slice.call(slide.querySelectorAll('.tile'));
      slide._items = [].slice.call(slide.querySelectorAll('.rv, .tile, .cut, .a'));
      slide._still = slide.hasAttribute('data-still');
      slide._outs = [].slice.call(slide.querySelectorAll('[data-out]'));
      slide._items.forEach(function (n) {
        if (n.classList.contains('is-vis')) n._shown = true;
        /* у .a своей координаты нет — он инлайновый, берём у родительского блока */
        var host = n.style.getPropertyValue('--y') ? n : n.closest('.t');
        n._y = (host && parseFloat(host.style.getPropertyValue('--y'))) || 0;
        n._d = parseFloat(n.style.getPropertyValue('--d')) || 0.1;
        n._i = parseFloat(n.style.getPropertyValue('--i')) || 0;
      });
    });

    function frame() {
      var vh = window.innerHeight;
      mx += (mtx - mx) * 0.07;
      my += (mty - my) * 0.07;

      var now = performance.now();
      /* Позицию берём сырую, без сглаживания. Сглаживание тут пробовали — оно
         давало запаздывание: колесо провернул, а картинка догоняет, и скрол
         переставал ощущаться нативным. Секции едут нативно, эффекты должны
         идти с ними в такт. */
      var y = window.scrollY || window.pageYOffset;

      for (var s = 0; s < slides.length; s++) {
        var slide = slides[s];
        var flowTop = slide._top - y;          /* где секция была бы без липкости */
        /* секции теперь разной высоты, поэтому и отсечка считается от неё */
        if (flowTop > vh * 1.2 || flowTop < -(slide._h + vh * 0.2)) continue;

        /* Очередь появления. Порог считаем от положения самой секции, а не от
           места узла в кадре: иначе узел проявляется, пока секция ещё внизу
           экрана, и текст выезжает снизу вместе с ней. Здесь же он возникает
           уже на своём месте наверху — когда секция почти встала. Плитки идут
           следом и доезжают снизу своим ходом. */
        var items = slide._items;
        for (var j = 0; j < items.length; j++) {
          var n = items[j];
          if (n._shown) continue;
          /* Содержимое собирается, пока секция ещё поднимается, а не после
             того, как встала: иначе экран приезжает пустым и наполняется
             рывком в самом конце. */
          var porog = n.classList.contains('tile') ? vh * 0.75 : vh * 0.92;
          if (flowTop < porog) {
            show(n);
            n._shown = true;
            n._t0 = now + n._i * 90;         /* та же лесенка, что в CSS */
          }
        }

        /* большой заголовок уходит обратно под маску, когда экран поехал вверх */
        if (slide._outs.length) {
          /* Экран-разбег теперь обычный и просто уезжает вверх, так что
             заголовок успевает постоять: уходит под маску, когда экран
             сдвинулся на четверть. */
          var gone = flowTop < -vh * 0.25;
          if (gone !== slide._gone) {
            slide._gone = gone;
            for (var o = 0; o < slide._outs.length; o++) {
              slide._outs[o].classList.toggle('is-out', gone);
            }
          }
        }

        /* p = 0 когда секция по центру окна, ±1 — на экран выше/ниже */
        var p = flowTop / vh;
        var own = slide._tiles;

        for (var i = 0; i < own.length; i++) {
          var tile = own[i];
          var d = tile._d;

          /* Доезд у каждой плитки свой: и стартует по лесенке, и идёт со своей
             скоростью — глубокие слои медленнее ближних. Это и даёт глубину
             без привязки к скролу. */
          var live = tile._shown && now >= tile._t0 ? 1 : 0;
          tile._rv += (live - tile._rv) * tile._sp;
          var settle = 1 - tile._rv;

          var dx = slide._still ? 0 : mx * d * 64;
          /* Вертикальный параллакс: с привязкой к блокам он живёт только
             в переходе — внутри секции прокрутка стоит, сдвигать слои нечем.
             Поэтому коэффициент крупный (0,95 против 0,55 без снапа), иначе
             глубина не успевает прочитаться за короткую анимацию.
             Выезд снизу при появлении заодно ужат, чтобы два движения
             не складывались в один длинный полёт. */
          var dy = (slide._still ? 0 : -p * d * vh * 0.95 + my * d * 40)
                 + settle * (70 + d * 220);

          tile.style.transform =
            'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0)';
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ───────── ховер по коллажу: наведённый слой подрастает ───────── */

  function initHover() {
    if (!hasMouse) return;
    /* обложка из ховера исключена: там один портрет, и подрастать ему незачем */
    tiles.forEach(function (tile) {
      if (tile.closest('.slide').id === 's1') return;
      tile.addEventListener('pointerenter', function () { tile.classList.add('is-hot'); });
      tile.addEventListener('pointerleave', function () { tile.classList.remove('is-hot'); });
    });
  }

  /* ───────── видео: подхватываются из data-video, играют только в кадре ───────── */
  /* Пока все превью — картинки. Появится файл — достаточно дописать
     data-video="assets/deck/имя.mp4" на нужный .tile, разметку менять не надо. */

  function initVideo() {
    var hosts = [].slice.call(document.querySelectorAll('.tile[data-video]'));
    if (!hosts.length || !('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var tile = e.target;
        if (e.isIntersecting) {
          var video = tile._video;
          if (!video) {
            video = document.createElement('video');
            video.src = tile.getAttribute('data-video');
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.preload = 'auto';
            var poster = tile.querySelector('img');
            if (poster) video.poster = poster.getAttribute('src');
            tile.querySelector('.tile__in').appendChild(video);
            tile._video = video;
          }
          var play = video.play();
          if (play && play.catch) play.catch(function () {});
        } else if (tile._video) {
          tile._video.pause();
        }
      });
    }, { threshold: 0.3 });

    hosts.forEach(function (t) { io.observe(t); });
  }

  /* ───────── счётчик, подсказка и стрелки ───────── */

  function initNav() {
    var hud = document.querySelector('[data-hud]');
    var total = slides.length;

    /* Считаем по реальным позициям секций, а не делением скрола на высоту окна:
       у экранов-разбегов высота двойная, и деление врало бы. */
    function current() {
      var mid = window.scrollY + window.innerHeight / 2;
      var i = 0;
      for (var k = 0; k < slides.length; k++) if (slides[k]._top <= mid) i = k;
      return Math.max(0, Math.min(total - 1, i));
    }

    function update() {
      if (hud) hud.textContent = pad(current() + 1) + ' / ' + pad(total);
    }
    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    /* презентацию открывают с первого слайда, а не с того, где закрыли */
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    window.addEventListener('pageshow', update);
    update();

    document.addEventListener('keydown', function (e) {
      var step = 0;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') step = 1;
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') step = -1;
      else if (e.key === 'Home') step = -total;
      else if (e.key === 'End') step = total;
      else return;

      e.preventDefault();
      var next = Math.max(0, Math.min(total - 1, current() + step));
      slides[next].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ───────── курсор: перенесён с портфолио ───────── */

  function initCursor() {
    var parts = [].slice.call(document.querySelectorAll('[data-cursor]'));
    if (!parts.length || !hasMouse) return;

    root.classList.add('has-cursor');

    var x = window.innerWidth / 2, y = window.innerHeight / 2;
    var tx = x, ty = y;
    var awake = false;

    function tick() {
      var ease = reduceMotion ? 1 : 0.24;
      x += (tx - x) * ease;
      y += (ty - y) * ease;
      var t = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
      for (var i = 0; i < parts.length; i++) parts[i].style.transform = t;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    function setState(target) {
      var close = target.closest ? target.closest.bind(target) : function () { return null; };
      var link = close('a[href]');
      var view = !link && close('.tile') && !close('#s1');
      var onAccent = close('.plate, .marquee');

      root.classList.toggle('c-link', !!link);
      root.classList.toggle('c-view', !!view);
      root.classList.toggle('c-onaccent', !!onAccent);
    }

    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      if (!awake) {
        awake = true;
        x = tx; y = ty;
        root.classList.add('c-awake');
      }
      setState(e.target);
    }, { passive: true });

    document.addEventListener('pointerdown', function () { root.classList.add('c-down'); });
    document.addEventListener('pointerup', function () { root.classList.remove('c-down'); });
    document.addEventListener('mouseleave', function () { root.classList.remove('c-awake'); awake = false; });
    document.addEventListener('mouseenter', function () { root.classList.add('c-awake'); awake = true; });
  }

  /* initCut идёт первым: остальное меряет уже разрезанные на буквы заголовки */
  initCut();
  initReveal();
  initParallax();
  initHover();
  initVideo();
  initNav();
  initCursor();
})();
