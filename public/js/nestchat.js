/* NestChat — Improved chat with WhatsApp-style UI */
(function () {
  'use strict';

  // ── Elements ──────────────────────────────────────────────
  const messagesEl    = document.getElementById('messages');
  const chatInput     = document.getElementById('chatInput');
  const sendBtn       = document.getElementById('sendBtn');
  const imgBtn        = document.getElementById('imgBtn');
  const imgFileInput  = document.getElementById('imgFileInput');
  const voiceBtn      = document.getElementById('voiceBtn');
  const imgModal      = document.getElementById('imgModal');
  const imgModalSrc   = document.getElementById('imgModalSrc');
  const imgModalClose = document.getElementById('imgModalClose');
  const imgModalBg    = document.getElementById('imgModalBg');
  const wipeBtn       = document.getElementById('wipeBtn');
  const onlineListEl  = document.getElementById('onlineList');
  const onlineCount   = document.getElementById('onlineCount');
  const dmListEl      = document.getElementById('dmList');
  const topbarRoomName= document.getElementById('topbarRoomName');
  const topbarRoomIcon= document.getElementById('topbarRoomIcon');
  const topbarRoomSub = document.getElementById('topbarRoomSub');
  const typingBar     = document.getElementById('typingBar');
  const typingText    = document.getElementById('typingText');
  const panicBtn      = document.getElementById('panicBtn');
  const panicBtnSm    = document.getElementById('panicBtnSm');
  const menuBtn       = document.getElementById('menuBtn');
  const sidebar       = document.getElementById('sidebar');
  const sidebarClose  = document.getElementById('sidebarClose');
  const helpBtn       = document.getElementById('helpBtn');
  const helpPanel     = document.getElementById('helpPanel');
  const helpClose     = document.getElementById('helpClose');
  const themeBtn      = document.getElementById('themeBtn');

  let currentRoom = 'general';
  let typingTimeout;
  let allUsers = [];

  // ── Theme ─────────────────────────────────────────────────
  const savedTheme = localStorage.getItem('nc-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  themeBtn.addEventListener('click', () => {
    const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('nc-theme', t);
    themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
  });

  // ── Helpers ───────────────────────────────────────────────
  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function isURL(s) {
    try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch { return false; }
  }
  function getYTId(url) {
    const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  function formatTime(d) {
    return d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  }
  function formatDay(d) {
    const t = new Date(); const y = new Date(t); y.setDate(y.getDate()-1);
    if (d.toDateString() === t.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
  }

  // Auto-detect URLs in text and render as links
  function linkifyText(rawText) {
    const escaped = esc(rawText);
    return escaped.replace(/(https?:\/\/[^\s<>"]+)/g, (match) => {
      return `<a href="${match}" target="_blank" rel="noopener noreferrer">${match}</a>`;
    }).replace(/\n/g, '<br>');
  }

  // ── Cloudinary ────────────────────────────────────────────
  // Fix: Validate that config looks like actual preset, not API secret
  function getCloudinaryConfig() {
    const cfg = CLOUDINARY_CONFIG || {};
    const cloudName    = (cfg.cloudName    || '').trim();
    // Upload preset should be a short name, not a long credential string
    const rawPreset    = (cfg.uploadPreset || '').trim();
    // If preset looks like a base64/JWT secret (>40 chars with special chars), it's wrong
    const uploadPreset = rawPreset.length > 0 && rawPreset.length <= 80 ? rawPreset : '';
    return { cloudName, uploadPreset };
  }

  async function uploadToCloudinary(file, resourceType) {
    const { cloudName, uploadPreset } = getCloudinaryConfig();
    if (!cloudName) throw new Error('Cloudinary cloud name is not configured. Check your .env CLOUDINARY_CLOUD_NAME.');
    if (!uploadPreset) throw new Error(
      'Cloudinary upload preset is not configured correctly.\n\n' +
      'To fix:\n1. Go to cloudinary.com → Settings → Upload Presets\n' +
      '2. Create an "Unsigned" preset\n3. Copy the preset NAME (e.g. "nestchat_uploads")\n' +
      '4. Set CLOUDINARY_UPLOAD_PRESET=nestchat_uploads in your .env file'
    );
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const errMsg = data?.error?.message || 'Upload failed.';
      if (errMsg.toLowerCase().includes('preset') || errMsg.toLowerCase().includes('unknown')) {
        throw new Error(
          `Cloudinary Upload Preset Error: "${uploadPreset}" is not a valid unsigned upload preset.\n\n` +
          'Fix: Go to cloudinary.com → Settings → Upload Presets → Create unsigned preset → Copy preset NAME to .env'
        );
      }
      throw new Error(errMsg);
    }
    const url = data?.secure_url || data?.url;
    if (!url) throw new Error('Cloudinary did not return a URL.');
    return url;
  }

  // ── Voice Recording ───────────────────────────────────────
  let voiceRecorder = null, voiceStream = null, voiceChunks = [], voiceRecording = false;

  async function startVoiceRecording() {
    if (!voiceBtn) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert('Voice messages are not supported in this browser.'); return;
    }
    if (voiceRecording) { stopVoiceRecording(); return; }
    try {
      voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceChunks = [];
      voiceRecorder = new MediaRecorder(voiceStream);
      voiceRecorder.ondataavailable = (e) => { if (e.data?.size > 0) voiceChunks.push(e.data); };
      voiceRecorder.onstop = async () => {
        try {
          const mime = voiceRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(voiceChunks, { type: mime });
          if (!blob.size) { addSystem('🎤 Recording was empty.'); return; }
          const status = makeTempStatus('Uploading voice message…');
          try {
            const voiceUrl = await uploadToCloudinary(blob, 'video');
            socket.emit('message', { voiceUrl });
            lastSenderId = null;
          } finally {
            if (status?.parentNode) status.remove();
          }
        } catch (err) {
          console.error(err);
          alert(err.message || 'Voice upload failed.');
        } finally {
          voiceChunks = [];
          voiceStream?.getTracks().forEach(t => t.stop());
          voiceStream = null;
          voiceRecorder = null;
          voiceRecording = false;
          voiceBtn.classList.remove('recording');
          voiceBtn.setAttribute('aria-pressed','false');
        }
      };
      voiceRecorder.start();
      voiceRecording = true;
      voiceBtn.classList.add('recording');
      voiceBtn.setAttribute('aria-pressed','true');
      addSystem('🎤 Recording… tap the mic again to send.');
    } catch (err) {
      voiceStream?.getTracks().forEach(t => t.stop());
      voiceStream = null; voiceRecording = false;
      voiceBtn.classList.remove('recording');
      voiceBtn.setAttribute('aria-pressed','false');
      alert('Could not access the microphone.');
    }
  }
  function stopVoiceRecording() {
    if (voiceRecorder && voiceRecorder.state !== 'inactive') voiceRecorder.stop();
  }
  if (voiceBtn) voiceBtn.addEventListener('click', startVoiceRecording);

  // ── Mobile sidebar ────────────────────────────────────────
  menuBtn?.addEventListener('click', () => sidebar.classList.add('open'));
  sidebarClose?.addEventListener('click', () => sidebar.classList.remove('open'));
  // Close sidebar on outside click
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuBtn) {
      sidebar.classList.remove('open');
    }
  });

  // ── Help Panel ────────────────────────────────────────────
  function toggleHelp(forceOpen) {
    if (!helpPanel) return;
    const open = typeof forceOpen === 'boolean' ? forceOpen : !helpPanel.classList.contains('open');
    helpPanel.classList.toggle('open', open);
    helpPanel.style.display = open ? 'flex' : 'none';
    helpPanel.style.flexDirection = 'column';
    helpPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  helpBtn?.addEventListener('click', () => toggleHelp());
  helpBtn?.addEventListener('touchend', (e) => { e.preventDefault(); toggleHelp(); }, { passive:false });
  helpClose?.addEventListener('click', () => toggleHelp(false));

  // ── Panic ─────────────────────────────────────────────────
  function triggerPanic() {
    fetch('/secret/panic', { method:'POST', credentials:'same-origin' })
      .finally(() => { history.replaceState(null,'','/'); window.location.replace('/'); });
  }
  panicBtn?.addEventListener('click', triggerPanic);
  panicBtnSm?.addEventListener('click', triggerPanic);
  document.addEventListener('keydown', e => { if (e.key==='Escape') triggerPanic(); });

  // ── Inactivity ────────────────────────────────────────────
  const overlay   = document.getElementById('inactivityOverlay');
  const countdown = document.getElementById('countdownNum');
  const stayBtn   = document.getElementById('stayBtn');
  const fillEl    = document.getElementById('sessionFill');
  const timerText = document.getElementById('sessionTimerText');
  const LIMIT_MS  = INACTIVITY_LIMIT * 1000;
  const WARN_MS   = (INACTIVITY_LIMIT - WARN_AT) * 1000;
  let sessionStart = Date.now(), inTimer, warnTimer, cdInterval;

  function resetTimers() {
    clearTimeout(inTimer); clearTimeout(warnTimer); clearInterval(cdInterval);
    overlay.classList.remove('show');
    sessionStart = Date.now();
    fetch('/secret/heartbeat', { method:'POST', credentials:'same-origin' })
      .then(r=>r.json()).then(d=>{ if(!d.ok) doLogout(); }).catch(()=>{});
    warnTimer = setTimeout(() => {
      let sec = WARN_AT; countdown.textContent = sec; overlay.classList.add('show');
      cdInterval = setInterval(() => { sec--; countdown.textContent = sec; if(sec<=0){clearInterval(cdInterval);doLogout();} }, 1000);
    }, WARN_MS);
    inTimer = setTimeout(() => doLogout(), LIMIT_MS);
  }
  function doLogout() {
    history.replaceState(null,'','/');
    const f = document.createElement('form'); f.method='POST'; f.action='/secret/logout';
    document.body.appendChild(f); f.submit();
  }
  stayBtn?.addEventListener('click', () => { overlay.classList.remove('show'); resetTimers(); });
  ['mousemove','keydown','click','scroll','touchstart'].forEach(e =>
    document.addEventListener(e, resetTimers, {passive:true}));
  setInterval(() => {
    const elapsed = (Date.now()-sessionStart)/1000;
    const pct = Math.max(0, 100-(elapsed/INACTIVITY_LIMIT)*100);
    if (fillEl) { fillEl.style.width=pct+'%'; fillEl.classList.toggle('warn',pct<30); fillEl.classList.toggle('danger',pct<15); }
    if (timerText) {
      const rem = Math.max(0, Math.round(INACTIVITY_LIMIT-elapsed));
      timerText.textContent = rem>0 ? rem+'s remaining' : 'Logging out…';
    }
  }, 500);
  resetTimers();

  // ── Socket.io ─────────────────────────────────────────────
  const socket = io({ withCredentials: true });
  socket.on('connect',       () => { socket.emit('join-room', currentRoom); });
  socket.on('connect_error', () => addSystem('⚠️ Connection error. Retrying…'));
  socket.on('disconnect',    () => addSystem('⚠️ Disconnected.'));

  socket.on('history', (msgs) => {
    messagesEl.innerHTML = ''; lastDay = null; lastSenderId = null;
    if (msgs.length === 0) { addSystem('No messages yet. Say hi! 👋'); }
    else { msgs.forEach(m => renderMessage(m, false)); }
    scrollBottom();
  });
  socket.on('message', (msg) => { renderMessage(msg, true); scrollBottom(); });
  socket.on('message-deleted', (msgId) => {
    const el = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (el) { el.style.opacity='0'; el.style.transform='scale(.95)'; setTimeout(()=>el.remove(),200); }
  });
  socket.on('room-wiped', (room) => {
    if (room===currentRoom) { messagesEl.innerHTML=''; lastDay=null; lastSenderId=null; addSystem('🗑 Room cleared by admin.'); }
  });

  // Online list
  socket.on('online-list', (list) => {
    if (onlineCount) onlineCount.textContent = list.length;
    if (onlineListEl) {
      onlineListEl.innerHTML = list.map(u=>`
        <div class="online-item">
          <div class="avatar xs" style="background:${esc(u.avatarColor||'#6366f1')}">${(u.displayName||'?')[0].toUpperCase()}</div>
          <span style="font-size:.79rem;color:var(--text2)">${esc(u.displayName||'User')}${u.id===CURRENT_USER.id?' <em style="opacity:.45;font-size:.7rem">(you)</em>':''}</span>
          <span style="width:7px;height:7px;background:var(--accent);border-radius:50%;margin-left:auto;flex-shrink:0"></span>
        </div>
      `).join('');
    }
    buildDMList(list);
  });

  // Typing
  let typingUsers = new Set();
  socket.on('typing', ({displayName, isTyping}) => {
    if (isTyping) typingUsers.add(displayName); else typingUsers.delete(displayName);
    if (typingUsers.size > 0) {
      typingBar.style.display = 'flex';
      typingText.textContent = [...typingUsers].join(', ') + (typingUsers.size===1?' is typing…':' are typing…');
    } else { typingBar.style.display = 'none'; }
  });
  socket.on('rate-limited', () => addSystem('⚠️ Slow down! You are sending messages too fast.'));
  socket.on('error', (msg) => addSystem('⚠️ ' + msg));

  // ── DM List ───────────────────────────────────────────────
  function buildDMList(onlineList) {
    const seen = new Set([CURRENT_USER.id]);
    const items = [];
    onlineList.forEach(u => { if (!seen.has(u.id)) { seen.add(u.id); items.push(u); } });
    allUsers.forEach(u => { const id=u._id||u.id; if (!seen.has(id)) { seen.add(id); items.push({...u, id}); } });
    if (items.length === 0) { dmListEl.innerHTML='<div class="dm-placeholder">No other users</div>'; return; }
    dmListEl.innerHTML = items.map(u => {
      const dmRoom = makeDMRoom(CURRENT_USER.id, u.id||u._id);
      const isOnline = onlineList.some(o => o.id === (u.id||u._id));
      return `<div class="dm-item${currentRoom===dmRoom?' active':''}" data-room="${esc(dmRoom)}" data-uid="${esc(u.id||u._id)}">
        <div class="avatar sm" style="background:${esc(u.avatarColor||'#6366f1')};position:relative">
          ${(u.displayName||'?')[0].toUpperCase()}
          ${isOnline ? '<span style="position:absolute;bottom:-1px;right:-1px;width:9px;height:9px;background:var(--accent);border-radius:50%;border:2px solid var(--bg-sidebar)"></span>' : ''}
        </div>
        <span>${esc(u.displayName||u.username||'User')}</span>
      </div>`;
    }).join('');
    dmListEl.querySelectorAll('.dm-item').forEach(el => {
      el.addEventListener('click', () => {
        const name = el.querySelector('span')?.textContent || 'DM';
        switchRoom(el.dataset.room, name, '💬', 'Direct Message');
      });
    });
  }

  fetch('/secret/users', {credentials:'same-origin'})
    .then(r=>r.json()).then(d=>{ allUsers=d.users||[]; buildDMList([]); }).catch(()=>{});

  function makeDMRoom(a, b) { return 'dm:' + [a,b].sort().join(':'); }

  // ── Room switching ────────────────────────────────────────
  document.querySelectorAll('.room-item').forEach(el => {
    el.addEventListener('click', () => switchRoom(el.dataset.room, el.querySelector('span')?.textContent||'general', '#', 'Group channel'));
  });

  function switchRoom(room, name, icon, sub) {
    if (room===currentRoom) { sidebar.classList.remove('open'); return; }
    currentRoom = room;
    topbarRoomName.textContent = name;
    topbarRoomIcon.textContent = icon;
    if (topbarRoomSub) topbarRoomSub.textContent = sub || '';
    document.querySelectorAll('.room-item').forEach(el => el.classList.toggle('active', el.dataset.room===room));
    document.querySelectorAll('.dm-item').forEach(el => el.classList.toggle('active', el.dataset.room===room));
    socket.emit('join-room', room);
    sidebar.classList.remove('open');
    lastDay = null; lastSenderId = null;
  }

  // ── Render Message ────────────────────────────────────────
  let lastSenderId = null, lastDay = null;

  function renderMessage(msg, animate) {
    const isOwn    = msg.sender.id === CURRENT_USER.id;
    const isAdmin  = CURRENT_USER.role === 'admin';
    const canDelete= isOwn || isAdmin;
    const grouped  = msg.sender.id === lastSenderId;
    lastSenderId   = msg.sender.id;

    const d = new Date(msg.createdAt);
    const dayKey = d.toDateString();
    if (dayKey !== lastDay) { addDayDivider(formatDay(d)); lastDay = dayKey; lastSenderId = null; }

    const wrap = document.createElement('div');
    wrap.className = `msg-wrap ${isOwn?'own':'other'}${grouped?' grouped':''}`;
    wrap.dataset.msgId = msg._id || '';

    let bubbleContent = '';

    // Sender name (in group channel, non-own)
    if (!isOwn && !grouped) {
      bubbleContent += `<span class="msg-sender-name">${esc(msg.sender.displayName)}</span>`;
    }

    if (msg.text) {
      // Auto-detect URLs and render as hyperlinks
      bubbleContent += `<div class="msg-text">${linkifyText(msg.text)}</div>`;
    }
    if (msg.imageUrl) {
      bubbleContent += `<img class="msg-image" src="${esc(msg.imageUrl)}" alt="image" data-src="${esc(msg.imageUrl)}" loading="lazy"/>`;
    }
    if (msg.voiceUrl) {
      bubbleContent += `<div class="msg-voice">
        <div class="msg-voice-icon">🎤</div>
        <audio controls preload="none" src="${esc(msg.voiceUrl)}"></audio>
      </div>`;
    }
    if (msg.linkUrl) {
      const ytId = getYTId(msg.linkUrl);
      if (ytId) {
        bubbleContent += `<div class="msg-link-preview">
          <div class="msg-link-label">🎥 YouTube</div>
          <img src="https://img.youtube.com/vi/${esc(ytId)}/mqdefault.jpg"
               style="width:100%;border-radius:7px;cursor:pointer;display:block"
               onclick="window.open('${esc(msg.linkUrl)}','_blank')"/>
          <a href="${esc(msg.linkUrl)}" target="_blank" rel="noopener">${esc(msg.linkUrl)}</a>
        </div>`;
      } else {
        bubbleContent += `<div class="msg-link-preview">
          <div class="msg-link-label">🔗 Link</div>
          <a href="${esc(msg.linkUrl)}" target="_blank" rel="noopener">${esc(msg.linkUrl)}</a>
        </div>`;
      }
    }

    bubbleContent += `<div class="msg-meta"><span class="msg-time">${formatTime(d)}</span></div>`;
    if (canDelete) {
      bubbleContent += `<button class="msg-delete" data-id="${esc(msg._id||'')}">🗑 Delete</button>`;
    }

    wrap.innerHTML = `
      <div class="msg-row">
        <div class="msg-avatar" style="background:${esc(msg.sender.avatarColor||'#6366f1')}">
          ${(msg.sender.displayName||'?')[0].toUpperCase()}
        </div>
        <div class="msg-bubble ${isOwn?'out':'in'}">${bubbleContent}</div>
      </div>`;

    if (animate) {
      wrap.style.opacity = '0'; wrap.style.transform = 'translateY(5px)';
      requestAnimationFrame(() => {
        wrap.style.transition = 'opacity .18s, transform .18s';
        wrap.style.opacity = '1'; wrap.style.transform = 'none';
      });
    }

    messagesEl.appendChild(wrap);

    // Image zoom
    wrap.querySelectorAll('.msg-image').forEach(img => {
      img.addEventListener('click', () => { imgModalSrc.src = img.dataset.src; imgModal.style.display = 'flex'; });
    });
    // Delete
    wrap.querySelectorAll('.msg-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Delete this message?')) socket.emit('delete-message', btn.dataset.id);
      });
    });
  }

  function addDayDivider(text) {
    const d = document.createElement('div');
    d.className = 'day-divider';
    d.innerHTML = `<span>${text}</span>`;
    messagesEl.appendChild(d);
  }

  function addSystem(text) {
    const d = document.createElement('div');
    d.className = 'system-msg';
    d.innerHTML = `<span class="system-msg-inner">${esc(text)}</span>`;
    messagesEl.appendChild(d);
    scrollBottom();
  }

  function makeTempStatus(text) {
    const d = document.createElement('div');
    d.className = 'system-msg';
    d.innerHTML = `<span class="system-msg-inner">${esc(text)}</span>`;
    messagesEl.appendChild(d); scrollBottom(); return d;
  }

  function scrollBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

  // ── Send ──────────────────────────────────────────────────
  function sendMessage(forcedText) {
    const text = (forcedText ?? chatInput.textContent).toString().trim();
    if (!text) return;
    // Check if the whole message is a single URL → send as linkUrl too for embed preview
    const words = text.split(/\s+/);
    if (words.length === 1 && isURL(text)) {
      socket.emit('message', { text, linkUrl: text });
    } else {
      socket.emit('message', { text });
    }
    chatInput.textContent = '';
    chatInput.focus();
    lastSenderId = null;
  }

  sendBtn.addEventListener('click', () => sendMessage());
  chatInput.addEventListener('keydown', e => {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  chatInput.addEventListener('input', () => {
    socket.emit('typing', true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socket.emit('typing', false), 2000);
  });

  // ── Image upload ──────────────────────────────────────────
  imgBtn?.addEventListener('click', () => imgFileInput.click());
  imgFileInput?.addEventListener('change', async () => {
    const file = imgFileInput.files[0]; imgFileInput.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please choose an image file.'); return; }
    if (file.size > 5*1024*1024) { alert('Max image size is 5MB.'); return; }
    const status = makeTempStatus('Uploading image…');
    try {
      const imageUrl = await uploadToCloudinary(file, 'image');
      socket.emit('message', { imageUrl });
      lastSenderId = null;
    } catch (err) {
      console.error(err);
      alert(err.message || 'Image upload failed.');
    } finally {
      if (status?.parentNode) status.remove();
    }
  });

  // ── Admin wipe ────────────────────────────────────────────
  wipeBtn?.addEventListener('click', () => {
    if (confirm(`Wipe ALL messages in #${currentRoom}?`)) socket.emit('admin-wipe', currentRoom);
  });

  // ── Image modal ───────────────────────────────────────────
  imgModalClose.addEventListener('click', () => imgModal.style.display='none');
  imgModalBg.addEventListener('click',    () => imgModal.style.display='none');

})();
