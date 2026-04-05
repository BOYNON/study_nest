// Middleware: require authenticated session for protected routes
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/secret/login?reason=auth');
  }
  next();
}

// Middleware: require admin role
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/secret/login?reason=auth');
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Middleware: attach user info to res.locals for templates
function attachUser(req, res, next) {
  if (req.session && req.session.userId) {
    res.locals.currentUser = {
      id: req.session.userId,
      username: req.session.username,
      displayName: req.session.displayName,
      role: req.session.role,
      avatarColor: req.session.avatarColor,
    };
  } else {
    res.locals.currentUser = null;
  }
  next();
}

module.exports = { requireAuth, requireAdmin, attachUser };
