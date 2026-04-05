/**
 * StudyNest — User Management Script
 *
 * Usage:
 *   1) Edit data/users.json
 *   2) Run: npm run setup-users
 *
 * The script reads users from data/users.json, validates them,
 * hashes passwords through the User model, and skips usernames
 * that already exist.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    throw new Error(`Missing ${path.relative(process.cwd(), USERS_FILE)}. Create it first.`);
  }

  const raw = fs.readFileSync(USERS_FILE, 'utf8').trim();
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${path.relative(process.cwd(), USERS_FILE)}: ${err.message}`);
  }

  const list = Array.isArray(parsed) ? parsed : parsed.users;
  if (!Array.isArray(list)) {
    throw new Error(`Expected an array or { users: [] } in ${path.relative(process.cwd(), USERS_FILE)}.`);
  }

  return list.map((u, index) => ({
    username: String(u.username || '').trim().toLowerCase(),
    displayName: String(u.displayName || '').trim(),
    password: String(u.password || ''),
    role: u.role === 'admin' ? 'admin' : 'user',
    avatarColor: String(u.avatarColor || '#6366f1').trim(),
    _sourceIndex: index + 1,
  }));
}

async function run() {
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/studynest';

  console.log('\n📚 StudyNest User Setup');
  console.log('Connecting to MongoDB:', MONGO_URI);

  const users = loadUsers();
  if (!users.length) {
    console.log('No users found in data/users.json');
    return;
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected\n');

  for (const u of users) {
    if (!u.username || !u.displayName || !u.password) {
      console.log(`⚠️  Skipped  : entry #${u._sourceIndex} (missing username/displayName/password)`);
      continue;
    }

    if (u.password.length < 6) {
      console.log(`⚠️  Skipped  : ${u.username} (password must be at least 6 characters)`);
      continue;
    }

    const exists = await User.findOne({ username: u.username });
    if (exists) {
      console.log(`⏭  Skipped  : ${u.username} (already exists)`);
      continue;
    }

    const user = new User({
      username: u.username,
      displayName: u.displayName,
      password: u.password,
      role: u.role,
      avatarColor: u.avatarColor,
    });

    await user.save();
    console.log(`✅ Created  : ${u.username} [${u.role}]`);
  }

  console.log('\n✨ Done! You can now log in at /secret/login');
  console.log('   Update data/users.json and run npm run setup-users again to add more users.\n');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
