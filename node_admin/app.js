const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// 导入路由
const configRouter = require('./routes/config');
const novelRouter = require('./routes/novel');
const chapterRouter = require('./routes/chapter');
const knowledgeRouter = require('./routes/knowledge');
const userRouter = require('./routes/user');

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 路由
app.use('/api/config', configRouter);
app.use('/api/novel', novelRouter);
app.use('/api/novel', chapterRouter);
app.use('/api/novel', knowledgeRouter);
app.use('/api/user', userRouter);

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'AI Novel Generator API is running' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('请求错误:', err.message);
  console.error(err.stack);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
