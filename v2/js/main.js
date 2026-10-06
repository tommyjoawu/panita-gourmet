(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  /* "still" = no autoplay and no background video downloads */
  var still = reduceMotion || saveData;
  if (still) root.classList.add("is-reduced");

  /* ---------- Mobile menu (hamburger morph + staggered overlay) ---------- */
  var burger = document.querySelector(".burger");
  var overlay = document.getElementById("menu-overlay");

  function setMenu(open) {
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      overlay.hidden = false;
      requestAnimationFrame(function () { overlay.classList.add("is-open"); });
    } else {
      overlay.classList.remove("is-open");
      window.setTimeout(function () {
        if (burger.getAttribute("aria-expanded") === "false") overlay.hidden = true;
      }, reduceMotion ? 0 : 300);
    }
  }

  if (burger && overlay) {
    burger.addEventListener("click", function () {
      setMenu(burger.getAttribute("aria-expanded") !== "true");
    });
    overlay.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && burger.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        burger.focus();
      }
    });
    window.matchMedia("(min-width: 1081px)").addEventListener("change", function (mq) {
      if (mq.matches) setMenu(false);
    });
  }

  /* ---------- Open / closed status (Panama time, UTC-5, no DST) ---------- */
  var HOURS = {
    0: [8 * 60 + 30, 14 * 60 + 30],
    1: [8 * 60 + 30, 16 * 60 + 30],
    2: [8 * 60 + 30, 16 * 60 + 30],
    3: [8 * 60 + 30, 16 * 60 + 30],
    4: [8 * 60 + 30, 16 * 60 + 30],
    5: [8 * 60 + 30, 16 * 60 + 30],
    6: [8 * 60 + 30, 16 * 60 + 30]
  };

  function panamaNow() {
    var now = new Date();
    var utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utcMs - 5 * 3600000);
  }

  function fmt(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    var suffix = h >= 12 ? "p.m." : "a.m.";
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ":" + (m < 10 ? "0" + m : m) + " " + suffix;
  }

  function updateStatus() {
    var el = document.querySelector("[data-status]");
    var text = document.querySelector("[data-status-text]");
    if (!el || !text) return;

    var now = panamaNow();
    var day = now.getDay();
    var mins = now.getHours() * 60 + now.getMinutes();
    var today = HOURS[day];
    var open = mins >= today[0] && mins < today[1];

    el.classList.toggle("is-open", open);
    if (open) {
      text.textContent = "Abierto ahora, hasta las " + fmt(today[1]);
    } else if (mins < today[0]) {
      text.textContent = "Cerrado. Abrimos hoy a las " + fmt(today[0]);
    } else {
      var next = HOURS[(day + 1) % 7];
      text.textContent = "Cerrado. Abrimos mañana a las " + fmt(next[0]);
    }

    document.querySelectorAll(".hours__row").forEach(function (row) {
      var days = row.getAttribute("data-days");
      var isToday = days === "0" ? day === 0 : day >= 1 && day <= 6;
      row.classList.toggle("is-today", isToday);
    });
  }
  updateStatus();
  window.setInterval(updateStatus, 60000);

  /* ---------- Scroll reveal (IntersectionObserver, no scroll listeners) ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });

    reveals.forEach(function (el) {
      var siblings = el.parentElement ? Array.prototype.filter.call(el.parentElement.children, function (c) {
        return c.classList.contains("reveal");
      }) : [];
      var idx = siblings.indexOf(el);
      if (idx > 0) el.style.transitionDelay = Math.min(idx, 6) * 60 + "ms";
      io.observe(el);
    });
  }

  /* ---------- Video: lazy sources, play only in view, pause control ----------
     Below-the-fold videos carry data-src sources and a data-poster. They are
     hydrated ~800px before they enter the viewport. Under reduced motion only
     the poster is set: no source is downloaded and nothing plays. */
  var videos = Array.prototype.slice.call(document.querySelectorAll("video[data-video]"));

  function hydrate(v, force) {
    if (v.getAttribute("data-hydrated") && !force) return;
    v.setAttribute("data-hydrated", "1");
    if (v.dataset.poster) v.poster = v.dataset.poster;
    if (still && !force) return;
    var sources = v.querySelectorAll("source[data-src]");
    if (!sources.length) return;
    sources.forEach(function (s) { s.src = s.dataset.src; s.removeAttribute("data-src"); });
    v.load();
  }

  function tryPlay(v) {
    if (v.dataset.userPaused) return;
    if (still && !v.dataset.userPlay) return;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  if (still) {
    videos.forEach(function (v) {
      v.removeAttribute("autoplay");
      v.pause();
      if (!v.hasAttribute("data-lazy")) v.preload = "none";
    });
  }

  if ("IntersectionObserver" in window) {
    var near = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          hydrate(entry.target);
          near.unobserve(entry.target);
        }
      });
    }, { rootMargin: "800px 0px" });

    var inView = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) tryPlay(entry.target);
        else entry.target.pause();
      });
    }, { threshold: 0.15 });

    videos.forEach(function (v) {
      if (v.hasAttribute("data-lazy")) near.observe(v);
      inView.observe(v);
    });
  } else {
    videos.forEach(function (v) { hydrate(v); tryPlay(v); });
  }

  function syncToggle(btn, v) {
    var paused = v.paused;
    btn.setAttribute("aria-pressed", String(paused));
    btn.setAttribute("aria-label", paused ? "Reproducir video" : "Pausar video");
    var icon = btn.querySelector("i");
    if (icon) icon.className = "ph-fill " + (paused ? "ph-play" : "ph-pause");
  }

  document.querySelectorAll(".vid-toggle").forEach(function (btn) {
    var host = btn.closest(".snap, .stage__frame, .party");
    var v = host ? host.querySelector("video") : null;
    if (!v) { btn.hidden = true; return; }
    if (still) syncToggle(btn, v);
    btn.addEventListener("click", function () {
      if (v.paused) {
        delete v.dataset.userPaused;
        v.dataset.userPlay = "1";
        hydrate(v, true);
        tryPlay(v);
      } else {
        v.dataset.userPaused = "1";
        v.pause();
      }
    });
    v.addEventListener("play", function () { syncToggle(btn, v); });
    v.addEventListener("pause", function () {
      /* Only show "play" when the user paused; auto-pauses offscreen keep the pause icon */
      if (v.dataset.userPaused) syncToggle(btn, v);
    });
  });

  /* ---------- Hero stage: vertical reel on phones / portrait, 16:9 otherwise ----------
     The inline script in the hero already picked the first source. Here we swap on
     orientation / width changes and fall back to the 16:9 reel (as a block with the
     CTA band below it) if the vertical file is missing. Lazy <source>s without a src
     fire "error" at parse time, so only errors from a real src count. */
  var stage = document.querySelector("[data-stage]");
  var stageVideo = stage ? stage.querySelector("[data-stage-video]") : null;
  if (stageVideo) {
    var VID = "../assets/video/";
    var mqPortrait = window.matchMedia("(max-width: 760px), (orientation: portrait)");
    var verticalOk = null;
    var stageSources = stageVideo.querySelectorAll("source");

    var setStage = function (mode) {
      stage.classList.toggle("stage--vertical", mode === "v");
      stage.classList.toggle("stage--fallback", mqPortrait.matches && mode === "h");
      if (stageVideo.getAttribute("data-mode") !== mode) {
        var base = mode === "v" ? "panita-motion-vertical" : "panita-motion";
        stageVideo.setAttribute("data-mode", mode);
        stageVideo.poster = VID + base + "-poster.jpg";
        var live = !still || stageVideo.dataset.userPlay;
        var attr = live ? "src" : "data-src";
        stageSources[0].setAttribute(attr, VID + base + ".webm");
        stageSources[1].setAttribute(attr, VID + base + ".mp4");
        if (live) { stageVideo.load(); tryPlay(stageVideo); }
      }
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    };
    var pickStage = function () {
      setStage(mqPortrait.matches && verticalOk !== false ? "v" : "h");
    };
    var verticalFailed = function () {
      if (verticalOk === false) return;
      verticalOk = false;
      pickStage();
    };
    stageSources[1].addEventListener("error", function () {
      if (stageSources[1].getAttribute("src") && stageVideo.getAttribute("data-mode") === "v") verticalFailed();
    });
    /* Only probe the vertical file when a portrait layout actually needs it */
    var probeVertical = function () {
      if (verticalOk !== null || !mqPortrait.matches || !window.fetch || location.protocol === "file:") return;
      verticalOk = "pending";
      fetch(VID + "panita-motion-vertical.mp4", { method: "HEAD", cache: "no-store" })
        .then(function (r) { if (r.ok) verticalOk = true; else { verticalOk = null; verticalFailed(); } })
        .catch(function () { verticalOk = null; verticalFailed(); });
    };
    mqPortrait.addEventListener("change", function () { probeVertical(); pickStage(); });
    probeVertical();
    pickStage();
  }

  /* ---------- Mobile order dock: shows once the hero is out of view ---------- */
  var dock = document.querySelector(".dock");
  var hero = document.querySelector(".stage");
  var footer = document.querySelector(".foot");
  if (dock && hero && "IntersectionObserver" in window) {
    var heroVisible = true;
    var footVisible = false;
    var sync = function () {
      var show = !heroVisible && !footVisible;
      dock.classList.toggle("is-visible", show);
      dock.setAttribute("aria-hidden", String(!show));
      dock.tabIndex = show ? 0 : -1;
    };
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.05 }).observe(hero);
    if (footer) {
      new IntersectionObserver(function (entries) {
        footVisible = entries[0].isIntersecting;
        sync();
      }).observe(footer);
    }
  }

  /* ---------- Intro chapter: start its CSS entrance when it scrolls into view ---------- */
  var intro = document.querySelector("[data-intro]");
  if (intro) {
    if (still || !("IntersectionObserver" in window)) intro.classList.add("is-in");
    else {
      var introIo = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { intro.classList.add("is-in"); introIo.disconnect(); }
      }, { threshold: 0.2 });
      introIo.observe(intro);
    }
  }

  /* ---------- Map loading state: hide the fallback once the iframe loads ---------- */
  var mapFrame = document.querySelector(".map iframe");
  var mapFallback = document.querySelector(".map__fallback");
  if (mapFrame && mapFallback) {
    mapFrame.addEventListener("load", function () { mapFallback.hidden = true; });
  }

  /* ---------- Footer year ---------- */
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ======================================================================
     GSAP ScrollTrigger motion layer. Skipped entirely under reduced motion
     or if the CDN fails; the page is fully readable without it.
     ====================================================================== */
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  if (reduceMotion || !gsap || !ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  root.classList.add("has-gsap");

  var mm = gsap.matchMedia();
  var isMobile = window.matchMedia("(max-width: 767px)").matches;

  /* Wrap each word / letter of a text node in a span (text-only elements) */
  function splitInto(el, unit, cls) {
    var text = el.textContent.trim();
    var parts = unit === "word" ? text.split(/\s+/) : Array.from(text);
    el.textContent = "";
    var nodes = [];
    parts.forEach(function (part, i) {
      var span = document.createElement("span");
      span.className = cls;
      span.textContent = part;
      el.appendChild(span);
      nodes.push(span);
      if (unit === "word" && i < parts.length - 1) el.appendChild(document.createTextNode(" "));
    });
    return nodes;
  }

  /* 1. The 4.9 sticker turns with the page scroll (hierarchy: keeps the rating in the eye) */
  gsap.to(".sticker", {
    rotation: 720,
    ease: "none",
    scrollTrigger: { start: 0, end: "max", scrub: 0.8 }
  });

  /* 2. Parallax depth on the poster collage pieces */
  gsap.utils.toArray("[data-parallax]").forEach(function (el) {
    var amt = parseFloat(el.getAttribute("data-parallax")) || 0;
    if (isMobile) amt *= 0.5;
    gsap.fromTo(el, { yPercent: -amt / 2 }, {
      yPercent: amt / 2,
      ease: "none",
      scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true }
    });
  });

  /* 3. Marquee: constant loop whose speed and direction follow the scroll velocity */
  var track = document.querySelector("[data-marquee]");
  if (track) {
    var loop = gsap.to(track, { xPercent: -50, ease: "none", duration: 38, repeat: -1 });
    loop.totalTime(loop.duration() * 200);
    var dir = 1;
    var settle = gsap.delayedCall(0.25, function () {
      gsap.to(loop, { timeScale: dir, duration: 1, ease: "power2.out", overwrite: true });
    }).pause();
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: function (self) {
        dir = self.direction;
        var boost = gsap.utils.clamp(1, 7, 1 + Math.abs(self.getVelocity()) / 350);
        gsap.to(loop, { timeScale: dir * boost, duration: 0.2, ease: "power2.out", overwrite: true });
        settle.restart(true);
      }
    });
  }

  /* 4. Image reveals: clip wipe up + slight scale settle on the photo inside */
  gsap.utils.toArray("[data-reveal-img]").forEach(function (fig) {
    var img = fig.querySelector("img");
    var tl = gsap.timeline({ scrollTrigger: { trigger: fig, start: "top 88%", once: true } });
    tl.fromTo(fig, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "expo.out" });
    if (img) tl.fromTo(img, { scale: 1.28 }, { scale: 1, duration: 1.5, ease: "expo.out" }, 0);
  });

  /* 5. Café cup photo turns like a saucer as it crosses the viewport */
  gsap.utils.toArray("[data-spin]").forEach(function (el) {
    gsap.fromTo(el, { rotation: -28 }, {
      rotation: 20,
      ease: "none",
      scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 }
    });
  });

  /* 6. Cocina: pinned section, photo cards stack in from below (desktop / tablet).
        Under 768px the CSS sticky stack does the job without pinning. */
  mm.add("(min-width: 768px)", function () {
    var section = document.querySelector("[data-stack]");
    if (!section) return;
    var cards = gsap.utils.toArray(".stack__card", section);
    if (cards.length < 2) return;
    section.classList.add("is-pinned");

    /* GSAP folds the CSS `rotate` tilt into its transform, so read it and keep it */
    var tilts = cards.map(function (c) { return parseFloat(getComputedStyle(c).getPropertyValue("--tilt")) || 0; });
    gsap.set(cards.slice(1), {
      yPercent: 190,
      rotation: function (i) { return tilts[i + 1] + (i % 2 ? -12 : 12); }
    });

    var tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: function () { return "+=" + Math.round(window.innerHeight * 0.75 * (cards.length - 1)); },
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    cards.forEach(function (card, i) {
      if (i === 0) return;
      tl.to(card, { yPercent: 0, rotation: tilts[i], duration: 1 }, i - 1);
      tl.to(cards.slice(0, i), {
        scale: function (j) { return 1 - (i - j) * 0.045; },
        y: function (j) { return -(i - j) * 16; },
        duration: 1
      }, i - 1);
    });

    return function () {
      section.classList.remove("is-pinned");
      gsap.set(cards, { clearProps: "transform" });
    };
  });

  /* 7. Reviews statement: words scrub from faint to full as you read down */
  var scrub = document.querySelector("[data-scrub-text]");
  if (scrub) {
    var words = splitInto(scrub, "word", "sw");
    gsap.fromTo(words, { opacity: 0.16 }, {
      opacity: 1,
      stagger: 0.08,
      ease: "none",
      scrollTrigger: { trigger: scrub, start: "top 82%", end: "bottom 42%", scrub: true }
    });
  }

  /* 8. Count-up on the ratings and review counts */
  gsap.utils.toArray("[data-count]").forEach(function (el) {
    var end = parseFloat(el.getAttribute("data-count"));
    var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var state = { v: 0 };
    el.textContent = (0).toFixed(dec);
    gsap.to(state, {
      v: end,
      duration: 1.6,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
      onUpdate: function () { el.textContent = state.v.toFixed(dec); }
    });
  });

  /* 9. Team photo drifts inside its frame */
  var teamImg = document.querySelector(".team__frame img");
  if (teamImg) {
    gsap.fromTo(teamImg, { yPercent: -5 }, {
      yPercent: 5,
      ease: "none",
      scrollTrigger: { trigger: ".team__frame", start: "top bottom", end: "bottom top", scrub: true }
    });
  }

  /* 10. Hero stage: as you scroll away the poster frame shrinks and tilts into a sticker card */
  var stageFrame = document.querySelector("[data-stage-frame]");
  if (stageFrame) {
    gsap.to(stageFrame, {
      scale: isMobile ? 0.9 : 0.8,
      rotation: -3,
      yPercent: 6,
      transformOrigin: "50% 30%",
      ease: "none",
      scrollTrigger: { trigger: "[data-stage]", start: "top top", end: "bottom top", scrub: 0.6 }
    });
  }

  /* 11. Tequeños block: video parallax + kinetic outline headline traveling sideways */
  var partyMedia = document.querySelector(".party__media");
  if (partyMedia) {
    gsap.fromTo(partyMedia, { yPercent: -6 }, {
      yPercent: 6,
      ease: "none",
      scrollTrigger: { trigger: ".party", start: "top bottom", end: "bottom top", scrub: true }
    });
  }
  var kinetic = document.querySelector("[data-kinetic]");
  if (kinetic) {
    gsap.fromTo(kinetic, { x: 0 }, {
      x: function () { return -Math.max(0, kinetic.offsetWidth - window.innerWidth * 0.92); },
      ease: "none",
      scrollTrigger: { trigger: ".party", start: "top bottom", end: "bottom top", scrub: 0.5, invalidateOnRefresh: true }
    });
  }

  /* 12. Footer wordmark: letters rise out of the baseline in sequence */
  var word = document.querySelector("[data-letters]");
  if (word) {
    var letters = splitInto(word, "letter", "l");
    gsap.fromTo(letters, { yPercent: 105 }, {
      yPercent: 0,
      stagger: 0.07,
      ease: "power2.out",
      scrollTrigger: { trigger: word, start: "top bottom", end: "bottom 92%", scrub: 0.6 }
    });
  }

  /* 13. Magnetic CTAs (fine pointers only): the pill leans toward the cursor,
         the icon island leans a little further for internal tension */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    gsap.utils.toArray("[data-magnetic]").forEach(function (btn) {
      var xTo = gsap.quickTo(btn, "x", { duration: 0.5, ease: "power3.out" });
      var yTo = gsap.quickTo(btn, "y", { duration: 0.5, ease: "power3.out" });
      var icon = btn.querySelector(".btn__icon");
      var ixTo = icon ? gsap.quickTo(icon, "x", { duration: 0.5, ease: "power3.out" }) : null;
      var iyTo = icon ? gsap.quickTo(icon, "y", { duration: 0.5, ease: "power3.out" }) : null;
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        xTo(dx * 0.22);
        yTo(dy * 0.34);
        if (icon) { ixTo(dx * 0.1); iyTo(dy * 0.16); }
      });
      btn.addEventListener("pointerleave", function () {
        xTo(0); yTo(0);
        if (icon) { ixTo(0); iyTo(0); }
      });
    });
  }

  /* Recalculate trigger positions once fonts and media have settled */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
