/* ============================================================
   UX Enhancements v2 — for the redesigned storefront
   ============================================================ */
(function () {
  'use strict';

  /* ---- Page Loader ---- */
  function dismissLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 600);
    }
  }

  /* ---- Header Scroll ---- */
  function initHeaderScroll() {
    const header = document.querySelector('header.site');
    if (!header) return;
    let ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          header.classList.toggle('scrolled', window.scrollY > 40);
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- Scroll Reveal ---- */
  let revealObserver = null;

  function observeReveals() {
    if (!revealObserver) return;
    document.querySelectorAll('.reveal:not(.visible), .reveal-stagger:not(.visible)').forEach(el => {
      // If the element already has children and is in/near viewport, reveal immediately
      if (el.children.length > 0) {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight + 200) {
          el.classList.add('visible');
          return;
        }
      }
      // Unobserve first — re-observing a previously observed element is a
      // no-op per spec, so we must release and re-register to force a re-check
      // (the element may have grown from 0 height when it was first observed).
      revealObserver.unobserve(el);
      revealObserver.observe(el);
    });
  }

  /* Ensure stagger grids with children become visible on scroll.
     This is a fallback for when the IntersectionObserver was set up on an
     empty element and never re-fires after content is added. */
  function initScrollVisibilityFallback() {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          document.querySelectorAll('.reveal-stagger:not(.visible)').forEach(el => {
            if (el.children.length > 0) {
              const rect = el.getBoundingClientRect();
              if (rect.top < window.innerHeight + 100) {
                el.classList.add('visible');
              }
            }
          });
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  function initScrollReveal() {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    observeReveals();

    const mo = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.attributeName === 'hidden') {
          const el = m.target;
          if (!el.hidden && el.classList.contains('reveal') && !el.classList.contains('visible')) {
            revealObserver.observe(el);
          }
        }
      }
    });
    document.querySelectorAll('.reveal').forEach(el => {
      mo.observe(el, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  /* ---- Hero Background ---- */
  let heroBgLoaded = false;
  function loadHeroBg() {
    if (heroBgLoaded) return;
    const heroBg = document.getElementById('heroBg');
    if (!heroBg) return;

    // 1. Custom hero image from config.js
    const customSrc = (window.HERO_IMAGE || '') ;
    if (customSrc) {
      heroBgLoaded = true;
      const img = new Image();
      img.onload = () => {
        heroBg.style.backgroundImage = `url(${customSrc})`;
        heroBg.classList.add('loaded');
      };
      img.src = customSrc;
      return;
    }

    // 2. Auto: first featured product photo from catalogue
    const products = (typeof state !== 'undefined' && state.products) || [];
    if (!products.length) return;

    const pick = products.find(p => p.featured) || products[0];
    if (!pick) return;

    const src = (typeof DB !== 'undefined' && DB.photoOf) ? DB.photoOf(pick) : null;
    if (src && /^https?:/i.test(src)) {
      heroBgLoaded = true;
      const img = new Image();
      img.onload = () => {
        heroBg.style.backgroundImage = `url(${src})`;
        heroBg.classList.add('loaded');
      };
      img.src = src;
    }
  }

  function watchHeroBg() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    let revealTimer = null;
    new MutationObserver(() => {
      loadHeroBg();
      // Debounce: wait for renderGrid() to finish adding children
      clearTimeout(revealTimer);
      revealTimer = setTimeout(observeReveals, 60);
    }).observe(grid, { childList: true, subtree: true });
  }


  /* ---- Bottom navigation (phones): active tab + search deep-link.
     The search tab opens the fullscreen overlay when this page has one;
     elsewhere it walks the visitor home first. #search on any page works. */
  function initBottomNav() {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    const path = location.pathname.replace(/\/index\.html$/, '/');
    nav.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') || '';
      const target = href.split('#')[0] || '/';
      const isHome = target === '/';
      if ((isHome && (path === '/' || path === '/index.html')) ||
          (!isHome && path.startsWith(target.replace(/\.html$/, '')))) {
        a.classList.add('active');
      }
      if (href.endsWith('#search')) {
        a.addEventListener('click', e => {
          const btn = document.getElementById('searchBtn');
          if (btn) { e.preventDefault(); btn.click(); }
        });
      }
    });
    const openFromHash = () => {
      if (location.hash !== '#search') return;
      const btn = document.getElementById('searchBtn');
      if (btn) btn.click();
      else location.href = '/#search';
    };
    if (location.hash === '#search') openFromHash();
    window.addEventListener('hashchange', openFromHash);
  }

  /* ---- Search Overlay ---- */
  function initSearchOverlay() {
    const overlay = document.getElementById('searchOverlay');
    const searchBtn = document.getElementById('searchBtn');
    const closeBtn = document.getElementById('searchClose');
    const input = document.getElementById('globalSearch');
    if (!overlay || !searchBtn) return;

    searchBtn.addEventListener('click', () => {
      overlay.classList.add('open');
      setTimeout(() => input && input.focus(), 100);
    });
    if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.remove('open'));

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) {
        overlay.classList.remove('open');
      }
    });

    // Close on overlay click (not on content)
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });

    // Search functionality
    if (input) {
      let debounce;
      input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          const q = input.value.trim().toLowerCase();
          const results = document.getElementById('searchResults');
          if (!results || typeof state === 'undefined') return;
          if (!q) { results.innerHTML = ''; return; }
          const matches = (state.products || []).filter(p => {
            const name = (p.name_fr || '').toLowerCase() + ' ' + (p.name_en || '').toLowerCase();
            return name.includes(q);
          });
          results.innerHTML = matches.length ? '' : `<p style="color:var(--gray-500);grid-column:1/-1">${typeof I18N !== 'undefined' ? I18N.t('no_results') : 'No results.'}</p>`;
          matches.slice(0, 8).forEach(p => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
              <a class="photo" href="/p/${p.id}/"><img src="${esc(typeof DB !== 'undefined' && DB.thumbUrl ? DB.thumbUrl(p.photos?.[0] || '') : (p.photos?.[0] || ''))}" alt="${esc(typeof I18N !== 'undefined' ? I18N.localize(p, 'name') : '')}" loading="lazy"></a>
              <div class="info">
                <div class="cat">${esc(typeof I18N !== 'undefined' ? (p.category_id ? catName(p.category_id) : '') : '')}</div>
                <h3><a href="/p/${p.id}/">${esc(typeof I18N !== 'undefined' ? I18N.localize(p, 'name') : '')}</a></h3>
                <div class="price-row"><span class="price">${typeof I18N !== 'undefined' ? I18N.fmtPrice(p.price) : p.price}</span></div>
              </div>`;
            results.appendChild(card);
          });
        }, 200);
      });
    }
  }

  /* ---- Hamburger (mobile nav) ---- */
  function initHamburger() {
    const btn = document.getElementById('hamburgerBtn');
    const nav = document.querySelector('nav.main-nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', () => {
      const open = nav.style.display === 'flex';
      nav.style.display = open ? 'none' : 'flex';
      nav.style.position = open ? '' : 'absolute';
      nav.style.top = open ? '' : '100%';
      nav.style.left = open ? '' : '0';
      nav.style.right = open ? '' : '0';
      nav.style.background = open ? '' : 'var(--white)';
      nav.style.flexDirection = open ? '' : 'column';
      nav.style.padding = open ? '' : '16px 24px';
      nav.style.gap = open ? '' : '16px';
      nav.style.boxShadow = open ? '' : '0 8px 24px rgba(0,0,0,0.08)';
      nav.style.zIndex = open ? '' : '10';
      nav.style.borderTop = open ? '' : '1px solid var(--gray-200)';
    });
  }

  /* ---- Button Ripple ---- */
  function initRipple() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('.btn-primary');
      if (!btn) return;
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
    });
  }

  /* ---- Cart Bump ---- */
  function initCartBump() {
    const el = document.getElementById('cartCount');
    if (!el) return;
    let last = el.textContent;
    new MutationObserver(() => {
      const v = el.textContent;
      if (v !== last) {
        last = v;
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }

  /* ---- Smooth Nav ---- */
  function initSmoothNav() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id = a.getAttribute('href');
        if (id === '#') return;
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          const h = document.querySelector('header.site')?.offsetHeight || 0;
          window.scrollTo({
            top: target.getBoundingClientRect().top + window.scrollY - h - 12,
            behavior: 'smooth'
          });
        }
      });
    });
  }

  /* ---- Language Dropdown ---- */
  function initLangDropdown() {
    const toggle = document.getElementById('langToggle');
    const dropdown = document.getElementById('langDropdown');
    const label = document.getElementById('currentLang');
    if (!toggle || !dropdown) return;
    const langNames = { fr: 'FR', ar: 'ع', en: 'EN' };
    function updateLabel() {
      const lang = typeof I18N !== 'undefined' ? I18N.getLang() : 'fr';
      if (label) label.textContent = langNames[lang] || 'FR';
      dropdown.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.dataset.lang === lang);
      });
    }
    toggle.addEventListener('click', e => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    dropdown.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        if (typeof I18N !== 'undefined') I18N.setLang(b.dataset.lang);
        dropdown.classList.remove('open');
        updateLabel();
      });
    });
    document.addEventListener('click', () => dropdown.classList.remove('open'));
    document.addEventListener('langchange', updateLabel);
    updateLabel();
  }

  /* ---- Boot ---- */
  function boot() {
    initHeaderScroll();
    initScrollReveal();
    initScrollVisibilityFallback();
    initSearchOverlay();
    initBottomNav();
    initHamburger();
    initLangDropdown();
    initRipple();
    initCartBump();
    initSmoothNav();
    watchHeroBg();

    setTimeout(dismissLoader, 500);

    loadHeroBg();
    const retry = setInterval(() => {
      if (heroBgLoaded) { clearInterval(retry); return; }
      loadHeroBg();
    }, 500);
    setTimeout(() => clearInterval(retry), 10000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('langchange', () => setTimeout(loadHeroBg, 100));
  document.addEventListener('langchange', () => setTimeout(observeReveals, 50));
})();
