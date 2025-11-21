/**
 * 章节生成服务
 * 负责章节内容的生成、定稿和状态更新
 */
const fs = require('fs-extra');
const path = require('path');
const { createLLMAdapter } = require('../utils/llmAdapter');
const VectorStoreManager = require('../utils/vectorStoreNew');
// const logger = require('../utils/logger');
const prompts = require('../data/prompts');

class ChapterService {
  constructor() {
    this.novelsPath = process.env.NOVELS_PATH || './novels';
    this.vectorStoreManager = new VectorStoreManager({
      embeddingsProvider: process.env.EMBEDDING_PROVIDER || 'openai',
      embeddingsModel: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
      vectorStorePath: path.join(__dirname, '../novels'), // 使用与knowledge.js相同的路径
      retrievalK: parseInt(process.env.EMBEDDING_RETRIEVAL_K) || 4,
      openaiApiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * 生成章节草稿
   * @param {string} novelId - 小说ID
   * @param {number} chapterNumber - 章节号
   * @param {object} config - LLM配置
   * @param {string} userGuidance - 用户指导
   * @returns {object} - 生成结果
   */
  async generateChapterDraft(novelId, chapterNumber, config, userGuidance = '') {
    try {
      const novelPath = path.join(this.novelsPath, novelId);
      const chaptersPath = path.join(novelPath, 'chapters');

      // 检查必要文件
      const architectureFile = path.join(novelPath, 'Novel_architecture.txt');
      const blueprintFile = path.join(novelPath, 'Novel_directory.txt');
      const characterStateFile = path.join(novelPath, 'character_state.txt');
      const globalSummaryFile = path.join(novelPath, 'global_summary.txt');

      if (!(await fs.pathExists(architectureFile)) || 
          !(await fs.pathExists(blueprintFile))) {
        throw new Error('请先生成小说架构和章节目录');
      }

      // 读取必要文件
      const architecture = await fs.readFile(architectureFile, 'utf8');
      const blueprint = await fs.readFile(blueprintFile, 'utf8');
      let characterState = '';
      let globalSummary = '';

      if (await fs.pathExists(characterStateFile)) {
        characterState = await fs.readFile(characterStateFile, 'utf8');
      }

      if (await fs.pathExists(globalSummaryFile)) {
        globalSummary = await fs.readFile(globalSummaryFile, 'utf8');
      }

      // 解析章节信息
      const chapterInfo = this.parseChapterInfo(blueprint, chapterNumber);

      // 创建LLM适配器
      const llmAdapter = createLLMAdapter(config.provider, {
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens
      });

      // 创建默认的chapterParams对象
      const chapterParams = {
        wordNumber: 3000,
        charactersInvolved: '',
        keyItems: '',
        sceneLocation: '',
        timeConstraint: '',
        userGuidance: userGuidance || ''
      };

      // 如果是第一章，使用第一章提示词
      let prompt;
      if (chapterNumber === 1) {
        prompt = prompts.firstChapterDraftPrompt
          .replace('{novel_number}', chapterNumber)
          .replace('{chapter_title}', chapterInfo.title)
          .replace('{chapter_role}', chapterInfo.role)
          .replace('{chapter_purpose}', chapterInfo.purpose)
          .replace('{suspense_level}', chapterInfo.suspenseLevel)
          .replace('{foreshadowing}', chapterInfo.foreshadowing)
          .replace('{plot_twist_level}', chapterInfo.plotTwistLevel)
          .replace('{chapter_summary}', chapterInfo.summary)
          .replace('{word_number}', chapterParams.wordNumber || 3000)
          .replace('{characters_involved}', chapterParams.charactersInvolved || '')
          .replace('{key_items}', chapterParams.keyItems || '')
          .replace('{scene_location}', chapterParams.sceneLocation || '')
          .replace('{time_constraint}', chapterParams.timeConstraint || '')
          .replace('{user_guidance}', userGuidance || chapterParams.userGuidance || '')
          .replace('{novel_setting}', architecture);
      } else {
        // 获取前几章内容
        const recentChapters = await this.getRecentChapters(chaptersPath, chapterNumber, 3);
        const previousChapter = recentChapters.length > 0 ? recentChapters[recentChapters.length - 1] : '';

        // 生成章节摘要
        const chapterSummary = await this.generateChapterSummary(
          llmAdapter, 
          recentChapters, 
          chapterInfo
        );

        // 检索相关知识
        const relevantContext = await this.getRelevantKnowledge(
          novelId, 
          chapterInfo, 
          chapterParams
        );

        // 获取下一章信息
        const nextChapterInfo = this.parseChapterInfo(blueprint, chapterNumber + 1);

        prompt = prompts.nextChapterDraftPrompt
          .replace('{global_summary}', globalSummary)
          .replace('{previous_chapter_excerpt}', previousChapter.slice(-800))
          .replace('{user_guidance}', userGuidance || chapterParams.userGuidance || '')
          .replace('{character_state}', characterState)
          .replace('{short_summary}', chapterSummary)
          .replace('{novel_number}', chapterNumber)
          .replace('{chapter_title}', chapterInfo.title)
          .replace('{chapter_role}', chapterInfo.role)
          .replace('{chapter_purpose}', chapterInfo.purpose)
          .replace('{suspense_level}', chapterInfo.suspenseLevel)
          .replace('{foreshadowing}', chapterInfo.foreshadowing)
          .replace('{plot_twist_level}', chapterInfo.plotTwistLevel)
          .replace('{chapter_summary}', chapterInfo.summary)
          .replace('{word_number}', chapterParams.wordNumber || 3000)
          .replace('{characters_involved}', chapterParams.charactersInvolved || '')
          .replace('{key_items}', chapterParams.keyItems || '')
          .replace('{scene_location}', chapterParams.sceneLocation || '')
          .replace('{time_constraint}', chapterParams.timeConstraint || '')
          .replace('{next_chapter_number}', chapterNumber + 1)
          .replace('{next_chapter_title}', nextChapterInfo.title)
          .replace('{next_chapter_role}', nextChapterInfo.role)
          .replace('{next_chapter_purpose}', nextChapterInfo.purpose)
          .replace('{next_chapter_suspense_level}', nextChapterInfo.suspenseLevel)
          .replace('{next_chapter_foreshadowing}', nextChapterInfo.foreshadowing)
          .replace('{next_chapter_plot_twist_level}', nextChapterInfo.plotTwistLevel)
          .replace('{next_chapter_summary}', nextChapterInfo.summary)
          .replace('{filtered_context}', relevantContext);
      }

      // 生成章节内容
      console.info(`生成章节草稿 - 小说ID: ${novelId}, 章节: ${chapterNumber}`);
      const chapterContent = await llmAdapter.invoke(prompt);

      // 保存章节草稿
      const chapterFile = path.join(chaptersPath, `chapter_${chapterNumber}.txt`);
      await fs.writeFile(chapterFile, chapterContent);

      // 保存章节大纲
      const outlineFile = path.join(chaptersPath, `outline_${chapterNumber}.txt`);
      const outline = `第${chapterNumber}章《${chapterInfo.title}》\n本章定位：${chapterInfo.role}\n核心作用：${chapterInfo.purpose}\n悬念密度：${chapterInfo.suspenseLevel}\n伏笔操作：${chapterInfo.foreshadowing}\n认知颠覆：${chapterInfo.plotTwistLevel}\n本章简述：${chapterInfo.summary}`;
      await fs.writeFile(outlineFile, outline);

      console.info(`章节草稿生成完成 - 小说ID: ${novelId}, 章节: ${chapterNumber}`);
      return { 
        success: true, 
        content: chapterContent,
        outline: outline
      };
    } catch (error) {
      console.error('生成章节草稿失败:', error);
      throw error;
    }
  }

  /**
   * 定稿章节
   * @param {string} novelId - 小说ID
   * @param {number} chapterNumber - 章节号
   * @param {object} config - LLM配置
   * @returns {object} - 定稿结果
   */
  async finalizeChapter(novelId, chapterNumber, config) {
    try {
      const novelPath = path.join(this.novelsPath, novelId);
      const chaptersPath = path.join(novelPath, 'chapters');

      // 检查章节文件是否存在
      const chapterFile = path.join(chaptersPath, `chapter_${chapterNumber}.txt`);
      if (!(await fs.pathExists(chapterFile))) {
        throw new Error('章节草稿不存在，请先生成草稿');
      }

      // 读取章节内容
      const chapterContent = await fs.readFile(chapterFile, 'utf8');

      // 创建LLM适配器
      const llmAdapter = createLLMAdapter(config.provider, {
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens
      });

      // 获取小说架构和章节目录
      const architectureFile = path.join(novelPath, 'Novel_architecture.txt');
      const blueprintFile = path.join(novelPath, 'Novel_directory.txt');
      
      let architecture = '';
      let blueprint = '';
      
      if (await fs.pathExists(architectureFile)) {
        architecture = await fs.readFile(architectureFile, 'utf8');
      }
      
      if (await fs.pathExists(blueprintFile)) {
        blueprint = await fs.readFile(blueprintFile, 'utf8');
      }

      // 解析当前章节信息
      const chapterInfo = this.parseChapterInfo(blueprint, chapterNumber);

      // 获取前几章内容
      const recentChapters = await this.getRecentChapters(chaptersPath, chapterNumber, 3);
      const previousChapter = recentChapters.length > 0 ? recentChapters[recentChapters.length - 1] : '';

      // 生成章节优化提示词
      const optimizePrompt = `请优化以下章节内容，确保其符合小说设定和章节目录要求：

章节信息：
第${chapterNumber}章《${chapterInfo.title}》
本章定位：${chapterInfo.role}
核心作用：${chapterInfo.purpose}
悬念密度：${chapterInfo.suspenseLevel}
伏笔操作：${chapterInfo.foreshadowing}
认知颠覆：${chapterInfo.plotTwistLevel}
本章简述：${chapterInfo.summary}

小说设定：
${architecture}

前一章结尾（供参考）：
${previousChapter.slice(-800)}

当前章节内容：
${chapterContent}

请优化以上章节内容，要求：
1. 保持与小说设定的一致性
2. 确保符合章节目录中定义的定位、作用和悬念密度
3. 保持与前一章的连贯性
4. 优化文笔，增强表现力和可读性
5. 保持核心情节不变，但可以调整细节描写
6. 确保字数符合要求

仅返回优化后的章节正文文本，不要使用markdown格式，不要添加解释。`;

      // 优化章节内容
      console.info(`优化章节内容 - 小说ID: ${novelId}, 章节: ${chapterNumber}`);
      const optimizedContent = await llmAdapter.invoke(optimizePrompt);

      // 保存优化后的章节内容
      await fs.writeFile(chapterFile, optimizedContent);

      // 更新全局摘要
      const globalSummaryFile = path.join(novelPath, 'global_summary.txt');
      let globalSummary = '';

      if (await fs.pathExists(globalSummaryFile)) {
        globalSummary = await fs.readFile(globalSummaryFile, 'utf8');
      }

      const summaryPrompt = prompts.summaryPrompt
        .replace('{chapter_text}', optimizedContent)
        .replace('{global_summary}', globalSummary);

      const newGlobalSummary = await llmAdapter.invoke(summaryPrompt);
      await fs.writeFile(globalSummaryFile, newGlobalSummary);

      // 更新角色状态
      const characterStateFile = path.join(novelPath, 'character_state.txt');
      let characterState = '';

      if (await fs.pathExists(characterStateFile)) {
        characterState = await fs.readFile(characterStateFile, 'utf8');
      }

      const characterStatePrompt = prompts.updateCharacterStatePrompt
        .replace('{chapter_text}', optimizedContent)
        .replace('{old_state}', characterState);

      const newCharacterState = await llmAdapter.invoke(characterStatePrompt);
      await fs.writeFile(characterStateFile, newCharacterState);

      // 更新向量存储
      await this.vectorStoreManager.addDocuments(novelId, [optimizedContent], [
        { 
          type: 'chapter', 
          chapterNumber: chapterNumber,
          novelId: novelId
        }
      ]);

      console.info(`章节定稿完成 - 小说ID: ${novelId}, 章节: ${chapterNumber}`);
      return { 
        success: true, 
        globalSummary: newGlobalSummary,
        characterState: newCharacterState
      };
    } catch (error) {
      console.error('章节定稿失败:', error);
      throw error;
    }
  }

  /**
   * 获取章节内容
   * @param {string} novelId - 小说ID
   * @param {number} chapterNumber - 章节号
   * @returns {object} - 章节内容
   */
  async getChapterContent(novelId, chapterNumber) {
    try {
      const novelPath = path.join(this.novelsPath, novelId);
      const chaptersPath = path.join(novelPath, 'chapters');

      const chapterFile = path.join(chaptersPath, `chapter_${chapterNumber}.txt`);
      const outlineFile = path.join(chaptersPath, `outline_${chapterNumber}.txt`);

      if (!(await fs.pathExists(chapterFile))) {
        throw new Error('章节不存在');
      }

      const content = await fs.readFile(chapterFile, 'utf8');
      let outline = '';

      if (await fs.pathExists(outlineFile)) {
        outline = await fs.readFile(outlineFile, 'utf8');
      }

      return {
        content,
        outline,
        number: chapterNumber
      };
    } catch (error) {
      console.error('获取章节内容失败:', error);
      throw error;
    }
  }

  /**
   * 获取小说所有章节
   * @param {string} novelId - 小说ID
   * @returns {array} - 章节列表
   */
  async getChapterList(novelId) {
    try {
      const novelPath = path.join(this.novelsPath, novelId);
      const chaptersPath = path.join(novelPath, 'chapters');

      if (!(await fs.pathExists(chaptersPath))) {
        return [];
      }

      const files = await fs.readdir(chaptersPath);
      const chapterFiles = files.filter(file => file.startsWith('chapter_') && file.endsWith('.txt'));

      const chapters = [];
      for (const file of chapterFiles) {
        const chapterNumber = parseInt(file.match(/chapter_(\d+)\.txt/)[1]);
        const outlineFile = path.join(chaptersPath, `outline_${chapterNumber}.txt`);
        let outline = '';

        if (await fs.pathExists(outlineFile)) {
          outline = await fs.readFile(outlineFile, 'utf8');
        }

        chapters.push({
          number: chapterNumber,
          outline: outline,
          hasContent: true
        });
      }

      // 按章节号排序
      chapters.sort((a, b) => a.number - b.number);

      return chapters;
    } catch (error) {
      console.error('获取章节列表失败:', error);
      throw error;
    }
  }

  /**
   * 解析章节信息
   * @param {string} blueprint - 章节目录文本
   * @param {number} chapterNumber - 章节号
   * @returns {object} - 章节信息
   */
  parseChapterInfo(blueprint, chapterNumber) {
    try {
      // 使用正则表达式匹配章节信息
      const chapterRegex = new RegExp(`第${chapterNumber}章\s*-\s*([^\n]+)\s*本章定位：([^\n]+)\s*核心作用：([^\n]+)\s*悬念密度：([^\n]+)\s*伏笔操作：([^\n]+)\s*认知颠覆：([^\n]+)\s*本章简述：([^\n]+)`, 'g');
      const match = chapterRegex.exec(blueprint);

      if (!match) {
        // 如果没有找到匹配，返回默认值
        return {
          title: `第${chapterNumber}章`,
          role: '常规章节',
          purpose: '内容推进',
          suspenseLevel: '中等',
          foreshadowing: '无',
          plotTwistLevel: '★☆☆☆☆',
          summary: ''
        };
      }

      return {
        title: match[1].trim(),
        role: match[2].trim(),
        purpose: match[3].trim(),
        suspenseLevel: match[4].trim(),
        foreshadowing: match[5].trim(),
        plotTwistLevel: match[6].trim(),
        summary: match[7].trim()
      };
    } catch (error) {
      console.error('解析章节信息失败:', error);
      return {
        title: `第${chapterNumber}章`,
        role: '常规章节',
        purpose: '内容推进',
        suspenseLevel: '中等',
        foreshadowing: '无',
        plotTwistLevel: '★☆☆☆☆',
        summary: ''
      };
    }
  }

  /**
   * 获取前几章内容
   * @param {string} chaptersPath - 章节目录路径
   * @param {number} currentChapter - 当前章节号
   * @param {number} count - 获取章节数量
   * @returns {array} - 章节内容数组
   */
  async getRecentChapters(chaptersPath, currentChapter, count) {
    try {
      const chapters = [];
      const startChapter = Math.max(1, currentChapter - count);

      for (let i = startChapter; i < currentChapter; i++) {
        const chapterFile = path.join(chaptersPath, `chapter_${i}.txt`);
        if (await fs.pathExists(chapterFile)) {
          const content = await fs.readFile(chapterFile, 'utf8');
          chapters.push(content);
        }
      }

      return chapters;
    } catch (error) {
      console.error('获取前几章内容失败:', error);
      return [];
    }
  }

  /**
   * 生成章节摘要
   * @param {object} llmAdapter - LLM适配器
   * @param {array} recentChapters - 前几章内容
   * @param {object} chapterInfo - 当前章节信息
   * @returns {string} - 章节摘要
   */
  async generateChapterSummary(llmAdapter, recentChapters, chapterInfo) {
    try {
      const combinedText = recentChapters.join('\n\n');

      const prompt = prompts.summarizeRecentChaptersPrompt
        .replace('{combined_text}', combinedText)
        .replace('{novel_number}', chapterInfo.number)
        .replace('{chapter_title}', chapterInfo.title)
        .replace('{chapter_role}', chapterInfo.role)
        .replace('{chapter_purpose}', chapterInfo.purpose)
        .replace('{suspense_level}', chapterInfo.suspenseLevel)
        .replace('{foreshadowing}', chapterInfo.foreshadowing)
        .replace('{plot_twist_level}', chapterInfo.plotTwistLevel)
        .replace('{chapter_summary}', chapterInfo.summary);

      const response = await llmAdapter.invoke(prompt);

      // 提取摘要部分
      const summaryMatch = response.match(/当前章节摘要:\s*([\s\S]*?)(?=\n\n|$)/);
      if (summaryMatch) {
        return summaryMatch[1].trim();
      }

      return response.trim();
    } catch (error) {
      console.error('生成章节摘要失败:', error);
      return '';
    }
  }

  /**
   * 保存章节内容
   * @param {string} novelId - 小说ID
   * @param {number} chapterNumber - 章节号
   * @param {string} content - 章节内容
   * @returns {object} - 保存结果
   */
  async saveChapterContent(novelId, chapterNumber, content) {
    try {
      const novelPath = path.join(this.novelsPath, novelId);
      const chaptersPath = path.join(novelPath, 'chapters');
      
      // 确保章节目录存在
      await fs.ensureDir(chaptersPath);
      
      // 保存章节内容
      const chapterFile = path.join(chaptersPath, `chapter_${chapterNumber}.txt`);
      await fs.writeFile(chapterFile, content);
      
      console.info(`章节内容保存完成 - 小说ID: ${novelId}, 章节: ${chapterNumber}`);
      return {
        success: true,
        message: '章节内容保存成功'
      };
    } catch (error) {
      console.error('保存章节内容失败:', error);
      throw error;
    }
  }

  /**
   * 获取相关知识
   * @param {string} novelId - 小说ID
   * @param {object} chapterInfo - 章节信息
   * @param {object} chapterParams - 章节参数
   * @returns {string} - 相关知识
   */
  async getRelevantKnowledge(novelId, chapterInfo, chapterParams) {
    try {
      // 构建查询关键词
      const keywords = [
        chapterInfo.title,
        chapterInfo.summary,
        chapterParams.charactersInvolved || '',
        chapterParams.keyItems || '',
        chapterParams.sceneLocation || ''
      ].filter(Boolean).join(' ');

      // 从向量存储检索相关内容
      const documents = await this.vectorStoreManager.search(novelId, keywords);

      if (documents.length === 0) {
        return '（无相关知识库内容）';
      }

      // 组合检索结果
      return documents.map(doc => doc.pageContent).join('\n\n');
    } catch (error) {
      console.error('获取相关知识失败:', error);
      return '（知识库检索失败）';
    }
  }
}

module.exports = ChapterService;
