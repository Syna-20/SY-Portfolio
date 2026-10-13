(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function store(k, v) { try { v === undefined ? 0 : sessionStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }

  /* ---------------- Boot screen ---------------- */
  var boot = document.getElementById("boot");
  var bootStatus = document.getElementById("bootStatus");
  var onBooted = [];
  function finishBoot() {
    if (boot) boot.classList.add("done");
    store("booted", "1");
    onBooted.forEach(function (fn) { fn(); });
    onBooted = [];
  }
  if (!boot || reduceMotion || read("booted")) {
    if (boot) boot.style.display = "none";
    setTimeout(finishBoot, 0);
  } else {
    setTimeout(function () { bootStatus.textContent = "loading clinical models…"; }, 700);
    setTimeout(function () { bootStatus.textContent = "ready"; }, 1350);
    var started = performance.now();
    var close = function () { setTimeout(finishBoot, Math.max(0, 1700 - (performance.now() - started))); };
    if (document.readyState === "complete") close(); else addEventListener("load", close);
  }
  function whenBooted(fn) { if (!boot || boot.classList.contains("done")) fn(); else onBooted.push(fn); }

  /* ---------------- Theme switch ---------------- */
  var themeSwitch = document.getElementById("themeSwitch");
  var themeListeners = [];
  function syncSwitch() {
    if (!themeSwitch) return;
    var light = root.dataset.theme === "light";
    themeSwitch.setAttribute("aria-checked", String(light));
    document.querySelector('meta[name="theme-color"]').content = light ? "#f5f8fa" : "#0a1220";
  }
  if (themeSwitch) themeSwitch.addEventListener("click", function () {
    var next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
    syncSwitch();
    themeListeners.forEach(function (fn) { fn(); });
  });
  syncSwitch();
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }

  /* ---------------- Nav: scrolled state, progress, active link ---------------- */
  var nav = document.getElementById("nav");
  var progress = document.getElementById("progress");
  function onScroll() {
    if (nav) nav.classList.toggle("scrolled", scrollY > 20);
    if (!progress) return;
    var max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = (max > 0 ? scrollY / max * 100 : 0) + "%";
  }
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-links a"));
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("main section[id]").forEach(function (s) { spy.observe(s); });
  }

  /* ---------------- Hyperspectral portrait scan ---------------- */
  var frame = document.querySelector(".scan-frame");
  var img = document.getElementById("scanImg");
  var falseCanvas = document.getElementById("scanFalse");
  var modeLabel = document.getElementById("scanMode");

  // Turbo colormap (polynomial approximation) — maps luminance to a spectral false-colour
  function turbo(x) {
    var r = 34.61 + x * (1172.33 - x * (10793.56 - x * (33300.12 - x * (38394.49 - x * 14825.05))));
    var g = 23.31 + x * (557.33 + x * (1225.33 - x * (3574.96 - x * (1073.77 + x * 707.56))));
    var b = 27.2 + x * (3211.1 - x * (15327.97 - x * (27814 - x * (22569.18 - x * 6838.66))));
    return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
  }
  function paintFalseColour() {
    var N = 480;
    falseCanvas.width = falseCanvas.height = N;
    var ctx = falseCanvas.getContext("2d");
    ctx.drawImage(img, 0, 0, N, N);
    try {
      var data = ctx.getImageData(0, 0, N, N), px = data.data;
      for (var i = 0; i < px.length; i += 4) {
        var lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
        var c = turbo(Math.pow(1 - lum, 0.9) * 0.92 + 0.04); // invert so skin/hair separate like a thermal map
        px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
      }
      ctx.putImageData(data, 0, 0);
    } catch (e) {
      // pixel access blocked (e.g. opened from disk): approximate with filters
      ctx.filter = "grayscale(1) invert(1) sepia(1) hue-rotate(160deg) saturate(5) contrast(1.2)";
      ctx.drawImage(img, 0, 0, N, N);
    }
  }
  function runScan() {
    if (reduceMotion) { frame.classList.add("done"); modeLabel.textContent = "MODE · RGB"; return; }
    var t0 = performance.now(), D = 2400;
    (function step(now) {
      var p = Math.min((now - t0) / D, 1);
      var eased = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      frame.style.setProperty("--y", (eased * 100).toFixed(2) + "%");
      modeLabel.textContent = "MODE · SPECTRAL → RGB · " + Math.round(400 + eased * 1300) + " nm";
      if (p < 1) requestAnimationFrame(step);
      else { frame.classList.add("done"); modeLabel.textContent = "MODE · RGB · subject located"; }
    })(t0);
  }
  function setupScan() {
    paintFalseColour();
    whenBooted(function () { setTimeout(runScan, 250); });
  }
  if (frame && img && falseCanvas && modeLabel) {
  if (img.complete && img.naturalWidth) setupScan(); else img.addEventListener("load", setupScan);

  // spectral lens follows the pointer once the scan is done
  frame.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse" || !frame.classList.contains("done")) return;
    var r = frame.getBoundingClientRect();
    frame.style.setProperty("--lx", (e.clientX - r.left) + "px");
    frame.style.setProperty("--ly", (e.clientY - r.top) + "px");
    if (!frame.classList.contains("lensing")) {
      frame.classList.add("lensing");
      modeLabel.textContent = "MODE · SPECTRAL LENS";
    }
  });
  // touch: tap to drop the lens, it lifts after a moment
  var touchTimer = null;
  var hint = document.getElementById("scanHint");
  if (hint && matchMedia("(hover: none)").matches) hint.textContent = "tap to inspect";
  frame.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" || !frame.classList.contains("done")) return;
    var r = frame.getBoundingClientRect();
    frame.style.setProperty("--lx", (e.clientX - r.left) + "px");
    frame.style.setProperty("--ly", (e.clientY - r.top) + "px");
    frame.classList.add("lensing");
    modeLabel.textContent = "MODE · SPECTRAL LENS";
    clearTimeout(touchTimer);
    touchTimer = setTimeout(function () { frame.classList.remove("lensing"); modeLabel.textContent = "MODE · RGB · subject located"; }, 2500);
  });
  frame.addEventListener("pointerleave", function (e) {
    if (e.pointerType !== "mouse") return;
    if (!frame.classList.contains("done")) return;
    frame.classList.remove("lensing");
    modeLabel.textContent = "MODE · RGB · subject located";
  });
  }

  /* ---------------- ECG monitor strip ---------------- */
  var ecg = document.getElementById("ecg");
  if (ecg && ecg.getContext) {
    var ectx = ecg.getContext("2d"), W = 0, H = 0, dpr = 1, buf = [], head = 0, ecgColor = cssVar("--ecg"), running = true, last = 0, phase = 0;
    themeListeners.push(function () { ecgColor = cssVar("--ecg"); if (reduceMotion) drawStatic(); });
    function g(x, mu, s, a) { return a * Math.exp(-Math.pow((x - mu) / s, 2)); }
    function beat(p) { // one heartbeat, p in [0,1)
      return g(p, .12, .025, .12) - g(p, .245, .008, .14) + g(p, .27, .012, 1) - g(p, .3, .01, .3) + g(p, .52, .05, .22);
    }
    function sizeEcg() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = ecg.clientWidth; H = ecg.clientHeight;
      ecg.width = W * dpr; ecg.height = H * dpr;
      ectx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buf = new Array(Math.ceil(W)).fill(null);
      head = 0;
    }
    function yOf(v) { return H * 0.62 - v * H * 0.5; }
    function drawBuf() {
      ectx.clearRect(0, 0, W, H);
      ectx.lineWidth = 1.8;
      ectx.lineJoin = "round";
      ectx.strokeStyle = "rgba(" + ecgColor + ",0.95)";
      ectx.shadowColor = "rgba(" + ecgColor + ",0.6)";
      ectx.shadowBlur = 8;
      ectx.beginPath();
      var pen = false;
      for (var x = 0; x < buf.length; x++) {
        var v = buf[x];
        if (v === null) { pen = false; continue; }
        if (!pen) { ectx.moveTo(x, yOf(v)); pen = true; } else ectx.lineTo(x, yOf(v));
      }
      ectx.stroke();
      ectx.shadowBlur = 0;
      // glowing write head
      var hv = buf[(head - 1 + buf.length) % buf.length];
      if (hv !== null && hv !== undefined) {
        ectx.fillStyle = "rgba(" + ecgColor + ",1)";
        ectx.beginPath(); ectx.arc(head - 1, yOf(hv), 3, 0, Math.PI * 2); ectx.fill();
      }
    }
    var SPEED = 140, BPM = 72, GAP = 26;
    function tick(now) {
      if (!running) return;
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      var steps = Math.round(dt * SPEED);
      for (var i = 0; i < steps; i++) {
        phase = (phase + (BPM / 60) / SPEED) % 1;
        buf[head] = beat(phase);
        head = (head + 1) % buf.length;
        for (var k = 0; k < GAP; k++) buf[(head + k) % buf.length] = null; // erase ahead like a monitor
      }
      drawBuf();
      requestAnimationFrame(tick);
    }
    function drawStatic() {
      for (var x = 0; x < buf.length; x++) buf[x] = beat((x / SPEED * BPM / 60) % 1);
      head = 0;
      drawBuf();
    }
    sizeEcg();
    addEventListener("resize", function () { sizeEcg(); if (reduceMotion) drawStatic(); });
    if (reduceMotion) drawStatic();
    else if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        var vis = en[0].isIntersecting;
        if (vis && !running) { running = true; last = 0; requestAnimationFrame(tick); }
        running = vis;
      }).observe(ecg);
      requestAnimationFrame(tick);
    } else requestAnimationFrame(tick);
  }

  /* ---------------- Tile spotlight ---------------- */
  document.querySelectorAll(".tile").forEach(function (t) {
    t.addEventListener("pointermove", function (e) {
      var r = t.getBoundingClientRect();
      t.style.setProperty("--mx", (e.clientX - r.left) + "px");
      t.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });

  /* ---------------- Reveal + vitals count-up ---------------- */
  if ("IntersectionObserver" in window && !reduceMotion) {
    var groups = [".block-head", ".tile", ".ev", ".edu-card", ".pub", ".proj", ".h-col", ".stack-row"];
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); ro.unobserve(e.target); } });
    }, { threshold: 0.12 });
    groups.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el, i) {
        el.classList.add("reveal");
        el.style.transitionDelay = (i % 3) * 80 + "ms";
        ro.observe(el);
      });
    });

    var counted = false;
    new IntersectionObserver(function (en, obs) {
      if (!en[0].isIntersecting || counted) return;
      counted = true; obs.disconnect();
      document.querySelectorAll(".v-num[data-count]").forEach(function (el) {
        var target = +el.dataset.count, t0 = performance.now();
        (function up(now) {
          var p = Math.min((now - t0) / 1200, 1);
          el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(up);
        })(t0);
      });
    }, { threshold: 0.4 }).observe(document.querySelector(".vitals") || document.body);
  }

  /* ---------------- Nazar: watches the cursor, blinks now and then ---------------- */
  var nazar = document.getElementById("nazar");
  var iris = document.getElementById("iris");
  var lid = document.getElementById("lid");
  if (nazar && iris && lid) {
    if (!reduceMotion) {
      addEventListener("pointermove", function (e) {
        var r = nazar.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        var d = Math.hypot(dx, dy) || 1, m = Math.min(9, d / 30);
        iris.setAttribute("transform", "translate(" + (dx / d * m).toFixed(2) + " " + (dy / d * m).toFixed(2) + ")");
      }, { passive: true });
    }
    function blink() {
      if (reduceMotion) return;
      var t0 = performance.now(), D = 220;
      (function step(now) {
        var p = Math.min((now - t0) / D, 1);
        var ry = 56 * Math.abs(Math.cos(p * Math.PI)); // close then open
        lid.setAttribute("ry", Math.max(3, ry).toFixed(1));
        if (p < 1) requestAnimationFrame(step); else lid.setAttribute("ry", "56");
      })(t0);
    }
    (function schedule() { setTimeout(function () { blink(); schedule(); }, 3000 + Math.random() * 4000); })();
    nazar.addEventListener("click", blink);
  }

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
