(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Theme toggle with circular reveal ---------- */
  function setTheme(light) {
    root.classList.toggle("light", light);
    try { localStorage.setItem("theme", light ? "light" : "dark"); } catch (e) {}
  }
  document.querySelectorAll(".theme-btn").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      var next = !root.classList.contains("light");
      if (!document.startViewTransition || reduceMotion) { setTheme(next); return; }
      var x = ev.clientX, y = ev.clientY;
      var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      document.startViewTransition(function () { setTheme(next); }).ready.then(function () {
        root.animate(
          { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + r + "px at " + x + "px " + y + "px)"] },
          { duration: 550, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" }
        );
      });
    });
  });

  /* ---------- Scroll-driven chrome: header, progress, back-to-top ---------- */
  var topbar = document.getElementById("topbar");
  var floatingTheme = document.getElementById("floatingTheme");
  var toTop = document.getElementById("toTop");
  var progress = document.getElementById("progress");
  function onScroll() {
    var past = scrollY > innerHeight * 0.8;
    topbar.classList.toggle("show", past);
    floatingTheme.classList.toggle("hide", past);
    toTop.classList.toggle("show", past);
    var max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
    updateDotFill();
  }
  toTop.addEventListener("click", function () { scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); });

  /* ---------- Section dots + keyboard navigation ---------- */
  var sections = Array.prototype.slice.call(document.querySelectorAll("section[data-label]"));
  var dots = document.getElementById("dots");
  var fill = document.createElement("span");
  fill.className = "fill";
  dots.appendChild(fill);
  var buttons = sections.map(function (sec) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", sec.dataset.label);
    b.innerHTML = '<span class="label"></span><span class="dot"></span>';
    b.querySelector(".label").textContent = sec.dataset.label;
    b.addEventListener("click", function () { sec.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }); });
    dots.appendChild(b);
    return b;
  });
  var current = 0;
  function setActive(i) {
    current = i;
    buttons.forEach(function (b, j) { b.classList.toggle("active", i === j); });
    updateDotFill();
  }
  function updateDotFill() {
    var b = buttons[current];
    if (b) fill.style.height = (b.offsetTop + b.offsetHeight / 2) + "px";
  }
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) setActive(sections.indexOf(e.target)); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }
  setActive(0);
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea/i.test(e.target.tagName)) return;
    var k = e.key.toLowerCase(), i = null;
    if (k === "j") i = Math.min(current + 1, sections.length - 1);
    if (k === "k") i = Math.max(current - 1, 0);
    if (i !== null) sections[i].scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* ---------- Typer: cycles research areas from the CV ---------- */
  var typer = document.getElementById("typer");
  var areas = ["deep_learning", "computer_vision", "medical_image_analysis", "generative_ai",
               "federated_learning", "multimodal_learning", "hyperspectral_imaging", "llms"];
  if (reduceMotion) {
    typer.textContent = areas.join(" · ");
  } else {
    var ai = 0, ci = 0, deleting = false;
    (function tick() {
      var word = areas[ai];
      ci += deleting ? -1 : 1;
      typer.textContent = word.slice(0, ci);
      var delay = deleting ? 35 : 75;
      if (!deleting && ci === word.length) { deleting = true; delay = 1600; }
      else if (deleting && ci === 0) { deleting = false; ai = (ai + 1) % areas.length; delay = 300; }
      setTimeout(tick, delay);
    })();
  }

  /* ---------- Intro "denoising": words resolve from noise ---------- */
  var intro = document.getElementById("intro");
  if (intro && !reduceMotion) {
    var glyphs = "▓▒░#%&@$*+=<>/\\|01";
    var words = [];
    var walker = document.createTreeWalker(intro, NodeFilter.SHOW_TEXT);
    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var span = document.createElement("span");
        span.className = "w noisy";
        span.dataset.word = part;
        frag.appendChild(span);
        words.push(span);
      });
      node.parentNode.replaceChild(frag, node);
    });
    function noise(len) {
      var s = "";
      for (var i = 0; i < len; i++) s += glyphs[(Math.random() * glyphs.length) | 0];
      return s;
    }
    var start = performance.now();
    words.forEach(function (w, i) {
      // deterministic pseudo-random resolve time per word, 0.3s–2.6s
      var r = Math.abs(Math.sin((i + 1) * 12.9898) * 43758.5453) % 1;
      w._at = 300 + r * 2300;
      w.textContent = noise(w.dataset.word.length);
    });
    (function step(now) {
      var t = now - start, pending = 0;
      words.forEach(function (w) {
        if (!w.classList.contains("noisy")) return;
        if (t >= w._at) {
          w.textContent = w.dataset.word;
          w.classList.remove("noisy");
        } else {
          pending++;
          // partially denoise: reveal a growing prefix as the time approaches
          var word = w.dataset.word, k = Math.floor(word.length * Math.max(0, (t - w._at + 600) / 600));
          w.textContent = word.slice(0, k) + noise(word.length - k);
        }
      });
      if (pending) requestAnimationFrame(step);
    })(start);
  }

  /* ---------- Portrait: pixel-reveal if photo.jpg exists ---------- */
  var portrait = document.getElementById("portrait");
  var img = new Image();
  img.onload = function () {
    portrait.classList.add("has-photo");
    portrait.querySelector(".portrait-initials").style.display = "none";
    document.querySelectorAll("[data-avatar]").forEach(function (a) {
      a.style.backgroundImage = "url(photo.jpg)";
      a.textContent = "";
    });
    var canvas = portrait.querySelector("canvas");
    var ctx = canvas.getContext("2d");
    var N = 128, tmp = document.createElement("canvas"), tctx = tmp.getContext("2d");
    var side = Math.min(img.naturalWidth, img.naturalHeight);
    var sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2;
    function draw(res) {
      tmp.width = tmp.height = res;
      tctx.drawImage(img, sx, sy, side, side, 0, 0, res, res);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, N, N);
      ctx.drawImage(tmp, 0, 0, N, N);
    }
    if (reduceMotion) { canvas.width = canvas.height = 512; N = 512; draw(512); return; }
    var t0 = performance.now(), D = 3500;
    (function frame(now) {
      var p = Math.min((now - t0) / D, 1);
      draw(Math.max(4, Math.round(4 * Math.pow(N / 4, p))));
      if (p < 1) requestAnimationFrame(frame);
      else { canvas.width = canvas.height = 512; N = 512; ctx.imageSmoothingEnabled = true; draw(512); }
    })(t0);
  };
  img.src = "photo.jpg";

  /* ---------- Hero neural field: drifting nodes that wire up to the cursor ---------- */
  var net = document.getElementById("netCanvas");
  var hero = document.getElementById("hero");
  if (net && net.getContext) {
    var nctx = net.getContext("2d");
    var nodes = [], mouse = { x: -9999, y: -9999 }, running = true, W = 0, H = 0, dpr = 1;
    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = hero.clientWidth; H = hero.clientHeight;
      net.width = W * dpr; net.height = H * dpr;
      nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round(Math.min(90, (W * H) / 16000));
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35 });
      }
    }
    function color() { return getComputedStyle(root).getPropertyValue("--net").trim(); }
    function render() {
      var c = color();
      nctx.clearRect(0, 0, W, H);
      var LINK = 120;
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        if (!reduceMotion) {
          a.x += a.vx; a.y += a.vy;
          if (a.x < 0 || a.x > W) a.vx *= -1;
          if (a.y < 0 || a.y > H) a.vy *= -1;
          var dxm = mouse.x - a.x, dym = mouse.y - a.y, dm = Math.hypot(dxm, dym);
          if (dm < 180) { a.x += dxm * 0.004; a.y += dym * 0.004; }
        }
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK) {
            nctx.strokeStyle = "rgba(" + c + "," + (0.18 * (1 - d / LINK)) + ")";
            nctx.lineWidth = 1;
            nctx.beginPath(); nctx.moveTo(a.x, a.y); nctx.lineTo(b.x, b.y); nctx.stroke();
          }
        }
        var md = Math.hypot(mouse.x - a.x, mouse.y - a.y);
        if (md < 180) {
          nctx.strokeStyle = "rgba(" + c + "," + (0.45 * (1 - md / 180)) + ")";
          nctx.beginPath(); nctx.moveTo(a.x, a.y); nctx.lineTo(mouse.x, mouse.y); nctx.stroke();
        }
        nctx.fillStyle = "rgba(" + c + ",0.55)";
        nctx.beginPath(); nctx.arc(a.x, a.y, 1.6, 0, Math.PI * 2); nctx.fill();
      }
      if (running && !reduceMotion) requestAnimationFrame(render);
    }
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    hero.addEventListener("pointerleave", function () { mouse.x = mouse.y = -9999; });
    addEventListener("resize", function () { resize(); if (reduceMotion) render(); });
    resize();
    if ("IntersectionObserver" in window && !reduceMotion) {
      new IntersectionObserver(function (en) {
        var vis = en[0].isIntersecting;
        if (vis && !running) { running = true; render(); }
        running = vis;
      }).observe(hero);
    }
    render();
    // redraw static field on theme change when motion is reduced
    new MutationObserver(function () { if (reduceMotion) render(); }).observe(root, { attributes: true, attributeFilter: ["class"] });
  }

  /* ---------- Card spotlight ---------- */
  document.querySelectorAll(".card").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });

  /* ---------- Reveal on scroll + stat count-up ---------- */
  var revealables = document.querySelectorAll("section:not(#hero) h2, section:not(#hero) .group-title, section:not(#hero) .card");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); ro.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    revealables.forEach(function (el) { el.classList.add("reveal"); ro.observe(el); });

    document.querySelectorAll(".stats dt[data-count]").forEach(function (dt) {
      var target = +dt.dataset.count, t0 = null;
      dt.textContent = "0";
      (function up(now) {
        if (t0 === null) t0 = now;
        var p = Math.min((now - t0) / 1400, 1);
        dt.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(up);
      })(performance.now());
    });
  }

  document.getElementById("year").textContent = new Date().getFullYear();
})();
