const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['badge', 'achievement', 'item', 'title', 'experience', 'coins'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: 'EmojiEvents'
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  value: {
    type: Number,
    default: 0
  },
  claimed: {
    type: Boolean,
    default: false
  },
  claimedAt: Date,
  source: {
    type: String,
    enum: ['quest_completion', 'achievement', 'daily_bonus', 'special_event'],
    required: true
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'sourceModel'
  },
  sourceModel: {
    type: String,
    enum: ['Quest', 'Progress']
  }
}, {
  timestamps: true
});

// 索引
rewardSchema.index({ user: 1, claimed: 1 });
rewardSchema.index({ user: 1, type: 1 });

module.exports = mongoose.model('Reward', rewardSchema);