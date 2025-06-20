const express = require('express');
const router = express.Router();
const Quest = require('../models/Quest');
const Reward = require('../models/Reward');
const User = require('../models/User');
const Progress = require('../models/Progress');
const auth = require('../middleware/auth');
const { OpenAI } = require('openai');
const { DEEPSEEK_API_KEY, DEEPSEEK_API_URL } = require('../config/deepseek');

// 初始化OpenAI客户端
const openai = new OpenAI({
  apiKey: DEEPSEEK_API_KEY,
  baseURL: DEEPSEEK_API_URL
});

// 基于问卷数据生成任务链
router.post('/generate', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.completedSurvey) {
      return res.status(400).json({ msg: '请先完成问卷调查' });
    }

    // 检查是否已生成任务链
    const existingQuests = await Quest.find({ user: req.user.id });
    if (existingQuests.length > 0) {
      return res.json({ 
        msg: '任务链已存在', 
        quests: existingQuests 
      });
    }

    // 使用AI生成个性化任务链
    const questChain = await generateQuestChainWithAI(user.surveyData);
    
    // 保存任务链到数据库
    const savedQuests = [];
    for (let i = 0; i < questChain.length; i++) {
      const questData = {
        ...questChain[i],
        user: req.user.id,
        order: i + 1,
        status: i === 0 ? 'available' : 'locked'
      };
      
      if (i > 0) {
        questData.prerequisites = [savedQuests[i - 1]._id];
      }
      
      const quest = new Quest(questData);
      const savedQuest = await quest.save();
      savedQuests.push(savedQuest);
    }

    res.json({ 
      msg: '任务链生成成功', 
      quests: savedQuests 
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: '服务器错误' });
  }
});

// 添加新的API端点来检查用户状态
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: '用户不存在' });
    }

    const quests = await Quest.find({ user: req.user.id });
    
    res.json({
      hasCompletedSurvey: user.completedSurvey,
      hasQuestChain: quests.length > 0,
      questCount: quests.length
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: '服务器错误' });
  }
});

// 获取用户任务列表
router.get('/my', auth, async (req, res) => {
  try {
    const quests = await Quest.find({ user: req.user.id })
      .sort({ order: 1 })
      .populate('prerequisites');
    
    res.json(quests);
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({ msg: '服务器错误' });
  }
});

// 更新任务进度
router.post('/update-progress/:questId', auth, async (req, res) => {
  try {
    const quest = await Quest.findOne({ 
      _id: req.params.questId, 
      user: req.user.id 
    });
    
    if (!quest) {
      return res.status(404).json({ msg: '任务不存在' });
    }

    // 获取用户在相关章节的进度
    const userProgress = await Progress.find({
      user: req.user.id,
      // 可以根据quest的subject和chapter进一步筛选
    }).populate('question');

    // 计算任务进度
    const relevantProgress = userProgress.filter(p => 
      p.question && 
      p.question.subject === quest.subject && 
      p.question.chapter === quest.chapter
    );

    const completedQuestions = relevantProgress.filter(p => p.status === 'completed').length;
    const correctAnswers = relevantProgress.filter(p => p.isCorrect).length;
    const accuracy = completedQuestions > 0 ? (correctAnswers / completedQuestions) * 100 : 0;

    // 更新任务进度
    quest.progress.questionsCompleted = completedQuestions;
    quest.progress.currentAccuracy = accuracy;

    if (!quest.progress.startedAt && completedQuestions > 0) {
      quest.progress.startedAt = new Date();
      quest.status = 'in_progress';
    }

    // 检查任务是否完成
    if (completedQuestions >= quest.requirements.questionsToComplete && 
        accuracy >= quest.requirements.minAccuracy) {
      quest.status = 'completed';
      quest.progress.completedAt = new Date();
      
      // 发放奖励
      await grantQuestRewards(req.user.id, quest);
      
      // 解锁下一个任务
      await unlockNextQuest(req.user.id, quest.order);
    }

    await quest.save();
    res.json(quest);
  } catch (error) {
    console.error('更新任务进度失败:', error);
    res.status(500).json({ msg: '服务器错误' });
  }
});

// AI生成任务链函数
async function generateQuestChainWithAI(surveyData) {
  const prompt = `
基于以下用户问卷数据，生成一个包含5-8个主线任务的RPG风格学习路径：

用户信息：
- 年级：${surveyData.grade}
- 学习原因：${surveyData.studyReason}
- 期望引导方式：${surveyData.preferredGuide}
- 数学基础：${surveyData.mathBackground || '未知'}
- 学习目标：${surveyData.learningGoals || '未知'}

请严格按照以下JSON格式返回，不要包含任何其他文本：
[
  {
    "title": "任务标题（要有RPG风格）",
    "description": "详细描述",
    "difficulty": "beginner/intermediate/advanced",
    "subject": "数学科目",
    "chapter": "具体章节",
    "requirements": {"questionsToComplete": 数量, "minAccuracy": 准确率, "timeLimit": 时间限制},
    "rewards": {"experience": 经验值, "coins": 金币数, "badges": ["徽章名称"]},
    "isMainQuest": true
  }
]

确保任务难度递进，内容连贯。只返回JSON数组，不要包含任何解释文字。
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });

    const questChainText = response.choices[0].message.content;
    // 尝试解析JSON，如果失败则使用默认任务链
    try {
      // 清理AI响应，提取JSON部分
      let cleanedText = questChainText.trim();
      
      // 尝试提取JSON数组或对象
      const jsonMatch = cleanedText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      
      const parsedQuests = JSON.parse(cleanedText);
      
      // 验证解析结果的结构
      if (Array.isArray(parsedQuests) && parsedQuests.length > 0) {
        return parsedQuests;
      } else {
        throw new Error('解析的JSON结构不正确');
      }
    } catch (parseError) {
      console.warn('AI返回的JSON格式有误，使用默认任务链:', parseError.message);
      console.log('AI响应内容:', questChainText);
      console.log('尝试解析JSON...');
      return getDefaultQuestChain(surveyData);
    }
  } catch (error) {
    console.error('AI生成任务链失败:', error);
    return getDefaultQuestChain(surveyData);
  }
}

// 默认任务链
function getDefaultQuestChain(surveyData) {
  const difficulty = surveyData.mathBackground === 'advanced' ? 'advanced' : 
                    surveyData.mathBackground === 'intermediate' ? 'intermediate' : 'beginner';
  
  return [
    {
      title: "数学基础探索之旅",
      description: "开始您的数学学习冒险，掌握基础概念和运算技巧。",
      difficulty: 'beginner',
      subject: "高等数学",
      chapter: "函数与极限",
      requirements: { questionsToComplete: 5, minAccuracy: 70, timeLimit: 48 },
      rewards: { experience: 100, coins: 50, badges: ["数学新手"] },
      isMainQuest: true
    },
    {
      title: "极限挑战任务",
      description: "深入理解极限概念，掌握极限的计算方法。",
      difficulty: difficulty,
      subject: "高等数学",
      chapter: "极限与连续",
      requirements: { questionsToComplete: 8, minAccuracy: 75, timeLimit: 72 },
      rewards: { experience: 150, coins: 75, badges: ["极限大师"] },
      isMainQuest: true
    },
    {
      title: "导数征服之路",
      description: "学习导数的定义和计算，理解导数的几何意义。",
      difficulty: difficulty,
      subject: "高等数学",
      chapter: "导数与微分",
      requirements: { questionsToComplete: 10, minAccuracy: 80, timeLimit: 96 },
      rewards: { experience: 200, coins: 100, badges: ["导数专家"] },
      isMainQuest: true
    },
    {
      title: "积分探险任务",
      description: "掌握不定积分和定积分的计算方法。",
      difficulty: difficulty,
      subject: "高等数学",
      chapter: "积分学",
      requirements: { questionsToComplete: 12, minAccuracy: 80, timeLimit: 120 },
      rewards: { experience: 250, coins: 125, badges: ["积分勇士"] },
      isMainQuest: true
    },
    {
      title: "微积分终极试炼",
      description: "综合运用微积分知识解决复杂问题，成为真正的数学英雄！",
      difficulty: 'advanced',
      subject: "高等数学",
      chapter: "微积分应用",
      requirements: { questionsToComplete: 15, minAccuracy: 85, timeLimit: 168 },
      rewards: { experience: 500, coins: 250, badges: ["微积分大师", "数学英雄"] },
      isMainQuest: true
    }
  ];
}

// 发放任务奖励
async function grantQuestRewards(userId, quest) {
  const rewards = [];
  
  // 经验值奖励
  if (quest.rewards.experience > 0) {
    rewards.push(new Reward({
      user: userId,
      type: 'experience',
      name: `经验值 +${quest.rewards.experience}`,
      description: `完成任务"${quest.title}"获得的经验值奖励`,
      value: quest.rewards.experience,
      source: 'quest_completion',
      sourceId: quest._id,
      sourceModel: 'Quest'
    }));
  }
  
  // 金币奖励
  if (quest.rewards.coins > 0) {
    rewards.push(new Reward({
      user: userId,
      type: 'coins',
      name: `金币 +${quest.rewards.coins}`,
      description: `完成任务"${quest.title}"获得的金币奖励`,
      value: quest.rewards.coins,
      source: 'quest_completion',
      sourceId: quest._id,
      sourceModel: 'Quest'
    }));
  }
  
  // 徽章奖励
  for (const badge of quest.rewards.badges) {
    rewards.push(new Reward({
      user: userId,
      type: 'badge',
      name: badge,
      description: `完成任务"${quest.title}"获得的特殊徽章`,
      rarity: 'rare',
      source: 'quest_completion',
      sourceId: quest._id,
      sourceModel: 'Quest'
    }));
  }
  
  // 保存所有奖励
  await Reward.insertMany(rewards);
  
  // 更新用户统计
  await User.findByIdAndUpdate(userId, {
    $inc: {
      'stats.totalExperience': quest.rewards.experience,
      'stats.totalCoins': quest.rewards.coins,
      'stats.completedQuests': 1
    }
  });
}

// 解锁下一个任务
async function unlockNextQuest(userId, currentOrder) {
  const nextQuest = await Quest.findOne({
    user: userId,
    order: currentOrder + 1,
    status: 'locked'
  });
  
  if (nextQuest) {
    nextQuest.status = 'available';
    await nextQuest.save();
  }
}

// 检查是否完成所有主线任务
router.get('/check-completion', auth, async (req, res) => {
  try {
    const allQuests = await Quest.find({ 
      user: req.user.id, 
      isMainQuest: true 
    });
    
    const completedQuests = allQuests.filter(q => q.status === 'completed');
    const isAllCompleted = allQuests.length > 0 && completedQuests.length === allQuests.length;
    
    if (isAllCompleted) {
      // 发放终极奖励
      const finalReward = new Reward({
        user: req.user.id,
        type: 'achievement',
        name: '学习大师',
        description: '恭喜您完成了所有主线学习任务！您已成为真正的数学大师！',
        rarity: 'legendary',
        value: 1000,
        source: 'special_event'
      });
      
      await finalReward.save();
      
      res.json({ 
        completed: true, 
        message: '🎉 恭喜您完成了所有主线任务！您已成为数学大师！',
        finalReward 
      });
    } else {
      res.json({ 
        completed: false, 
        progress: `${completedQuests.length}/${allQuests.length}`,
        nextQuest: allQuests.find(q => q.status === 'available' || q.status === 'in_progress')
      });
    }
  } catch (error) {
    console.error('检查任务完成状态失败:', error);
    res.status(500).json({ msg: '服务器错误' });
  }
});

module.exports = router;