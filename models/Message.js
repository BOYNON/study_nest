const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  room: { type: String, default: 'general' }, // 'general' or 'dm:user1:user2'
  sender: {
    id:          String,
    username:    String,
    displayName: String,
    avatarColor: String,
    role:        String,
  },
  text:     { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  linkUrl:  { type: String, default: '' },
  voiceUrl: { type: String, default: '' },
  deleted:  { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

messageSchema.index({ room: 1, createdAt: 1 });
module.exports = mongoose.model('Message', messageSchema);
