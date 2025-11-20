/**
 * 章节相关API路由
 */
const express = require('express');
const router = express.Router();
const ChapterService = require('../services/chapterService');
// const logger = require('../utils/logger');

const chapterService = new ChapterService();

// 生成章节草稿
router.post('/:novelId/chapters/:chapterNumber/draft', async (req, res) => {
  try {
    const { novelId, chapterNumber } = req.params;
    const { config, userGuidance } = req.body;

    // 验证必填字段
    if (!config || !config.provider || !config.apiKey) {
      return res.status(400).json({
        error: '缺少LLM配置',
        required: ['config.provider', 'config.apiKey']
      });
    }

    const result = await chapterService.generateChapterDraft(
      novelId,
      parseInt(chapterNumber),
      config,
      userGuidance || ''
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('生成章节草稿失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 定稿章节
router.post('/:novelId/chapters/:chapterNumber/finalize', async (req, res) => {
  try {
    const { novelId, chapterNumber } = req.params;
    const { config } = req.body;

    // 验证必填字段
    if (!config || !config.provider || !config.apiKey) {
      return res.status(400).json({
        error: '缺少LLM配置',
        required: ['config.provider', 'config.apiKey']
      });
    }

    const result = await chapterService.finalizeChapter(
      novelId,
      parseInt(chapterNumber),
      config
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('章节定稿失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取章节内容
router.get('/:novelId/chapters/:chapterNumber', async (req, res) => {
  try {
    const { novelId, chapterNumber } = req.params;
    const chapter = await chapterService.getChapterContent(
      novelId,
      parseInt(chapterNumber)
    );
    res.json({ success: true, data: { content: chapter.content, outline: chapter.outline, number: chapter.number } });
  } catch (error) {
    console.error('获取章节内容失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取章节列表
router.get('/:novelId/chapters', async (req, res) => {
  try {
    const { novelId } = req.params;
    const chapters = await chapterService.getChapterList(novelId);
    res.json({ success: true, data: chapters });
  } catch (error) {
    console.error('获取章节列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
