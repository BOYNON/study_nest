/* ============================================================
   StudyNest — Main JS
   Handles: dark mode, hamburger, settings, inactivity timer
   ============================================================ */

(function () {
  'use strict';

  // ── Theme ─────────────────────────────────────────────────
  const THEME_KEY = 'sn-theme';

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const status = document.getElementById('themeStatus');
    const item   = document.getElementById('themeToggleItem');
    if (status) status.textContent = theme === 'dark' ? 'On' : 'Off';
    if (item)   item.querySelector('.settings-item-label span:first-child').textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme() {
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }

  // Apply saved theme immediately (before DOM ready to avoid flash)
  applyTheme(getTheme());

  // ── DOM Ready ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {

    // Theme init UI
    applyTheme(getTheme());

    // Theme toggle (settings item click)
    const themeItem = document.getElementById('themeToggleItem');
    if (themeItem) themeItem.addEventListener('click', () => { toggleTheme(); });

    // ── Settings Dropdown ────────────────────────────────────
    const settingsToggle   = document.getElementById('settingsToggle');
    const settingsDropdown = document.getElementById('settingsDropdown');

    if (settingsToggle && settingsDropdown) {
      settingsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsDropdown.classList.toggle('open');
      });

      document.addEventListener('click', (e) => {
        if (!settingsDropdown.contains(e.target) && e.target !== settingsToggle) {
          settingsDropdown.classList.remove('open');
        }
      });
    }

    // ── Hamburger ────────────────────────────────────────────
    const hamburger  = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');

    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        mobileMenu.classList.toggle('open');
      });
      mobileMenu.querySelectorAll('a').forEach(a =>
        a.addEventListener('click', () => {
          hamburger.classList.remove('open');
          mobileMenu.classList.remove('open');
        })
      );
    }

    // ── Active nav link ──────────────────────────────────────
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('href') === path) link.classList.add('active');
    });

    // ── Panic Button ─────────────────────────────────────────
    const panicBtn = document.getElementById('panicBtn');
    if (panicBtn) {
      panicBtn.addEventListener('click', triggerPanic);
    }

    // ── Inactivity Timer (only when logged in) ───────────────
    const inactivityToast   = document.getElementById('inactivityToast');
    const countdownEl       = document.getElementById('countdown');
    const stayBtn           = document.getElementById('stayLoggedIn');

    if (inactivityToast) {
      let inactivityTimer;
      let warningTimer;
      let countdownInterval;
      let countdownSec;
      const INACTIVITY_MS = 60 * 1000;     // 60 seconds
      const WARNING_MS    = (60 - 10) * 1000; // show warning 10s before

      function resetTimers() {
        clearTimeout(inactivityTimer);
        clearTimeout(warningTimer);
        clearInterval(countdownInterval);
        inactivityToast.classList.remove('show');

        // Heartbeat to server
        fetch('/secret/heartbeat', { method: 'POST', credentials: 'same-origin' }).catch(() => {});

        // Schedule warning
        warningTimer = setTimeout(() => {
          countdownSec = 10;
          if (countdownEl) countdownEl.textContent = countdownSec;
          inactivityToast.classList.add('show');
          countdownInterval = setInterval(() => {
            countdownSec--;
            if (countdownEl) countdownEl.textContent = countdownSec;
            if (countdownSec <= 0) {
              clearInterval(countdownInterval);
              performLogout('timeout');
            }
          }, 1000);
        }, WARNING_MS);

        // Schedule auto logout
        inactivityTimer = setTimeout(() => performLogout('timeout'), INACTIVITY_MS);
      }

      function performLogout(reason) {
        clearInterval(countdownInterval);
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/secret/logout';
        document.body.appendChild(form);
        // Replace history so back button doesn't expose chat
        history.replaceState(null, '', '/');
        form.submit();
      }

      if (stayBtn) {
        stayBtn.addEventListener('click', () => {
          inactivityToast.classList.remove('show');
          resetTimers();
        });
      }

      // Track user activity
      ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(ev =>
        document.addEventListener(ev, resetTimers, { passive: true })
      );

      resetTimers(); // Start
    }

    // ── Scroll animations ────────────────────────────────────
    if ('IntersectionObserver' in window) {
      const cards = document.querySelectorAll(
        '.class-card, .overview-card, .chapter-card, .subject-card, .about-card, .pyq-card, .note-card, .hero-card'
      );
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((e, i) => {
          if (e.isIntersecting) {
            setTimeout(() => {
              e.target.style.opacity = '1';
              e.target.style.transform = 'translateY(0)';
            }, 0);
            obs.unobserve(e.target);
          }
        });
      }, { threshold: 0.06 });

      cards.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(18px)';
        el.style.transition = `opacity 0.4s ease ${i * 0.035}s, transform 0.4s ease ${i * 0.035}s, border-color 0.18s ease, box-shadow 0.18s ease`;
        obs.observe(el);
      });
    }

    // ── AI Helper prefill ────────────────────────────────────
    const params = new URLSearchParams(window.location.search);
    const aiQ    = document.getElementById('aiQuestion');
    const aiSub  = document.getElementById('aiSubject');
    const aiCls  = document.getElementById('aiClass');

    if (aiQ && params.get('chapter')) {
      aiQ.placeholder = `Ask something about "${params.get('chapter')}"...`;
    }
    if (aiSub && params.get('subject')) {
      [...aiSub.options].forEach(o => { if (o.value === params.get('subject')) o.selected = true; });
    }
    if (aiCls && params.get('class')) {
      [...aiCls.options].forEach(o => { if (o.value === params.get('class')) o.selected = true; });
    }


    // ── Search Bar with secret_chat detection ────────────────
    const SEARCH_ITEMS = [
      { label: 'Home', url: '/' }, { label: 'All Classes', url: '/#pick-class' },
      { label: 'AI Helper', url: '/ai-helper' }, { label: 'About', url: '/about' },
      { label: 'Class 3', url: '/class/3' }, { label: 'Class 4', url: '/class/4' },
      { label: 'Class 5', url: '/class/5' }, { label: 'Class 6', url: '/class/6' },
      { label: 'Class 7', url: '/class/7' }, { label: 'Class 8', url: '/class/8' },
      { label: 'Class 9', url: '/class/9' }, { label: 'Class 10', url: '/class/10' },
      { label: 'Class 11', url: '/class/11' }, { label: 'Class 12', url: '/class/12' },
    ];

    function setupSearch(searchInput, searchResults) {
      if (!searchInput || !searchResults) return;
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        if (!q) { searchResults.style.display = 'none'; return; }
        if (q === 'secret_chat') { searchResults.style.display = 'none'; window.location.href = '/secret/enter'; return; }
        const matches = SEARCH_ITEMS.filter(i => i.label.toLowerCase().includes(q)).slice(0, 6);
        if (!matches.length) { searchResults.style.display = 'none'; return; }
        searchResults.innerHTML = matches.map(i => '<div class="search-result-item" data-url="' + i.url + '">' + i.label + '</div>').join('');
        searchResults.style.display = 'block';
        searchResults.querySelectorAll('.search-result-item').forEach(el => {
          el.addEventListener('click', () => { window.location.href = el.dataset.url; });
        });
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const q = searchInput.value.trim().toLowerCase();
          if (q === 'secret_chat') { window.location.href = '/secret/enter'; return; }
          const first = searchResults.querySelector('.search-result-item');
          if (first) window.location.href = first.dataset.url;
        }
        if (e.key === 'Escape') { searchResults.style.display = 'none'; searchInput.value = ''; }
      });
      document.addEventListener('click', (e) => {
        if (!searchResults.contains(e.target) && e.target !== searchInput) searchResults.style.display = 'none';
      });
    }

    setupSearch(document.getElementById('siteSearch'), document.getElementById('searchResults'));
    setupSearch(document.getElementById('mobileSiteSearch'), document.getElementById('mobileSearchResults'));

  }); // end DOMContentLoaded

  // ── Panic function (global) ───────────────────────────────
  window.triggerPanic = function () {
    fetch('/secret/panic', { method: 'POST', credentials: 'same-origin' })
      .finally(() => {
        // Wipe history stack and redirect to homepage
        history.replaceState(null, document.title, '/');
        window.location.replace('/');
      });
  };

  // ESC key panic (only on secret pages)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.location.pathname.startsWith('/secret/')) {
      window.triggerPanic();
    }
  });

})();
