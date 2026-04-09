require('dotenv').config();
const express  = require('express');
const morgan   = require('morgan');
const path     = require('path');
const session  = require('express-session');
const http     = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: false } });
const PORT   = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─────────────────────────────────────────────
// Markdown Renderer
// ─────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/`(.*?)`/g,'<code class="inline-code">$1</code>')
    .replace(/^### (.+)$/gm,'<h4 class="md-h4">$1</h4>')
    .replace(/^## (.+)$/gm,'<h3 class="md-h3">$1</h3>')
    .replace(/^# (.+)$/gm,'<h2 class="md-h2">$1</h2>');

  html = html.replace(/^\d+\. (.+)$/gm,'<li class="ol-item">$1</li>');
  html = html.replace(/((?:<li class="ol-item">.*<\/li>\n?)+)/g,'<ol class="md-ol">$1</ol>');

  html = html.replace(/^- (.+)$/gm,'<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g,'<ul class="md-ul">$1</ul>');

  html = html.split('\n\n').map(block => {
    if (block.trimStart().startsWith('<')) return block;
    return '<p>' + block.replace(/\n/g,'<br>') + '</p>';
  }).join('\n');

  return html;
}

app.locals.renderMarkdown = renderMarkdown;

// ─────────────────────────────────────────────
// Basic Middleware
// ─────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const onlineUsers = new Map();
const rateLimits  = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const lim = rateLimits.get(userId) || { count:0, resetAt: now+10000 };
  if (now > lim.resetAt) { lim.count=0; lim.resetAt=now+10000; }
  lim.count++;
  rateLimits.set(userId, lim);
  return lim.count <= 15;
}

function isDMRoom(room, userId) {
  if (!room.startsWith('dm:')) return false;
  const p = room.split(':');
  return p.length===3 && (p[1]===userId || p[2]===userId);
}

// ─────────────────────────────────────────────
// MongoDB Session Store
// ─────────────────────────────────────────────
async function buildSessionStore() {
  if (!process.env.MONGODB_URI) return undefined;
  try {
    const mongoose = require('mongoose');
    const MongoStore = require('connect-mongo');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    return MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: 'studynest',
      ttl: 7200,
      touchAfter: 60
    });

  } catch(err) {
    console.warn('⚠️ MongoDB unavailable – memory sessions only. Error:', err.message);
    return undefined;
  }
}

// ─────────────────────────────────────────────
// Start App
// ─────────────────────────────────────────────
async function startApp() {

  const store = await buildSessionStore();

  // Required for secure cookies behind Render's HTTPS proxy
  app.set('trust proxy', 1);

  const sessionMiddleware = session({
    name: 'studynest.sid',
    secret: process.env.SESSION_SECRET || 'sn-dev-secret-CHANGE-IN-PROD',
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7200000,
      sameSite: 'lax'
    },
  });

  app.use(sessionMiddleware);
  io.use((socket, next) => sessionMiddleware(socket.request, socket.request.res || {}, next));

  const { attachUser } = require('./middleware/auth');
  app.use(attachUser);

  // ─────────────────────────────────────────────
  // Routes
  // ─────────────────────────────────────────────
  app.use('/',       require('./routes/index'));
  app.use('/class',  require('./routes/class'));
  app.use('/api',    require('./routes/api'));
  app.use('/secret', require('./routes/secret')(io, onlineUsers));

  app.use((_req, res) => res.status(404).render('404', { title: '404 – Not Found' }));

  // ─────────────────────────────────────────────
  // Socket.io
  // ─────────────────────────────────────────────
  let Message = null;

  function tryLoadMessage() {
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1 && !Message) {
        Message = require('./models/Message');
      }
    } catch {}
  }

  // Fetch history for a room and emit back to the requesting socket
  async function sendHistory(socket, room) {
    tryLoadMessage();
    if (!Message) {
      socket.emit('history', []);
      return;
    }
    try {
      const msgs = await Message
        .find({ room, deleted: { $ne: true } })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();
      socket.emit('history', msgs);
    } catch (err) {
      console.error('History fetch error:', err.message);
      socket.emit('history', []);
    }
  }

  function broadcastOnlineList(room) {
    const list = [];
    onlineUsers.forEach(u => {
      if (u.room === room) list.push(u);
    });
    io.to(room).emit('online-list', list);
  }

  io.on('connection', (socket) => {

    const sess = socket.request.session;
    if (!sess?.userId) {
      socket.disconnect(true);
      return;
    }

    const user = {
      id:          sess.userId,
      username:    sess.username,
      displayName: sess.displayName,
      avatarColor: sess.avatarColor,
      role:        sess.role,
      room:        'general'
    };

    onlineUsers.set(socket.id, user);

    // ── join-room: client calls this on connect + room switch ──
    socket.on('join-room', async (room) => {
      // Validate room access
      if (!room) return;
      if (room !== 'general' && !isDMRoom(room, user.id)) return;

      // Leave previous room
      if (user.room) {
        socket.leave(user.room);
        broadcastOnlineList(user.room);
      }

      // Join new room
      user.room = room;
      onlineUsers.set(socket.id, user);
      socket.join(room);

      // Send history to this socket
      await sendHistory(socket, room);

      // Broadcast updated online list
      broadcastOnlineList(room);
    });

    // ── message ───────────────────────────────────────────────
    socket.on('message', async (data) => {

      if (!checkRateLimit(user.id)) {
        socket.emit('rate-limited');
        return;
      }

      const msgData = {
        room:      user.room,
        sender:    user,
        text:      data.text      || '',
        imageUrl:  data.imageUrl  || '',
        linkUrl:   data.linkUrl   || '',
        voiceUrl:  data.voiceUrl  || '',
        createdAt: new Date()
      };

      tryLoadMessage();

      // Save permanently to MongoDB — no pruning
      if (Message) {
        try {
          const saved = await new Message(msgData).save();
          msgData._id = saved._id.toString();
        } catch (err) {
          console.error('Message save error:', err.message);
        }
      }

      io.to(user.room).emit('message', msgData);
    });

    // ── typing ────────────────────────────────────────────────
    socket.on('typing', (isTyping) => {
      socket.to(user.room).emit('typing', {
        displayName: user.displayName,
        isTyping: !!isTyping
      });
    });

    // ── delete message ────────────────────────────────────────
    socket.on('delete-message', async (msgId) => {
      tryLoadMessage();
      if (!Message || !msgId) return;
      try {
        const msg = await Message.findById(msgId);
        if (!msg) return;
        const canDelete = msg.sender.id === user.id || user.role === 'admin';
        if (!canDelete) return;
        msg.deleted = true;
        await msg.save();
        io.to(user.room).emit('message-deleted', msgId);
      } catch (err) {
        console.error('Delete error:', err.message);
      }
    });

    // ── admin wipe ────────────────────────────────────────────
    socket.on('wipe-room', async (room) => {
      if (user.role !== 'admin') return;
      tryLoadMessage();
      if (!Message) return;
      try {
        await Message.deleteMany({ room: room || user.room });
        io.to(room || user.room).emit('room-wiped', room || user.room);
      } catch (err) {
        console.error('Wipe error:', err.message);
      }
    });

    // ── disconnect ────────────────────────────────────────────
    socket.on('disconnect', () => {
      const leftRoom = user.room;
      onlineUsers.delete(socket.id);
      if (leftRoom) broadcastOnlineList(leftRoom);
    });

  });

  server.listen(PORT, () => {
    console.log(`🚀 Running on http://localhost:${PORT}`);
  });
}

startApp();

module.exports = app;
