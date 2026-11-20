/* ==========================================================================
   26amFilms — site script
   ========================================================================== */
const root = document.documentElement;
const body = document.body;
const header = document.querySelector("[data-header]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const VIEW_EXIT_MS = prefersReducedMotion ? 0 : 380;

body.classList.add("motion-ready");

const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
};

/* ---------- Analytics (GA4) ----------
   Safe no-op if gtag is blocked or hasn't loaded. Buttons opt in with
   data-track="event_name"; every Google Calendar link counts as book_call. */
const track = (event, params = {}) => {
  if (typeof window.gtag === "function") window.gtag("event", event, params);
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-track], a[href*='calendar.app.google']");
  if (!el) return;
  track(el.dataset.track || "book_call", {
    link_text: el.textContent.trim().slice(0, 60),
    link_location: el.closest("header") ? "header" : el.closest("[id]")?.id || "page",
  });
});

/* ---------- Years of experience: one source for every mention ---------- */
const CAREER_START_YEAR = 2011;
const yearsOfExperience = new Date().getFullYear() - CAREER_START_YEAR;
document.querySelectorAll("[data-years]").forEach((el) => { el.textContent = yearsOfExperience; });

/* ---------- Theme (black ↔ white) ---------- */
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

const scrollToTarget = (target, { immediate = false } = {}) => {
  if (lenis) {
    lenis.scrollTo(target, { immediate, duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
  } else {
    const top = typeof target === "number" ? target : target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: immediate || prefersReducedMotion ? "auto" : "smooth" });
  }
};

const lockScroll = (locked) => {
  if (lenis) locked ? lenis.stop() : lenis.start();
  body.style.overflow = locked ? "hidden" : "";
};

/* ---------- Scroll state: progress, header hide/show, hero parallax ---------- */
const faqFab = document.querySelector(".faq-fab");
const faqSection = document.querySelector("#faq");
let lastY = window.scrollY;
let ticking = false;

const updateScrollState = () => {
  const y = window.scrollY;
  const maxScroll = root.scrollHeight - window.innerHeight;
  root.style.setProperty("--progress", maxScroll > 0 ? (y / maxScroll).toFixed(4) : "0");
  if (y < window.innerHeight * 1.2) root.style.setProperty("--hero-shift", (y * 0.25).toFixed(1));

  header?.classList.toggle("scrolled", y > 20);
  const goingDown = y > lastY + 2;
  const goingUp = y < lastY - 2;
  if (body.classList.contains("menu-open")) header?.classList.remove("hidden");
  else if (goingDown && y > 400) header?.classList.add("hidden");
  else if (goingUp || y < 400) header?.classList.remove("hidden");
  lastY = y;

  if (faqFab) {
    const pastHero = y > window.innerHeight * 0.8;
    const faqTop = faqSection && mainView.classList.contains("is-active") ? faqSection.getBoundingClientRect().top : Infinity;
    faqFab.classList.toggle("show", pastHero && faqTop > window.innerHeight * 0.6 && mainView.classList.contains("is-active"));
  }
  ticking = false;
};

const onScroll = () => {
  if (!ticking) { ticking = true; requestAnimationFrame(updateScrollState); }
};
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll, { passive: true });

/* ---------- Reveal on scroll ---------- */
document.querySelectorAll(".reveal-group").forEach((group) => {
  Array.from(group.children).forEach((child, i) => child.style.setProperty("--i", i));
});
document.querySelectorAll(".split-in").forEach((el, i) => {
  Array.from(el.children).forEach((child, j) => child.style.setProperty("--i", i + j));
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

/* ---------- Active nav link ---------- */
const navLinks = document.querySelectorAll(".main-nav a");
const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
    });
  },
  { rootMargin: "-45% 0px -50% 0px" }
);
document.querySelectorAll('[data-view="main"] section[id]').forEach((s) => sectionObserver.observe(s));

/* ---------- Stat counters ----------
   Years auto-calculates from a fixed start year. Video and view counts are
   static targets (update data-target by hand) that roll up once on scroll. */
const counterTarget = (counter) => (counter.hasAttribute("data-years-counter") ? yearsOfExperience : Number(counter.dataset.target));
const renderCounter = (counter, v) => (counter.dataset.format === "comma" ? Math.round(v).toLocaleString("en-IN") : String(Math.round(v)));

const animateCounter = (counter) => {
  const target = counterTarget(counter);
  const startFrom = Number(counter.dataset.startFrom || 0);
  const duration = Number(counter.dataset.duration || 1800);
  const render = (v) => renderCounter(counter, v);

  if (prefersReducedMotion) { counter.textContent = render(target); return; }

  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 4);
    counter.textContent = render(startFrom + (target - startFrom) * eased);
    if (p < 1) requestAnimationFrame(tick);
    else counter.textContent = render(target);
  };
  requestAnimationFrame(tick);
};

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.2 }
);
// The HTML already holds the real numbers, so the stats read correctly even
// if this script never runs. Only once we know we can animate do we reset to
// the start value and roll up when the stats scroll into view.
document.querySelectorAll("[data-counter]").forEach((c) => {
  if (prefersReducedMotion) { c.textContent = renderCounter(c, counterTarget(c)); return; }
  c.textContent = renderCounter(c, Number(c.dataset.startFrom || 0));
  counterObserver.observe(c);
});

/* ---------- Region rotator ---------- */
const rotator = document.querySelector("[data-rotator]");
if (rotator && !prefersReducedMotion) {
  const spans = Array.from(rotator.querySelectorAll("span"));
  let index = 0;
  setInterval(() => {
    const current = spans[index];
    current.classList.remove("active");
    current.classList.add("leaving");
    setTimeout(() => current.classList.remove("leaving"), 650);
    index = (index + 1) % spans.length;
    spans[index].classList.add("active");
  }, 2400);
}

/* ---------- Marquees: duplicate content for a seamless loop ---------- */
document.querySelectorAll("[data-marquee] .marquee-track").forEach((track) => {
  Array.from(track.children).forEach((item) => {
    const clone = item.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    track.append(clone);
  });
  // Constant speed regardless of how many items are in the row
  requestAnimationFrame(() => {
    const pxPerSecond = 45;
    track.style.setProperty("--marquee-duration", `${Math.max(track.scrollWidth / 2 / pxPerSecond, 20)}s`);
  });
});

/* ==========================================================================
   Mobile menu
   ========================================================================== */
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");

const setMenu = (open) => {
  body.classList.toggle("menu-open", open);
  menuToggle?.setAttribute("aria-expanded", String(open));
  menuToggle?.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  mobileMenu?.setAttribute("aria-hidden", String(!open));
  lockScroll(open);
};
menuToggle?.addEventListener("click", () => setMenu(!body.classList.contains("menu-open")));
mobileMenu?.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

/* ==========================================================================
   Video Portfolio
   ========================================================================== */
const mainView = document.querySelector('[data-view="main"]');
const categoryView = document.querySelector('[data-view="category"]');
const categoryTitle = document.querySelector("[data-category-title]");
const categoryDescription = document.querySelector("[data-category-description]");
const categoryCount = document.querySelector("[data-category-count]");
const categoryGrid = document.querySelector("[data-category-grid]");
const categoryCards = document.querySelectorAll("[data-category-card]");
const videoModal = document.querySelector("[data-video-modal]");
const videoPanel = document.querySelector("[data-video-panel]");
const videoFrame = document.querySelector("[data-video-frame]");

let activeView = mainView;

// To add a new video: add its YouTube video ID to the relevant array below,
// with a short title. IDs are the part of a YouTube URL after v= or
// youtu.be/ or /shorts/. No other code needs to change.
const portfolioCategories = {
  corporate: {
    title: "Corporate Videos",
    description: "Business videos, explainers, testimonials, event recaps, and brand films.",
    // Note: 2 additional Corporate videos are hosted on Vimeo
    // (vimeo.com/1066597339, vimeo.com/1066320097) and aren't included here
    // since this player only embeds YouTube.
    vertical: false,
    videos: [
      { id: "WErc62GzhsM", title: "Corporate 01" },
      { id: "vwe28f_y2wE", title: "Corporate 02" },
    ],
  },
  podcasts: {
    title: "Podcast",
    description: "Hours of raw footage into smooth, one-hour podcast edits — recorded on Riverside, cleaned up, captioned, and packaged for release.",
    vertical: false,
    videos: [
      "iks-9bA2XkU", "iFh1jXCollY", "ZDYbVOLtpn8", "OsmsJWwSsAI", "5ZE9YXHCSig",
      "Yw6P8cef7RE", "t58F68SElhE", "yd98AcUB3y0", "VC95_XxWnFQ", "gt6j9v_RZ5s",
      "8Cimeg7veq0", "RSu2pQ1WiA0", "1DIrjDdK0CE", "ErRGOd7dVjc", "8VTrWXDeUNU",
      "Z94vn0pTewg", "OnM7sWLnAfw", "ni00UYRGgK8", "XX0c3C54dg8", "BUD446V2ThE",
      "OPWimNWDgmc", "-rWrVlUYBo4", "kgdJsjCHK3c", "ZvWGuEmE4oQ", "WpH3g3kjFus",
      "WjMy0JFTQZ0", "9ycqruB4Pl0", "7GFPAPrysFY", "5OS3pZ3yXrg", "ONGmW6POqX4",
      "vuxztj8MXxI", "n3uEWZ1KT64", "iVa0NP3u74s", "SEAVE9XgBbM", "-stDHMwbBRw",
      "aI5-oKjfgo4", "wueNYL-wNiU", "VwJnowQ7Iio", "2IiKVJhrWQQ", "4JKzfCdwiSo",
      "SJi5MfOZYnk", "aDZd77cefbs", "AsWsnL_zcmA",
      "C6f8E897Pgs", "TEF_kYBcn8E", "qFTu9nRdU4g", "JpR_c36oMVk", "7OFueWiLLlY",
      "sCe94K_bnm8", "jHLsvVuJjOA",
      "m7iIL5hwqMs", // P2P Masterclass
    ].map((id) => ({ id, title: "" })),
  },
  reels: {
    title: "Reels / Shorts",
    description: "Short-form vertical edits for FB, IG, and YT ads — fast hooks, tight pacing, and social-first attention.",
    vertical: true,
    videos: [
      "Be9Mi1yvJ-Q", "jE-4LB8wl0s", "Wmg-fV6KIus", "U7TTuP1aCno", "cPMpVoZrk6M",
      "qE4er7kqTqs", "2Q219fO2-Aw", "nslPhWLEu8M", "6rlRyj0_eDo", "euwwYeG2POE",
      "6iLH5IPmBJQ", "kTqo8ZCNHy8", "hEIUfa4B1Ng", "dCIl2I5_CJk", "99Oc2Ozp998",
      "5386z9zDuIM", "6mnAQABar5s", "kq3Z0u2OpHo", "UqJIBgnfVFs", "Sg7D9NXsLjs",
      "nWZ-kRttIeQ", "Lx7yS5DOgSY", "SZuWOagXT7M", "uhdkE6oZJdM", "009L0XUuJ-g", "uDUy0cPeCUA", "CC8Wb7BGoV4",
      "VISbqJ69X4U", "fhnqB4TiRM4", "ysYRggQL4yA", "yPRmtFJ--5o", "xkHyNvB-yp0",
      "teMOHWsLOGk", "k9OZpBq-izQ", "6cp6DBGDNd8", "NE6vVe-YnZk", "FpyhjgxkRXM",
      "AiWB0pNWrWU", "gxEIl2LmdL4", "D0T6Wim91ZE", "FEuZcllxeqk", "3feVNgtkXPU",
      "BMGaHy_EHIE", "VjkcY20Mstc", "6jz5bsR_K1Y", "t22UviZExa0", "PuE7VjGMp9E",
      "awdqw_UwR5c", "Zvr6aU6OtNg", "J21RUmmnXTg", "QsJQr_BMj0U", "Mo__r1CWfhY",
      "HOQvqbb_H88", "OCUlIgneLBk", "osRTtRLqdTw",
    ].filter((id, i, all) => all.indexOf(id) === i).map((id, i) => ({ id, title: `Reel ${String(i + 1).padStart(2, "0")}` })),
  },
  vox: {
    title: "Talking-head Editing",
    description: "Story-led explainer edits with kinetic captions, atmosphere, real voices, and deeper narrative structure.",
    vertical: false,
    videos: [
      { id: "DHfRMLihR18", title: "Talking-head 01" },
      { id: "B3E1F0rJnLQ", title: "Talking-head 02" },
      { id: "78dqieABevk", title: "Talking-head 03" },
    ],
  },
  "motion-saas": {
    title: "Motion Graphics / SaaS",
    description: "UI animation, explainers, kinetic typography, infographics, and SaaS-style product motion.",
    vertical: false,
    videos: [
      { id: "E3a-XBJXKn4", title: "Motion / SaaS 01" },
      { id: "G2lRzDZn-l8", title: "Motion / SaaS 02" },
      { id: "xpSYZM_AHu0", title: "Motion / SaaS 03" },
      { id: "cIy0pgm-Ols", title: "Motion / SaaS 04" },
    ],
  },
  "films-events": {
    title: "Films & Events",
    description: "Short films, event coverage, and summit recaps shaped around real moments and clean pacing.",
    vertical: false,
    videos: [
      "ZZP_Iu7-WDM", "m6KB4kN_QbM", "-vlJUoQbtwA", "Isxq9P8E504", "EdSjfYVrhUQ",
      "IIwU7XFov2k", "svYKSIoeiRo", "Q1qr2MVY4n0", "Fi2gcCOsKB8", "UzKlWNRqCBk",
      "h-b5tiOmZe4", "BSoknwwVlFk", "RCM7WRrSq7g", "FqR_s40yWzE", "0iAgxWVzCzw",
      "kcP0ucpkWmM", "iVHeUf8ntwI",
    ].map((id, i) => ({ id, title: `Films & Events ${String(i + 1).padStart(2, "0")}` })),
  },
};

const thumbObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const { lazyBg, fallbackBg } = el.dataset;
      el.removeAttribute("data-lazy-bg");
      thumbObserver.unobserve(el);
      if (!fallbackBg) { el.style.backgroundImage = `url("${lazyBg}")`; return; }
      // Shorts: try YouTube's vertical thumbnail first. Not every Short has
      // one (404 or a tiny placeholder), so fall back to the 16:9 one.
      const probe = new Image();
      probe.onload = () => { el.style.backgroundImage = `url("${probe.naturalWidth > 120 ? lazyBg : fallbackBg}")`; };
      probe.onerror = () => { el.style.backgroundImage = `url("${fallbackBg}")`; };
      probe.src = lazyBg;
    });
  },
  { rootMargin: "300px 0px" }
);

const createVideoThumb = (video, vertical, index, categoryKey) => {
  const card = document.createElement("div");
  card.className = "video-card";
  card.style.setProperty("--i", index);

  const thumb = document.createElement("button");
  thumb.type = "button";
  thumb.className = vertical ? "video-thumb vertical" : "video-thumb";
  thumb.setAttribute("aria-label", video.title ? `Play ${video.title}` : "Play video");
  const hq = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
  if (vertical) {
    thumb.dataset.lazyBg = `https://img.youtube.com/vi/${video.id}/oardefault.jpg`;
    thumb.dataset.fallbackBg = hq;
  } else {
    thumb.dataset.lazyBg = hq;
  }
  thumb.innerHTML = `<span class="play-badge">Play</span>`;
  thumb.addEventListener("click", () => openVideo(video.id, vertical, thumb, categoryKey));
  thumbObserver.observe(thumb);
  card.append(thumb);

  // Podcast thumbnails already carry the real episode title, so no caption.
  if (video.title) {
    const caption = document.createElement("p");
    caption.className = "video-caption";
    caption.textContent = video.title;
    card.append(caption);
  }
  return card;
};

const videoCountLabel = (n) => (n ? `${n} video${n === 1 ? "" : "s"}` : "");

// Show each category's real video count on its card
categoryCards.forEach((card) => {
  const category = portfolioCategories[card.dataset.categoryCard];
  const label = card.querySelector("[data-card-count]");
  if (category && label) label.textContent = videoCountLabel(category.videos.length);
});

const renderCategory = (key) => {
  const category = portfolioCategories[key];
  if (!category) return;
  categoryTitle.textContent = category.title;
  categoryDescription.textContent = category.description;
  categoryCount.textContent = videoCountLabel(category.videos.length);
  categoryGrid.classList.toggle("vertical", Boolean(category.vertical));
  categoryGrid.replaceChildren(...category.videos.map((v, i) => createVideoThumb(v, category.vertical, i, key)));
};

/* ---------- View transitions + routing ----------
   The old view fades out first, then the new one fades up — sequential, so
   there's never a frame where both are stacked. */
let viewTimer = null;
const transitionToView = (nextView, { onSwap } = {}) => {
  clearTimeout(viewTimer);
  if (activeView === nextView) { onSwap?.(); return; }
  const previous = activeView;
  activeView = nextView;
  previous.classList.add("is-exiting");
  viewTimer = setTimeout(() => {
    previous.classList.remove("is-active", "is-exiting");
    previous.hidden = true;
    nextView.hidden = false;
    nextView.classList.add("is-active");
    onSwap?.();
    onScroll();
  }, VIEW_EXIT_MS);
};

const scrollToHash = (hash, immediate) => {
  const target = hash && !hash.startsWith("#/") ? document.querySelector(hash) : null;
  scrollToTarget(target || 0, { immediate });
};

const openCategory = (key) => {
  if (!portfolioCategories[key]) return;
  history.pushState({ view: "category", key }, "", `#/portfolio/${key}`);
  transitionToView(categoryView, {
    onSwap: () => { renderCategory(key); scrollToTarget(0, { immediate: true }); },
  });
};

const openMainView = ({ push = true, hash = "#/" } = {}) => {
  if (push) history.pushState({ view: "main" }, "", hash);
  const switching = activeView !== mainView;
  transitionToView(mainView, { onSwap: () => scrollToHash(hash, switching) });
};

const routeFromHash = () => {
  const match = window.location.hash.match(/^#\/portfolio\/([^/]+)$/);
  if (match && portfolioCategories[match[1]]) {
    transitionToView(categoryView, {
      onSwap: () => { renderCategory(match[1]); scrollToTarget(0, { immediate: true }); },
    });
    return;
  }
  openMainView({ push: false, hash: window.location.hash || "#/" });
};

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const href = link.getAttribute("href");
    if (!href || href === "#" || href.startsWith("#/")) return;
    event.preventDefault();
    openMainView({ push: true, hash: href });
  });
});

categoryCards.forEach((card) => {
  card.addEventListener("click", () => openCategory(card.dataset.categoryCard));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCategory(card.dataset.categoryCard); }
  });
});

document.querySelector("[data-back-to-main]")?.addEventListener("click", () => openMainView({ hash: "#work" }));
window.addEventListener("popstate", routeFromHash);

// Initial route: no transition, just show the right view.
(() => {
  const match = window.location.hash.match(/^#\/portfolio\/([^/]+)$/);
  if (match && portfolioCategories[match[1]]) {
    renderCategory(match[1]);
    mainView.classList.remove("is-active");
    mainView.hidden = true;
    categoryView.hidden = false;
    categoryView.classList.add("is-active");
    activeView = categoryView;
  } else if (window.location.hash && !window.location.hash.startsWith("#/")) {
    const target = document.querySelector(window.location.hash);
    if (target) setTimeout(() => scrollToTarget(target, { immediate: true }), 50);
  }
  updateScrollState();
})();

/* ---------- Video modal ---------- */
let lastFocused = null;

const closeVideo = () => {
  if (!videoModal.classList.contains("open")) return;
  videoModal.classList.remove("open");
  videoModal.setAttribute("aria-hidden", "true");
  lockScroll(false);
  setTimeout(() => {
    if (videoModal.classList.contains("open")) return; // reopened meanwhile
    videoFrame.removeAttribute("src");
    videoPanel.classList.remove("vertical");
    videoModal.hidden = true;
  }, 450);
  lastFocused?.focus({ preventScroll: true });
};

const openVideo = (id, vertical, trigger, categoryKey) => {
  lastFocused = trigger || null;
  videoFrame.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  videoPanel.classList.toggle("vertical", Boolean(vertical));
  videoModal.hidden = false;
  void videoModal.offsetWidth; // start the fade-in from the hidden state
  videoModal.classList.add("open");
  track("video_play", { video_id: id, video_category: categoryKey || "", video_format: vertical ? "short" : "long_form" });
  videoModal.setAttribute("aria-hidden", "false");
  lockScroll(true);
  videoModal.querySelector(".modal-close")?.focus({ preventScroll: true });
};

document.querySelectorAll("[data-close-video]").forEach((btn) => btn.addEventListener("click", closeVideo));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closeVideo();
  if (body.classList.contains("menu-open")) setMenu(false);
});

/* ==========================================================================
   Services ↔ Process — hovering a service lights up the steps it uses
   ========================================================================== */
const processSteps = document.querySelectorAll("[data-process-list] li");
document.querySelectorAll("[data-service-grid] [data-steps]").forEach((row) => {
  const relevant = row.dataset.steps.split(",");
  row.addEventListener("mouseenter", () => {
    processSteps.forEach((step) => {
      const on = relevant.includes(step.dataset.step);
      step.classList.toggle("step-highlight", on);
      step.classList.toggle("step-dim", !on);
    });
  });
  row.addEventListener("mouseleave", () => processSteps.forEach((s) => s.classList.remove("step-highlight", "step-dim")));
});

/* ==========================================================================
   FAQ accordion
   ========================================================================== */
document.querySelectorAll("[data-faq] .faq-item").forEach((item) => {
  const button = item.querySelector("button");
  button.addEventListener("click", () => {
    const open = !item.classList.contains("open");
    item.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
    // Let Lenis pick up the new page height after the animation
    setTimeout(() => lenis?.resize(), 650);
  });
});

/* ==========================================================================
   Contact form — Netlify Forms (AJAX submit), mailto fallback elsewhere
   ========================================================================== */
const contactForm = document.querySelector("[data-contact-form]");
const formStatus = document.querySelector("[data-form-status]");

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(contactForm).entries());
  const submitButton = contactForm.querySelector("button[type='submit']");
  const originalLabel = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.textContent = "Sending…";

  try {
    const response = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString(),
    });
    if (!response.ok) throw new Error(`Form submission failed: ${response.status}`);
    contactForm.reset();
    track("contact_form_submit", { method: "netlify_form" });
    formStatus.textContent = "Thanks — I'll get back to you shortly.";
    formStatus.classList.remove("error");
  } catch {
    // Netlify Forms only works on a Netlify deploy — fall back to email.
    track("contact_form_submit", { method: "mailto_fallback" });
    const subject = encodeURIComponent(`26amFilms project inquiry from ${payload.name || ""}`);
    const mailBody = encodeURIComponent(`Name: ${payload.name}\nEmail: ${payload.email}\n\nProject:\n${payload.message}`);
    window.location.href = `mailto:hello@26amfilms.com?subject=${subject}&body=${mailBody}`;
    formStatus.textContent = "Opening your email app instead.";
    formStatus.classList.add("error");
  } finally {
    formStatus.hidden = false;
    submitButton.disabled = false;
    submitButton.innerHTML = originalLabel;
  }
});

/* ---------- Placeholder links (no real URL yet) ---------- */
document.querySelectorAll("[data-placeholder-link]").forEach((link) => {
  link.addEventListener("click", (e) => { if (link.getAttribute("href") === "#") e.preventDefault(); });
});

/* ---------- Footer year ---------- */
document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
