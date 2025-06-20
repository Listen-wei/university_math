const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  avatar: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student'
  },
  completedSurvey: {
    type: Boolean,
    default: false
  },
  surveyData: {
    grade: String,
    studyReason: String,
    preferredGuide: String,
    mathBackground: String,
    learningGoals: String,
    studyTime: String,
    difficulties: [String]
  },
  stats: {
    totalExperience: {
      type: Number,
      default: 0
    },
    totalCoins: {
      type: Number,
      default: 0
    },
    completedQuests: {
      type: Number,
      default: 0
    },
    level: {
      type: Number,
      default: 1
    }
  },
  rewards: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 密码加密中间件
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 验证密码的方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);