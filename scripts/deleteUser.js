require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const username = process.argv[2];

if (!username) {
  console.error('Usage: node scripts/deleteUser.js <username>');
  process.exit(1);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/studynest');
  const result = await User.deleteOne({ username: username.toLowerCase() });
  if (result.deletedCount === 0) {
    console.log(`❌ User "${username}" not found.`);
  } else {
    console.log(`✅ User "${username}" deleted.`);
  }
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });