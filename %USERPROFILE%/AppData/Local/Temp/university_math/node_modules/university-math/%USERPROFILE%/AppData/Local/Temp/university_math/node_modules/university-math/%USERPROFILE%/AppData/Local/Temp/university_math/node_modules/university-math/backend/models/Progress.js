const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'skipped', 'reviewing'],
    required: true
  },
  isCorrect: {
    type: Boolean,
    default: false
  },
  userAnswer: {
    type: String
  },
  timeSpent: {
    type: Number,  // 以秒为单位
    default: 0
  },
  attempts: {
    type: Number,
    default: 1
  },
  lastAttemptAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String
  },
  difficulty: {
    type: Number,
    min: 1,
    max: 5
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 创建复合索引
progressSchema.index({ user: 1, question: 1 }, { unique: true });

const Progress = mongoose.model('Progress', progressSchema);

module.exports = Progress;