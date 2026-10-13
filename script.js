// Theme toggle (remembers choice when storage is available)
(function () {
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) {}
  if (saved) root.dataset.theme = saved;
  else if (window.matchMedia("(prefers-color-scheme: dark)").matches) root.dataset.theme = "dark";

  document.getElementById("themeToggle").addEventListener("click", function () {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
  });
})();

// Reveal sections on scroll and highlight the current nav link
(function () {
  const sections = document.querySelectorAll(".reveal");
  const navLinks = document.querySelectorAll(".nav a");

  if (!("IntersectionObserver" in window)) {
    sections.forEach(function (s) { s.classList.add("visible"); });
    return;
  }

  const revealer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  sections.forEach(function (s) { revealer.observe(s); });

  const spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      navLinks.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id);
      });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll("section[id]").forEach(function (s) { spy.observe(s); });
})();

document.getElementById("year").textContent = new Date().getFullYear();
