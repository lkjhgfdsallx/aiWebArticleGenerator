/**
 * 配置相关API路由
 */
const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { createLLMAdapter } = require('../utils/llmAdapter');
// const logger = require('../utils/logger');

// 测试LLM配置
router.post('/test-llm', async (req, res) => {
  try {
    const { config } = req.body;

    // 验证必填字段
    if (!config || !config.provider || !config.apiKey) {
      return res.status(400).json({ 
        error: '缺少LLM配置',
        required: ['config.provider', 'config.apiKey']
      });
    }

    // 创建LLM适配器
    const llmAdapter = createLLMAdapter(config.provider, {
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens
    });
    console.log(llmAdapter);

    // 测试API调用
    const testPrompt = 'Please reply with "OK"';
    const response = await llmAdapter.invoke(testPrompt);

    if (response && response.includes('OK')) {
      res.json({ 
        success: true, 
        message: 'LLM配置测试成功',
        response: response
      });
    } else {
      res.status(400).json({ 
        error: 'LLM配置测试失败',
        response: response || '无响应'
      });
    }
  } catch (error) {
    console.error('测试LLM配置失败:', error);
    res.status(500).json({ 
      error: 'LLM配置测试出错',
      details: error.message
    });
  }
});

// 获取配置
router.get('/', (req, res) => {
  try {
    // 这里应该从某个地方获取配置，例如从文件或数据库
    // 目前返回一个默认配置作为示例
    const config = {
      llmConfigs: {
        default: {
          interfaceFormat: process.env.DEFAULT_LLM_PROVIDER || 'openai',
          apiKey: process.env.LLM_API_KEY || '',
          baseUrl: process.env.LLM_BASE_URL || '',
          modelName: process.env.DEFAULT_MODEL || 'gpt-4',
          temperature: parseFloat(process.env.DEFAULT_TEMPERATURE) || 0.7,
          maxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS) || 4096,
          timeout: parseInt(process.env.DEFAULT_TIMEOUT) || 600
        }
      },
      defaultLlmConfig: 'default',
      embedding: {
        provider: process.env.EMBEDDING_PROVIDER || 'openai',
        model: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
        retrievalK: parseInt(process.env.EMBEDDING_RETRIEVAL_K) || 4
      }
    };

    res.json({ success: true, data: config });
  } catch (error) {
    console.error('获取配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取默认配置
router.get('/defaults', (req, res) => {
  try {
    const defaults = {
      llm: {
        provider: process.env.DEFAULT_LLM_PROVIDER || 'openai',
        model: process.env.DEFAULT_MODEL || 'gpt-4',
        temperature: parseFloat(process.env.DEFAULT_TEMPERATURE) || 0.7,
        maxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS) || 4096,
        timeout: parseInt(process.env.DEFAULT_TIMEOUT) || 600
      },
      embedding: {
        provider: process.env.EMBEDDING_PROVIDER || 'openai',
        model: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
        retrievalK: parseInt(process.env.EMBEDDING_RETRIEVAL_K) || 4
      },
      novel: {
        genre: '玄幻',
        numChapters: 10,
        wordNumber: 3000
      }
    };

    res.json({ success: true, data: defaults });
  } catch (error) {
    console.error('获取默认配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
