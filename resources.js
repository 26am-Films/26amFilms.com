/* ==========================================================================
   26amFilms — resources page script (lightweight subset of script.js)
   ========================================================================== */
const root = document.documentElement;
const body = document.body;
const header = document.querySelector("[data-header]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

body.classList.add("motion-ready");

const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
};

/* ---------- Theme (shared key with main site) ---------- */
const savedTheme = storage.get("26amfilms-theme");
if (savedTheme) root.dataset.theme = savedTheme;

document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
  const next = root.dataset.theme === "light" ? "dark" : "light";
  root.dataset.theme = next;
  storage.set("26amfilms-theme", next);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#ffffff" : "#000000");
});

/* ---------- Lenis smooth scroll ---------- */
const lenis = prefersReducedMotion || typeof Lenis === "undefined"
  ? null
  : new Lenis({ lerp: 0.085, wheelMultiplier: 1, touchMultiplier: 1.5, smoothWheel: true });

if (lenis) {
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

/* ---------- Header + progress ---------- */
let lastY = window.scrollY;
let ticking = false;
const updateScrollState = () => {
  const y = window.scrollY;
  const maxScroll = root.scrollHeight - window.innerHeight;
  root.style.setProperty("--progress", maxScroll > 0 ? (y / maxScroll).toFixed(4) : "0");
  header?.classList.toggle("scrolled", y > 20);
  if (body.classList.contains("menu-open")) header?.classList.remove("hidden");
  else if (y > lastY + 2 && y > 400) header?.classList.add("hidden");
  else if (y < lastY - 2 || y < 400) header?.classList.remove("hidden");
  lastY = y;
  ticking = false;
};
window.addEventListener("scroll", () => {
  if (!ticking) { ticking = true; requestAnimationFrame(updateScrollState); }
}, { passive: true });
updateScrollState();

/* ---------- Reveal on scroll ---------- */
document.querySelectorAll(".reveal-group").forEach((group) => {
  Array.from(group.children).forEach((child, i) => child.style.setProperty("--i", i));
});
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
);
document.querySelectorAll(".reveal, .reveal-group").forEach((el) => revealObserver.observe(el));

/* ---------- Mobile menu ---------- */
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const setMenu = (open) => {
  body.classList.toggle("menu-open", open);
  menuToggle?.setAttribute("aria-expanded", String(open));
  mobileMenu?.setAttribute("aria-hidden", String(!open));
  if (lenis) open ? lenis.stop() : lenis.start();
  body.style.overflow = open ? "hidden" : "";
};
menuToggle?.addEventListener("click", () => setMenu(!body.classList.contains("menu-open")));
mobileMenu?.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

/* ---------- Placeholder links ---------- */
document.querySelectorAll("[data-placeholder-link]").forEach((link) => {
  link.addEventListener("click", (e) => { if (link.getAttribute("href") === "#") e.preventDefault(); });
});

/* ---------- Footer year ---------- */
document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
