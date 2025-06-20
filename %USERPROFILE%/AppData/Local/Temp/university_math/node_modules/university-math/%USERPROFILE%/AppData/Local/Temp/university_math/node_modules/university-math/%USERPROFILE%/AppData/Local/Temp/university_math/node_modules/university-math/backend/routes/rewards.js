const express = require('express');
const router = express.Router();
const Reward = require('../models/Reward');
const User = require('../models/User');
const auth = require('../middleware/auth');

// 获取用户奖励列表
router.get('/', auth, async (req, res) => {
  try {
    const { type, claimed } = req.query;
    const query = { user: req.user.id };
    
    if (type) query.type = type;
    if (claimed !== undefined) query.claimed = claimed === 'true';
    
    const rewards = await Reward.find(query)
      .sort({ createdAt: -1 })
      .populate('sourceId');
    
    res.json(rewards);
  } catch (error) {
    console.error('获取奖励列表失败:', error);
    res.status(500).json({ msg: '服务器错误' });
  }
});

// 领取奖励
router.post('/claim/:rewardId', auth, async (req, res) => {
  try {
    const reward = await Reward.findOne({
      _id: req.params.rewardId,
      user: req.user.id,
      claimed: false
    });
    
    if (!reward) {
      return res.status(404).json({ msg: '奖励不存在或已领取' });
    }
    
    reward.claimed = true;
    reward.claimedAt = new Date();
    await reward.save();
    
    res.json({ msg: '奖励领取成功！', reward });
  } catch (error) {
    console.error('领取奖励失败:', error);
    res.status(500).json({ msg: '服务器错误' });
  }
});

// 获取奖励统计
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await Reward.aggregate([
      { $match: { user: req.user.id } },
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          claimed: { $sum: { $cond: ['$claimed', 1, 0] } },
          totalValue: { $sum: '$value' }
        }
      }
    ]);
    
    res.json(stats);
  } catch (error) {
    console.error('获取奖励统计失败:', error);
    res.status(500).json({ msg: '服务器错误' });
  }
});

module.exports = router;