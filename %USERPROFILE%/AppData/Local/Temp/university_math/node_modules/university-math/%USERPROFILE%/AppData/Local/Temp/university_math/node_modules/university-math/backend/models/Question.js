const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['选择题', '填空题', '计算题', '证明题'],
    required: true
  },
  difficulty: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  subject: {
    type: String,
    enum: ['高等数学', '线性代数', '概率论', '复变函数'],
    required: true
  },
  chapter: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  explanation: {
    type: String,
    required: true
  },
  options: [{
    type: String
  }],
  tags: [{
    type: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 更新时间中间件
questionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;