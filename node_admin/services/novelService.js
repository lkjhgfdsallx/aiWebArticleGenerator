/**
 * 小说生成服务
 * 负责小说设定、章节目录和章节内容的生成
 */
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createLLMAdapter } = require('../utils/llmAdapter');
const VectorStoreManager = require('../utils/vectorStoreNew');
// const logger = require('../utils/logger');

// 导入提示词
const prompts = require('../data/prompts');

class NovelService {
  constructor() {
    this.novelsPath = process.env.NOVELS_PATH || './novels';
    this.vectorStoreManager = new VectorStoreManager({
      embeddingsProvider: process.env.EMBEDDING_PROVIDER || 'jina',
      embeddingsModel: process.env.EMBEDDING_MODEL || 'jina-embeddings-v3',
      vectorStorePath: path.join(__dirname, '../novels'), // 使用与knowledge.js相同的路径
      retrievalK: parseInt(process.env.EMBEDDING_RETRIEVAL_K) || 4,
      openaiApiKey: process.env.OPENAI_API_KEY,
      jinaApiKey: process.env.JINA_API_KEY,
      chromaURL: process.env.CHROMA_URL || 'http://localhost:8000'
    });
  }

  /**
   * 创建新小说项目
   * @param {object} novelData - 小说数据
   * @returns {object} - 小说信息
   */
  async createNovel(novelData) {
    try {
      console.log('开始创建小说，数据:', novelData);

      const novelId = uuidv4();
      const novelPath = path.join(this.novelsPath, novelId);
      console.log('生成的小说ID:', novelId);
      console.log('小说路径:', novelPath);

      // 创建小说目录
      console.log('创建小说目录...');
      await fs.ensureDir(novelPath);
      await fs.ensureDir(path.join(novelPath, 'chapters'));
      console.log('小说目录创建成功');

      // 保存小说基本信息
      console.log('准备保存小说信息...');
      const novelInfo = {
        id: novelId,
        title: novelData.title,
        genre: novelData.genre,
        topic: novelData.topic,
        numChapters: novelData.numChapters,
        wordNumber: novelData.wordNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'created'
      };

      await fs.writeJSON(path.join(novelPath, 'info.json'), novelInfo);
      console.log('小说信息保存成功');

      // 创建向量存储
      console.log('开始创建向量存储...');
      await this.vectorStoreManager.createVectorStore(novelId);
      console.log('向量存储创建成功');

      console.info(`创建新小说: ${novelData.title} (ID: ${novelId})`);
      return novelInfo;
    } catch (error) {
      console.error('创建小说失败:', error);
      console.error('错误堆栈:', error.stack);
      throw error;
    }
  }

  /**
   * 生成小说架构
   * @param {string} novelId - 小说ID
   * @param {object} config - LLM配置
   * @param {string} userGuidance - 用户指导
   * @returns {object} - 生成结果
   */
  async generateNovelArchitecture(novelId, config, userGuidance = '') {
    try {
      const novelPath = path.join(this.novelsPath, novelId);
      const novelInfo = await fs.readJSON(path.join(novelPath, 'info.json'));

      // 创建LLM适配器
      const llmAdapter = createLLMAdapter(config.provider, {
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens
      });

      // 检查是否有部分完成的架构
      const partialFile = path.join(novelPath, 'partial_architecture.json');
      let partialData = {};

      if (await fs.pathExists(partialFile)) {
        partialData = await fs.readJSON(partialFile);
      }

      // 步骤1：生成核心种子
      if (!partialData.coreSeed) {
        console.info(`生成核心种子 - 小说ID: ${novelId}`);
        const prompt = prompts.coreSeedPrompt
          .replace('{topic}', novelInfo.topic)
          .replace('{genre}', novelInfo.genre)
          .replace('{number_of_chapters}', novelInfo.numChapters)
          .replace('{word_number}', novelInfo.wordNumber)
          .replace('{user_guidance}', userGuidance);

        const coreSeed = await llmAdapter.invoke(prompt);
        partialData.coreSeed = coreSeed;
        await fs.writeJSON(partialFile, partialData);
      }

      // 步骤2：生成角色动力学
      if (!partialData.characterDynamics) {
        console.info(`生成角色动力学 - 小说ID: ${novelId}`);
        const prompt = prompts.characterDynamicsPrompt
          .replace('{core_seed}', partialData.coreSeed)
          .replace('{user_guidance}', userGuidance);

        const characterDynamics = await llmAdapter.invoke(prompt);
        partialData.characterDynamics = characterDynamics;
        await fs.writeJSON(partialFile, partialData);
      }

      // 步骤3：生成世界观
      if (!partialData.worldBuilding) {
        console.info(`生成世界观 - 小说ID: ${novelId}`);
        const prompt = prompts.worldBuildingPrompt
          .replace('{core_seed}', partialData.coreSeed)
          .replace('{user_guidance}', userGuidance);

        const worldBuilding = await llmAdapter.invoke(prompt);
        partialData.worldBuilding = worldBuilding;
        await fs.writeJSON(partialFile, partialData);
      }

      // 步骤4：生成情节架构
      if (!partialData.plotArchitecture) {
        console.info(`生成情节架构 - 小说ID: ${novelId}`);
        const prompt = prompts.plotArchitecturePrompt
          .replace('{core_seed}', partialData.coreSeed)
          .replace('{character_dynamics}', partialData.characterDynamics)
          .replace('{world_building}', partialData.worldBuilding)
          .replace('{user_guidance}', userGuidance);

        const plotArchitecture = await llmAdapter.invoke(prompt);
        partialData.plotArchitecture = plotArchitecture;
        await fs.writeJSON(partialFile, partialData);
      }

      // 组合最终架构
      const finalArchitecture = `#=== 0) 小说设定 ===\n主题：${novelInfo.topic},类型：${novelInfo.genre},篇幅：约${novelInfo.numChapters}章（每章${novelInfo.wordNumber}字）\n\n#=== 1) 核心种子 ===\n${partialData.coreSeed}\n\n#=== 2) 角色动力学 ===\n${partialData.characterDynamics}\n\n#=== 3) 世界观 ===\n${partialData.worldBuilding}\n\n#=== 4) 三幕式情节架构 ===\n${partialData.plotArchitecture}\n`;

      // 保存最终架构
      const architectureFile = path.join(novelPath, 'Novel_architecture.txt');
      await fs.writeFile(architectureFile, finalArchitecture);

      // 生成初始角色状态
      const characterStatePrompt = prompts.createCharacterStatePrompt
        .replace('{character_dynamics}', partialData.characterDynamics);

      const characterState = await llmAdapter.invoke(characterStatePrompt);
      const characterStateFile = path.join(novelPath, 'character_state.txt');
      await fs.writeFile(characterStateFile, characterState);

      // 更新小说状态
      novelInfo.status = 'architecture_generated';
      novelInfo.updatedAt = new Date().toISOString();
      await fs.writeJSON(path.join(novelPath, 'info.json'), novelInfo);

      // 删除部分架构文件
      if (await fs.pathExists(partialFile)) {
        await fs.remove(partialFile);
      }

      // 将架构添加到向量存储
      await this.vectorStoreManager.addDocuments(novelId, [finalArchitecture], [{ type: 'architecture', novelId }]);

      console.info(`小说架构生成完成 - 小说ID: ${novelId}`);
      return { success: true, architecture: finalArchitecture, characterState };
    } catch (error) {
      console.error('生成小说架构失败:', error);
      throw error;
    }
  }

  /**
   * 生成章节目录
   * @param {string} novelId - 小说ID
   * @param {object} config - LLM配置
   * @param {string} userGuidance - 用户指导
   * @returns {object} - 生成结果
   */
  async generateChapterBlueprint(novelId, config, userGuidance = '') {
    try {
      const novelPath = path.join(this.novelsPath, novelId);
      const novelInfo = await fs.readJSON(path.join(novelPath, 'info.json'));

      // 检查小说架构是否存在
      const architectureFile = path.join(novelPath, 'Novel_architecture.txt');
      if (!(await fs.pathExists(architectureFile))) {
        throw new Error('请先生成小说架构');
      }

      const architecture = await fs.readFile(architectureFile, 'utf8');

      // 创建LLM适配器
      const llmAdapter = createLLMAdapter(config.provider, {
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens
      });

      // 生成章节目录
      console.info(`生成章节目录 - 小说ID: ${novelId}`);
      const prompt = prompts.chapterBlueprintPrompt
        .replace('{novel_architecture}', architecture)
        .replace('{number_of_chapters}', novelInfo.numChapters)
        .replace('{user_guidance}', userGuidance);

      const blueprint = await llmAdapter.invoke(prompt);

      // 保存章节目录
      const blueprintFile = path.join(novelPath, 'Novel_directory.txt');
      await fs.writeFile(blueprintFile, blueprint);

      // 更新小说状态
      novelInfo.status = 'blueprint_generated';
      novelInfo.updatedAt = new Date().toISOString();
      await fs.writeJSON(path.join(novelPath, 'info.json'), novelInfo);

      // 将章节目录添加到向量存储
      await this.vectorStoreManager.addDocuments(novelId, [blueprint], [{ type: 'blueprint', novelId }]);

      console.info(`章节目录生成完成 - 小说ID: ${novelId}`);
      return { success: true, blueprint };
    } catch (error) {
      console.error('生成章节目录失败:', error);
      throw error;
    }
  }

  /**
   * 获取小说架构
   * @param {string} novelId - 小说ID
   * @returns {string} - 小说架构
   */
  async getArchitecture(novelId) {
    try {
      const novelPath = path.join(this.novelsPath, novelId);
      const architectureFile = path.join(novelPath, 'Novel_architecture.txt');

      if (!(await fs.pathExists(architectureFile))) {
        return ''; // 返回空字符串而不是抛出错误
      }

      return await fs.readFile(architectureFile, 'utf8');
    } catch (error) {
      console.error('获取小说架构失败:', error);
      return ''; // 发生错误时也返回空字符串
    }
  }

  /**
   * 获取章节目录
   * @param {string} novelId - 小说ID
   * @returns {string} - 章节目录
   */
  async getBlueprint(novelId) {
    try {
      const novelPath = path.join(this.novelsPath, novelId);
      const blueprintFile = path.join(novelPath, 'Novel_directory.txt');

      if (!(await fs.pathExists(blueprintFile))) {
        return ''; // 返回空字符串而不是抛出错误
      }

      return await fs.readFile(blueprintFile, 'utf8');
    } catch (error) {
      console.error('获取章节目录失败:', error);
      return ''; // 发生错误时也返回空字符串
    }
  }

  /**
   * 获取小说信息
   * @param {string} novelId - 小说ID
   * @returns {object} - 小说信息
   */
  async getNovelInfo(novelId) {
    try {
      const novelPath = path.join(this.novelsPath, novelId);
      const infoFile = path.join(novelPath, 'info.json');

      if (!(await fs.pathExists(infoFile))) {
        throw new Error('小说不存在');
      }

      return await fs.readJSON(infoFile);
    } catch (error) {
      console.error('获取小说信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取小说列表
   * @returns {array} - 小说列表
   */
  async getNovelList() {
    try {
      if (!(await fs.pathExists(this.novelsPath))) {
        return [];
      }

      const novelDirs = await fs.readdir(this.novelsPath);
      const novels = [];

      for (const dir of novelDirs) {
        const infoFile = path.join(this.novelsPath, dir, 'info.json');
        if (await fs.pathExists(infoFile)) {
          const novelInfo = await fs.readJSON(infoFile);
          novels.push(novelInfo);
        }
      }

      // 按创建时间降序排列
      novels.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return novels;
    } catch (error) {
      console.error('获取小说列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取角色状态
   * @param {string} novelId - 小说ID
   * @returns {string} - 角色状态
   */
  async getCharacterState(novelId) {
    try {
      const novelPath = path.join(this.novelsPath, novelId);
      const characterStateFile = path.join(novelPath, 'character_state.txt');

      if (!(await fs.pathExists(characterStateFile))) {
        return '';
      }

      return await fs.readFile(characterStateFile, 'utf8');
    } catch (error) {
      console.error('获取角色状态失败:', error);
      throw error;
    }
  }

  /**
   * 生成角色状态
   * @param {string} novelId - 小说ID
   * @param {object} config - LLM配置
   * @param {string} userGuidance - 用户指导
   * @returns {string} - 角色状态
   */
  async generateCharacterState(novelId, config, userGuidance = '') {
    try {
      const novelPath = path.join(this.novelsPath, novelId);
      const architectureFile = path.join(novelPath, 'Novel_architecture.txt');
      
      if (!(await fs.pathExists(architectureFile))) {
        throw new Error('请先生成小说架构');
      }

      const architecture = await fs.readFile(architectureFile, 'utf8');

      // 创建LLM适配器
      const llmAdapter = createLLMAdapter(config.provider, {
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens
      });

      // 提取角色动力学部分
      const characterDynamicsMatch = architecture.match(/#=== 2\) 角色动力学 ===\n([\s\S]*?)\n\n#===/);
      if (!characterDynamicsMatch) {
        throw new Error('无法从架构中提取角色动力学信息');
      }

      const characterDynamics = characterDynamicsMatch[1];

      // 生成角色状态
      console.info(`生成角色状态 - 小说ID: ${novelId}`);
      const prompt = prompts.updateCharacterStatePrompt
        .replace('{character_dynamics}', characterDynamics)
        .replace('{user_guidance}', userGuidance);

      const characterState = await llmAdapter.invoke(prompt);

      // 保存角色状态
      const characterStateFile = path.join(novelPath, 'character_state.txt');
      await fs.writeFile(characterStateFile, characterState);

      // 将角色状态添加到向量存储
      await this.vectorStoreManager.addDocuments(novelId, [characterState], [{ type: 'character_state', novelId }]);

      console.info(`角色状态生成完成 - 小说ID: ${novelId}`);
      return characterState;
    } catch (error) {
      console.error('生成角色状态失败:', error);
      throw error;
    }
  }

  /**
   * 获取全局摘要
   * @param {string} novelId - 小说ID
   * @returns {string} - 全局摘要
   */
  async getGlobalSummary(novelId) {
    try {
      const novelPath = path.join(this.novelsPath, novelId);
      const globalSummaryFile = path.join(novelPath, 'global_summary.txt');

      if (!(await fs.pathExists(globalSummaryFile))) {
        return '';
      }

      return await fs.readFile(globalSummaryFile, 'utf8');
    } catch (error) {
      console.error('获取全局摘要失败:', error);
      throw error;
    }
  }

  /**
   * 生成全局摘要
   * @param {string} novelId - 小说ID
   * @param {object} config - LLM配置
   * @param {string} userGuidance - 用户指导
   * @returns {string} - 全局摘要
   */
  async generateGlobalSummary(novelId, config, userGuidance = '') {
    try {
      const novelPath = path.join(this.novelsPath, novelId);
      const architectureFile = path.join(novelPath, 'Novel_architecture.txt');
      const blueprintFile = path.join(novelPath, 'Novel_directory.txt');
      
      if (!(await fs.pathExists(architectureFile))) {
        throw new Error('请先生成小说架构');
      }

      const architecture = await fs.readFile(architectureFile, 'utf8');
      let blueprint = '';
      
      if (await fs.pathExists(blueprintFile)) {
        blueprint = await fs.readFile(blueprintFile, 'utf8');
      }

      // 创建LLM适配器
      const llmAdapter = createLLMAdapter(config.provider, {
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens
      });

      // 生成全局摘要
      console.info(`生成全局摘要 - 小说ID: ${novelId}`);
      const prompt = prompts.globalSummaryPrompt
        .replace('{novel_architecture}', architecture)
        .replace('{chapter_blueprint}', blueprint)
        .replace('{user_guidance}', userGuidance);

      const globalSummary = await llmAdapter.invoke(prompt);

      // 保存全局摘要
      const globalSummaryFile = path.join(novelPath, 'global_summary.txt');
      await fs.writeFile(globalSummaryFile, globalSummary);

      // 将全局摘要添加到向量存储
      await this.vectorStoreManager.addDocuments(novelId, [globalSummary], [{ type: 'global_summary', novelId }]);

      console.info(`全局摘要生成完成 - 小说ID: ${novelId}`);
      return globalSummary;
    } catch (error) {
      console.error('生成全局摘要失败:', error);
      throw error;
    }
  }

  /**
   * 删除小说
   * @param {string} novelId - 小说ID
   * @returns {boolean} - 是否成功删除
   */
  async deleteNovel(novelId) {
    try {
      const novelPath = path.join(this.novelsPath, novelId);

      if (!(await fs.pathExists(novelPath))) {
        return false;
      }

      // 删除小说目录
      await fs.remove(novelPath);

      // 删除向量存储
      await this.vectorStoreManager.deleteVectorStore(novelId);

      console.info(`删除小说 - ID: ${novelId}`);
      return true;
    } catch (error) {
      console.error('删除小说失败:', error);
      throw error;
    }
  }
}

module.exports = NovelService;
