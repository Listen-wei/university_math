const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');

// 用户注册
router.post('/register', [
  check('username', '用户名至少需要3个字符').isLength({ min: 3 }),
  check('email', '请提供有效的邮箱').isEmail(),
  check('password', '密码至少需要6个字符').isLength({ min: 6 }),
  check('name', '请提供姓名').not().isEmpty()
], async (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return res.status(400).json({ message: errorMessages.join(', ') });
    }

    const { username, email, password, name } = req.body;

    // 检查用户名是否已存在
    let existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: '用户名已被使用' });
    }

    // 检查邮箱是否已存在
    let existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: '邮箱已被注册' });
    }

    // 创建新用户
    const user = new User({
      username,
      email,
      password,
      name
    });

    // 保存用户并处理可能的验证错误
    try {
      await user.save();
    } catch (saveError) {
      if (saveError.name === 'ValidationError') {
        const validationErrors = Object.values(saveError.errors).map(err => err.message);
        return res.status(400).json({ message: validationErrors.join(', ') });
      }
      throw saveError;
    }

    // 生成JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 用户登录
router.post('/login', [
  check('username', '请提供用户名').trim().notEmpty(),
  check('password', '请提供密码').trim().notEmpty()
], async (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('登录验证错误:', errors.array());
      const errorMessages = errors.array().map(error => error.msg);
      return res.status(400).json({ message: errorMessages.join(', ') });
    }

    const { username, password } = req.body;

    // 查找用户
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: '用户名或密码错误' });
    }

    // 验证密码
    try {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        console.log('密码验证失败:', username);
        return res.status(400).json({ message: '用户名或密码错误' });
      }
    } catch (error) {
      console.error('密码验证错误:', error);
      return res.status(500).json({ message: '服务器错误，请稍后重试' });
    }

    // 生成JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // 返回用户信息和token
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ message: '服务器错误，请稍后重试' });
  }
});

// 获取当前用户信息
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

module.exports = router;