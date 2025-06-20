const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Question = require('../models/Question');
const auth = require('../middleware/auth');

// 获取题目列表
router.get('/', async (req, res) => {
  try {
    const { subject, type, difficulty, chapter, page = 1, limit = 10 } = req.query;
    
    // 构建查询条件
    const query = {};
    if (subject) query.subject = subject;
    if (type) query.type = type;
    if (difficulty) query.difficulty = Number(difficulty);
    if (chapter) query.chapter = chapter;

    // 分页
    const skip = (page - 1) * limit;

    const questions = await Question.find(query)
      .populate('createdBy', 'username name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Question.countDocuments(query);

    res.json({
      questions,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 获取单个题目
router.get('/:id', async (req, res) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('createdBy', 'username name');

    if (!question) {
      return res.status(404).json({ message: '题目不存在' });
    }

    res.json(question);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: '题目不存在' });
    }
    res.status(500).send('服务器错误');
  }
});

// 创建题目
router.post('/', [
  auth,
  check('title', '请提供题目标题').not().isEmpty(),
  check('content', '请提供题目内容').not().isEmpty(),
  check('type', '请提供题目类型').isIn(['选择题', '填空题', '计算题', '证明题']),
  check('difficulty', '请提供题目难度(1-5)').isInt({ min: 1, max: 5 }),
  check('subject', '请提供学科').isIn(['高等数学', '线性代数', '概率论', '复变函数']),
  check('chapter', '请提供章节').not().isEmpty(),
  check('answer', '请提供答案').not().isEmpty(),
  check('explanation', '请提供解析').not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const newQuestion = new Question({
      ...req.body,
      createdBy: req.user.id
    });

    const question = await newQuestion.save();
    res.json(question);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 更新题目
router.put('/:id', [
  auth,
  check('title', '请提供题目标题').optional().not().isEmpty(),
  check('content', '请提供题目内容').optional().not().isEmpty(),
  check('type', '请提供有效的题目类型').optional().isIn(['选择题', '填空题', '计算题', '证明题']),
  check('difficulty', '请提供有效的题目难度(1-5)').optional().isInt({ min: 1, max: 5 }),
  check('subject', '请提供有效的学科').optional().isIn(['高等数学', '线性代数', '概率论', '复变函数']),
  check('chapter', '请提供章节').optional().not().isEmpty(),
  check('answer', '请提供答案').optional().not().isEmpty(),
  check('explanation', '请提供解析').optional().not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: '题目不存在' });
    }

    // 检查权限
    if (question.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ message: '无权限修改此题目' });
    }

    // 更新题目
    question = await Question.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    ).populate('createdBy', 'username name');

    res.json(question);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: '题目不存在' });
    }
    res.status(500).send('服务器错误');
  }
});

// 删除题目
router.delete('/:id', auth, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: '题目不存在' });
    }

    // 检查权限
    if (question.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ message: '无权限删除此题目' });
    }

    await question.remove();
    res.json({ message: '题目已删除' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: '题目不存在' });
    }
    res.status(500).send('服务器错误');
  }
});

module.exports = router;