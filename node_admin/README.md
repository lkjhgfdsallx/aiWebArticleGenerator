# AI小说生成器后端

基于Node.js和Express构建的AI小说生成器后端服务，提供RESTful API接口供前端调用。

## 功能特性

- 多种大语言模型支持（OpenAI、DeepSeek、Gemini、Azure OpenAI、Ollama等）
- 向量数据库集成，实现长程上下文一致性维护
- 小说架构、章节目录和章节内容的生成
- 知识库管理和检索
- 用户认证和授权
- 完整的日志记录

## 技术栈

- Node.js
- Express.js
- OpenAI、Langchain等AI库
- JWT认证
- Winston日志

## 安装和运行

1. 安装依赖
```bash
npm install
```

2. 配置环境变量
```bash
cp .env.example .env
# 编辑.env文件，填入你的API密钥和其他配置
```

3. 启动开发服务器
```bash
npm run dev
```

4. 启动生产服务器
```bash
npm start
```

## API接口

### 认证相关
- POST `/api/user/register` - 用户注册
- POST `/api/user/login` - 用户登录

### 小说管理
- GET `/api/novel` - 获取小说列表
- GET `/api/novel/:id` - 获取小说详情
- POST `/api/novel/create` - 创建新小说
- POST `/api/novel/:id/architecture` - 生成小说架构
- POST `/api/novel/:id/blueprint` - 生成章节目录
- DELETE `/api/novel/:id` - 删除小说

### 章节管理
- GET `/api/novel/:id/chapters` - 获取章节列表
- GET `/api/novel/:id/chapters/:number` - 获取章节内容
- POST `/api/novel/:id/chapters/:number/draft` - 生成章节草稿
- POST `/api/novel/:id/chapters/:number/finalize` - 定稿章节

### 知识库管理
- POST `/api/knowledge/:id/import` - 导入知识库
- GET `/api/knowledge/:id/search` - 搜索知识库
- DELETE `/api/knowledge/:id/clear` - 清空知识库

### 配置管理
- GET `/api/config/defaults` - 获取默认配置
- POST `/api/config/test-llm` - 测试LLM配置

## 项目结构

```
node_admin/
├── app.js                 # 应用入口
├── package.json           # 依赖和脚本
├── .env.example          # 环境变量示例
├── routes/               # API路由
│   ├── novel.js
│   ├── chapter.js
│   ├── knowledge.js
│   ├── config.js
│   └── user.js
├── services/             # 业务逻辑
│   ├── novelService.js
│   └── chapterService.js
├── utils/                # 工具类
│   ├── llmAdapter.js
│   ├── vectorStore.js
│   └── logger.js
├── data/                 # 数据文件
│   └── prompts.js
├── logs/                 # 日志文件
├── novels/               # 小说数据
├── uploads/              # 上传文件
└── vectorstore/          # 向量数据库
```

## 开发指南

1. 所有API接口都应该有适当的错误处理和日志记录
2. 使用async/await处理异步操作
3. 遵循RESTful设计原则
4. 所有敏感信息（如API密钥）都应通过环境变量配置
5. 新增功能时，同时添加对应的单元测试

## 许可证

MIT
