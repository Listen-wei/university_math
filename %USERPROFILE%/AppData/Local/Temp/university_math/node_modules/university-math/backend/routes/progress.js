const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Progress = require('../models/Progress');
const Question = require('../models/Question');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { DEEPSEEK_API_KEY, DEEPSEEK_API_URL, defaultConfig } = require('../config/deepseek');
const { OpenAI } = require('openai');

// 获取用户的学习进度
router.get('/my', auth, async (req, res) => {
  try {
    const { subject, chapter, status, page = 1, limit = 10 } = req.query;

    // 构建查询条件
    const query = { user: req.user.id };
    if (status) query.status = status;

    // 分页
    const skip = (page - 1) * limit;

    const progress = await Progress.find(query)
      .populate({
        path: 'question',
        select: 'title content type difficulty subject chapter',
        match: {
          ...(subject && { subject }),
          ...(chapter && { chapter })
        }
      })
      .sort({ lastAttemptAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // 过滤掉因populate match条件不匹配而为null的记录
    const filteredProgress = progress.filter(p => p.question !== null);

    const total = await Progress.countDocuments(query);

    res.json({
      progress: filteredProgress,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 获取学习统计数据
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await Progress.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalQuestions: { $sum: 1 },
          correctAnswers: {
            $sum: { $cond: [{ $eq: ['$isCorrect', true] }, 1, 0] }
          },
          totalAttempts: { $sum: '$attempts' },
          averageTimeSpent: { $avg: '$timeSpent' }
        }
      }
    ]);

    // 按科目统计
    const subjectStats = await Progress.aggregate([
      {
        $match: { user: req.user._id }
      },
      {
        $lookup: {
          from: 'questions',
          localField: 'question',
          foreignField: '_id',
          as: 'questionData'
        }
      },
      { $unwind: '$questionData' },
      {
        $group: {
          _id: '$questionData.subject',
          total: { $sum: 1 },
          correct: {
            $sum: { $cond: [{ $eq: ['$isCorrect', true] }, 1, 0] }
          }
        }
      }
    ]);

    // 按章节统计
    const chapterStats = await Progress.aggregate([
      {
        $match: { user: req.user._id }
      },
      {
        $lookup: {
          from: 'questions',
          localField: 'question',
          foreignField: '_id',
          as: 'questionData'
        }
      },
      { $unwind: '$questionData' },
      {
        $group: {
          _id: '$questionData.chapter',
          total: { $sum: 1 },
          correct: {
            $sum: { $cond: [{ $eq: ['$isCorrect', true] }, 1, 0] }
          },
          mastery: { 
            $avg: { 
              $cond: [
                { $eq: ['$isCorrect', true] },
                { $divide: [100, { $add: ['$attempts', 1] }] },
                0
              ]
            }
          }
        }
      },
      { $sort: { mastery: -1 } }
    ]);

    res.json({
      overall: stats[0] || {
        totalQuestions: 0,
        correctAnswers: 0,
        totalAttempts: 0,
        averageTimeSpent: 0
      },
      bySubject: subjectStats,
      byChapter: chapterStats
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 记录题目完成情况
router.post('/:questionId', [
  auth,
  check('status', '请提供有效的状态').isIn(['completed', 'skipped', 'reviewing']),
  check('isCorrect', '请提供答题结果').isBoolean(),
  check('timeSpent', '请提供有效的用时').isInt({ min: 0 }),
  check('userAnswer', '请提供答案').not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const question = await Question.findById(req.params.questionId);
    if (!question) {
      return res.status(404).json({ message: '题目不存在' });
    }

    let progress = await Progress.findOne({
      user: req.user.id,
      question: req.params.questionId
    });

    if (progress) {
      // 更新现有记录
      progress.status = req.body.status;
      progress.isCorrect = req.body.isCorrect;
      progress.userAnswer = req.body.userAnswer;
      progress.timeSpent = req.body.timeSpent;
      progress.attempts += 1;
      progress.lastAttemptAt = Date.now();
      if (req.body.notes) progress.notes = req.body.notes;
      if (req.body.difficulty) progress.difficulty = req.body.difficulty;
    } else {
      // 创建新记录
      progress = new Progress({
        user: req.user.id,
        question: req.params.questionId,
        ...req.body
      });
    }

    await progress.save();
    res.json(progress);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: '题目不存在' });
    }
    res.status(500).send('服务器错误');
  }
});

// 获取学习进度历史记录
router.get('/history', auth, async (req, res) => {
  try {
    // 获取过去30天的学习进度记录
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const progressHistory = await Progress.aggregate([
      {
        $match: {
          user: req.user._id,
          lastAttemptAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: "%Y-%m-%d", date: "$lastAttemptAt" } 
          },
          correctCount: {
            $sum: { $cond: [{ $eq: ['$isCorrect', true] }, 1, 0] }
          },
          totalCount: { $sum: 1 },
          averageAttempts: { $avg: '$attempts' }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          mastery: { 
            $multiply: [
              { $divide: ['$correctCount', { $max: ['$totalCount', 1] }] },
              100
            ]
          },
          correctCount: 1,
          totalCount: 1,
          averageAttempts: 1
        }
      },
      { $sort: { date: 1 } }
    ]);
    
    res.json(progressHistory);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 获取知识点掌握情况
router.get('/concepts', auth, async (req, res) => {
  try {
    // 聚合查询，按知识点分组统计掌握情况
    const conceptProgress = await Progress.aggregate([
      { $match: { user: req.user._id } },
      {
        $lookup: {
          from: 'questions',
          localField: 'question',
          foreignField: '_id',
          as: 'questionData'
        }
      },
      { $unwind: '$questionData' },
      { $unwind: '$questionData.tags' },
      {
        $group: {
          _id: '$questionData.tags',
          total: { $sum: 1 },
          correct: {
            $sum: { $cond: [{ $eq: ['$isCorrect', true] }, 1, 0] }
          },
          attempts: { $sum: '$attempts' },
          timeSpent: { $avg: '$timeSpent' }
        }
      },
      {
        $project: {
          _id: 0,
          concept: '$_id',
          total: 1,
          correct: 1,
          attempts: 1,
          timeSpent: 1,
          mastery: {
            $multiply: [
              { $divide: ['$correct', { $max: ['$total', 1] }] },
              100
            ]
          }
        }
      },
      { $sort: { mastery: 1 } } // 按掌握度从低到高排序，优先显示需要加强的知识点
    ]);
    
    res.json(conceptProgress);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 获取个性化学习建议
router.get('/recommendations', auth, async (req, res) => {
  try {
    // 1. 获取用户的学习进度数据
    const userProgress = await Progress.find({ user: req.user._id })
      .populate('question', 'title content type difficulty subject chapter tags')
      .lean();
    
    // 2. 分析用户的弱点知识点
    const conceptStats = {};
    userProgress.forEach(progress => {
      if (!progress.question || !progress.question.tags) return;
      
      progress.question.tags.forEach(tag => {
        if (!conceptStats[tag]) {
          conceptStats[tag] = { total: 0, correct: 0 };
        }
        conceptStats[tag].total += 1;
        if (progress.isCorrect) {
          conceptStats[tag].correct += 1;
        }
      });
    });
    
    // 计算每个知识点的掌握度
    const weakConcepts = [];
    for (const [concept, stats] of Object.entries(conceptStats)) {
      const mastery = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
      if (mastery < 70) { // 掌握度低于70%的知识点被视为弱点
        weakConcepts.push({
          concept,
          mastery,
          total: stats.total,
          correct: stats.correct
        });
      }
    }
    
    // 按掌握度排序，优先推荐掌握度最低的知识点
    weakConcepts.sort((a, b) => a.mastery - b.mastery);
    
    // 3. 使用DeepSeek API生成个性化学习建议
    let recommendations = [];
    
    if (weakConcepts.length > 0) {
      // 如果API密钥已配置，使用DeepSeek生成建议
      if (DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'your-api-key') {
        try {
          const openai = new OpenAI({
            baseURL: DEEPSEEK_API_URL,
            apiKey: DEEPSEEK_API_KEY,
            defaultHeaders: defaultConfig.headers
          });
          
          // 构建提示词
          const prompt = `
          我是一名大学生，正在学习高等数学。根据我的学习数据，我在以下知识点的掌握度较低：
          ${weakConcepts.slice(0, 3).map(c => `- ${c.concept}（掌握度：${c.mastery.toFixed(1)}%）`).join('\n')}
          
          请为我提供针对性的学习建议，包括：
          1. 这些知识点的重要性和应用场景
          2. 学习这些知识点的最佳方法和资源推荐
          3. 针对每个知识点的具体练习建议
          4. 如何将这些知识点与其他数学概念联系起来
          
          请以JSON格式返回，包含以下字段：
          - importance: 重要性说明
          - methods: 学习方法建议（数组）
          - resources: 推荐资源（数组）
          - exercises: 练习建议（数组）
          - connections: 知识点联系（数组）
          `;
          
          const response = await openai.chat.completions.create({
            model: 'deepseek-reasoner',
            temperature: 0.7,
            max_tokens: 2000,
            messages: [
              {
                role: 'system',
                content: '你是一个专业的数学教育顾问，擅长为学生提供个性化的学习建议。请根据学生的学习数据，提供针对性的建议。'
              },
              {
                role: 'user',
                content: prompt
              }
            ]
          });
          
          const aiResponse = response.choices[0].message.content;
          
          // 解析JSON响应
          try {
            const jsonMatch = aiResponse.match(/```json\n([\s\S]*)\n```/) || 
                           aiResponse.match(/```([\s\S]*)```/) || 
                           [null, aiResponse];
            
            const jsonContent = jsonMatch[1];
            recommendations = JSON.parse(jsonContent);
          } catch (parseError) {
            console.error('解析AI响应失败:', parseError);
            // 如果解析失败，提供默认建议
            recommendations = {
              importance: '这些知识点是高等数学的基础，掌握它们对于理解更复杂的概念至关重要。',
              methods: [
                '回顾基础概念和定义',
                '多做练习题巩固理解',
                '寻求同学或老师的帮助'
              ],
              resources: [
                '教材相关章节',
                '网络视频教程',
                '习题集'
              ],
              exercises: [
                '从基础题开始，逐步增加难度',
                '定期复习已完成的题目',
                '尝试不同类型的题目'
              ],
              connections: [
                '理解这些知识点如何应用于实际问题',
                '探索与其他数学概念的联系'
              ]
            };
          }
        } catch (apiError) {
          console.error('调用DeepSeek API失败:', apiError);
          // 提供默认建议
          recommendations = getDefaultRecommendations(weakConcepts);
        }
      } else {
        // API密钥未配置，使用默认建议
        recommendations = getDefaultRecommendations(weakConcepts);
      }
    } else {
      // 没有明显的弱点知识点，提供通用建议
      recommendations = {
        importance: '恭喜！你目前的知识点掌握情况良好。继续保持并挑战更高难度的内容。',
        methods: [
          '尝试更高难度的题目',
          '帮助其他同学解决问题',
          '探索知识的应用场景'
        ],
        resources: [
          '高级教材',
          '学术论文',
          '实际应用案例'
        ],
        exercises: [
          '挑战竞赛题',
          '尝试跨学科应用',
          '设计自己的数学问题'
        ],
        connections: [
          '探索数学与其他学科的联系',
          '研究数学在实际问题中的应用'
        ]
      };
    }
    
    // 4. 返回个性化建议和弱点知识点
    res.json({
      weakConcepts: weakConcepts.slice(0, 5), // 最多返回5个弱点知识点
      recommendations
    });
  } catch (err) {
    console.error('获取学习建议失败:', err);
    res.status(500).send('服务器错误');
  }
});

// 获取默认学习建议
function getDefaultRecommendations(weakConcepts) {
  // 根据弱点知识点生成默认建议
  const conceptsList = weakConcepts.slice(0, 3).map(c => c.concept).join('、');
  
  return {
    importance: `${conceptsList}是高等数学的重要概念，掌握它们对于理解更复杂的数学问题至关重要。`,
    methods: [
      '回顾基础概念和定义',
      '观看视频教程加深理解',
      '多做练习题巩固知识',
      '参与小组讨论交流想法'
    ],
    resources: [
      '教材相关章节',
      '网络视频教程（如3Blue1Brown、可汗学院）',
      '习题集和历年考题',
      '数学论坛（如Math Stack Exchange）'
    ],
    exercises: [
      '从基础题开始，逐步增加难度',
      '定期复习已完成的题目',
      '尝试不同类型的题目',
      '将知识点应用到实际问题中'
    ],
    connections: [
      '理解这些知识点如何应用于实际问题',
      '探索与其他数学概念的联系',
      '研究这些知识点在其他学科中的应用'
    ]
  };
}

// 设置学习目标
router.post('/goals', auth, async (req, res) => {
  try {
    const { targetMastery, deadline, description } = req.body;
    
    // 验证请求参数
    if (targetMastery < 0 || targetMastery > 100) {
      return res.status(400).json({ msg: '目标掌握度必须在0-100之间' });
    }
    
    // 更新用户的学习目标
    await User.findByIdAndUpdate(req.user.id, {
      learningGoal: {
        targetMastery,
        deadline: deadline || null,
        description: description || '',
        createdAt: Date.now()
      }
    });
    
    res.json({ msg: '学习目标设置成功' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 获取学习目标
router.get('/goals', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('learningGoal');
    
    if (!user || !user.learningGoal) {
      return res.json({
        goal: {
          targetMastery: 70, // 默认目标
          deadline: null,
          description: '',
          createdAt: Date.now()
        }
      });
    }
    
    res.json({ goal: user.learningGoal });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

module.exports = router;