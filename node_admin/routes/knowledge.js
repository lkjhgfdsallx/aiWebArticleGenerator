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
  embeddingsProvider: process.env.EMBEDDING_PROVIDER || 'openai',
  embeddingsModel: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
  vectorStorePath: process.env.VECTOR_DB_PATH || './vectorstore',
  retrievalK: parseInt(process.env.EMBEDDING_RETRIEVAL_K) || 4,
  openaiApiKey: process.env.OPENAI_API_KEY
});

// 导入知识库
router.post('/:novelId/import', upload.array('files'), async (req, res) => {
  try {
    const { novelId } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const importedFiles = [];

    for (const file of req.files) {
      try {
        // 读取文件内容
        const content = await fs.readFile(file.path, 'utf8');

        // 添加到向量存储
        await vectorStoreManager.addDocuments(novelId, [content], [
          { 
            type: 'knowledge', 
            filename: file.originalname,
            novelId: novelId
          }
        ]);

        importedFiles.push(file.originalname);

        // 删除临时文件
        await fs.remove(file.path);
      } catch (fileError) {
        console.error(`处理文件 ${file.originalname} 失败:`, fileError);
      }
    }

    res.json({ 
      success: true, 
      message: `成功导入 ${importedFiles.length} 个文件`,
      files: importedFiles
    });
  } catch (error) {
    console.error('导入知识库失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 检索知识库
router.get('/:novelId/search', async (req, res) => {
  try {
    const { novelId } = req.params;
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: '缺少查询参数' });
    }

    const documents = await vectorStoreManager.search(novelId, query);

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
router.delete('/:novelId/clear', async (req, res) => {
  try {
    const { novelId } = req.params;

    const result = await vectorStoreManager.deleteVectorStore(novelId);

    if (result) {
      // 重新创建空的向量存储
      await vectorStoreManager.createVectorStore(novelId);
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
