const mongoose = require('mongoose');

const questSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['main', 'side', 'daily'],
    default: 'main'
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  chapter: {
    type: String,
    required: true
  },
  requirements: {
    questionsToComplete: {
      type: Number,
      default: 5
    },
    minAccuracy: {
      type: Number,
      default: 70
    },
    timeLimit: {
      type: Number, // 小时
      default: 24
    }
  },
  rewards: {
    experience: {
      type: Number,
      default: 100
    },
    coins: {
      type: Number,
      default: 50
    },
    badges: [{
      type: String
    }]
  },
  status: {
    type: String,
    enum: ['locked', 'available', 'in_progress', 'completed', 'failed'],
    default: 'locked'
  },
  progress: {
    questionsCompleted: {
      type: Number,
      default: 0
    },
    currentAccuracy: {
      type: Number,
      default: 0
    },
    startedAt: Date,
    completedAt: Date
  },
  order: {
    type: Number,
    required: true
  },
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quest'
  }],
  isMainQuest: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// 索引
questSchema.index({ user: 1, order: 1 });
questSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Quest', questSchema);