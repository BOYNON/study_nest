const express  = require('express');
const { requireAuth } = require('../middleware/auth');

module.exports = function(io, onlineUsers) {
  const router = express.Router();

  function getUser() {
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) return null;
      return require('../models/User');
    } catch { return null; }
  }

  // GET /secret/enter
  router.get('/enter', (req, res) => {
    if (req.session?.userId) return res.redirect('/secret/chat');
    res.redirect('/secret/login');
  });

  // GET /secret/login
  router.get('/login', (req, res) => {
    if (req.session?.userId) return res.redirect('/secret/chat');
    const { reason } = req.query;
    res.render('secret/login', {
      title: 'Sign In', error: null,
      notice: reason === 'auth'    ? 'Please sign in to continue.'       :
              reason === 'timeout' ? 'You were logged out due to inactivity.' :
              reason === 'panic'   ? 'Session ended.'                    : null,
    });
  });

  // POST /secret/login
  router.post('/login', async (req, res) => {
    const fail = (msg) => res.render('secret/login', { title: 'Sign In', error: msg, notice: null });
    const { username, password } = req.body;
    if (!username || !password) return fail('Please enter both username and password.');

    const User = getUser();
    if (!User) {
      // No-DB demo fallback
      const DEMO = { username: 'admin', password: 'admin1234', displayName: 'Admin', role: 'admin', avatarColor: '#ef4444', _id: 'demo-id' };
      if (username.toLowerCase() !== DEMO.username || password !== DEMO.password)
        return fail('Invalid username or password.');
      req.session.userId = DEMO._id; req.session.username = DEMO.username;
      req.session.displayName = DEMO.displayName; req.session.role = DEMO.role;
      req.session.avatarColor = DEMO.avatarColor; req.session.loginTime = Date.now();
      return res.redirect('/secret/chat');
    }
    try {
      const user = await User.findOne({ username: username.toLowerCase().trim() });
      if (!user || !(await user.comparePassword(password))) return fail('Invalid username or password.');
      req.session.userId = user._id.toString(); req.session.username = user.username;
      req.session.displayName = user.displayName; req.session.role = user.role;
      req.session.avatarColor = user.avatarColor; req.session.loginTime = Date.now();
      user.lastSeen = new Date(); await user.save();
      return res.redirect('/secret/chat');
    } catch (err) { console.error(err); return fail('Something went wrong.'); }
  });

  // GET/POST /secret/logout
  const doLogout = (req, res) => {
    req.session.destroy(() => { res.clearCookie('studynest.sid'); res.redirect('/'); });
  };
  router.get('/logout', doLogout);
  router.post('/logout', doLogout);

  // GET /secret/chat
  router.get('/chat', requireAuth, (req, res) => {
    const cloudName    = (process.env.CLOUDINARY_CLOUD_NAME    || '').trim();
    const uploadPreset = (process.env.CLOUDINARY_UPLOAD_PRESET || '').trim();

    // Warn in server console if Cloudinary looks misconfigured
    if (uploadPreset.length > 80 || (uploadPreset.includes('-') && uploadPreset.length > 30 && /[A-Z]/.test(uploadPreset))) {
      console.warn('⚠️  CLOUDINARY_UPLOAD_PRESET looks like an API secret, not an upload preset name.');
      console.warn('   Upload presets are short names like "nestchat_uploads".');
      console.warn('   See: cloudinary.com → Settings → Upload Presets → create unsigned preset');
    }

    res.render('secret/chat', {
      title: 'NestChat',
      user: {
        id:          req.session.userId,
        username:    req.session.username,
        displayName: req.session.displayName,
        role:        req.session.role,
        avatarColor: req.session.avatarColor,
      },
      cloudinary: { cloudName, uploadPreset },
    });
  });

  // POST /secret/heartbeat
  router.post('/heartbeat', requireAuth, (req, res) => {
    req.session.touch();
    res.json({ ok: true, username: req.session.username });
  });

  // POST /secret/panic
  router.post('/panic', (req, res) => {
    req.session.destroy(() => { res.clearCookie('studynest.sid'); res.json({ ok: true }); });
  });

  // GET /secret/session-status
  router.get('/session-status', (req, res) => {
    if (req.session?.userId) return res.json({ loggedIn: true, username: req.session.username });
    res.json({ loggedIn: false });
  });

  // GET /secret/users — list users for DM selector
  router.get('/users', requireAuth, async (req, res) => {
    const User = getUser();
    if (!User) return res.json({ users: [] });
    try {
      const users = await User.find({}, { username: 1, displayName: 1, avatarColor: 1, role: 1, lastSeen: 1 }).lean();
      res.json({ users });
    } catch { res.json({ users: [] }); }
  });

  return router;
};
