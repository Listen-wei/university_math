import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Button,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  School,
  Upload,
  Assessment,
  EmojiEvents,
  Assignment,
  Timeline
} from '@mui/icons-material';
import { userAPI, progressAPI } from '../../api/api';

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState(null);
  const [progressData, setProgressData] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      setError('');
      
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }
        
        // 使用API模块获取数据
        const [userResponse, progressResponse] = await Promise.all([
          userAPI.getUserProfile(),
          progressAPI.getUserProgress()
        ]);
        
        setUserData(userResponse.data.user);
        setProgressData(progressResponse.data);
      } catch (err) {
        console.error('获取用户数据失败:', err);
        setError('获取用户数据失败，请重试');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [navigate]);
  
  const features = [
    {
      title: '上传题目',
      description: '拍照或文字输入您的数学问题',
      icon: <Upload fontSize="large" color="primary" />,
      path: '/upload-question'
    },
    {
      title: '学习进度',
      description: '查看您的学习掌握情况和进度',
      icon: <Assessment fontSize="large" color="primary" />,
      path: '/progress'
    },
    {
      title: '奖励中心',
      description: '达到学习目标后领取奖励',
      icon: <EmojiEvents fontSize="large" color="primary" />,
      path: '/rewards'
    },
    {
      title: '生成测试',
      description: '生成个性化测试卷巩固学习',
      icon: <Assignment fontSize="large" color="primary" />,
      path: '/generate-test'
    },
    {
      title: '学习任务',
      description: 'RPG风格的个性化学习路径，完成任务获得奖励',
      icon: <Timeline fontSize="large" color="primary" />, // ✅ Fixed: properly instantiated as JSX
      path: '/quests'
    }
  ];
  
  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          正在加载数据...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      {/* Remove the surveyCompleted check since this logic is now handled in App.js */}
      
      {/* Rest of the component remains the same */}
      {loading ? (
        <>
          <CircularProgress />
          <Typography variant="body1" sx={{ mt: 2 }}>
            正在加载数据...
          </Typography>
        </>
      ) : error ? (
        <Typography variant="body1" sx={{ mt: 2 }}>
          获取用户数据失败，请重试...
        </Typography>
      ) : (
        <>
          <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <School color="primary" sx={{ fontSize: 40, mr: 2 }} />
              <Typography variant="h4">
                {userData ? `${userData.name}，欢迎回来！` : '欢迎使用高数我帮你'}
              </Typography>
            </Box>
            
            <Typography variant="body1" paragraph>
              高数我帮你是一个智能辅导系统，旨在帮助大学生更好地学习高等数学。通过题目识别、详细解答、学习进度跟踪和奖励机制，为您提供个性化的学习体验。
            </Typography>
            
            {userData && (
              <Box sx={{ mb: 3, p: 2, bgcolor: '#f0f7ff', borderRadius: 2, border: '1px solid #bae0ff' }}>
                <Typography variant="h6" gutterBottom>
                  个人学习概览
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center', p: 1 }}>
                      <Typography variant="body2" color="text.secondary">已解决题目</Typography>
                      <Typography variant="h5">{userData.solvedQuestions || 0}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center', p: 1 }}>
                      <Typography variant="body2" color="text.secondary">学习天数</Typography>
                      <Typography variant="h5">{userData.learningDays || 0}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center', p: 1 }}>
                      <Typography variant="body2" color="text.secondary">获得奖励</Typography>
                      <Typography variant="h5">{userData.rewards || 0}</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}
            
            {progressData && (
              <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>
                  您当前的学习掌握度: {progressData.overallMastery}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {progressData.overallMastery >= 70 
                    ? '恭喜！您已达到领取奖励的标准，可以前往奖励中心领取奖励。' 
                    : `继续努力！再提高${(70 - progressData.overallMastery).toFixed(1)}%的掌握度即可获得奖励。`}
                </Typography>
                {progressData.overallMastery >= 70 && (
                  <Button 
                    variant="contained" 
                    color="primary"
                    size="small"
                    sx={{ mt: 1 }}
                    onClick={() => navigate('/rewards')}
                  >
                    前往奖励中心
                  </Button>
                )}
              </Box>
            )}
          </Paper>
          
          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            功能导航
          </Typography>
          
          <Grid container spacing={3}>
            {features.map((feature, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Card sx={{ height: '100%' }}>
                  <CardActionArea 
                    sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}
                    onClick={() => navigate(feature.path)}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                      {feature.icon}
                    </Box>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" gutterBottom>
                        {feature.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {feature.description}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
          
          {userData && userData.recentQuestions && userData.recentQuestions.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Divider sx={{ mb: 3 }} />
              <Typography variant="h5" gutterBottom>
                最近解答的题目
              </Typography>
              <Grid container spacing={2}>
                {userData.recentQuestions.map((question) => (
                  <Grid item xs={12} sm={6} md={4} key={question.id}>
                    <Card variant="outlined">
                      <CardActionArea onClick={() => navigate(`/solve-question/${question.id}`)}>
                        <CardContent>
                          <Typography variant="subtitle1" noWrap gutterBottom>
                            {question.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {question.content}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            {new Date(question.createdAt).toLocaleString()}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
          
          {userData && (
            <Box sx={{ mt: 4 }}>
              <Divider sx={{ mb: 3 }} />
              <Typography variant="h5" gutterBottom>
                学习建议
              </Typography>
              <Paper elevation={1} sx={{ p: 3, bgcolor: '#fafafa' }}>
                <Typography variant="body1" paragraph>
                  根据您的学习情况，我们为您提供以下学习建议：
                </Typography>
                <ul>
                  <li>
                    <Typography variant="body1" paragraph>
                      每天解决至少3道题目，保持学习连贯性
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body1" paragraph>
                      重点关注您掌握度较低的知识点
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body1" paragraph>
                      定期生成测试卷检验学习成果
                    </Typography>
                  </li>
                </ul>
                <Button 
                  variant="outlined" 
                  color="primary"
                  onClick={() => navigate('/progress')}
                  sx={{ mt: 2 }}
                >
                  查看详细学习报告
                </Button>
              </Paper>
            </Box>
          )}
        </>
      )}
    </Container>
  );
}

export default Dashboard;