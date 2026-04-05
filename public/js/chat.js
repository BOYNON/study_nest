/* ============================================================
   StudyNest — Chat UI JS (Phase 3)
   Handles: Socket.io messaging, history loading,
            image upload, link sharing, image modal,
            delete messages
   ============================================================ */

(function () {
  'use strict';

  const messagesEl        = document.getElementById('chatMessages');
  const inputEl           = document.getElementById('chatInput');
  const sendBtn           = document.getElementById('sendBtn');
  const imgBtn            = document.getElementById('imgUploadBtn');
  const imgFileInput      = document.getElementById('imageFileInput');
  const linkBtn           = document.getElementById('linkBtn');
  const linkDialog        = document.getElementById('linkDialog');
  const linkInput         = document.getElementById('linkInput');
  const linkSendBtn       = document.getElementById('linkSendBtn');
  const linkCancel        = document.getElementById('linkCancelBtn');
  const imgModal          = document.getElementById('imgModal');
  const imgModalSrc       = document.getElementById('imgModalSrc');
  const imgModalClose     = document.getElementById('imgModalClose');
  const imgModalCloseBtn  = document.getElementById('imgModalCloseBtn');

  // ── Socket.io connection ─────────────────────────────────
  const socket = io({ transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
    loadHistory();
  });

  socket.on('connect_error', (err) => {
    console.error('Socket error:', err.message);
  });

  // ── Load chat history from server on page open ───────────
  async function loadHistory() {
    try {
      const res  = await fetch('/api/messages?room=general&limit=200');
      const data = await res.json();
      if (!data.messages || !data.messages.length) return;

      messagesEl.innerHTML = ''; // clear any placeholder

      data.messages.forEach(msg => {
        renderMessage({
          text:        msg.text,
          imageUrl:    msg.imageUrl,
          linkUrl:     msg.linkUrl,
          voiceUrl:    msg.voiceUrl,
          isOwn:       msg.sender?.id === CURRENT_USER.id,
          displayName: msg.sender?.displayName || 'Unknown',
          avatarColor: msg.sender?.avatarColor || '#6366f1',
          msgId:       msg._id,
          timestamp:   msg.createdAt,
        });
      });

      scrollToBottom();
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  // ── Receive messages from other users via socket ─────────
  socket.on('message', (msg) => {
    // Don't double-render own messages (already rendered on send)
    if (msg.sender?.id === CURRENT_USER.id) return;

    renderMessage({
      text:        msg.text,
      imageUrl:    msg.imageUrl,
      linkUrl:     msg.linkUrl,
      voiceUrl:    msg.voiceUrl,
      isOwn:       false,
      displayName: msg.sender?.displayName || 'Unknown',
      avatarColor: msg.sender?.avatarColor || '#6366f1',
      msgId:       msg._id,
      timestamp:   msg.createdAt,
    });
  });

  // ── Helpers ──────────────────────────────────────────────
  function formatTime(ts) {
    const d = ts ? new Date(ts) : new Date();
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom() {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function isURL(str) {
    try { new URL(str); return true; } catch { return false; }
  }

  function isYouTube(url) {
    return /youtube\.com|youtu\.be/.test(url);
  }

  function getYTId(url) {
    const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Render a message bubble ──────────────────────────────
  function renderMessage({ text, imageUrl, linkUrl, isOwn, displayName, avatarColor, msgId, timestamp }) {
    const isAdmin = CURRENT_USER.role === 'admin';
    const wrapper = document.createElement('div');
    wrapper.className = `chat-msg${isOwn ? ' own' : ''}`;
    wrapper.dataset.msgId = msgId || Date.now();

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.style.background = avatarColor || '#6366f1';
    avatar.textContent = (displayName || 'U').charAt(0).toUpperCase();

    const body = document.createElement('div');
    body.className = 'chat-msg-body';

    const header = document.createElement('div');
    header.className = 'chat-msg-header';
    header.innerHTML = `
      <span class="chat-msg-name">${escapeHtml(displayName)}</span>
      <span class="chat-msg-time">${formatTime(timestamp)}</span>
    `;
    body.appendChild(header);

    // Text content
    if (text) {
      const textEl = document.createElement('div');
      textEl.className = 'chat-msg-text';
      if (isURL(text.trim())) {
        textEl.innerHTML = `<a href="${escapeHtml(text.trim())}" target="_blank" rel="noopener">${escapeHtml(text.trim())}</a>`;
      } else {
        textEl.textContent = text;
      }
      body.appendChild(textEl);
    }

    // Image
    if (imageUrl) {
      const img = document.createElement('img');
      img.className = 'chat-msg-image';
      img.src = imageUrl;
      img.alt = 'Shared image';
      img.addEventListener('click', () => openImageModal(imageUrl));
      body.appendChild(img);
    }

    // Link preview
    if (linkUrl) {
      const preview = document.createElement('div');
      preview.className = 'chat-msg-link-preview';
      if (isYouTube(linkUrl)) {
        const ytId = getYTId(linkUrl);
        if (ytId) {
          preview.innerHTML = `
            <div style="font-size:.78rem;color:var(--text-3);margin-bottom:6px">🎥 YouTube Video</div>
            <img src="https://img.youtube.com/vi/${ytId}/mqdefault.jpg"
              style="width:100%;border-radius:6px;margin-bottom:6px;cursor:pointer"
              onclick="window.open('${escapeHtml(linkUrl)}','_blank')" alt="YT thumbnail"/>
            <a href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener"
              style="font-size:.8rem;color:var(--math-fg)">${escapeHtml(linkUrl)}</a>
          `;
        }
      } else {
        preview.innerHTML = `
          <div style="font-size:.78rem;color:var(--text-3);margin-bottom:4px">🔗 Link</div>
          <a href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener"
            style="font-size:.82rem;color:var(--math-fg);word-break:break-all">${escapeHtml(linkUrl)}</a>
        `;
      }
      body.appendChild(preview);
    }

    // Delete button (own messages or admin)
    if (isOwn || isAdmin) {
      const delBtn = document.createElement('button');
      delBtn.className = 'chat-msg-delete';
      delBtn.textContent = '🗑 Delete';
      delBtn.addEventListener('click', () => {
        wrapper.style.opacity = '0';
        wrapper.style.transform = 'translateX(-10px)';
        wrapper.style.transition = 'all .25s ease';
        setTimeout(() => wrapper.remove(), 250);
      });
      wrapper.appendChild(avatar);
      wrapper.appendChild(body);
      wrapper.appendChild(delBtn);
    } else {
      wrapper.appendChild(avatar);
      wrapper.appendChild(body);
    }

    messagesEl.appendChild(wrapper);
    scrollToBottom();

    // Animate in
    wrapper.style.opacity = '0';
    wrapper.style.transform = 'translateY(8px)';
    requestAnimationFrame(() => {
      wrapper.style.transition = 'opacity .2s ease, transform .2s ease';
      wrapper.style.opacity = '1';
      wrapper.style.transform = 'translateY(0)';
    });
  }

  // ── Send text message ────────────────────────────────────
  function sendMessage() {
    const text = inputEl.textContent.trim();
    if (!text) return;

    // Render immediately for sender (optimistic UI)
    renderMessage({
      text,
      isOwn:       true,
      displayName: CURRENT_USER.displayName,
      avatarColor: CURRENT_USER.avatarColor,
    });

    // Actually send via socket to server + save to MongoDB
    socket.emit('message', { text, room: 'general' });

    inputEl.textContent = '';
    inputEl.focus();
  }

  if (sendBtn) sendBtn.addEventListener('click', sendMessage);

  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // ── Image upload ─────────────────────────────────────────
  if (imgBtn && imgFileInput) {
    imgBtn.addEventListener('click', () => imgFileInput.click());

    imgFileInput.addEventListener('change', async () => {
      const file = imgFileInput.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('Image too large. Max size is 5MB.');
        return;
      }

      // Upload to Cloudinary first, then emit URL via socket
      const cloudName    = (window.CLOUDINARY_CLOUD_NAME    || '').trim();
      const uploadPreset = (window.CLOUDINARY_UPLOAD_PRESET || '').trim();

      if (cloudName && uploadPreset) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', uploadPreset);

          const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST', body: formData,
          });
          const data = await res.json();
          const imageUrl = data.secure_url;

          renderMessage({
            imageUrl,
            isOwn:       true,
            displayName: CURRENT_USER.displayName,
            avatarColor: CURRENT_USER.avatarColor,
          });

          socket.emit('message', { imageUrl, room: 'general' });
        } catch (err) {
          alert('Image upload failed. Check Cloudinary settings.');
          console.error(err);
        }
      } else {
        // Fallback: show locally only (no Cloudinary configured)
        const reader = new FileReader();
        reader.onload = (e) => {
          renderMessage({
            imageUrl:    e.target.result,
            isOwn:       true,
            displayName: CURRENT_USER.displayName,
            avatarColor: CURRENT_USER.avatarColor,
          });
        };
        reader.readAsDataURL(file);
      }

      imgFileInput.value = '';
    });
  }

  // ── Link sharing ─────────────────────────────────────────
  if (linkBtn && linkDialog) {
    linkBtn.addEventListener('click', () => {
      linkDialog.style.display = 'flex';
      if (linkInput) linkInput.focus();
    });
  }

  if (linkCancel) {
    linkCancel.addEventListener('click', () => { linkDialog.style.display = 'none'; });
  }

  if (linkSendBtn && linkInput) {
    linkSendBtn.addEventListener('click', () => {
      const url = linkInput.value.trim();
      if (!url || !isURL(url)) { alert('Please enter a valid URL.'); return; }

      renderMessage({
        linkUrl:     url,
        isOwn:       true,
        displayName: CURRENT_USER.displayName,
        avatarColor: CURRENT_USER.avatarColor,
      });

      socket.emit('message', { linkUrl: url, room: 'general' });

      linkInput.value = '';
      linkDialog.style.display = 'none';
    });

    linkInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') linkSendBtn.click();
    });
  }

  // ── Image Modal ──────────────────────────────────────────
  function openImageModal(src) {
    if (!imgModal || !imgModalSrc) return;
    imgModalSrc.src = src;
    imgModal.style.display = 'flex';
  }

  if (imgModalClose)    imgModalClose.addEventListener('click',    () => { imgModal.style.display = 'none'; });
  if (imgModalCloseBtn) imgModalCloseBtn.addEventListener('click', () => { imgModal.style.display = 'none'; });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imgModal && imgModal.style.display !== 'none') {
      imgModal.style.display = 'none';
    }
  });

  scrollToBottom();

})();

