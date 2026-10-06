(function () {
  'use strict';

  var doc = document.documentElement;
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q).matches : false; };
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------------
     Open / closed status in Panama time (hours from the brief)
  ------------------------------------------------------------------ */
  var HOURS = { 0: [510, 870] }; // Sunday 8:30–14:30 (minutes)
  for (var d = 1; d <= 6; d++) HOURS[d] = [510, 990]; // Mon–Sat 8:30–16:30

  function panamaNow() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Panama', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
      }).formatToParts(new Date());
      var map = {};
      parts.forEach(function (p) { map[p.type] = p.value; });
      var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return { day: days[map.weekday], min: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10) };
    } catch (err) {
      return null;
    }
  }

  function fmt(min) {
    var h = Math.floor(min / 60), m = min % 60;
    var suffix = h >= 12 ? 'p. m.' : 'a. m.';
    var h12 = h % 12 || 12;
    return h12 + ':' + (m < 10 ? '0' + m : m) + ' ' + suffix;
  }

  function updateStatus() {
    var now = panamaNow();
    if (!now) return;
    var today = HOURS[now.day];
    var open = now.min >= today[0] && now.min < today[1];
    var msg = open ? 'Abierto hoy hasta las ' + fmt(today[1])
      : now.min < today[0] ? 'Abrimos hoy a las ' + fmt(today[0])
      : 'Cerrado. Abrimos mañana a las ' + fmt(HOURS[(now.day + 1) % 7][0]);

    $$('[data-status]').forEach(function (status) {
      var text = $('[data-status-text]', status);
      status.classList.toggle('is-open', open);
      status.classList.toggle('is-closed', !open);
      if (text) text.textContent = msg;
    });

    $$('.hours__row').forEach(function (row) {
      var days = row.getAttribute('data-days').split(',').map(Number);
      row.classList.toggle('is-today', days.indexOf(now.day) !== -1);
    });
  }
  updateStatus();
  setInterval(updateStatus, 60000);

  var year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------
     Header rule + mobile WhatsApp dock
  ------------------------------------------------------------------ */
  var top = $('.top');
  var dock = $('.dock');
  if ('IntersectionObserver' in window) {
    var scrolled = new IntersectionObserver(function (entries) {
      top.classList.toggle('is-scrolled', entries[0].boundingClientRect.top < 0);
    }, { threshold: [0, 1] });
    var stageEl = $('[data-stage]');
    if (stageEl) scrolled.observe(stageEl);

    var visible = new Set();
    var dockIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target);
      });
      if (dock) dock.classList.toggle('is-hidden', visible.size > 0);
    });
    [$('.stage__ctas'), $('.hero__ctas'), $('.foot__btns')].forEach(function (el) { if (el) dockIO.observe(el); });
  }

  /* ------------------------------------------------------------------
     Videos: lazy sources, play only while on screen, pause buttons,
     posters only under reduced motion or Save-Data.
  ------------------------------------------------------------------ */
  var postersOnly = reduce || saveData;
  var videos = $$('video[data-lazy]');

  function loadVideo(v) {
    if (v.dataset.loaded) return;
    $$('source[data-src]', v).forEach(function (s) { s.src = s.getAttribute('data-src'); });
    v.dataset.loaded = '1';
    v.load();
  }
  function canPlay(v) {
    return !postersOnly && !v.dataset.userPaused && !v.dataset.hold && v.dataset.inView === '1';
  }
  function tryPlay(v) {
    if (!canPlay(v)) return;
    loadVideo(v);
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }
  function pause(v) { if (!v.paused) v.pause(); }

  videos.forEach(function (v) {
    if (postersOnly) {
      v.removeAttribute('autoplay');
      v.autoplay = false;
    }
  });

  // pause / play buttons (WCAG 2.2.2: moving content longer than 5 s)
  $$('[data-vbtn]').forEach(function (btn) {
    var sel = btn.getAttribute('data-vbtn-for');
    var v = sel ? $(sel) : btn.parentElement.querySelector('video');
    if (!v || postersOnly) return;
    btn.hidden = false;
    var use = btn.querySelector('use');
    function sync() {
      var paused = v.paused;
      btn.setAttribute('aria-label', paused ? 'Reproducir video' : 'Pausar video');
      use.setAttribute('href', paused ? '#i-play' : '#i-pause');
    }
    v.addEventListener('play', sync);
    v.addEventListener('pause', sync);
    btn.addEventListener('click', function () {
      if (v.paused) { delete v.dataset.userPaused; v.dataset.inView = '1'; tryPlay(v); }
      else { v.dataset.userPaused = '1'; v.pause(); }
    });
    sync();
  });

  if ('IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        v.dataset.inView = e.isIntersecting ? '1' : '0';
        if (e.isIntersecting) tryPlay(v); else pause(v);
      });
    }, { rootMargin: '150px 0px' });
    videos.forEach(function (v) { vio.observe(v); });
  }

  /* ------------------------------------------------------------------
     Stage: the motion reel is the hero. Horizontal cut on landscape
     screens, vertical cut on phones / portrait; falls back to the
     horizontal file as a 16:9 block if the vertical one is missing.
  ------------------------------------------------------------------ */
  var stage = $('[data-stage]');
  var sv = $('[data-stage-video]');
  var sbtn = $('[data-stage-btn]');
  var PORTRAIT = '(max-width: 760px), (orientation: portrait)';
  var stageState = { userPaused: postersOnly, inView: true, fallback: false };

  function stagePlay() {
    if (!sv || stageState.userPaused || !stageState.inView) return;
    var p = sv.play();
    if (p && p.catch) p.catch(function () {});
  }
  function setCut(vertical) {
    if (!sv) return;
    var useV = vertical && !stageState.fallback;
    doc.classList.toggle('stage-v', useV);
    stage.classList.toggle('stage--fallback', vertical && stageState.fallback);
    sv.poster = '../assets/video/panita-motion' + (useV ? '-vertical' : '') + '-poster.jpg';
    sv.width = useV ? 1080 : 1920; sv.height = useV ? 1920 : 1080;
    var want = useV ? 'data-v' : 'data-h';
    var srcs = $$('source', sv);
    if (srcs[0] && srcs[0].getAttribute('src') === srcs[0].getAttribute(want)) return;
    srcs.forEach(function (s) { s.src = s.getAttribute(want); });
    sv.load();
    stagePlay();
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }
  if (sv) {
    var srcList = $$('source', sv);
    srcList[srcList.length - 1].addEventListener('error', function () {
      if (doc.classList.contains('stage-v') && !stageState.fallback) {
        stageState.fallback = true;
        setCut(true);
      }
    });
    var syncBtn = function () {
      var paused = sv.paused;
      sbtn.setAttribute('aria-label', paused ? 'Reproducir video' : 'Pausar video');
      $('use', sbtn).setAttribute('href', paused ? '#i-play' : '#i-pause');
    };
    sv.addEventListener('play', syncBtn);
    sv.addEventListener('pause', syncBtn);
    // DOM moves (the desktop pin wraps the stage in a spacer) pause media:
    // resume unless the user or the off-screen observer asked for it
    sv.addEventListener('pause', function () {
      if (stageState.userPaused || !stageState.inView || document.hidden) return;
      requestAnimationFrame(stagePlay);
    });
    sbtn.addEventListener('click', function () {
      if (sv.paused) { stageState.userPaused = false; sv.preload = 'auto'; stageState.inView = true; stagePlay(); }
      else { stageState.userPaused = true; sv.pause(); }
    });
    syncBtn();
    if (window.matchMedia) {
      var pq = window.matchMedia(PORTRAIT);
      var onCut = function () { setCut(pq.matches); };
      if (pq.addEventListener) pq.addEventListener('change', onCut); else if (pq.addListener) pq.addListener(onCut);
    }
    if ('IntersectionObserver' in window) {
      // observe the section, not the video: the pin spacer + plate clip confuse
      // intersection on the media element itself
      new IntersectionObserver(function (entries) {
        stageState.inView = entries[entries.length - 1].isIntersecting;
        if (stageState.inView) stagePlay(); else sv.pause();
      }).observe(stage);
    }
  }

  /* ------------------------------------------------------------------
     Ken Burns only runs while the photo is on screen
  ------------------------------------------------------------------ */
  if (!reduce && 'IntersectionObserver' in window) {
    var kio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle('is-live', e.isIntersecting); });
    });
    $$('.kb').forEach(function (el) { kio.observe(el); });
  }

  /* ------------------------------------------------------------------
     La carta drives the hero photo (fine pointers, wide screens only)
  ------------------------------------------------------------------ */
  var PHOTOS = {
    empanada:  { f: 'ig-empanada-in-hand', w: 1217, h: 2160, sm: true,
                 alt: 'Una empanada venezolana grande y dorada, sostenida en la mano frente a unas plantas',
                 cap: 'Una empanada recién frita, tamaño de la casa.' },
    tequenos:  { f: 'ig-tequenos-minipizzas-tray', w: 1600, h: 2842, sm: true,
                 alt: 'Bandeja de tequeños dorados y minipizzas',
                 cap: 'Tequeños y minipizzas, en bandeja de fiesta.' },
    desayunos: { f: 'ig-arepas-mural', w: 1600, h: 2842, sm: true,
                 alt: 'Arepas rellenas servidas frente al mural colorido del local',
                 cap: 'Arepas rellenas, frente al mural del local.' },
    almuerzos: { f: 'ig-lunch-trays', w: 1217, h: 2160, sm: true,
                 alt: 'Bandejas de almuerzo con arroz, pollo, ensaladas y puré de papa',
                 cap: 'Almuerzos del día, en bandeja.' },
    panes:     { f: 'ig-pan-de-jamon-rolls-tray', w: 1600, h: 2842, sm: true,
                 alt: 'Bandeja de pancitos de jamón recién horneados',
                 cap: 'Pancitos de jamón, recién salidos del horno.' },
    cafe:      { f: 'ig-latte-art-cat', w: 720, h: 1280, sm: false,
                 alt: 'Manos sosteniendo un latte con un gatico dibujado en la espuma',
                 cap: 'Latte con gatico en la espuma.' },
    aji:       { f: 'pexels-hot-sauce-peppers', w: 1600, h: 1066, sm: true,
                 alt: 'Salsa picante roja en una olla de barro con ajíes frescos',
                 cap: 'Ají picante, para quien le pone a todo.' }
  };
  var menu = $('.menu');
  var heroFrame = $('.hero__photo .frame');
  var heroCap = $('[data-hero-cap-text]');
  var canBrowse = mq('(hover: hover) and (pointer: fine)') && mq('(min-width: 761px)');

  if (menu && heroFrame && canBrowse) {
    menu.classList.add('is-browsable');
    var cache = { empanada: $('[data-hero-img]') };
    var current = 'empanada';
    var pending = null;

    var show = function (key) {
      if (key === current || !PHOTOS[key]) return;
      pending = key;
      var img = cache[key];
      var reveal = function () {
        if (pending !== key) return;
        Object.keys(cache).forEach(function (k) { cache[k].classList.toggle('is-out', k !== key); });
        current = key;
        heroCap.textContent = PHOTOS[key].cap;
      };
      if (!img) {
        var p = PHOTOS[key];
        img = document.createElement('img');
        img.width = p.w; img.height = p.h;
        img.alt = p.alt;
        img.decoding = 'async';
        img.className = 'is-out';
        if (p.sm) {
          img.sizes = '36vw';
          img.srcset = '../assets/img/' + p.f + '-sm.webp 800w, ../assets/img/' + p.f + '.webp ' + p.w + 'w';
        }
        img.src = '../assets/img/' + p.f + (p.sm ? '-sm' : '') + '.webp';
        heroFrame.appendChild(img);
        cache[key] = img;
        if (img.complete) reveal(); else img.addEventListener('load', reveal, { once: true });
      } else {
        reveal();
      }
    };

    $$('.dish', menu).forEach(function (li) {
      li.addEventListener('pointerenter', function () {
        $$('.dish', menu).forEach(function (o) { o.classList.toggle('is-active', o === li); });
        show(li.getAttribute('data-photo'));
      });
    });
    menu.addEventListener('pointerleave', function () {
      $$('.dish', menu).forEach(function (o) { o.classList.remove('is-active'); });
      show('empanada');
    });
  }

  /* ------------------------------------------------------------------
     Motion design (GSAP + ScrollTrigger). Every hidden state is set
     here, so if the CDN fails the page is simply static.
  ------------------------------------------------------------------ */
  function splitWords(el) {
    if (el.hasAttribute('data-split-done')) return $$('.wi', el);
    var label = el.textContent.replace(/\s+/g, ' ').trim();
    var words = [];
    (function walk(node) {
      [].slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            w.className = 'w';
            var wi = document.createElement('span');
            wi.className = 'wi';
            wi.textContent = part;
            w.appendChild(wi);
            frag.appendChild(w);
            words.push(wi);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    })(el);
    if (/^H[1-6]$/.test(el.tagName)) {
      // headings keep one clean accessible name
      el.setAttribute('aria-label', label);
      [].slice.call(el.childNodes).forEach(function (n) { if (n.nodeType === 1) n.setAttribute('aria-hidden', 'true'); });
    }
    el.setAttribute('data-split-done', '');
    return words;
  }

  function countUp(el, opts) {
    var target = parseFloat(el.getAttribute('data-count'));
    var o = { v: 0 };
    el.textContent = '0.0';
    return window.gsap.to(o, Object.assign({
      v: target, duration: 1.4, ease: 'power3.out',
      onUpdate: function () { el.textContent = o.v.toFixed(1); },
      onComplete: function () { el.textContent = target.toFixed(1); }
    }, opts || {}));
  }

  function wipeFrom(dir) {
    return {
      up: 'inset(100% 0% 0% 0%)',
      down: 'inset(0% 0% 100% 0%)',
      left: 'inset(0% 100% 0% 0%)',
      right: 'inset(0% 0% 0% 100%)'
    }[dir] || 'inset(100% 0% 0% 0%)';
  }
  var OPEN = 'inset(0% 0% 0% 0%)';

  function boot() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (reduce || !gsap || !ST) { doc.classList.remove('motion'); return; }
    gsap.registerPlugin(ST);
    doc.classList.add('motion-ready');

    /* hero: load choreography ------------------------------------ */
    var h1 = $('.hero__title');
    var h1Words = splitWords(h1);
    var items = $$('.hero [data-hero-item]');
    var leads = $$('.dish__lead');
    var notes = $$('.dish__note');
    gsap.set(h1Words, { y: 0, yPercent: 105 });
    gsap.set(items, { opacity: 0, y: 16 });
    gsap.set(menu, { opacity: 0, y: 90 });
    gsap.set(notes, { opacity: 0 });
    gsap.set($('.hero__photo .frame'), { clipPath: wipeFrom('up') });
    gsap.set(leads, { clipPath: 'inset(0% 100% 0% 0%)' });

    // the intro sits right under the stage, so it plays when it arrives
    var intro = gsap.timeline({
      defaults: { ease: 'expo.out' },
      scrollTrigger: { trigger: '.intro', start: 'top 94%', once: true }
    });
    intro
      .to(items[0], { opacity: 1, y: 0, duration: .7 }, 0)
      .to(h1Words, { yPercent: 0, duration: 1.05, stagger: .035 }, .05)
      .to($('.hero__photo .frame'), { clipPath: OPEN, duration: 1.4, ease: 'expo.out' }, .1)
      .to(items.slice(1), { opacity: 1, y: 0, duration: .8, stagger: .08 }, .45)
      .to(menu, { opacity: 1, y: 0, duration: 1 }, .55)
      .to(leads, { clipPath: OPEN, duration: .7, stagger: .06, ease: 'power3.out' }, .9)
      .to(notes, { opacity: 1, duration: .5, stagger: .06, ease: 'power2.out' }, 1.0);

    /* stage: reel settles from a slight zoom, the CTA band rises in */
    var stageItems = $$('[data-stage-item]');
    var num = $('.rating--stage [data-count]');
    var load = gsap.timeline({ defaults: { ease: 'expo.out' } });
    gsap.set(stageItems, { opacity: 0, y: 18 });
    if (sv) load.fromTo(sv, { scale: 1.06 }, { scale: 1, duration: 2.2, ease: 'power2.out' }, 0);
    load.to(stageItems, { opacity: 1, y: 0, duration: .9, stagger: .09 }, .35);
    if (num) load.add(countUp(num, { duration: 1.3 }), .55);

    var mm = gsap.matchMedia();

    /* shared: headline word rises, text reveals, numbers ----------- */
    $$('[data-split]').forEach(function (el) {
      if (el === h1) return;
      var words = splitWords(el);
      gsap.set(words, { y: 0, yPercent: 105 });
      gsap.to(words, {
        yPercent: 0, duration: .95, stagger: .04, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    var reveals = $$('.reveal');
    gsap.set(reveals, { opacity: 0, y: 22 });
    ST.batch(reveals, {
      start: 'top 90%', once: true,
      onEnter: function (batch) {
        gsap.to(batch, { opacity: 1, y: 0, duration: .8, stagger: .07, ease: 'expo.out', overwrite: true });
      }
    });

    var statement = $('[data-scrub-words]');
    if (statement) {
      var sw = splitWords(statement);
      gsap.fromTo(sw, { opacity: .16 }, {
        opacity: 1, stagger: .1, ease: 'none',
        scrollTrigger: { trigger: statement, start: 'top 82%', end: 'bottom 48%', scrub: .5 }
      });
    }

    var big = $('.score__big [data-count]');
    var bars = $$('.bar > span');
    if (big) {
      gsap.set(bars, { scaleX: 0 });
      ST.create({
        trigger: '.score', start: 'top 75%', once: true,
        onEnter: function () {
          countUp(big, { duration: 1.6 });
          gsap.to(bars, {
            scaleX: function (i, el) { return parseFloat(el.style.getPropertyValue('--v')) || 1; },
            duration: 1.1, stagger: .12, ease: 'expo.out', delay: .2
          });
        }
      });
    }

    var wipes = $$('[data-wipe]');

    /* desktop: scrubbed wipes, parallax, pinned story -------------- */
    mm.add('(min-width: 961px)', function () {
      wipes.forEach(function (el) {
        var img = $('img[data-parallax]', el);
        var tl = gsap.timeline({
          scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 38%', scrub: .6 }
        });
        tl.fromTo(el, { clipPath: wipeFrom(el.getAttribute('data-wipe')) }, { clipPath: OPEN, ease: 'none' });
        if (img) {
          tl.fromTo(img, { scale: 1.32 }, { scale: 1.1, ease: 'none' }, 0);
          gsap.fromTo(img, { yPercent: -4 }, {
            yPercent: 4, ease: 'none',
            scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true }
          });
        }
      });

      var story = $('.story');
      var stage = $('[data-story]');
      var frames = $$('.story__frame', stage);
      if (!story || frames.length < 2) return;
      story.classList.add('story--pinned');
      var ticks = $$('.story__ticks li', stage);
      var bar = $('[data-story-bar]', stage);
      var STEP = 1.3, HOLD = .3;

      gsap.set(frames.slice(1), { clipPath: wipeFrom('up') });
      var tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: stage, start: 'top top',
          end: function () { return '+=' + window.innerHeight * (frames.length - 1) * 1.1; },
          pin: true, scrub: .8, invalidateOnRefresh: true,
          snap: { snapTo: 'labels', duration: { min: .25, max: .7 }, delay: .12, ease: 'power2.inOut' }
        }
      });
      tl.addLabel('f0', 0);
      frames.forEach(function (frame, i) {
        if (i === 0) return;
        var at = (i - 1) * STEP + HOLD;
        var media = $('.story__media, .story__table', frame);
        var text = $('.story__text', frame);
        var prevMedia = $('.story__media, .story__table', frames[i - 1]);
        tl.to(frame, { clipPath: OPEN, duration: STEP - HOLD }, at)
          .fromTo(media, { scale: 1.16 }, { scale: 1, duration: STEP - HOLD }, at)
          .fromTo(text, { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: STEP - HOLD - .2, ease: 'power3.out' }, at + .2)
          .to(prevMedia, { yPercent: -8, duration: STEP - HOLD }, at)
          .addLabel('f' + i, i * STEP);
      });
      tl.to({}, { duration: HOLD }); // hold on the last frame
      if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: tl.duration() }, 0);

      var active = -1;
      var storyVideos = frames.map(function (f) { return $('video', f); });
      function setActive(idx) {
        if (idx === active) return;
        active = idx;
        ticks.forEach(function (t, i) { t.classList.toggle('is-on', i === idx); });
        story.classList.toggle('is-on-paper', frames[idx].classList.contains('story__frame--paper'));
        frames.forEach(function (f, i) {
          $$('button', f).forEach(function (b) { if (i === idx) b.removeAttribute('tabindex'); else b.setAttribute('tabindex', '-1'); });
        });
        storyVideos.forEach(function (v, i) {
          if (!v) return;
          if (i === idx) { delete v.dataset.hold; tryPlay(v); }
          else { v.dataset.hold = 'story'; pause(v); }
        });
      }
      tl.eventCallback('onUpdate', function () {
        var idx = Math.floor((tl.time() + .5) / STEP);
        setActive(Math.max(0, Math.min(frames.length - 1, idx)));
      });
      setActive(0);

      return function () {
        story.classList.remove('story--pinned', 'is-on-paper');
        storyVideos.forEach(function (v) { if (v) { delete v.dataset.hold; } });
        $$('.story__frame button', stage).forEach(function (b) { b.removeAttribute('tabindex'); });
      };
    });

    /* desktop landscape: the stage frames itself into a "Fig. 0" plate
       while pinned, then the intro (and its menu card) rises over it */
    mm.add('(min-width: 961px) and (orientation: landscape)', function () {
      var plate = $('[data-stage-plate]');
      if (!stage || !plate) return;
      var band = $('.stage__band', stage);
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: stage, start: 'top top+=' + top.offsetHeight, end: '+=65%',
          pin: true, scrub: .7, invalidateOnRefresh: true
        }
      });
      tl.fromTo(plate, { clipPath: 'inset(0% 0% 0% 0% round 0px)' },
                       { clipPath: 'inset(6% 7% 12% 7% round 8px)', ease: 'power2.inOut', duration: 1 }, 0)
        .fromTo($('.stage__wash', stage), { opacity: 0 }, { opacity: 1, ease: 'none', duration: .8 }, 0)
        .fromTo(band, { opacity: 1, y: 0 }, { opacity: 0, y: 40, ease: 'none', duration: .45 }, 0)
        .fromTo($('.stage__fig', stage), { opacity: 0, y: 10 }, { opacity: 1, y: 0, ease: 'power2.out', duration: .35 }, .65);
      return function () { gsap.set([plate, band], { clearProps: 'all' }); };
    });

    /* mobile / tablet: one-shot wipes, no pin, no parallax ---------- */
    mm.add('(max-width: 960px)', function () {
      wipes.forEach(function (el) {
        gsap.fromTo(el, { clipPath: wipeFrom(el.getAttribute('data-wipe')) }, {
          clipPath: OPEN, duration: 1.1, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true }
        });
      });
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ST.refresh(); });
    }
    window.addEventListener('load', function () { ST.refresh(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
