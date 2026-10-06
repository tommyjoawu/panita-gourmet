/* Panita Gourmet & Bakery · v1 (b) — dependency-free enhancements + motion.
   Motion rules (Emil Kowalski / Apple): transform/opacity/clip-path only, interruptible,
   springs for drag, and a gentler path for prefers-reduced-motion. */
(function () {
  "use strict";

  var WA = "50765899235";
  var reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  function reduced() { return reduceMQ.matches; }
  // Save-Data users get posters + play buttons, never autoplaying video
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  function quiet() { return reduced() || saveData; }
  function qs(s, r) { return (r || document).querySelector(s); }
  function qsa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var hasIO = "IntersectionObserver" in window;

  /* ---------- Hours: "abierto ahora" in Panama time (UTC-5, no DST) ---------- */
  var HOURS = { 0: [8.5, 14.5], 1: [8.5, 16.5], 2: [8.5, 16.5], 3: [8.5, 16.5], 4: [8.5, 16.5], 5: [8.5, 16.5], 6: [8.5, 16.5] };
  function panamaNow() {
    var now = new Date();
    return new Date(now.getTime() + now.getTimezoneOffset() * 60000 - 5 * 3600000);
  }
  function fmt(h) {
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return (hh % 12 || 12) + ":" + (mm < 10 ? "0" : "") + mm + " " + (hh < 12 ? "a.m." : "p.m.");
  }
  function updateStatus() {
    var el = qs("[data-status]"), text = qs("[data-status-text]");
    var d = panamaNow(), day = d.getDay(), t = d.getHours() + d.getMinutes() / 60, range = HOURS[day], msg;
    if (t >= range[0] && t < range[1]) {
      el.setAttribute("data-open", "");
      msg = "Abierto ahora · cerramos a las " + fmt(range[1]);
    } else {
      el.removeAttribute("data-open");
      msg = t < range[0] ? "Cerrado · abrimos hoy a las " + fmt(range[0])
                         : "Cerrado · abrimos mañana a las " + fmt(HOURS[(day + 1) % 7][0]);
    }
    text.textContent = msg;
    el.hidden = false;
    qsa("[data-days]").forEach(function (row) {
      var days = row.getAttribute("data-days").split(",").map(Number);
      row.toggleAttribute("data-today", days.indexOf(day) !== -1);
    });
  }
  updateStatus();
  setInterval(updateStatus, 60000);

  /* ---------- Header scroll-edge shadow + mobile dock ---------- */
  var header = qs("[data-header]"), dock = qs("[data-dock]"), dockLink = dock.querySelector("a");
  var pastHero = false, atCloser = false;
  function setDock() {
    var show = pastHero && !atCloser;
    dock.toggleAttribute("data-visible", show);
    dock.setAttribute("aria-hidden", show ? "false" : "true");
    dockLink.tabIndex = show ? 0 : -1;
  }
  if (hasIO) {
    new IntersectionObserver(function (entries) {
      pastHero = !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0;
      setDock();
    }).observe(qs("[data-hero-ctas]"));
    new IntersectionObserver(function (entries) {
      atCloser = entries[0].isIntersecting;
      setDock();
    }, { rootMargin: "0px 0px -20% 0px" }).observe(qs(".closer"));
  }
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      header.toggleAttribute("data-scrolled", window.scrollY > 8);
      ticking = false;
    });
  }, { passive: true });

  /* ---------- Split headings into masked words ----------
     Each word gets its own transition-delay (set on the element itself, never through a
     parent CSS variable) so the stagger costs no style recalculation on siblings. */
  function splitWords(el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (tok) {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(" ")); return; }
            var w = document.createElement("span"), inner = document.createElement("span");
            w.className = "w"; inner.className = "w__i"; inner.textContent = tok;
            inner.style.transitionDelay = Math.min(i++, 12) * 55 + "ms";
            w.appendChild(inner); frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== "BR") {
          walk(child);
        }
      });
    })(el);
    // trim leading/trailing whitespace nodes created from the source indentation
    while (el.firstChild && el.firstChild.nodeType === 3 && !el.firstChild.textContent.trim()) el.removeChild(el.firstChild);
    while (el.lastChild && el.lastChild.nodeType === 3 && !el.lastChild.textContent.trim()) el.removeChild(el.lastChild);
  }
  qsa("[data-split]").forEach(splitWords);


  /* ---------- Count-up (4.9 ratings) ----------
     Rare, first-visit marketing moment. Numbers carry aria-hidden + a static aria-label
     on the parent, so screen readers never hear intermediate values. */
  function countUp(el, delay) {
    if (el.__counted) return;
    el.__counted = true;
    var to = parseFloat(el.getAttribute("data-count"));
    if (reduced()) { el.textContent = to.toFixed(1); return; }
    var dur = 1100, start = null;
    el.textContent = "0.0";
    setTimeout(function () {
      requestAnimationFrame(function step(ts) {
        if (start === null) start = ts;
        var t = Math.min(1, (ts - start) / dur);
        var eased = 1 - Math.pow(1 - t, 4); // strong ease-out: fast start, gentle landing
        el.textContent = (to * eased).toFixed(1);
        if (t < 1) requestAnimationFrame(step);
      });
    }, delay || 0);
  }
  qsa("[data-count]").forEach(function (el) { if (!reduced()) el.textContent = "0.0"; });
  qsa('[data-count-on="load"]').forEach(function (el) { countUp(el, 600); });

  /* ---------- Scroll reveals: once, short stagger per batch ---------- */
  var stripEl = qs("[data-strip]");
  var stripShots = stripEl ? qsa(".shot", stripEl) : [];
  var revealTargets = qsa("[data-reveal], [data-split]:not([data-split='load']), [data-mask]")
    .filter(function (el) { return stripShots.indexOf(el) === -1; });

  function reveal(el, i) {
    if (el.hasAttribute("data-reveal")) el.style.setProperty("--stagger", Math.min(i, 5) * 70 + "ms");
    el.setAttribute("data-visible", "");
    qsa("[data-count]", el).forEach(function (c) { countUp(c, 250 + Math.min(i, 5) * 70); });
  }
  if (hasIO) {
    // A fully clipped [data-mask] frame never reports as intersecting, so it is revealed
    // through its (unclipped) parent instead.
    var io = new IntersectionObserver(function (entries) {
      entries.filter(function (e) { return e.isIntersecting; }).forEach(function (e, i) {
        (e.target.__reveals || [e.target]).forEach(function (t) { reveal(t, i); });
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    revealTargets.forEach(function (el) {
      var watch = el.hasAttribute("data-mask") ? el.parentNode : el;
      if (!watch.__reveals) watch.__reveals = [];
      if (watch !== el && watch.__reveals.indexOf(watch) === -1 && revealTargets.indexOf(watch) !== -1) watch.__reveals.push(watch);
      watch.__reveals.push(el);
      io.observe(watch);
    });

    // The strip reveals as one group (items off to the right would otherwise pop in mid-drag)
    if (stripEl) {
      var sio = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        stripShots.forEach(function (s, i) {
          s.style.setProperty("--stagger", Math.min(i, 6) * 60 + "ms");
          s.setAttribute("data-visible", "");
        });
        sio.disconnect();
      }, { rootMargin: "0px 0px -10% 0px", threshold: 0.15 });
      sio.observe(stripEl);
    }
  } else {
    revealTargets.concat(stripShots).forEach(function (el) { reveal(el, 0); });
  }
  document.addEventListener("transitionend", function (e) {
    var t = e.target;
    if (!t.hasAttribute || !t.hasAttribute("data-visible")) return;
    if (e.propertyName === "opacity" || e.propertyName === "transform") {
      t.style.removeProperty("--stagger");
      if (e.propertyName === "opacity" && t.hasAttribute("data-reveal")) t.setAttribute("data-settled", "");
    }
    if (e.propertyName === "clip-path" && t.hasAttribute("data-mask")) t.setAttribute("data-settled", "");
  });

  /* ---------- Videos: play only when on screen, honor reduced motion + user pauses ---------- */
  var videos = {};
  qsa("video[data-video]").forEach(function (v) {
    videos[v.getAttribute("data-video")] = { el: v, inView: false, mode: "auto" }; // mode: auto | playing | paused
  });
  function isPlaying(rec) {
    return rec.inView && !document.hidden && (rec.mode === "playing" || (rec.mode === "auto" && !quiet()));
  }
  function syncVideo(rec) {
    var want = isPlaying(rec);
    if (want && rec.el.paused) {
      var p = rec.el.play();
      if (p && p.catch) p.catch(function () {});
    } else if (!want && !rec.el.paused) {
      rec.el.pause();
    }
    var btn = qs('[data-video-toggle="' + rec.el.getAttribute("data-video") + '"]');
    if (btn) {
      var showsPaused = rec.mode === "paused" || (rec.mode === "auto" && quiet());
      btn.setAttribute("aria-pressed", showsPaused ? "true" : "false");
      var what = btn.getAttribute("aria-label").replace(/^(Pausar|Reproducir) /, "");
      btn.setAttribute("aria-label", (showsPaused ? "Reproducir " : "Pausar ") + what);
    }
  }
  function syncAll() { Object.keys(videos).forEach(function (k) { syncVideo(videos[k]); }); }

  if (hasIO) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var rec = videos[e.target.getAttribute("data-video")];
        rec.inView = e.isIntersecting;
        syncVideo(rec);
      });
    }, { rootMargin: "150px 0px", threshold: 0 });
    Object.keys(videos).forEach(function (k) { vio.observe(videos[k].el); });
  } else {
    Object.keys(videos).forEach(function (k) { videos[k].inView = true; });
    syncAll();
  }
  qsa("[data-video-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var rec = videos[btn.getAttribute("data-video-toggle")];
      if (!rec) return;
      rec.mode = isPlaying(rec) ? "paused" : "playing";
      syncVideo(rec);
    });
  });
  document.addEventListener("visibilitychange", syncAll);
  if (reduceMQ.addEventListener) reduceMQ.addEventListener("change", syncAll);

  /* ---------- Hero stage: horizontal vs vertical reel, with fallback ----------
     The inline script in the hero already picked sources before first paint; this keeps
     them right when the viewport changes, and falls back to the horizontal reel as a
     16:9 block (CTA band below) if the vertical render is missing. */
  var stage = qs("[data-stage]");
  if (stage && videos.hero) (function () {
    var v = videos.hero.el, srcs = qsa("source", v);
    var H = "../assets/video/panita-motion", V = H + "-vertical";
    var verticalMQ = window.matchMedia("(max-width: 760px), (orientation: portrait)");
    var verticalFailed = false;

    function setSources(base, mode) {
      if (v.getAttribute("data-reel-mode") === mode) return false;
      v.setAttribute("data-reel-mode", mode);
      v.poster = base + "-poster.jpg";
      srcs[0].src = base + ".webm"; srcs[1].src = base + ".mp4";
      return true;
    }
    function apply() {
      var wantVertical = verticalMQ.matches;
      var changed;
      if (wantVertical && !verticalFailed) { changed = setSources(V, "vertical"); stage.setAttribute("data-mode", "vertical"); }
      else {
        changed = setSources(H, "horizontal");
        stage.setAttribute("data-mode", wantVertical ? "block" : "cover");
      }
      if (changed) { v.load(); syncVideo(videos.hero); }
    }
    srcs[srcs.length - 1].addEventListener("error", function () {
      if (v.getAttribute("data-reel-mode") !== "vertical") return;
      verticalFailed = true;
      apply();
    });
    stage.setAttribute("data-mode", v.getAttribute("data-reel-mode") === "vertical" ? "vertical" : "cover");
    if (v.getAttribute("data-reel-mode") === "vertical" && v.networkState === 3 /* NO_SOURCE */) { verticalFailed = true; }
    apply();
    if (verticalMQ.addEventListener) verticalMQ.addEventListener("change", apply);

    // With preload="none" (reduced motion / Save-Data) the video never fetches, so its
    // source errors never fire: probe the vertical poster (already preloaded) instead.
    function probeVertical() {
      if (verticalFailed || !verticalMQ.matches) return;
      var img = new Image();
      img.onerror = function () { verticalFailed = true; apply(); };
      img.src = V + "-poster.jpg";
    }
    probeVertical();
    if (verticalMQ.addEventListener) verticalMQ.addEventListener("change", probeVertical);
  })();

  /* ---------- Draggable photo strip with momentum ----------
     Touch uses native scrolling (already has momentum + snap). Mouse gets Apple-style
     direct manipulation: 1:1 tracking from the grab point, rubber-banding at the edges,
     momentum projection on release, then a critically damped spring to the nearest card. */
  if (stripEl) (function () {
    var track = qs("[data-strip-track]", stripEl);
    var prev = qs("[data-strip-prev]"), next = qs("[data-strip-next]");
    var raf = 0, pos = 0, vel = 0;           // virtual position (can overshoot) + velocity px/s
    var drag = null;

    function maxScroll() { return Math.max(0, stripEl.scrollWidth - stripEl.clientWidth); }
    function clamp(x) { return Math.max(0, Math.min(maxScroll(), x)); }
    function rubberband(over, dim) { var c = 0.55; return (over * dim * c) / (dim + c * Math.abs(over)); }
    function render(x) {
      var c = clamp(x);
      stripEl.scrollLeft = c;
      var over = x - c;
      track.style.transform = over ? "translateX(" + (-over).toFixed(2) + "px)" : "";
    }
    function snapPoints() {
      var pad = parseFloat(getComputedStyle(track).paddingLeft) || 0, max = maxScroll();
      var pts = stripShots.map(function (s) { return Math.min(max, s.offsetLeft - pad); });
      pts.push(max);
      return pts;
    }
    function nearest(x) {
      return snapPoints().reduce(function (best, p) { return Math.abs(p - x) < Math.abs(best - x) ? p : best; }, 0);
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

    // Critically damped spring (Apple: damping 1.0, response ~0.45s). Starts from the
    // current on-screen value and inherits velocity, so it can be grabbed mid-flight.
    function springTo(target, v0) {
      stop();
      if (reduced()) { render(target); pos = target; updateNav(); return; }
      var response = 0.45, zeta = 1, w = 2 * Math.PI / response;
      var k = w * w, c = 2 * zeta * w;
      vel = v0 || 0;
      var last = performance.now();
      raf = requestAnimationFrame(function step(now) {
        var dt = Math.min(0.064, (now - last) / 1000); last = now;
        var steps = Math.ceil(dt / 0.004), h = dt / steps;
        for (var i = 0; i < steps; i++) {
          var a = -k * (pos - target) - c * vel;
          vel += a * h; pos += vel * h;
        }
        if (Math.abs(pos - target) < 0.4 && Math.abs(vel) < 8) { pos = target; render(pos); raf = 0; updateNav(); return; }
        render(pos);
        raf = requestAnimationFrame(step);
      });
    }

    stripEl.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0 || drag) return; // one pointer only
      stop();
      pos = stripEl.scrollLeft - (parseFloat((track.style.transform.match(/-?[\d.]+/) || [0])[0]) || 0);
      drag = { id: e.pointerId, x0: e.clientX, p0: pos, moved: false, hist: [{ x: e.clientX, t: e.timeStamp }] };
    });
    stripEl.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x0;
      if (!drag.moved) {
        if (Math.abs(dx) < 6) return; // small hysteresis so clicks stay clicks
        drag.moved = true;
        drag.x0 = e.clientX; dx = 0;   // start tracking from here: no jump
        stripEl.setPointerCapture(drag.id);
        stripEl.classList.add("is-dragging");
      }
      var raw = drag.p0 - dx, c = clamp(raw);
      pos = c + rubberband(raw - c, stripEl.clientWidth);
      render(pos);
      drag.hist.push({ x: e.clientX, t: e.timeStamp });
      if (drag.hist.length > 6) drag.hist.shift();
    });
    function release(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null;
      stripEl.classList.remove("is-dragging");
      if (!d.moved) return;
      // velocity from the last ~100ms of movement; a pause before release means no throw
      var h = d.hist.filter(function (p) { return e.timeStamp - p.t < 100; });
      var v = 0;
      if (h.length > 1) {
        var a = h[0], b = h[h.length - 1];
        if (b.t > a.t) v = -((b.x - a.x) / (b.t - a.t)) * 1000; // px/s in scroll direction
      }
      // Apple momentum projection, then snap to the card nearest the projected rest point
      var proj = pos + (v / 1000) * 0.998 / (1 - 0.998);
      springTo(nearest(clamp(proj)), v);
      // swallow the click that follows a drag
      stripEl.addEventListener("click", function sw(ev) { ev.preventDefault(); ev.stopPropagation(); stripEl.removeEventListener("click", sw, true); }, true);
    }
    stripEl.addEventListener("pointerup", release);
    stripEl.addEventListener("pointercancel", release);
    stripEl.addEventListener("dragstart", function (e) { e.preventDefault(); });

    // Wheel / trackpad / keyboard / touch scroll natively; stop any spring they interrupt
    stripEl.addEventListener("wheel", function () { if (!drag) stop(); }, { passive: true });
    stripEl.addEventListener("touchstart", stop, { passive: true });

    function currentIndex() {
      var pts = snapPoints(), x = stripEl.scrollLeft, best = 0;
      pts.forEach(function (p, i) { if (Math.abs(p - x) < Math.abs(pts[best] - x)) best = i; });
      return best;
    }
    function go(dir) {
      var pts = snapPoints(), i = currentIndex(), x = stripEl.scrollLeft;
      // walk until the target actually moves the strip (the last points can coincide with max)
      var j = i;
      do { j += dir; } while (j > 0 && j < pts.length - 1 && Math.abs(pts[j] - x) < 2);
      j = Math.max(0, Math.min(pts.length - 1, j));
      pos = x;
      springTo(pts[j], 0);
    }
    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });

    var navTick = false;
    function updateNav() {
      if (!prev || !next) return;
      prev.disabled = stripEl.scrollLeft <= 2;
      next.disabled = stripEl.scrollLeft >= maxScroll() - 2;
    }
    stripEl.addEventListener("scroll", function () {
      if (navTick) return;
      navTick = true;
      requestAnimationFrame(function () { navTick = false; updateNav(); if (!raf && !drag) pos = stripEl.scrollLeft; });
    }, { passive: true });
    window.addEventListener("resize", updateNav);
    updateNav();
  })();

  /* ---------- Tequeños calculator ---------- */
  var calc = qs("[data-calc]");
  if (calc) {
    var guests = 20, MIN = 5, MAX = 200, PER = 5;
    var out = qs("[data-guests]", calc), teq = qs("[data-teq]", calc), link = qs("[data-calc-link]", calc);
    var minus = qs('[data-step="-5"]', calc), plus = qs('[data-step="5"]', calc);
    function renderCalc() {
      out.textContent = guests;
      teq.textContent = guests * PER;
      minus.disabled = guests <= MIN;
      plus.disabled = guests >= MAX;
      var msg = "Hola Panita, quiero encargar tequeños congelados para una fiesta de " + guests +
        " personas (unos " + guests * PER + " tequeños). ¿Me ayudas con el pedido?";
      link.href = "https://wa.me/" + WA + "?text=" + encodeURIComponent(msg);
    }
    calc.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-step]");
      if (!btn) return;
      guests = Math.max(MIN, Math.min(MAX, guests + Number(btn.getAttribute("data-step"))));
      renderCalc();
    });
    renderCalc();
  }

  /* ---------- Copy address: label morph masked with blur ---------- */
  var copyBtn = qs("[data-copy]");
  if (copyBtn) {
    var label = qs("[data-copy-label]", copyBtn), original = label.textContent, resetTimer, swapTimer;
    function swap(text) {
      clearTimeout(swapTimer);
      if (reduced()) { label.textContent = text; return; }
      copyBtn.setAttribute("data-swapping", "");
      swapTimer = setTimeout(function () { label.textContent = text; copyBtn.removeAttribute("data-swapping"); }, 120);
    }
    copyBtn.addEventListener("click", function () {
      var value = copyBtn.getAttribute("data-copy");
      var done = function () {
        swap("Dirección copiada");
        clearTimeout(resetTimer);
        resetTimer = setTimeout(function () { swap(original); }, 1800);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(value).then(done, function () {});
      } else {
        var ta = document.createElement("textarea");
        ta.value = value; ta.setAttribute("readonly", ""); ta.style.position = "absolute"; ta.style.left = "-9999px";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); done(); } catch (err) {}
        document.body.removeChild(ta);
      }
    });
  }

  /* ---------- Footer year ---------- */
  var y = qs("[data-year]");
  if (y) y.textContent = panamaNow().getFullYear();
})();
