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

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const onlineUsers = new Map();
const rateLimits  = new Map();
const MAX_CHAT_MESSAGES = Math.max(100, Number(process.env.MAX_CHAT_MESSAGES || 1000));

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

async function buildSessionStore() {
  if (!process.env.MONGODB_URI) return undefined;
  try {
    const mongoose       = require('mongoose');
    const MongoStore = require("connect-mongo");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
    return MongoStore.create({ mongoUrl:process.env.MONGODB_URI, dbName:'studynest', ttl:7200, touchAfter:60 });
  } catch(err) {
    console.warn('⚠️  MongoDB unavailable – memory sessions only. Error:', err.message);
    return undefined;
  }
}

async function startApp() {
  const store = await buildSessionStore();

  const sessionMiddleware = session({
    name:'studynest.sid',
    secret: process.env.SESSION_SECRET || 'sn-dev-secret-CHANGE-IN-PROD',
    resave:false, saveUninitialized:false, store,
    cookie:{ httpOnly:true, secure:process.env.NODE_ENV==='production', maxAge:7200000, sameSite:'lax' },
  });

  app.use(sessionMiddleware);
  io.use((socket, next) => sessionMiddleware(socket.request, socket.request.res||{}, next));

  const { attachUser } = require('./middleware/auth');
  app.use(attachUser);

  app.use('/',       require('./routes/index'));
  app.use('/class',  require('./routes/class'));
  app.use('/api',    require('./routes/api'));
  app.use('/secret', require('./routes/secret')(io, onlineUsers));

  app.use((_req,res) => res.status(404).render('404',{title:'404 – Not Found'}));

  // ── Socket.io ──────────────────────────────────────────────────
  let Message = null;
  function tryLoadMessage() {
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState===1 && !Message) Message = require('./models/Message');
    } catch {}
  }

  function broadcastOnlineList() {
    const list = [...onlineUsers.values()].map(u=>({
      id:u.id, displayName:u.displayName, avatarColor:u.avatarColor, role:u.role, room:u.room
    }));
    io.emit('online-list', list);
  }

  async function pruneOldMessages(room = null) {
    tryLoadMessage();
    if (!Message) return;

    const filter = room ? { room } : {};
    const count = await Message.countDocuments(filter);
    if (count <= MAX_CHAT_MESSAGES) return;

    const excess = count - MAX_CHAT_MESSAGES;
    const oldest = await Message.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .limit(excess)
      .select({ _id: 1 })
      .lean();

    if (!oldest.length) return;
    await Message.deleteMany({ _id: { $in: oldest.map(m => m._id) } });
  }

  async function sendHistory(socket, room) {
    tryLoadMessage();
    if (!Message) { socket.emit('history', []); return; }
    try {
      const msgs = await Message.find({room,deleted:false}).sort({createdAt:-1}).limit(80).lean();
      socket.emit('history', msgs.reverse());
    } catch { socket.emit('history',[]); }
  }

  io.on('connection', (socket) => {
    const sess = socket.request.session;
    if (!sess?.userId) { socket.disconnect(true); return; }

    const user = {
      id:          sess.userId,
      username:    sess.username,
      displayName: sess.displayName,
      avatarColor: sess.avatarColor,
      role:        sess.role,
      room:        'general',
    };
    onlineUsers.set(socket.id, user);
    socket.join('general');
    broadcastOnlineList();
    sendHistory(socket, 'general');

    socket.on('join-room', async(room) => {
      if (!room || typeof room!=='string') return;
      if (room!=='general' && !isDMRoom(room, user.id)) return;
      socket.leave(user.room);
      user.room = room;
      onlineUsers.set(socket.id, user);
      socket.join(room);
      await sendHistory(socket, room);
    });

    socket.on('message', async(data) => {
      if (!checkRateLimit(user.id)) { socket.emit('rate-limited','Too fast!'); return; }
      const text     = (data.text||'').toString().slice(0,2000).trim();
      const imageUrl = (data.imageUrl||'').toString().slice(0,5000);
      const linkUrl  = (data.linkUrl||'').toString().slice(0,500).trim();
      const voiceUrl = (data.voiceUrl||'').toString().slice(0,5000).trim();
      if (!text && !imageUrl && !linkUrl && !voiceUrl) return;

      const room = user.room||'general';
      const msgData = {
        room,
        sender:{ id:user.id, username:user.username, displayName:user.displayName, avatarColor:user.avatarColor, role:user.role },
        text, imageUrl, linkUrl, voiceUrl,
        createdAt: new Date(),
      };
      tryLoadMessage();
      if (Message) {
        try { const s=await new Message(msgData).save(); msgData._id=s._id.toString(); await pruneOldMessages(); } catch {}
      } else { msgData._id = Date.now().toString(); }
      io.to(room).emit('message', msgData);
    });

    socket.on('delete-message', async(msgId) => {
      tryLoadMessage();
      if (!Message) return;
      try {
        const msg = await Message.findById(msgId);
        if (!msg) return;
        if (user.role!=='admin' && msg.sender.id!==user.id) return;
        msg.deleted=true; await msg.save();
        io.to(msg.room).emit('message-deleted', msgId);
      } catch {}
    });

    socket.on('admin-wipe', async(room) => {
      if (user.role!=='admin') return;
      tryLoadMessage();
      if (!Message) return;
      try { await Message.updateMany({room},{deleted:true}); io.to(room).emit('room-wiped',room); } catch {}
    });

    socket.on('typing', (isTyping) => {
      socket.to(user.room).emit('typing',{displayName:user.displayName,isTyping});
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(socket.id);
      broadcastOnlineList();
    });
  });

  server.listen(PORT, () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📚  StudyNest running at http://localhost:' + PORT);
    console.log('    Chat entry: /secret/enter');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  });
}

startApp();
module.exports = app;
