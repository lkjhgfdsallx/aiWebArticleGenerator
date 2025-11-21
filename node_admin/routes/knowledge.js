
/**
 * 知识库相关API路由
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const VectorStoreManager = require('../utils/vectorStoreNew');
// const logger = require('../utils/logger');

// 配置文件上传
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// 创建向量存储管理器
const vectorStoreManager = new VectorStoreManager({
  embeddingsProvider: process.env.EMBEDDING_PROVIDER || 'jina',
  embeddingsModel: process.env.EMBEDDING_MODEL || 'jina-embeddings-v3',
  vectorStorePath: path.join(__dirname, '../novels'), // 使用绝对路径
  retrievalK: parseInt(process.env.EMBEDDING_RETRIEVAL_K) || 4,
  openaiApiKey: process.env.OPENAI_API_KEY,
  jinaApiKey: process.env.JINA_API_KEY
});

// 导入知识库
router.post('/:id/import', upload.array('files'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const importedFiles = [];
    const errors = [];

    for (const file of req.files) {
      try {
        let content = '';

        // 根据文件类型处理文件
        if (file.mimetype === 'text/plain') {
          // 处理文本文件
          content = await fs.readFile(file.path, 'utf8');
        } else if (file.mimetype === 'application/pdf') {
          // 处理PDF文件
          const pdfParse = require('pdf-parse');
          const dataBuffer = await fs.readFile(file.path);
          const data = await pdfParse(dataBuffer);
          content = data.text;
        } else if (file.mimetype.includes('word') || file.mimetype.includes('document')) {
          // 处理Word文档
          const mammoth = require('mammoth');
          const result = await mammoth.extractRawText({ path: file.path });
          content = result.value;
        } else {
          console.warn(`不支持的文件类型: ${file.mimetype}`);
          // 尝试作为文本文件读取
          try {
            content = await fs.readFile(file.path, 'utf8');
          } catch (e) {
            console.error(`无法读取文件 ${file.originalname}:`, e);
            errors.push({ file: file.originalname, error: '不支持的文件类型且无法作为文本读取' });
            continue;
          }
        }

        if (!content || content.trim() === '') {
          console.warn(`文件内容为空: ${file.originalname}`);
          errors.push({ file: file.originalname, error: '文件内容为空' });
          continue;
        }

        // 添加到向量存储
        await vectorStoreManager.addDocuments(id, [content], [
          {
            type: 'knowledge',
            filename: file.originalname,
            novelId: id
          }
        ]);

        importedFiles.push(file.originalname);

        // 删除临时文件
        await fs.remove(file.path);
      } catch (fileError) {
        console.error(`处理文件 ${file.originalname} 失败:`, fileError);
        errors.push({ file: file.originalname, error: fileError.message });
      }
    }

    // 添加更详细的响应信息
    const response = {
      success: true,
      message: `成功导入 ${importedFiles.length} 个文件`,
      files: importedFiles,
      total: req.files.length
    };

    // 如果有错误，添加到响应中
    if (errors.length > 0) {
      response.errors = errors;
      response.warning = `${errors.length} 个文件处理失败`;
    }

    // 确保响应状态码为200，即使有部分失败
    res.status(200).json(response);
  } catch (error) {
    console.error('导入知识库失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 检索知识库
router.get('/:id/search', async (req, res) => {
  try {
    const { id } = req.params;
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: '缺少查询参数' });
    }

    // 记录搜索请求
    console.log(`搜索请求 - ID: ${id}, 查询: ${query}`);

    // 检查向量存储是否存在
    const storePath = path.join(__dirname, '../novels', id);
    const vectorDataPath = path.join(storePath, 'vector_data.json');

    if (!(await fs.pathExists(vectorDataPath))) {
      console.warn(`向量存储数据文件不存在: ${vectorDataPath}`);
      return res.json({ success: true, data: [], message: '知识库不存在或为空' });
    }

    // 读取向量存储数据
    const vectorData = await fs.readJson(vectorDataPath);
    if (!vectorData || !Array.isArray(vectorData.documents) || vectorData.documents.length === 0) {
      console.warn(`向量存储中没有文档: ${id}`);
      return res.json({ success: true, data: [], message: '知识库中没有文档' });
    }

    console.log(`向量存储中有 ${vectorData.documents.length} 个文档`);

    const documents = await vectorStoreManager.search(id, query);

    console.log(`搜索返回 ${documents.length} 个结果`);

    const results = documents.map(doc => ({
      content: doc.pageContent,
      metadata: doc.metadata
    }));

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('检索知识库失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 清空知识库
router.delete('/:id/clear', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await vectorStoreManager.deleteVectorStore(id);

    if (result) {
      // 重新创建空的向量存储
      await vectorStoreManager.createVectorStore(id);
      res.json({ success: true, message: '知识库已清空' });
    } else {
      res.status(404).json({ error: '知识库不存在' });
    }
  } catch (error) {
    console.error('清空知识库失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
