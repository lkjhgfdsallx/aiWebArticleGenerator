/**
 * 小说相关API路由
 */
const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const NovelService = require('../services/novelService');
// const logger = require('../utils/logger');

const novelService = new NovelService();

// 创建新小说
router.post('/create', async (req, res) => {
  try {
    console.log('收到创建小说请求');
    console.log('请求体:', req.body);
    const { title, genre, topic, numChapters, wordNumber } = req.body;

    // 验证必填字段
    if (!title || !genre || !topic || !numChapters || !wordNumber) {
      return res.status(400).json({ 
        error: '缺少必填字段',
        required: ['title', 'genre', 'topic', 'numChapters', 'wordNumber']
      });
    }

    const novelData = {
      title,
      genre,
      topic,
      numChapters: parseInt(numChapters),
      wordNumber: parseInt(wordNumber)
    };

    console.log('准备调用novelService.createNovel，数据:', novelData);
    const novelInfo = await novelService.createNovel(novelData);
    console.log('小说创建成功:', novelInfo);
    res.status(201).json({ success: true, data: novelInfo });
  } catch (error) {
    console.error('创建小说失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// 生成小说架构
router.post('/:novelId/architecture', async (req, res) => {
  try {
    const { novelId } = req.params;
    const { config, userGuidance } = req.body;

    // 验证必填字段
    if (!config || !config.provider || !config.apiKey) {
      return res.status(400).json({ 
        error: '缺少LLM配置',
        required: ['config.provider', 'config.apiKey']
      });
    }

    const result = await novelService.generateNovelArchitecture(novelId, config, userGuidance || '');
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('生成小说架构失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取小说架构
router.get('/:novelId/architecture', async (req, res) => {
  try {
    const { novelId } = req.params;
    const architecture = await novelService.getArchitecture(novelId);
    
    if (!architecture) {
      return res.json({ success: true, data: { architecture: '', message: '小说架构尚未生成' } });
    }
    
    res.json({ success: true, data: { architecture } });
  } catch (error) {
    console.error('获取小说架构失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取章节目录
router.get('/:novelId/blueprint', async (req, res) => {
  try {
    const { novelId } = req.params;
    const blueprint = await novelService.getBlueprint(novelId);
    
    if (!blueprint) {
      return res.json({ success: true, data: { blueprint: '', message: '章节目录尚未生成' } });
    }
    
    res.json({ success: true, data: { blueprint } });
  } catch (error) {
    console.error('获取章节目录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 生成章节目录
router.post('/:novelId/blueprint', async (req, res) => {
  try {
    const { novelId } = req.params;
    const { config, userGuidance } = req.body;

    // 验证必填字段
    if (!config || !config.provider || !config.apiKey) {
      return res.status(400).json({ 
        error: '缺少LLM配置',
        required: ['config.provider', 'config.apiKey']
      });
    }

    const result = await novelService.generateChapterBlueprint(novelId, config, userGuidance || '');
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('生成章节目录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取小说信息
router.get('/:novelId', async (req, res) => {
  try {
    const { novelId } = req.params;
    const novelInfo = await novelService.getNovelInfo(novelId);
    res.json({ success: true, data: novelInfo });
  } catch (error) {
    console.error('获取小说信息失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取小说列表
router.get('/', async (req, res) => {
  try {
    const novels = await novelService.getNovelList();
    res.json({ success: true, data: novels });
  } catch (error) {
    console.error('获取小说列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取章节列表
router.get('/:novelId/chapters', async (req, res) => {
  try {
    const { novelId } = req.params;
    const blueprint = await novelService.getBlueprint(novelId);
    
    if (!blueprint) {
      return res.json({ success: true, data: { blueprint: '', message: '章节目录尚未生成' } });
    }
    
    res.json({ success: true, data: { blueprint } });
  } catch (error) {
    console.error('获取章节列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取角色状态
router.get('/:novelId/character-state', async (req, res) => {
  try {
    const { novelId } = req.params;
    const characterState = await novelService.getCharacterState(novelId);
    res.json({ success: true, data: { characterState } });
  } catch (error) {
    console.error('获取角色状态失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 生成角色状态
router.post('/:novelId/character-state', async (req, res) => {
  try {
    const { novelId } = req.params;
    const { config, userGuidance } = req.body;

    // 验证必填字段
    if (!config || !config.provider || !config.apiKey) {
      return res.status(400).json({
        error: '缺少LLM配置',
        required: ['config.provider', 'config.apiKey']
      });
    }

    const characterState = await novelService.generateCharacterState(novelId, config, userGuidance || '');
    res.json({ success: true, data: { characterState } });
  } catch (error) {
    console.error('生成角色状态失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取全局摘要
router.get('/:novelId/global-summary', async (req, res) => {
  try {
    const { novelId } = req.params;
    const globalSummary = await novelService.getGlobalSummary(novelId);
    res.json({ success: true, data: { globalSummary } });
  } catch (error) {
    console.error('获取全局摘要失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 生成全局摘要
router.post('/:novelId/global-summary', async (req, res) => {
  try {
    const { novelId } = req.params;
    const { config, userGuidance } = req.body;

    // 验证必填字段
    if (!config || !config.provider || !config.apiKey) {
      return res.status(400).json({
        error: '缺少LLM配置',
        required: ['config.provider', 'config.apiKey']
      });
    }

    const globalSummary = await novelService.generateGlobalSummary(novelId, config, userGuidance || '');
    res.json({ success: true, data: { globalSummary } });
  } catch (error) {
    console.error('生成全局摘要失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除小说
router.delete('/:novelId', async (req, res) => {
  try {
    const { novelId } = req.params;
    const result = await novelService.deleteNovel(novelId);

    if (result) {
      res.json({ success: true, message: '小说已删除' });
    } else {
      res.status(404).json({ error: '小说不存在' });
    }
  } catch (error) {
    console.error('删除小说失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
