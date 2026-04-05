/* ============================================================
   StudyNest — Session Manager (chat page)
   Handles: inactivity timer, heartbeat, panic, theme
   ============================================================ */

(function () {
  'use strict';

  // ── Theme ────────────────────────────────────────────────
  const savedTheme = localStorage.getItem('sn-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  const themeBtn = document.getElementById('themeToggleChat');
  if (themeBtn) {
    themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next    = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('sn-theme', next);
      themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
    });
  }

  // ── Panic Button ────────────────────────────────────────
  const panicBtn = document.getElementById('panicBtn');
  if (panicBtn) {
    panicBtn.addEventListener('click', triggerPanic);
  }

  // ESC = panic on chat page
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') triggerPanic();
  });

  function triggerPanic() {
    fetch('/secret/panic', { method: 'POST', credentials: 'same-origin' })
      .finally(() => {
        history.replaceState(null, 'StudyNest', '/');
        window.location.replace('/');
      });
  }

  window.triggerPanic = triggerPanic;

  // ── Inactivity Timer ─────────────────────────────────────
  const INACTIVITY_LIMIT_SEC = typeof window.INACTIVITY_LIMIT !== 'undefined' ? window.INACTIVITY_LIMIT : 60;
  const WARN_AT_SEC          = typeof window.WARN_AT !== 'undefined' ? window.WARN_AT : 10;
  const INACTIVITY_MS        = INACTIVITY_LIMIT_SEC * 1000;
  const WARN_MS              = (INACTIVITY_LIMIT_SEC - WARN_AT_SEC) * 1000;

  // Create inactivity overlay for chat page
  const overlay = document.createElement('div');
  overlay.className = 'inactivity-overlay';
  overlay.innerHTML = `
    <div class="inactivity-modal">
      <div class="inactivity-modal-num" id="chatCountdown">10</div>
      <h3>Still there? 👋</h3>
      <p>You'll be logged out automatically in a few seconds due to inactivity.</p>
      <button class="btn-primary" id="chatStayBtn">Yes, I'm here! Stay Logged In</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const countdownEl = document.getElementById('chatCountdown');
  const stayBtn     = document.getElementById('chatStayBtn');

  let inactivityTimer, warningTimer, countdownInterval, countdownSec;

  // Session progress bar
  let sessionStart = Date.now();
  const fillEl     = document.getElementById('sessionFill');
  const timerText  = document.getElementById('sessionTimerText');

  function updateSessionBar() {
    const elapsed  = (Date.now() - sessionStart) / 1000;
    const pct      = Math.max(0, 100 - (elapsed / INACTIVITY_LIMIT_SEC) * 100);
    if (fillEl) {
      fillEl.style.width = pct + '%';
      fillEl.classList.toggle('warn',   pct < 30);
      fillEl.classList.toggle('danger', pct < 15);
    }
    if (timerText) {
      const remaining = Math.max(0, Math.round(INACTIVITY_LIMIT_SEC - elapsed));
      timerText.textContent = remaining > 0 ? `${remaining}s remaining` : 'Logging out...';
    }
  }

  const barInterval = setInterval(updateSessionBar, 500);

  function resetTimers() {
    clearTimeout(inactivityTimer);
    clearTimeout(warningTimer);
    clearInterval(countdownInterval);
    overlay.classList.remove('show');
    sessionStart = Date.now();
    updateSessionBar();

    // Ping server
    fetch('/secret/heartbeat', { method: 'POST', credentials: 'same-origin' })
      .then(r => r.json())
      .then(d => { if (!d.ok) performLogout('expired'); })
      .catch(() => {});

    // Warn countdown
    warningTimer = setTimeout(() => {
      countdownSec = WARN_AT_SEC;
      if (countdownEl) countdownEl.textContent = countdownSec;
      overlay.classList.add('show');
      countdownInterval = setInterval(() => {
        countdownSec--;
        if (countdownEl) countdownEl.textContent = countdownSec;
        if (countdownSec <= 0) {
          clearInterval(countdownInterval);
          performLogout('timeout');
        }
      }, 1000);
    }, WARN_MS);

    inactivityTimer = setTimeout(() => performLogout('timeout'), INACTIVITY_MS);
  }

  function performLogout(reason) {
    clearInterval(countdownInterval);
    clearInterval(barInterval);
    // Replace history to prevent back-button to chat
    history.replaceState(null, 'StudyNest', '/');
    const f = document.createElement('form');
    f.method = 'POST';
    f.action = '/secret/logout';
    document.body.appendChild(f);
    f.submit();
  }

  if (stayBtn) {
    stayBtn.addEventListener('click', () => {
      overlay.classList.remove('show');
      resetTimers();
    });
  }

  // Activity events
  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'touchmove'].forEach(ev =>
    document.addEventListener(ev, resetTimers, { passive: true })
  );

  resetTimers();

})();
