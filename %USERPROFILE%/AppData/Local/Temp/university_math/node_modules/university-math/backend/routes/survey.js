const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');

// 提交问卷
router.post('/submit', [
  auth,
  check('grade', '请选择年级').not().isEmpty(),
  check('studyReason', '请选择学习原因').not().isEmpty(),
  check('preferredGuide', '请选择期望的引导方式').not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 更新用户问卷状态
    user.completedSurvey = true;
    user.surveyData = req.body;
    await user.save();

    res.json({ message: '问卷提交成功' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取问卷状态
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({ completed: user.completedSurvey });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取问卷数据
router.get('/data', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json(user.surveyData || {});
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;