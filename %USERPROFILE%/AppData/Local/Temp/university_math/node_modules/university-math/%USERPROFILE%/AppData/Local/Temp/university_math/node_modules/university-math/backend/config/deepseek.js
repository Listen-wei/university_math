const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'your-api-key';
const DEEPSEEK_API_URL = 'https://api.deepseek.com';

// 验证API密钥是否已配置
if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'your-api-key') {
  console.error('错误: DeepSeek API密钥未正确配置，API调用将会失败');
  console.error('请在.env文件中设置有效的DEEPSEEK_API_KEY环境变量');
} else {
  console.log('DeepSeek API密钥已成功加载');
}

// 记录API配置状态
const apiKeyConfigured = process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'your-api-key';
console.log('DeepSeek API配置已加载，API URL:', DEEPSEEK_API_URL);
console.log('DeepSeek API密钥状态:', apiKeyConfigured ? '已配置' : '未配置');

// 验证API密钥格式
function isValidApiKey(key) {
  return typeof key === 'string' && key.length > 10 && key !== 'your-api-key';
}

// 导出配置，包括API密钥状态
module.exports = {
  DEEPSEEK_API_KEY,
  DEEPSEEK_API_URL,
  apiKeyConfigured,
  isValidApiKey,
  defaultConfig: {
    model: 'deepseek-chat',
    temperature: 0.7,
    max_tokens: 2000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Accept': 'application/json'
    }
  }
};