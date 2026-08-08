/* ==========================================================================
   26amFilms — site script
   ========================================================================== */
const root = document.documentElement;
const body = document.body;
const header = document.querySelector("[data-header]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const progress = document.querySelector("[data-scroll-progress]");
const navLinks = document.querySelectorAll(".main-nav a");
const revealItems = document.querySelectorAll(".reveal");
const counters = document.querySelectorAll("[data-counter]");
const rotator = document.querySelector("[data-rotator]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

body.classList.add("motion-ready");

/* ---------- Theme ---------- */
const savedTheme = localStorage.getItem("26amfilms-theme");
if (savedTheme) {
  root.dataset.theme = savedTheme;
}

themeToggle?.addEventListener("click", () => {
  const next = root.dataset.theme === "light" ? "dark" : "light";
  root.dataset.theme = next;
  localStorage.setItem("26amfilms-theme", next);
});

/* ---------- Scroll progress + header state ---------- */
const updateScrollState = () => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  root.style.setProperty("--progress", ratio.toString());
  root.style.setProperty("--hero-shift", Math.min(window.scrollY * 0.12, 80).toString());
  header?.classList.toggle("scrolled", window.scrollY > 10);
};

window.addEventListener("scroll", updateScrollState, { passive: true });
updateScrollState();

/* ---------- Lenis smooth scroll ----------
   Kept deliberately fast/responsive: a low duration + wheelMultiplier of 1
   means a single scroll tick moves the page right away, with only a brief,
   subtle glide afterward — not slow motion. */
const lenis = prefersReducedMotion || typeof Lenis === "undefined"
  ? null
  : new Lenis({
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 1,
      touchMultiplier: 2,
      smoothWheel: true,
    });

if (lenis) {
  const raf = (time) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
  lenis.on("scroll", updateScrollState);
}

const scrollToPosition = (top, { immediate = false } = {}) => {
  if (lenis) {
    lenis.scrollTo(top, { immediate });
  } else {
    window.scrollTo({ top, behavior: "auto" });
  }
};

/* ---------- Reveal on scroll ---------- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
);

revealItems.forEach((item) => revealObserver.observe(item));

/* ---------- Section nav highlighting ---------- */
const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`);
      });
    });
  },
  { threshold: 0.28 }
);

document.querySelectorAll('[data-view="main"] section[id]').forEach((section) => sectionObserver.observe(section));

/* ---------- Stat counters ----------
   Years auto-calculates from a fixed start year, so it silently becomes
   16+, 17+, etc. in future years without any manual edits. Video count and
   view count are static targets (update data-target by hand as real totals
   grow) that roll up on scroll — no fake perpetual auto-increment, just a
   one-time animated reveal each time the section scrolls into view. */
const animateCounter = (counter) => {
  const startYear = counter.dataset.startYear;
  const target = startYear
    ? new Date().getFullYear() - Number(startYear)
    : Number(counter.dataset.target);
  const startFrom = counter.dataset.startFrom ? Number(counter.dataset.startFrom) : 0;
  const format = counter.dataset.format;
  const duration = counter.dataset.duration ? Number(counter.dataset.duration) : 1300;
  const jitter = counter.dataset.jitter === "true";
  const start = performance.now();

  const render = (value) => (format === "comma" ? Math.round(value).toLocaleString("en-IN") : Math.round(value).toString());

  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    let value = startFrom + (target - startFrom) * eased;

    // A brief slot-machine-style wobble early in the animation, tapering
    // off to nothing well before it settles — still lands exactly on the
    // real target, not an open-ended live counter.
    if (jitter && p < 0.8) {
      const wobble = (target - startFrom) * 0.015 * (1 - p / 0.8);
      value += (Math.random() * 2 - 1) * wobble;
    }

    counter.textContent = render(value);
    if (p < 1) {
      requestAnimationFrame(tick);
    } else {
      counter.textContent = render(target);
    }
  };

  requestAnimationFrame(tick);
};

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.55 }
);

counters.forEach((counter) => counterObserver.observe(counter));

/* ---------- Global region rotator ---------- */
if (rotator && !prefersReducedMotion) {
  const spans = Array.from(rotator.querySelectorAll("span"));
  let activeIndex = 0;
  setInterval(() => {
    spans[activeIndex].classList.remove("active");
    activeIndex = (activeIndex + 1) % spans.length;
    spans[activeIndex].classList.add("active");
  }, 2600);
}

/* ==========================================================================
   Video Portfolio
   ========================================================================== */
const mainView = document.querySelector('[data-view="main"]');
const categoryView = document.querySelector('[data-view="category"]');
const categoryTitle = document.querySelector("[data-category-title]");
const categoryDescription = document.querySelector("[data-category-description]");
const categoryCount = document.querySelector("[data-category-count]");
const categoryGrid = document.querySelector("[data-category-grid]");
const backToMain = document.querySelector("[data-back-to-main]");
const categoryCards = document.querySelectorAll("[data-category-card]");
const categoryButtons = document.querySelectorAll("[data-open-category]");
const videoModal = document.querySelector("[data-video-modal]");
const videoPanel = document.querySelector("[data-video-panel]");
const videoFrame = document.querySelector("[data-video-frame]");
const closeVideoButtons = document.querySelectorAll("[data-close-video]");

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
    // yet since this player only embeds YouTube — let me know if you want
    // Vimeo support added.
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
      "SJi5MfOZYnk", "aDZd77cefbs",
    ].map((id) => ({ id, title: "" })),
  },
  reels: {
    title: "Reels/Shorts",
    description: "Short-form vertical edits for FB, IG, and YT ads — fast hooks, tight pacing, and social-first attention.",
    vertical: true,
    videos: [
      "Be9Mi1yvJ-Q", "jE-4LB8wl0s", "Wmg-fV6KIus", "U7TTuP1aCno", "cPMpVoZrk6M",
      "qE4er7kqTqs", "2Q219fO2-Aw", "nslPhWLEu8M", "6rlRyj0_eDo", "euwwYeG2POE",
      "6iLH5IPmBJQ", "kTqo8ZCNHy8", "hEIUfa4B1Ng", "dCIl2I5_CJk", "99Oc2Ozp998",
      "5386z9zDuIM", "6mnAQABar5s", "kq3Z0u2OpHo", "UqJIBgnfVFs", "Sg7D9NXsLjs",
      "nWZ-kRttIeQ", "Lx7yS5DOgSY", "SZuWOagXT7M", "uhdkE6oZJdM",
    ].map((id, i) => ({ id, title: `Reel ${String(i + 1).padStart(2, "0")}` })),
  },
  vox: {
    title: "Vox style editing",
    description: "Story-led explainer edits with kinetic captions, atmosphere, real voices, and deeper narrative structure.",
    vertical: false,
    videos: [
      { id: "DHfRMLihR18", title: "Vox style 01" },
      { id: "B3E1F0rJnLQ", title: "Vox style 02" },
    ],
  },
  "motion-saas": {
    title: "Motion Graphics / SaaS Style",
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
      if (entry.isIntersecting) {
        const el = entry.target;
        const url = el.dataset.lazyBg;
        if (url) {
          el.style.backgroundImage = `url("${url}")`;
          el.removeAttribute("data-lazy-bg");
        }
        thumbObserver.unobserve(el);
      }
    });
  },
  { rootMargin: "200px 0px" }
);

const createVideoThumb = (video, vertical) => {
  const card = document.createElement("div");
  card.className = "video-card";

  const thumb = document.createElement("button");
  thumb.type = "button";
  thumb.className = vertical ? "video-thumb vertical" : "video-thumb";
  thumb.dataset.videoId = video.id;
  thumb.setAttribute("aria-label", video.title ? `Play ${video.title}` : "Play video");
  // hqdefault is far lighter than maxresdefault and looks identical at
  // grid thumbnail size — kept lazy so only on-screen thumbs ever load.
  thumb.dataset.lazyBg = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
  thumb.innerHTML = `<span class="play-badge">Play</span>`;
  thumb.addEventListener("click", () => openVideo(video.id, vertical));
  thumbObserver.observe(thumb);

  card.append(thumb);

  // Titles are only generated where they're a fair generic label (e.g.
  // "Reel 01"). Podcast videos are real client projects, not sequential
  // episodes, and their real thumbnails already carry the actual title —
  // so no caption is added here rather than showing a misleading one.
  if (video.title) {
    const caption = document.createElement("p");
    caption.className = "video-caption";
    caption.textContent = video.title;
    card.append(caption);
  }

  return card;
};

const renderCategory = (key) => {
  const category = portfolioCategories[key];
  if (!category) return;
  categoryTitle.textContent = category.title;
  categoryDescription.textContent = category.description;
  categoryCount.textContent = category.videos.length ? `${category.videos.length} videos` : "";
  categoryGrid.classList.toggle("vertical", Boolean(category.vertical));

  if (!category.videos.length) {
    categoryGrid.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "video-empty";
    empty.textContent = "New work is on its way here — check back soon.";
    categoryGrid.after(empty);
    categoryGrid.dataset.emptyState = "1";
  } else {
    document.querySelectorAll(".video-empty").forEach((el) => el.remove());
    categoryGrid.replaceChildren(...category.videos.map((v) => createVideoThumb(v, category.vertical)));
  }

  categoryCards.forEach((card) => card.classList.toggle("active", card.dataset.categoryCard === key));
};

/* ---------- View transitions + routing ---------- */
const transitionToView = (nextView, { resetScroll = false } = {}) => {
  if (activeView === nextView) {
    if (resetScroll) scrollToPosition(0, { immediate: true });
    return;
  }
  const previousView = activeView;
  previousView.classList.remove("is-active");
  previousView.classList.add("is-exiting");
  nextView.classList.add("is-active");
  activeView = nextView;
  if (resetScroll) scrollToPosition(0, { immediate: true });
  window.setTimeout(() => previousView.classList.remove("is-exiting"), prefersReducedMotion ? 0 : 560);
};

const scrollToMainAnchor = (hash) => {
  const target = hash && hash !== "#/" ? document.querySelector(hash) : null;
  const top = target ? target.offsetTop : 0;
  window.setTimeout(() => scrollToPosition(top), activeView === mainView ? 0 : 560);
};

const openCategory = (key) => {
  renderCategory(key);
  history.pushState({ view: "category", key }, "", `#/portfolio/${key}`);
  transitionToView(categoryView, { resetScroll: true });
};

const openMainView = ({ push = true, hash = "#/" } = {}) => {
  categoryCards.forEach((card) => card.classList.remove("active"));
  if (push) history.pushState({ view: "main" }, "", hash);
  transitionToView(mainView, { resetScroll: false });
  scrollToMainAnchor(hash);
};

const routeFromHash = () => {
  const match = window.location.hash.match(/^#\/portfolio\/([^/]+)$/);
  if (match && portfolioCategories[match[1]]) {
    renderCategory(match[1]);
    transitionToView(categoryView, { resetScroll: true });
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

categoryButtons.forEach((btn) => btn.addEventListener("click", (e) => { e.stopPropagation(); openCategory(btn.dataset.openCategory); }));
categoryCards.forEach((card) => {
  card.addEventListener("click", () => {
    if (card.classList.contains("category-empty")) return;
    openCategory(card.dataset.categoryCard);
  });
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCategory(card.dataset.categoryCard); }
  });
});

backToMain?.addEventListener("click", () => openMainView({ hash: "#work" }));
window.addEventListener("popstate", routeFromHash);
routeFromHash();

/* ---------- Video modal ---------- */
const closeVideo = () => {
  videoModal.classList.remove("open");
  videoModal.setAttribute("aria-hidden", "true");
  videoFrame.removeAttribute("src");
  videoPanel.classList.remove("vertical");
};

const openVideo = (id, vertical) => {
  videoFrame.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  videoPanel.classList.toggle("vertical", Boolean(vertical));
  videoModal.classList.add("open");
  videoModal.setAttribute("aria-hidden", "false");
};

closeVideoButtons.forEach((btn) => btn.addEventListener("click", closeVideo));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && videoModal.classList.contains("open")) closeVideo();
});

/* ==========================================================================
   Services + Process — hover-linked
   ========================================================================== */
const serviceGrid = document.querySelector("[data-service-grid]");
const processSteps = document.querySelectorAll("[data-process-list] article");

serviceGrid?.querySelectorAll(".service-card").forEach((card) => {
  const relevant = (card.dataset.steps || "").split(",").filter(Boolean);
  card.addEventListener("mouseenter", () => {
    processSteps.forEach((step) => {
      const isRelevant = relevant.includes(step.dataset.step);
      step.classList.toggle("step-highlight", isRelevant);
      step.classList.toggle("step-dim", !isRelevant);
    });
  });
  card.addEventListener("mouseleave", () => {
    processSteps.forEach((step) => step.classList.remove("step-highlight", "step-dim"));
  });
});

/* ==========================================================================
   Contact form — Netlify Forms (AJAX submit, no app-picker redirect)
   ========================================================================== */
const contactForm = document.querySelector("[data-contact-form]");
const formStatus = document.querySelector("[data-form-status]");

const encodeFormData = (data) =>
  Object.keys(data)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join("&");

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(contactForm);
  const payload = Object.fromEntries(data.entries());
  const submitButton = contactForm.querySelector("button[type='submit']");

  submitButton.disabled = true;
  submitButton.textContent = "Sending...";

  try {
    const response = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encodeFormData(payload),
    });

    if (!response.ok) {
      throw new Error(`Form submission failed: ${response.status}`);
    }

    contactForm.reset();
    formStatus.textContent = "Thanks — I'll get back to you shortly.";
    formStatus.hidden = false;
    formStatus.classList.remove("error");
  } catch {
    // Netlify Forms only works once the site is actually deployed on
    // Netlify (it won't work opening index.html directly from disk, or on
    // other hosts without their own form handler). Fall back to mailto so
    // a message still gets through either way.
    const subject = encodeURIComponent(`26amFilms project inquiry from ${payload.name || ""}`);
    const body = encodeURIComponent(`Name: ${payload.name}\nEmail: ${payload.email}\n\nProject:\n${payload.message}`);
    window.location.href = `mailto:twenty6am@gmail.com?subject=${subject}&body=${body}`;
    formStatus.textContent = "Opening your email app instead — Netlify Forms isn't available here.";
    formStatus.hidden = false;
    formStatus.classList.add("error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send Inquiry";
  }
});

/* ---------- Discord copy-to-clipboard ----------
   Discord usernames aren't linkable the way email/WhatsApp are — there's
   no public URL to open a DM by username. Copy-to-clipboard with visual
   confirmation is the honest equivalent of a "contact" button here. */
document.querySelectorAll("[data-discord-copy]").forEach((btn) => {
  const username = btn.dataset.discordCopy;
  const originalHTML = btn.innerHTML;
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(username);
      btn.classList.add("copied");
      btn.textContent = `Copied "${username}"`;
      window.setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = originalHTML;
      }, 1800);
    } catch {
      // Clipboard API can fail (e.g. no HTTPS, permissions) — fall back to
      // just showing the username so the person can copy it manually.
      btn.textContent = username;
    }
  });
});

/* ---------- Placeholder links ----------
   Contact links (Slack, Instagram, X, booking, payment) don't have real
   URLs yet — this just gives a clear signal instead of a dead "#" click
   until real links are added to the href attributes above. */
document.querySelectorAll("[data-placeholder-link]").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (link.getAttribute("href") === "#") {
      event.preventDefault();
    }
  });
});



