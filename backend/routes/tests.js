const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { OpenAI } = require('openai');
const { DEEPSEEK_API_URL, DEEPSEEK_API_KEY, defaultConfig } = require('../config/deepseek');

/**
 * @route   POST api/tests/generate
 * @desc    生成数学测试题
 * @access  Private
 */
router.post('/generate', auth, async (req, res) => {
  try {
    const { type, difficulty, questionCount, topics, includeAnswers } = req.body;
    
    // 验证请求参数
    if (!type || !difficulty || !questionCount) {
      return res.status(400).json({ msg: '请提供完整的测试配置信息' });
    }
    
    // 导入配置和API密钥
    const { apiKeyConfigured } = require('../config/deepseek');
    
    // 始终优先使用DeepSeek API生成题目，只有在API密钥未配置时才使用模拟数据
    if (!apiKeyConfigured) {
      console.warn('DeepSeek API密钥未配置，直接使用模拟数据');
      return generateMockTest(req, res);
    }
    
    // 根据类型获取中文名称
    const typeMap = {
      calculus: '微积分',
      algebra: '线性代数',
      probability: '概率统计'
    };
    
    const difficultyMap = {
      easy: '简单',
      medium: '中等',
      hard: '困难'
    };
    
    // 构建提示词
    let prompt = `生成${questionCount}道${difficultyMap[difficulty]}难度的${typeMap[type]}题目`;
    
    if (topics) {
      prompt += `，主题为${topics}`;
    }
    
    if (includeAnswers) {
      prompt += '，并提供详细解答';
    }
    
    // 添加随机性要求，确保每次生成不同的题目
    const randomSeed = Math.floor(Math.random() * 10000);
    prompt += `。请确保生成的题目具有随机性和多样性，使用随机种子${randomSeed}。以JSON格式返回，每道题包含题目内容和答案。`;
    
    // 调用DeepSeek API生成题目
    try {
      // 检查API密钥是否正确配置
      if (!apiKeyConfigured) {
        console.error('错误: DeepSeek API密钥未正确配置，无法调用API');
        throw new Error('DeepSeek API密钥未正确配置');
      }

      console.log('正在调用DeepSeek API，请求URL:', DEEPSEEK_API_URL);
      console.log('请求头:', JSON.stringify({
        'Content-Type': defaultConfig.headers['Content-Type'],
        'Accept': defaultConfig.headers['Accept'],
        'Authorization': '已配置' // 不输出实际token
      }));
      
      // 添加时间戳作为请求参数，确保每次请求都不同
      const timestamp = new Date().getTime();
      console.log(`请求时间戳: ${timestamp}`);
      
      // 构建请求体，添加更多随机性参数
      const requestBody = {
        model: 'deepseek-chat',
        temperature: 1.0,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          {
            role: 'system',
            content: '你是一个专业的数学教师，擅长出各种难度的数学题目。请严格按照以下要求生成题目：\n1. 使用LaTeX格式表示所有数学公式，包括积分、极限、矩阵等特殊表达式\n2. 每道题目必须包含以下字段：\n   - question: 题目内容\n   - answer: 完整解答步骤\n   - type: 题目类型（选择、填空、计算、证明）\n   - difficulty: 难度等级（1-5）\n3. 对于不同类型的题目：\n   - 微积分：使用标准的极限、导数、积分符号\n   - 线性代数：使用标准的矩阵表示法\n   - 概率统计：包含概率分布和数理统计公式\n4. 确保JSON格式完全正确，不包含任何非法字符\n5. 答案必须包含详细的解题步骤和推导过程'
          },
          {
            role: 'user',
            content: prompt + "\n请以标准JSON格式返回，确保JSON格式正确无误，不要使用markdown代码块。返回格式必须是：{\"questions\": [{\"question\": \"题目内容\", \"answer\": \"答案内容\"}]}"
          }
        ]
      };
      
      console.log('完整请求体:', JSON.stringify(requestBody));
      
      // 添加请求超时设置和详细的错误处理
      console.log('开始发送请求到DeepSeek API...');
      
      // 设置请求超时时间为30秒
      const timeout = 30000; // 30秒
      
      // 创建OpenAI客户端实例，确保正确配置
      const openai = new OpenAI({
        baseURL: DEEPSEEK_API_URL,
        apiKey: DEEPSEEK_API_KEY,
        timeout: timeout, // 设置请求超时
        maxRetries: 3, // 设置最大重试次数
        defaultHeaders: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('OpenAI客户端配置完成，开始发送请求...');
      
      // 发送请求并获取响应
      const deepseekResponse = await openai.chat.completions.create(requestBody)
        .catch(error => {
          console.error('DeepSeek API请求失败详细信息:', error);
          // 检查是否是API密钥问题
          if (error.message && error.message.includes('API key') || 
              error.response?.status === 401) {
            console.error('API密钥验证失败，请检查环境变量DEEPSEEK_API_KEY是否正确配置');
          }
          throw error; // 重新抛出错误以便外层捕获
        });
      
      // 详细记录响应信息
      console.log('DeepSeek API响应成功获取');
      console.log('响应对象结构:', Object.keys(deepseekResponse));
      
      // 解析DeepSeek返回的内容
      if (!deepseekResponse.choices || !deepseekResponse.choices[0]) {
        console.error('响应格式异常，没有找到choices字段:', deepseekResponse);
        throw new Error('API响应格式异常，没有找到choices字段');
      }
      
      const aiResponse = deepseekResponse.choices[0].message.content;
      console.log('AI响应内容长度:', aiResponse.length);
      
      let questions = [];
      
      try {
        // 尝试直接解析JSON
        console.log('尝试解析AI响应内容...');
        let parsedData = JSON.parse(aiResponse);
        
        // 验证基本数据格式
        if (parsedData.questions && Array.isArray(parsedData.questions)) {
          questions = parsedData.questions.map(q => ({
            ...q,
            // 确保 question 和 answer 字段存在且为字符串，处理可能的换行符
            question: (q.question || '').toString().replace(/\n/g, '\n'),
            answer: (q.answer || '').toString().replace(/\n/g, '\n'),
            // 可选字段处理
            type: q.type || '未知',
            difficulty: q.difficulty || 3
          }));
          
          // 验证每个题目的必要字段
          questions.forEach((q, index) => {
            if (!q.question || !q.answer) {
              console.warn(`第${index + 1}题缺少 question 或 answer 字段`);
              // 可以选择抛出错误或提供默认值
              // throw new Error(`第${index + 1}题缺少必要字段`);
              q.question = q.question || '题目内容缺失';
              q.answer = q.answer || '答案内容缺失';
            }
          });
          console.log(`JSON解析成功，共获取 ${questions.length} 道题目`);
        } else {
          console.error('API返回的数据格式不符合预期的 {questions: [...]} 结构:', parsedData);
          throw new Error('API返回的数据格式不符合要求');
        }
        
      } catch (parseError) {
        console.error('JSON解析失败:', parseError.message);
        console.error('原始AI响应内容 (前500字符):', aiResponse.substring(0, 500));
        
        // 简单的回退机制：返回错误信息或一个默认题目
        // 不再尝试复杂的文本分割和修复
        return res.status(500).json({ 
          msg: '无法解析AI服务返回的数据格式，请稍后重试或联系管理员。',
          error: parseError.message,
          rawResponsePreview: aiResponse.substring(0, 200) // 提供部分原始响应以便调试
        });
        
        /* 
        // 移除复杂的文本处理和JSON修复逻辑
        // ... (原有的复杂 JSON 清理、修复和文本分割逻辑已删除) ...
        */
      }
      
      // 确保返回的题目数量与请求一致 (如果需要)
      if (questions.length !== questionCount) {
        console.warn(`警告：请求生成 ${questionCount} 道题目，但实际解析到 ${questions.length} 道`);
        // 可以选择截断、填充或直接返回现有题目
        // questions = questions.slice(0, questionCount);
      }

      // 返回生成的题目
      res.json({ questions });

    } catch (error) {
      console.error('调用DeepSeek API时发生错误:', error);
      // 区分API调用错误和内部逻辑错误
      if (error.response) {
        // API返回了错误状态码
        console.error('API 错误响应状态:', error.response.status);
        console.error('API 错误响应数据:', error.response.data);
        res.status(error.response.status || 500).json({ msg: `API请求失败: ${error.message}`, details: error.response.data });
      } else if (error.request) {
        // 请求已发出但没有收到响应 (例如超时)
        console.error('API 请求未收到响应:', error.request);
        res.status(504).json({ msg: `API请求超时或无响应: ${error.message}` });
      } else {
        // 设置请求时发生错误或其他内部错误
        console.error('内部错误:', error.message);
        res.status(500).json({ msg: `处理请求时发生内部错误: ${error.message}` });
      }
    }
  } catch (err) {
    console.error('生成测试题时发生未捕获的错误:', err);
    res.status(500).json({ msg: '服务器内部错误，无法生成测试题' });
  }
});

// 模拟数据生成函数 (如果需要，确保其存在并功能正常)
async function generateMockTest(req, res) {
  const { type, difficulty, questionCount, includeAnswers } = req.body;
  console.log(`使用模拟数据生成 ${questionCount} 道 ${difficulty} 难度的 ${type} 题目`);
  
  // 创建一些简单的模拟题目
  const mockQuestions = [];
  for (let i = 1; i <= questionCount; i++) {
    mockQuestions.push({
      id: `mock-${i}`,
      question: `这是第 ${i} 道模拟${type}题目 (${difficulty}难度)。问题内容示例：计算 $\int x^2 dx$。`,
      answer: includeAnswers ? `模拟答案 ${i}：$\frac{1}{3}x^3 + C$。` : '答案未包含',
      type: '计算题', // 示例类型
      difficulty: difficulty === 'easy' ? 1 : (difficulty === 'medium' ? 3 : 5) // 示例难度
    });
  }
  
  // 模拟API延迟
  await new Promise(resolve => setTimeout(resolve, 50)); 
  
  res.json({ questions: mockQuestions });
}

module.exports = router;