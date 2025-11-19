# AI小说生成器前端

基于Vue 3和Element Plus构建的AI小说生成器前端应用，提供直观的用户界面与后端API交互。

## 功能特性

- 现代化的响应式UI设计
- 小说管理和创作界面
- 章节编辑器（集成Monaco Editor）
- 知识库搜索和集成
- 多种LLM模型配置
- 用户认证和授权

## 技术栈

- Vue 3（组合式API）
- Vue Router 4（路由管理）
- Pinia（状态管理）
- Element Plus（UI组件库）
- Axios（HTTP请求）
- Monaco Editor（代码编辑器）
- Vite（构建工具）

## 安装和运行

1. 安装依赖
```bash
npm install
```

2. 启动开发服务器
```bash
npm run dev
```

3. 构建生产版本
```bash
npm run build
```

4. 预览生产构建
```bash
npm run preview
```

## 项目结构

```
vue_web/
├── index.html            # HTML入口
├── package.json         # 依赖和脚本
├── vite.config.js       # Vite配置
├── src/                # 源代码
│   ├── main.js         # 应用入口
│   ├── App.vue         # 根组件
│   ├── router/         # 路由配置
│   │   └── index.js
│   ├── stores/         # 状态管理
│   │   └── user.js
│   ├── views/          # 页面组件
│   │   ├── Login.vue
│   │   ├── Dashboard.vue
│   │   ├── NovelDetail.vue
│   │   ├── ChapterEditor.vue
│   │   └── Settings.vue
│   ├── utils/          # 工具函数
│   │   └── api.js
│   └── style.css       # 全局样式
└── dist/               # 构建输出
```

## 开发指南

1. 使用Vue 3组合式API编写组件
2. 使用Pinia进行状态管理
3. 遵循Element Plus设计规范
4. 使用TypeScript（可选）提高代码质量
5. 组件应有适当的错误处理和加载状态
6. 使用语义化HTML标签提高可访问性

## 部署

1. 构建生产版本
```bash
npm run build
```

2. 将dist目录部署到Web服务器

3. 配置反向代理（如果需要）
```nginx
location /api {
    proxy_pass http://localhost:3000;
}
```

## 浏览器支持

- Chrome (推荐)
- Firefox
- Safari
- Edge

## 许可证

MIT
