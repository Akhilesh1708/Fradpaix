/* =========================================
   FRADPAIX — script.js  (shared across all pages)
   ========================================= */

// ---- Inject utility styles ----
const revealStyle = document.createElement('style');
revealStyle.textContent = '.revealed { opacity: 1 !important; transform: translateY(0) !important; }';
document.head.appendChild(revealStyle);

// =========================================
// GOOGLE SHEETS SYNC
// Paste your deployed Apps Script Web App URL below.
// Leave as empty string '' to disable (localStorage only).
// =========================================
window.FradpaixSheets = (function () {
    const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyHNppw-9Fc5ZJlM4P7rXffAvPkxSh7ST-jtR7c0WFzJfGC-jxPI2hdd7iM2z4kNMbh/exec';

  // Expose URL for CRM to read back leads
  window._FRADPAIX_SHEETS_URL = SHEETS_URL;
  function push(type, payload) {
    if (!SHEETS_URL) return;                         // not configured yet
    if (typeof navigator !== 'undefined' && !navigator.onLine) return; // offline
    fetch(SHEETS_URL, {
      method:  'POST',
      mode:    'no-cors',                            // Apps Script requires no-cors
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type, [type]: payload })
    }).catch(() => {});                              // silent fail — localStorage is primary
  }

  return { push };
})();

// ---- Cookie consent ----
(function initCookieConsent() {
  const CONSENT_KEY = 'fradpaix-cookie-consent';
  const existing = localStorage.getItem(CONSENT_KEY);

  if (existing) {
      if (existing === 'allowed') {
      // Defer until FradpaixAnalytics is defined later in this script
      setTimeout(() => window.FradpaixAnalytics && window.FradpaixAnalytics.init(), 0);
    }
    return;
  }

  const banner = document.createElement('aside');
  banner.className = 'cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie preferences');
  banner.innerHTML = `
    <div class="cookie-banner__body">
      <div class="cookie-banner__icon">🍪</div>
      <div class="cookie-banner__text">
        <strong>We value your privacy</strong>
        <p>Fradpaix uses cookies to enhance your browsing experience and understand how visitors use our site. We collect anonymised data to improve our services. We never sell your data to third parties.</p>
      </div>
    </div>
    <div class="cookie-banner__actions">
      <button type="button" class="cookie-banner__reject">Decline</button>
      <button type="button" class="cookie-banner__allow">Accept All</button>
    </div>`;
  document.body.appendChild(banner);


  const finish = choice => {
    localStorage.setItem(CONSENT_KEY, choice);
    banner.classList.add('cookie-banner--hide');
    setTimeout(() => banner.remove(), 400);
    if (choice === 'allowed') setTimeout(() => window.FradpaixAnalytics && window.FradpaixAnalytics.init(), 0);
  };

  banner.querySelector('.cookie-banner__allow').addEventListener('click',  () => finish('allowed'));
  banner.querySelector('.cookie-banner__reject').addEventListener('click', () => finish('declined'));
})();

// =========================================
// ANALYTICS — collect technical info via cookies
// Runs only after user grants cookie consent.
// =========================================
window.FradpaixAnalytics = (function () {
  const COOKIE_KEY  = 'fradpaix_analytics';   // cookie name
  const STORE_KEY   = 'fradpaix-analytics';    // localStorage mirror for CRM
  const SESSION_KEY = 'fradpaix-session';      // sessionStorage for page-view count

  /* ---- tiny cookie helpers ---- */
  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))}; expires=${expires}; path=/; SameSite=Lax`;
  }
  function getCookie(name) {
    const match = document.cookie.split('; ').find(r => r.startsWith(name + '='));
    if (!match) return null;
    try { return JSON.parse(decodeURIComponent(match.split('=').slice(1).join('='))); } catch { return null; }
  }

  /* ---- device / browser fingerprint (no third-party libs) ---- */
  function getDeviceInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown', os = 'Unknown', device = 'Desktop';

    // Browser detection
    if (/Edg\//.test(ua))            browser = 'Edge';
    else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
    else if (/Chrome\//.test(ua))    browser = 'Chrome';
    else if (/Firefox\//.test(ua))   browser = 'Firefox';
    else if (/Safari\//.test(ua))    browser = 'Safari';
    else if (/MSIE|Trident/.test(ua)) browser = 'IE';

    // OS detection
    if (/Windows NT/.test(ua))      os = 'Windows';
    else if (/Mac OS X/.test(ua))   os = 'macOS';
    else if (/Android/.test(ua))    os = 'Android';
    else if (/iPhone|iPad/.test(ua)) os = 'iOS';
    else if (/Linux/.test(ua))      os = 'Linux';

    // Device type
    if (/Mobi|Android|iPhone/.test(ua)) device = 'Mobile';
    else if (/iPad|Tablet/.test(ua))    device = 'Tablet';

    return {
      browser,
      os,
      device,
      screen: `${screen.width}x${screen.height}`,
      language: navigator.language || 'unknown',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
      userAgent: ua
    };
  }

  /* ---- page-view tracking (session-scoped) ---- */
  function trackPageView() {
    let session = {};
    try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY)) || {}; } catch { session = {}; }
    session.views = (session.views || 0) + 1;
    session.pages = session.pages || [];
    session.pages.push({
      page: window.location.pathname.split('/').pop() || 'index.html',
      title: document.title,
      referrer: document.referrer || 'direct',
      time: new Date().toLocaleString('en-IN')
    });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  /* ---- fetch IP + geo from public API ---- */
  function fetchIPInfo(callback) {
    fetch('https://ipapi.co/json/', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => callback({
        ip:      data.ip      || 'unknown',
        city:    data.city    || 'unknown',
        region:  data.region  || 'unknown',
        country: data.country_name || 'unknown',
        isp:     data.org     || 'unknown'
      }))
      .catch(() => callback({ ip: 'unavailable', city: '', region: '', country: '', isp: '' }));
  }

  /* ---- main init ---- */
  function init() {
    const deviceInfo  = getDeviceInfo();
    const sessionData = trackPageView();

    // Check if we already have an IP record in the cookie (avoid re-fetching on every page load)
    const existing = getCookie(COOKIE_KEY);
    if (existing && existing.ip && existing.ip !== 'unavailable') {
      // Merge fresh session data into existing cookie
      existing.lastSeen   = new Date().toLocaleString('en-IN');
      existing.pageViews  = sessionData.views;
      existing.pagesVisited = sessionData.pages;
      existing.device     = deviceInfo;
      setCookie(COOKIE_KEY, existing, 365);
      _saveToStorage(existing);
      return;
    }

    // First visit or no IP yet — fetch it
    fetchIPInfo(function (ipInfo) {
      const record = {
        ...ipInfo,
        device:       deviceInfo,
        firstSeen:    new Date().toLocaleString('en-IN'),
        lastSeen:     new Date().toLocaleString('en-IN'),
        pageViews:    sessionData.views,
        pagesVisited: sessionData.pages
      };
      setCookie(COOKIE_KEY, record, 365);   // persist for 1 year
      _saveToStorage(record);
    });
  }

  /* ---- persist to localStorage + sync to Google Sheets ---- */
  function _saveToStorage(record) {
    try {
      const all = JSON.parse(localStorage.getItem(STORE_KEY)) || [];
      const idx = all.findIndex(r => r.ip === record.ip);
      if (idx >= 0) all[idx] = { ...all[idx], ...record };
      else {
        all.unshift(record);
        // Only push to Sheets on first visit (new visitor)
        window.FradpaixSheets && window.FradpaixSheets.push('visitor', record);
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
    } catch { /* storage full or unavailable */ }
  }

  /* ---- public API ---- */
  return { init, getCookie: () => getCookie(COOKIE_KEY) };
})();

// ---- Browser-based CRM lead store ----
window.FradpaixCRM = {
  addLead(lead) {
    const key = 'fradpaix-crm-leads';
    let leads = [];
    try { leads = JSON.parse(localStorage.getItem(key)) || []; } catch { leads = []; }
    const fullLead = {
      id:        `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      status:    'New',
      createdAt: new Date().toLocaleString('en-IN'),
      ...lead
    };
    leads.unshift(fullLead);
    localStorage.setItem(key, JSON.stringify(leads));
    // Sync to Google Sheets (fire-and-forget)
    window.FradpaixSheets && window.FradpaixSheets.push('lead', fullLead);
  }
};

// ---- Sticky nav ----
const header = document.getElementById('site-header');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ---- Mobile burger ----
const burger   = document.getElementById('burger');
const navLinks = document.getElementById('nav-links');
if (burger && navLinks) {
  burger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
    const spans = burger.querySelectorAll('span');
    if (open) {
      spans[0].style.transform = 'translateY(7px) rotate(45deg)';
      spans[1].style.opacity   = '0';
      spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    } else {
      spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    }
  });
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      burger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    });
  });
}

// ---- Homepage trip finder ----
(function initTripFinder() {
  const form = document.getElementById('trip-finder-form');
  const level = document.getElementById('trip-finder-level');
  const result = document.getElementById('trip-finder-result');
  if (!form || !level || !result) return;

  const recommendations = {
    easy: { name: 'Chanderkhani Pass Trek', href: 'chanderkhani.html', note: 'A scenic, approachable first high-altitude trek.' },
    moderate: { name: 'Miyar Valley Trek', href: 'miyar-valley.html', note: 'A rewarding wilderness journey with dramatic alpine views.' },
    hard: { name: 'Bara Bhangal Trek', href: 'bara-bhangal.html', note: 'A serious Himalayan challenge for experienced trekkers.' }
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    const recommendation = recommendations[level.value];
    if (!recommendation) {
      result.textContent = 'Choose an experience level to see a recommended trek.';
      return;
    }
    result.innerHTML = `Try <a href="${recommendation.href}">${recommendation.name}</a> — ${recommendation.note}`;
  });
})();

// ---- Gallery lightbox ----
(function initGalleryLightbox() {
  const lightbox = document.getElementById('gallery-lightbox');
  const image = lightbox?.querySelector('.gallery-lightbox__image');
  const close = lightbox?.querySelector('.gallery-lightbox__close');
  const galleryItems = document.querySelectorAll('.gallery__item');
  if (!lightbox || !image || !galleryItems.length) return;

  const closeLightbox = () => {
    lightbox.hidden = true;
    document.body.style.overflow = '';
  };

  galleryItems.forEach(item => {
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    const openLightbox = () => {
      image.src = getComputedStyle(item).backgroundImage.slice(5, -2);
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
      close.focus();
    };
    item.addEventListener('click', openLightbox);
    item.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openLightbox();
      }
    });
  });

  close.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !lightbox.hidden) closeLightbox(); });
})();

// ---- Back-to-top control ----
const backToTop = document.getElementById('back-to-top');
if (backToTop) {
  const updateBackToTop = () => backToTop.classList.toggle('visible', window.scrollY > 600);
  window.addEventListener('scroll', updateBackToTop, { passive: true });
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  updateBackToTop();
}

// =========================================
// HERO FULL-SCREEN SLIDER
// =========================================
(function initHeroSlider() {
  const track       = document.getElementById('hs-track');
  const slides      = document.querySelectorAll('.hs__slide');
  const dots        = document.querySelectorAll('.hs__dot');
  const prevBtn     = document.getElementById('hs-prev');
  const nextBtn     = document.getElementById('hs-next');
  const progressBar = document.getElementById('hs-progress-bar');
  const statDuration   = document.getElementById('hs-stat-duration');
  const statAltitude   = document.getElementById('hs-stat-altitude');
  const statDifficulty = document.getElementById('hs-stat-difficulty');
  const statPrice      = document.getElementById('hs-stat-price');
  if (!track || !slides.length) return;

  const DURATION = 5000;
  let current = 0;
  let timer;

  // Position track by translating it
  function moveTo(index, animate) {
    track.style.transition = animate
      ? 'transform 0.9s cubic-bezier(0.77,0,0.175,1)'
      : 'none';
    track.style.transform = `translateX(-${index * 100}%)`;
  }

  function updateStats(slide) {
    const d = slide.dataset;
    const els  = [statDuration, statAltitude, statDifficulty, statPrice];
    const vals = [d.duration, d.altitude, d.difficulty, d.price];
    els.forEach((el, i) => {
      if (!el) return;
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(() => {
        el.textContent = vals[i] || '';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 200);
    });
  }

  function goTo(index) {
    // Remove active from current
    slides[current].classList.remove('hs__slide--active');
    dots[current]?.classList.remove('hs__dot--active');
    // Wrap index
    current = ((index % slides.length) + slides.length) % slides.length;
    // Add active to new
    slides[current].classList.add('hs__slide--active');
    dots[current]?.classList.add('hs__dot--active');
    moveTo(current, true);
    updateStats(slides[current]);
    restartProgress();
  }

  function restartProgress() {
    clearTimeout(timer);
    if (progressBar) {
      progressBar.style.transition = 'none';
      progressBar.style.width = '0%';
      progressBar.getBoundingClientRect();
      progressBar.style.transition = `width ${DURATION}ms linear`;
      progressBar.style.width = '100%';
    }
    timer = setTimeout(() => goTo(current + 1), DURATION);
  }

  prevBtn?.addEventListener('click', () => goTo(current - 1));
  nextBtn?.addEventListener('click', () => goTo(current + 1));
  dots.forEach(dot => dot.addEventListener('click', () => goTo(parseInt(dot.dataset.goto))));

  // Touch swipe
  let touchStartX = 0;
  track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) dx < 0 ? goTo(current + 1) : goTo(current - 1);
  });

  // Pause on hover
  const sliderEl = document.querySelector('.hero-slider');
  sliderEl?.addEventListener('mouseenter', () => clearTimeout(timer));
  sliderEl?.addEventListener('mouseleave', () => restartProgress());

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') goTo(current - 1);
    if (e.key === 'ArrowRight') goTo(current + 1);
  });

  // Init — position without animation, then activate
  moveTo(0, false);
  slides[0].classList.add('hs__slide--active');
  dots[0]?.classList.add('hs__dot--active');
  updateStats(slides[0]);
  restartProgress();
})();

// =========================================
// CARD SLIDER (featured expeditions)
// =========================================
(function initCardSlider() {
  const csTrack  = document.getElementById('cs-track');
  const csPrev   = document.getElementById('cs-prev');
  const csNext   = document.getElementById('cs-next');
  const csDotsEl = document.getElementById('cs-dots');
  const csFill   = document.getElementById('cs-progress-fill');
  if (!csTrack) return;

  const cards = Array.from(csTrack.querySelectorAll('.cs__card'));
  if (!cards.length) return;

  let idx = 0;
  let isDragging = false, dragStartX = 0, dragOffset = 0;
  let autoTimer;

  // Build dots
  if (csDotsEl) {
    cards.forEach((_, i) => {
      const d = document.createElement('button');
      d.className = 'cs__dot' + (i === 0 ? ' active' : '');
      d.setAttribute('aria-label', `Slide to card ${i + 1}`);
      d.addEventListener('click', () => { slideTo(i); resetAuto(); });
      csDotsEl.appendChild(d);
    });
  }

  function cardW() { return (cards[0]?.getBoundingClientRect().width || 340) + 24; }
  function visCount() { return Math.max(1, Math.floor(csTrack.parentElement.getBoundingClientRect().width / cardW())); }
  function maxIdx() { return Math.max(0, cards.length - visCount()); }

  function slideTo(i, animate = true) {
    idx = ((i % cards.length) + cards.length) % cards.length;
    idx = Math.min(idx, maxIdx());
    csTrack.style.transition = animate
      ? 'transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)'
      : 'none';
    csTrack.style.transform = `translateX(-${idx * cardW()}px)`;
    // update dots
    csDotsEl?.querySelectorAll('.cs__dot').forEach((d, j) => d.classList.toggle('active', j === idx));
    // update arrow states
    if (csPrev) csPrev.disabled = idx <= 0;
    if (csNext) csNext.disabled = idx >= maxIdx();
  }

  csPrev?.addEventListener('click', () => { slideTo(idx - 1); resetAuto(); });
  csNext?.addEventListener('click', () => { slideTo(idx + 1); resetAuto(); });

  // Drag
  const viewport = csTrack.parentElement;
  viewport.addEventListener('mousedown', e => {
    isDragging = true; dragStartX = e.clientX; dragOffset = idx * cardW();
    csTrack.style.transition = 'none';
  });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    csTrack.style.transform = `translateX(-${dragOffset + (dragStartX - e.clientX)}px)`;
  });
  window.addEventListener('mouseup', e => {
    if (!isDragging) return;
    isDragging = false;
    const dx = dragStartX - e.clientX;
    slideTo(Math.abs(dx) > 60 ? idx + (dx > 0 ? 1 : -1) : idx);
    resetAuto();
  });

  // Touch swipe
  let ts = 0;
  viewport.addEventListener('touchstart', e => { ts = e.touches[0].clientX; }, { passive: true });
  viewport.addEventListener('touchend', e => {
    const dx = ts - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 50) { slideTo(idx + (dx > 0 ? 1 : -1)); resetAuto(); }
  });

  // Auto-advance — slides one card every 3.5s, loops back to start
  function startProgress() {
    if (!csFill) return;
    csFill.style.transition = 'none';
    csFill.style.width = '0%';
    csFill.getBoundingClientRect(); // force reflow
    csFill.style.transition = 'width 3.5s linear';
    csFill.style.width = '100%';
  }
  function stopProgress() {
    if (!csFill) return;
    csFill.style.transition = 'none';
    csFill.style.width = '0%';
  }

  function startAuto() {
    clearInterval(autoTimer);
    startProgress();
    autoTimer = setInterval(() => {
      const next = idx >= maxIdx() ? 0 : idx + 1;
      slideTo(next);
      startProgress();
    }, 3500);
  }
  function resetAuto() { startAuto(); }

  // Pause on hover
  viewport.addEventListener('mouseenter', () => { clearInterval(autoTimer); stopProgress(); });
  viewport.addEventListener('mouseleave', () => startAuto());

  slideTo(0, false);
  startAuto();
  window.addEventListener('resize', () => slideTo(idx, false));
})();

// ---- Scroll-reveal ----
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); revealObs.unobserve(e.target); } });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll(
  '.cs__card, .trip-card, .trip-detail-card, .journal-card, .testi-card, ' +
  '.about__visual, .about__content, .gallery__item, .gallery-full__item, ' +
  '.section-header, .info-panel, .season-card, .value-card, .team-card, ' +
  '.contact-info-item, .contact-form-box'
).forEach((el, i) => {
  el.style.opacity    = '0';
  el.style.transform  = 'translateY(28px)';
  el.style.transition = `opacity 0.6s ease ${Math.min(i * 0.07, 0.6)}s, transform 0.6s ease ${Math.min(i * 0.07, 0.6)}s`;
  revealObs.observe(el);
});

// ---- Contact form → CRM (legacy stub — handled by initContactPageForm below) ----

// ---- FAQ accordion ----
document.querySelectorAll('.faq-item').forEach(item => {
  item.querySelector('.faq-btn')?.addEventListener('click', () => {
    const open = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!open) item.classList.add('open');
  });
});

// ---- Filter tabs ----
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const f = tab.dataset.filter;
    document.querySelectorAll('.trip-detail-card').forEach(c => {
      c.style.display = (f === 'all' || c.dataset.region === f) ? 'flex' : 'none';
    });
  });
});

// ---- Active nav link ----
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav__links > li > a').forEach(a => {
  if (a.getAttribute('href') === currentPage) a.style.color = 'var(--clr-accent)';
});

// ---- Smooth scroll ----
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 88, behavior: 'smooth' }); }
  });
});

// ---- Pre-select trip on contact page ----
if (currentPage === 'contact.html') {
  const trip = new URLSearchParams(window.location.search).get('trip');
  if (trip) {
    const sel = document.getElementById('adventure');
    if (sel) Array.from(sel.options).forEach(o => {
      if (o.text.toLowerCase().includes(trip.replace(/-/g, ' '))) sel.value = o.value || o.text;
    });
  }
}

// =========================================
// TREK PAGE — Tab navigation
// =========================================
(function initTrekTabs() {
  const tabs  = document.querySelectorAll('.trek-tab[data-panel]');
  const panels = document.querySelectorAll('.trek-panel[data-panel]');
  if (!tabs.length) return;

  function activate(id) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.panel === id));
    panels.forEach(p => p.classList.toggle('active', p.dataset.panel === id));
    // Update URL hash without jumping
    history.replaceState(null, '', '#' + id);
  }

  tabs.forEach(tab => tab.addEventListener('click', () => activate(tab.dataset.panel)));

  // Honour URL hash on load
  const hash = location.hash.replace('#', '');
  const initial = hash && document.querySelector(`.trek-tab[data-panel="${hash}"]`) ? hash : tabs[0].dataset.panel;
  activate(initial);
})();

// =========================================
// TREK PAGE — Accordion itinerary
// =========================================
(function initTrekAccordion() {
  document.querySelectorAll('.trek-acc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.trek-acc-item');
      const isOpen = item.classList.contains('open');
      // Close all
      document.querySelectorAll('.trek-acc-item').forEach(i => i.classList.remove('open'));
      // Toggle clicked
      if (!isOpen) item.classList.add('open');
    });
  });
  // Open first item by default
  const first = document.querySelector('.trek-acc-item');
  if (first) first.classList.add('open');
})();


// =========================================
// BOOKING MODAL
// =========================================
(function initBookingModal() {
  const bookBtn = document.getElementById('book-float-btn');
  const modal = document.getElementById('booking-modal');
  const closeBtn = document.getElementById('booking-modal-close');
  const form = document.getElementById('booking-form');
  const trekSelect = document.getElementById('booking-trek');
  const priceDisplay = document.getElementById('booking-price-display');

  if (!bookBtn || !modal) return;

  // Trek prices map
  const trekPrices = {
    'Mt. Manirang Expedition (6,593m)': '₹45,000',
    'Mt. Yunam Peak Expedition (6,111m)': '₹32,000',
    'Parang La Trek (5,600m)': '₹25,000',
    'Miyar Valley Trek (3,990m)': '₹15,500',
    'Bara Bhangal Trek (4,878m)': '₹18,500',
    'Chanderkhani Pass Trek (3,440m)': '₹6,500',
    'Ghepan Lake Trek (4,149m)': '₹7,500'
  };

  // Update price when trek is selected
  if (trekSelect && priceDisplay) {
    trekSelect.addEventListener('change', () => {
      const selectedTrek = trekSelect.value;
      const priceAmount = priceDisplay.querySelector('.booking-form__price-amount');
      
      if (selectedTrek && trekPrices[selectedTrek]) {
        if (priceAmount) {
          priceAmount.textContent = trekPrices[selectedTrek] + ' per person';
        }
        priceDisplay.style.display = 'block';
      } else {
        priceDisplay.style.display = 'none';
      }
    });

    // Trigger change event on page load to show price if trek is pre-selected
    if (trekSelect.value) {
      trekSelect.dispatchEvent(new Event('change'));
    }
  }

  // Open modal
  bookBtn.addEventListener('click', () => {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    // Trigger price display if trek is already selected
    if (trekSelect && trekSelect.value) {
      trekSelect.dispatchEvent(new Event('change'));
    }
  });

  // Close modal
  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  closeBtn?.addEventListener('click', closeModal);

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });

  // Handle form submission
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = form.querySelector('#booking-name')?.value.trim();
      const email = form.querySelector('#booking-email')?.value.trim();
      const phone = form.querySelector('#booking-phone')?.value.trim();
      const trek = form.querySelector('#booking-trek')?.value.trim();
      const dates = form.querySelector('#booking-dates')?.value.trim();
      const people = form.querySelector('#booking-people')?.value.trim();
      const message = form.querySelector('#booking-message')?.value.trim();

      if (!name || !phone || !trek) {
        alert('Please fill in Name, Phone, and Trek selection.');
        return;
      }

      // Get price for selected trek
      const price = trekPrices[trek] || 'Price on request';

      // Build WhatsApp message
      let text = `Hi Fradpaix! I'd like to book a trek.\n\n`;
      text += `*Name:* ${name}\n`;
      if (email) text += `*Email:* ${email}\n`;
      text += `*Phone:* ${phone}\n`;
      text += `*Trek:* ${trek}\n`;
      text += `*Price:* ${price} per person\n`;
      if (dates) text += `*Preferred Dates:* ${dates}\n`;
      if (people) text += `*Number of People:* ${people}\n`;
      if (message) text += `\n*Message:* ${message}`;
      text += `\n\nReady With Frady!`;

      const waNumber = '918580475396';
      const waURL = `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;

      // Save to CRM
      if (window.FradpaixCRM) {
        window.FradpaixCRM.addLead({
          name, email, phone,
          trip: trek, dates, people, price,
          message, source: 'Booking modal'
        });
      }

      // Show loading state
      const btn = form.querySelector('button[type="submit"]');
      const origText = btn.innerHTML;
      btn.innerHTML = 'Opening WhatsApp…';
      btn.disabled = true;

      setTimeout(() => {
        window.open(waURL, '_blank', 'noopener');
        form.reset();
        priceDisplay.style.display = 'none';
        btn.innerHTML = origText;
        btn.disabled = false;
        closeModal();
      }, 600);
    });
  }
})();


// =========================================
// ENQUIRY STRIP — handles .enq-form on every page
// Sends full message via WhatsApp + saves to CRM
// =========================================
(function initEnquiryStrip() {
  document.querySelectorAll('.enq-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const get   = id => form.querySelector('[name="' + id + '"]');
      const val   = id => (get(id) ? get(id).value.trim() : '');
      const elName  = form.querySelector('[name="enq-name"]');
      const elPhone = form.querySelector('[name="enq-phone"]');

      // Clear previous errors
      form.querySelectorAll('.enq-error').forEach(el => el.classList.remove('enq-error'));

      // Validate required fields
      let valid = true;
      if (!elName || !elName.value.trim())  { elName && elName.classList.add('enq-error');  valid = false; }
      if (!elPhone || !elPhone.value.trim()) { elPhone && elPhone.classList.add('enq-error'); valid = false; }
      if (!valid) return;

      const name     = val('enq-name');
      const phone    = val('enq-phone');
      const email    = val('enq-email');
      const location = val('enq-location');
      const trip     = val('enq-trip');
      const message  = val('enq-message');
      const source   = (document.title || 'Website') + ' — Enquiry strip';

      // Build WhatsApp message
      let wa = 'Hi Fradpaix! I have an enquiry.\n\n';
      wa += '*Name:* ' + name + '\n';
      wa += '*Phone:* ' + phone + '\n';
      if (email)    wa += '*Email:* ' + email + '\n';
      if (location) wa += '*Location:* ' + location + '\n';
      if (trip)     wa += '*Trip of interest:* ' + trip + '\n';
      if (message)  wa += '\n*Message:* ' + message + '\n';
      wa += '\nReady With Frady!';

      // Save to CRM
      if (window.FradpaixCRM) {
        window.FradpaixCRM.addLead({
          name, phone, email, location,
          trip: trip || 'General enquiry',
          message, source
        });
      }

      // Loading state
      const btn  = form.querySelector('.enq-form__submit');
      const orig = btn.textContent;
      btn.textContent = 'Opening WhatsApp…';
      btn.disabled    = true;

      setTimeout(function () {
        window.open('https://wa.me/918580475396?text=' + encodeURIComponent(wa), '_blank', 'noopener');
        form.reset();
        btn.textContent = orig;
        btn.disabled    = false;
        const success = form.querySelector('.enq-form__success');
        if (success) {
          success.style.display = 'block';
          setTimeout(function () { success.style.display = 'none'; }, 6000);
        }
      }, 500);
    });
  });
})();

// ---- Contact page form (contact.html) — WhatsApp + CRM ----
(function initContactPageForm() {
  const form    = document.getElementById('contact-form');
  const success = document.getElementById('form-success');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const name    = form.querySelector('#name')?.value.trim();
    const email   = form.querySelector('#email')?.value.trim();
    const phone   = form.querySelector('#phone')?.value.trim();
    const location= form.querySelector('#location')?.value.trim();
    const subject = form.querySelector('#subject')?.value.trim()
                 || form.querySelector('#trip')?.value.trim();   // home page uses #trip
    const message = form.querySelector('#message')?.value.trim();

    if (!name || !phone) { alert('Please fill in your Name and Phone number.'); return; }

    // Build WhatsApp message
    let wa = 'Hi Fradpaix! I have an enquiry.\n\n';
    wa += '*Name:* ' + name + '\n';
    wa += '*Phone:* ' + phone + '\n';
    if (email)    wa += '*Email:* ' + email + '\n';
    if (location) wa += '*Location:* ' + location + '\n';
    if (subject)  wa += '*Trip / Subject:* ' + subject + '\n';
    if (message)  wa += '\n*Message:* ' + message + '\n';
    wa += '\nReady With Frady!';

    if (window.FradpaixCRM) {
      window.FradpaixCRM.addLead({
        name, email, phone, location,
        trip: subject,          // unified field for CRM
        subject, message,
        source: document.title.includes('Home') || window.location.pathname.endsWith('index.html') || window.location.pathname === '/'
          ? 'Homepage contact form'
          : 'Contact form'
      });
    }

    const btn  = form.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.textContent = 'Sending…';
    btn.disabled    = true;

    setTimeout(function () {
      window.open('https://wa.me/918580475396?text=' + encodeURIComponent(wa), '_blank', 'noopener');
      form.reset();
      btn.textContent = orig;
      btn.disabled    = false;
      if (success) { success.hidden = false; setTimeout(() => { success.hidden = true; }, 6000); }
    }, 500);
  });
})();

