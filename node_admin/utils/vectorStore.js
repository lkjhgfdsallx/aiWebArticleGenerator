/**
 * 向量数据库工具类
 * 用于文本向量化存储和检索
 */
const fs = require('fs-extra');
const path = require('path');
const { OpenAI } = require('openai');
const { FaissStore } = require('@langchain/community/vectorstores/faiss');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { Document } = require('@langchain/core/documents');
const JinaEmbeddings = require('./jinaEmbeddings');

class VectorStoreManager {
  constructor(config) {
    this.config = config;
    this.embeddingsProvider = config.embeddingsProvider || 'jina';
    this.embeddingsModel = config.embeddingsModel || 'jina-embeddings-v3';
    this.vectorStorePath = config.vectorStorePath || './vectorstore';
    this.retrievalK = config.retrievalK || 4;

    // 初始化嵌入模型
    this.initEmbeddings();
  }

  initEmbeddings() {
    switch (this.embeddingsProvider.toLowerCase()) {
      case 'openai':
        this.embeddings = new OpenAIEmbeddings({
          openAIApiKey: this.config.openaiApiKey,
          modelName: this.embeddingsModel
        });
        break;
      case 'jina':
        this.embeddings = new JinaEmbeddings({
          apiKey: this.config.jinaApiKey || 'jina_4f4b6f197baf4f25a7d7a18a15e7894f1Vgi3FSAJ8jcleositNGzBXNykbP',
          model: this.embeddingsModel,
          task: this.config.jinaTask || 'text-matching'
        });
        break;
      // 可以添加其他嵌入模型提供商
      default:
        throw new Error(`不支持的嵌入模型提供商: ${this.embeddingsProvider}`);
    }
  }

  /**
   * 加载向量存储
   * @param {string} novelId - 小说ID
   * @returns {FaissStore|null} - 向量存储实例
   */
  async loadVectorStore(novelId) {
    try {
      const storePath = path.join(this.vectorStorePath, novelId);

      // 检查目录是否存在
      if (!(await fs.pathExists(storePath))) {
        console.log(`向量存储目录不存在: ${storePath}`);
        return null;
      }

      // 加载向量存储
      const vectorStore = await FaissStore.load(storePath, this.embeddings);
      return vectorStore;
    } catch (error) {
      console.error('加载向量存储失败:', error);
      return null;
    }
  }

  /**
   * 创建新的向量存储
   * @param {string} novelId - 小说ID
   * @returns {FaissStore} - 向量存储实例
   */
  async createVectorStore(novelId) {
    try {
      const storePath = path.join(this.vectorStorePath, novelId);

      // 确保目录存在
      await fs.ensureDir(storePath);

      // 创建空的向量存储
      const vectorStore = await FaissStore.fromTexts(
        ["初始化向量存储"], 
        { novelId }, 
        this.embeddings
      );

      // 保存向量存储
      await vectorStore.save(storePath);

      return vectorStore;
    } catch (error) {
      console.error('创建向量存储失败:', error);
      throw error;
    }
  }

  /**
   * 向向量存储添加文档
   * @param {string} novelId - 小说ID
   * @param {string[]} texts - 文本数组
   * @param {object[]} metadatas - 元数据数组
   */
  async addDocuments(novelId, texts, metadatas) {
    try {
      // 加载或创建向量存储
      let vectorStore = await this.loadVectorStore(novelId);
      if (!vectorStore) {
        vectorStore = await this.createVectorStore(novelId);
      }

      // 创建文档对象
      const documents = texts.map((text, i) => {
        return new Document({
          pageContent: text,
          metadata: metadatas[i] || {}
        });
      });

      // 添加文档
      await vectorStore.addDocuments(documents);

      // 保存向量存储
      const storePath = path.join(this.vectorStorePath, novelId);
      await vectorStore.save(storePath);

      return true;
    } catch (error) {
      console.error('添加文档到向量存储失败:', error);
      throw error;
    }
  }

  /**
   * 从向量存储检索相关文档
   * @param {string} novelId - 小说ID
   * @param {string} query - 查询文本
   * @returns {Document[]} - 相关文档数组
   */
  async search(novelId, query) {
    try {
      // 加载向量存储
      const vectorStore = await this.loadVectorStore(novelId);
      if (!vectorStore) {
        console.log(`向量存储不存在: ${novelId}`);
        return [];
      }

      // 执行相似性搜索
      const results = await vectorStore.similaritySearch(query, this.retrievalK);

      return results;
    } catch (error) {
      console.error('向量检索失败:', error);
      throw error;
    }
  }

  /**
   * 删除向量存储
   * @param {string} novelId - 小说ID
   */
  async deleteVectorStore(novelId) {
    try {
      const storePath = path.join(this.vectorStorePath, novelId);

      if (await fs.pathExists(storePath)) {
        await fs.remove(storePath);
        return true;
      }

      return false;
    } catch (error) {
      console.error('删除向量存储失败:', error);
      throw error;
    }
  }
}

module.exports = VectorStoreManager;
