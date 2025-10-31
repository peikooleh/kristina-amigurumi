'use strict';

// === image pipeline helpers ===
function srcsFromKey(key) {
  return {
    thumbWebp: `photos/thumb/${key}.webp`,
    thumbJpg:  `photos/thumb/${key}.jpg`,
    fullWebp:  `photos/full/${key}.webp`,
    fullJpg:   `photos/full/${key}.jpg`
  };
}
function setLightboxSrc(imgEl, p) {
  imgEl.src = p.fullWebp;
  imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = p.fullJpg; };
}

// === theme handling ===
const THEME_KEY = 'theme';
const META_THEME = document.querySelector('#meta-theme-color');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (META_THEME) META_THEME.setAttribute('content', theme === 'dark' ? '#1b1d21' : '#ffffff');
}
function detectSystemTheme() {
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
}
let __savedTheme = localStorage.getItem(THEME_KEY);
if (!__savedTheme) {
  __savedTheme = detectSystemTheme();
  localStorage.setItem(THEME_KEY, __savedTheme);
}
applyTheme(__savedTheme);

const PAGE_SIZE = 25;
const PHOTOS_MANIFEST = 'photos/photos.json';

const LANGS = ['ru','uk','en','de','fr'];
const LANG_FLAGS = { ru:'🇷🇺', uk:'🇺🇦', en:'🇬🇧', de:'🇩🇪', fr:'🇫🇷' };

let photos = [];
let page = 1;
let currentIndex = 0;
let STR = {};
let PHOTO_TITLES = {};
let LANG = 'de'; // default German

const qs = (s, r = document) => r.querySelector(s);

/* Theme */
function initTheme() {
  let theme = localStorage.getItem('theme');
  if (!theme) {
    const h = new Date().getHours();
    theme = (h >= 20 || h < 8) ? 'dark' : 'light';
  }
  setTheme(theme);
  const tgl = qs('#themeToggle');
  if (tgl) {
    tgl.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      setTheme(isLight ? 'dark' : 'light');
    });
  }
}
function setTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('theme', mode);
  const sun = qs('#iconSun'), moon = qs('#iconMoon');
  if (sun && moon) {
    sun.style.display = (mode === 'light') ? 'block' : 'none';
    moon.style.display = (mode === 'dark') ? 'block' : 'none';
  }
  const btn = qs('#themeToggle');
  if (btn && STR.ui) {
    btn.setAttribute('aria-label', mode === 'light' ? (STR.ui.theme_light?.[LANG] || 'Light theme')
                                                   : (STR.ui.theme_dark?.[LANG]  || 'Dark theme'));
  }
}

/* Language */
async function initLang() {
  try { STR = await (await fetch('i18n/strings.json', {cache:'no-store'})).json(); } catch(e) { STR = {}; }
  try { PHOTO_TITLES = await (await fetch('i18n/photos.json', {cache:'no-store'})).json(); } catch(e) { PHOTO_TITLES = {}; }

  const saved = localStorage.getItem('lang');
  if (saved && LANGS.includes(saved)) LANG = saved;

  applyLang();

  const btn = qs('#langToggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const i = LANGS.indexOf(LANG);
      LANG = LANGS[(i+1) % LANGS.length];
      localStorage.setItem('lang', LANG);
      applyLang();
      render(); // перерендер без подписей
    });
  }
}
function applyLang() {
  document.documentElement.lang = LANG;
  qs('#langFlag') && (qs('#langFlag').textContent = LANG_FLAGS[LANG] || '🏳️');
  const title = STR.title?.[LANG] || 'Kristina amigurumi';
  const subtitle = STR.subtitle?.[LANG] || 'crocheted toys — handmade';
  qs('#siteTitle') && (qs('#siteTitle').textContent = title);
  qs('#siteSubtitle') && (qs('#siteSubtitle').textContent = subtitle);
  document.title = title + ' — Галерея';
  const y = new Date().getFullYear();
  const l1 = STR.footer_line1?.[LANG]; if (l1 && qs('#footerL1')) qs('#footerL1').textContent = l1;
  const l2 = STR.footer_line2?.[LANG]; if (l2 && qs('#footerL2')) qs('#footerL2').innerHTML = l2.replace('{year}', y);
}

/* Photos */
async function loadPhotos() {
  const res = await fetch(PHOTOS_MANIFEST, { cache: 'no-store' });
  if (!res.ok) throw new Error('Не удалось загрузить список фото');
  const files = await res.json(); // ["amigurumi-001.png", ...]
  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) * -1);
  photos = files.map(fn => {
    const key = fn.replace(/\.[a-z0-9]+$/i, '');
    return { key, ...srcsFromKey(key) };
  });
}

/* Render (без подписей) */
function render() {
  const p = getPageFromUrl();
  const totalPages = Math.max(1, Math.ceil(photos.length / PAGE_SIZE));
  page = Math.min(Math.max(1, p), totalPages);
  setUrlPage(page);

  const start = (page - 1) * PAGE_SIZE;
  const chunk = photos.slice(start, start + PAGE_SIZE);

  const wrap = qs('#gallery');
  if (!wrap) return;
  wrap.innerHTML = '';

  chunk.forEach((photo, i) => {
    const globalIndex = start + i;
    const card = document.createElement('article');
    card.className = 'card';

    const imgWrap = document.createElement('a');
    imgWrap.href = photo.fullJpg;                // ссылка на большой JPG
    imgWrap.className = 'card__imgwrap';
    imgWrap.addEventListener('click', (e) => { e.preventDefault(); openLightbox(globalIndex); });

    // <picture> превью: webp + jpg fallback
    const pic = document.createElement('picture');
    const sWebp = document.createElement('source');
    sWebp.type = 'image/webp';
    sWebp.srcset = photo.thumbWebp;
    pic.appendChild(sWebp);

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = photo.thumbJpg;
    img.alt = ''; // подписи убраны
    pic.appendChild(img);

    imgWrap.appendChild(pic);
    card.append(imgWrap);
    wrap.appendChild(card);
  });

  // пагинация (как было)
  const pag = qs('#pagination');
  if (!pag) return;
  pag.innerHTML = ''; pag.hidden = totalPages <= 1;
  if (totalPages > 1) {
    const makeBtn = (text, pNum, current = false, disabled = false) => {
      const btn = document.createElement('button');
      btn.className = 'page-btn';
      btn.textContent = text;
      if (current) btn.setAttribute('aria-current', 'page');
      if (disabled) btn.disabled = true;
      btn.addEventListener('click', () => { setUrlPage(pNum); render(); });
      return btn;
    };
    pag.append(makeBtn('‹', Math.max(1, page - 1), false, page === 1));
    const range = []; const push = (n) => { if (!range.includes(n) && n >= 1 && n <= totalPages) range.push(n); };
    [1, 2, page - 1, page, page + 1, totalPages - 1, totalPages].forEach(push);
    range.sort((a, b) => a - b);
    let last = 0;
    for (const n of range) {
      if (last && n - last > 1) {
        const dots = document.createElement('span');
        dots.className = 'page-btn'; dots.ariaHidden = 'true'; dots.textContent = '…';
        pag.append(dots);
      }
      pag.append(makeBtn(String(n), n, n === page));
      last = n;
    }
    pag.append(makeBtn('›', Math.min(totalPages, page + 1), false, page === totalPages));
  }
}

/* URL helpers */
function getPageFromUrl() {
  const p = new URLSearchParams(location.search).get('page');
  const n = parseInt(p, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
function setUrlPage(p) {
  const url = new URL(location.href);
  if (p === 1) url.searchParams.delete('page'); else url.searchParams.set('page', p);
  history.replaceState({}, '', url);
}

/* Lightbox (без подписи) */
function openLightbox(index) {
  currentIndex = index;
  const lb = qs('#lightbox');
  const img = qs('#lightboxImg');
  if (!lb || !img) return;
  setLightboxSrc(img, photos[index]);
  lb.hidden = false;

  const onKey = (e) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  };
  document.addEventListener('keydown', onKey);
  lb._onKey = onKey;
}
function closeLightbox() {
  const lb = qs('#lightbox');
  if (!lb) return;
  lb.hidden = true;
  if (lb._onKey) { document.removeEventListener('keydown', lb._onKey); delete lb._onKey; }
}
function step(dir) {
  currentIndex = (currentIndex + dir + photos.length) % photos.length;
  const img = qs('#lightboxImg');
  if (img) setLightboxSrc(img, photos[currentIndex]);
}

/* Start */
document.addEventListener('DOMContentLoaded', async () => {
  const y = qs('#year'); if (y) y.textContent = new Date().getFullYear();
  await initLang();
  initTheme();
  try { await loadPhotos(); render(); }
  catch (e) { const g = qs('#gallery'); if (g) g.innerHTML = `<p role="alert">Ошибка загрузки галереи: ${e.message}</p>`; }
});

// Lightbox controls binding fallback
function bindLbControls() {
  const btnClose = qs('#lightboxClose');
  const btnPrev  = qs('#lightboxPrev');
  const btnNext  = qs('#lightboxNext');
  const lb       = qs('#lightbox');
  if (btnClose && !btnClose._bound) { btnClose.addEventListener('click', closeLightbox); btnClose._bound = true; }
  if (btnPrev  && !btnPrev._bound)  { btnPrev.addEventListener('click', () => step(-1)); btnPrev._bound = true; }
  if (btnNext  && !btnNext._bound)  { btnNext.addEventListener('click', () => step(1));  btnNext._bound = true; }
  if (lb && !lb._backdropBound) {
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
    lb._backdropBound = true;
  }
}
if (document.readyState !== 'loading') bindLbControls();
else document.addEventListener('DOMContentLoaded', bindLbControls);

// === Lightbox: keyboard, backdrop, swipes, focus-trap, scroll lock (как было) ===
(() => {
  const lb = document.getElementById('lightbox');
  if (!lb) return;

  const btnClose = document.getElementById('lightboxClose');
  const btnPrev  = document.getElementById('lightboxPrev');
  const btnNext  = document.getElementById('lightboxNext');

  const isOpen = () => lb && !lb.hasAttribute('hidden');

  const closeLB = () => btnClose?.click();
  const prevImg = () => btnPrev?.click();
  const nextImg = () => btnNext?.click();

  window.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    switch (e.key) {
      case 'Escape': e.preventDefault(); closeLB(); break;
      case 'ArrowLeft': e.preventDefault(); prevImg(); break;
      case 'ArrowRight': e.preventDefault(); nextImg(); break;
    }
  });

  lb.addEventListener('click', (e) => { if (e.target === lb) closeLB(); });

  let touchX = 0, touchY = 0, t0 = 0;
  const THRESH_X = 40, THRESH_Y = 60, TIME_MAX = 800;

  lb.addEventListener('touchstart', (e) => {
    if (!isOpen()) return;
    const t = e.changedTouches[0];
    touchX = t.clientX; touchY = t.clientY; t0 = Date.now();
  }, { passive: true });

  lb.addEventListener('touchend', (e) => {
    if (!isOpen()) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchX;
    const dy = t.clientY - touchY;
    const dt = Date.now() - t0;
    if (dt <= TIME_MAX && Math.abs(dx) >= THRESH_X && Math.abs(dy) <= THRESH_Y) {
      if (dx > 0) prevImg(); else nextImg();
    }
  }, { passive: true });

  lb.addEventListener('touchmove', (e) => {
    if (!isOpen()) return;
    const t = e.changedTouches[0];
    const ax = Math.abs(t.clientX - touchX);
    const ay = Math.abs(t.clientY - touchY);
    if (ay > ax && ay > 8) e.preventDefault();
  }, { passive: false });
})();

(() => {
  const lb = document.getElementById('lightbox');
  if (!lb) return;

  const btnClose = document.getElementById('lightboxClose');
  const btnPrev  = document.getElementById('lightboxPrev');
  const btnNext  = document.getElementById('lightboxNext');
  const body = document.body;

  let prevFocus = null;
  let touchMoveBlocker = null;

  const isOpen = () => !lb.hasAttribute('hidden');

  const onOpen = () => {
    prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    body.style.overflow = 'hidden';
    touchMoveBlocker = (e) => { if (!lb.contains(e.target)) e.preventDefault(); };
    document.addEventListener('touchmove', touchMoveBlocker, { passive: false });
    queueMicrotask(() => btnClose?.focus());
  };

  const onClose = () => {
    body.style.overflow = '';
    if (touchMoveBlocker) { document.removeEventListener('touchmove', touchMoveBlocker); touchMoveBlocker = null; }
    if (prevFocus && document.contains(prevFocus)) prevFocus.focus();
  };

  const getFocusables = () => lb.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const onKeydown = (e) => {
    if (!isOpen()) return;
    if (e.key === 'Tab') {
      const nodes = Array.from(getFocusables());
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !lb.contains(document.activeElement)) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last || !lb.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      }
    }
  };

  window.addEventListener('keydown', onKeydown);

  const observer = new MutationObserver(() => { if (isOpen()) onOpen(); else onClose(); });
  observer.observe(lb, { attributes: true, attributeFilter: ['hidden'] });
  if (isOpen()) onOpen();
  btnClose?.addEventListener('click', () => { if (!isOpen()) onClose(); });
})();

/* a11y labels & guards (оставлено как было) */
window.addEventListener('DOMContentLoaded', () => {
  const STR = window.STRINGS || {};
  const lang = (window.LANG || (navigator.language||'en').slice(0,2)).toLowerCase();
  const tr = (k, fb) => (STR[k] && (STR[k][lang] || STR[k][lang.slice(0,2)])) || fb || k;

  document.querySelectorAll('[data-pagination="prev"], .pagination .prev, button.prev').forEach(btn => {
    if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', tr('prevPage','Предыдущая страница'));
  });
  document.querySelectorAll('[data-pagination="next"], .pagination .next, button.next').forEach(btn => {
    if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', tr('nextPage','Следующая страница'));
  });

  const lb = document.querySelector('.lightbox, [role="dialog"].lightbox, .lb');
  if (lb) {
    const closeBtn = lb.querySelector('.close, [data-action="close"]');
    const prevBtn  = lb.querySelector('.prev, [data-action="prev"]');
    const nextBtn  = lb.querySelector('.next, [data-action="next"]');
    if (closeBtn && !closeBtn.getAttribute('aria-label')) closeBtn.setAttribute('aria-label', tr('close','Закрыть'));
    if (prevBtn  && !prevBtn.getAttribute('aria-label'))  prevBtn.setAttribute('aria-label',  tr('prev','Предыдущее'));
    if (nextBtn  && !nextBtn.getAttribute('aria-label'))  nextBtn.setAttribute('aria-label',  tr('next','Следующее'));
  }
});
