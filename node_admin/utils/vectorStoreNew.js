/**
 * 向量数据库工具类
 * 使用MemoryVectorStore替代Faiss和ChromaDB，解决Windows平台兼容性问题
 */
const fs = require('fs-extra');
const path = require('path');
const { OpenAI } = require('openai');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { Document } = require('@langchain/core/documents');
const JinaEmbeddings = require('./jinaEmbeddings');
// const logger = require('./logger');

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
          task: this.config.jinaTask || 'text-matching',
          timeout: 120000 // 120秒超时，给API调用更充足的时间
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
   * @returns {MemoryVectorStore|null} - 向量存储实例
   */
  async loadVectorStore(novelId) {
    try {
      // 检查嵌入对象是否正确初始化
      if (!this.embeddings || typeof this.embeddings.embedQuery !== 'function') {
        console.error('嵌入对象未正确初始化或缺少必要方法');
        return null;
      }

      // 检查向量存储目录是否存在
      const storePath = path.join(this.vectorStorePath, novelId);
      if (!(await fs.pathExists(storePath))) {
        console.warn(`向量存储目录不存在: ${storePath}`);
        return null;
      }

      // 导入MemoryVectorStore
      let MemoryVectorStore;
      try {
        MemoryVectorStore = require('langchain/vectorstores/memory').MemoryVectorStore;
      } catch (e) {
        const { MemoryVectorStore: MVStore } = require('langchain');
        MemoryVectorStore = MVStore;
      }

      // 创建内存向量存储实例
      const vectorStore = new MemoryVectorStore(this.embeddings);

      // 验证向量存储是否有效
      if (!vectorStore || typeof vectorStore.similaritySearch !== 'function') {
        console.error('加载的向量存储无效或缺少必要方法');
        return null;
      }

      console.info(`成功加载向量存储: ${novelId}`);
      return vectorStore;
    } catch (error) {
      console.error(`加载向量存储失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 创建新的向量存储
   * @param {string} novelId - 小说ID
   * @returns {Chroma} - 向量存储实例
   */
  async createVectorStore(novelId) {
    try {
      console.log(`开始创建向量存储，ID: ${novelId}`);
      console.log(`嵌入提供商: ${this.embeddingsProvider}`);
      console.log(`嵌入模型: ${this.embeddingsModel}`);

      // 检查嵌入对象是否正确初始化
      if (!this.embeddings) {
        throw new Error('嵌入对象未正确初始化');
      }

      // 检查嵌入对象是否有必要的方法
      if (typeof this.embeddings.embedQuery !== 'function') {
        throw new Error('嵌入对象缺少必要的方法');
      }

      // 使用简单的内存向量存储代替ChromaDB
      let MemoryVectorStore;
      try {
        // 尝试不同的导入路径
        try {
          MemoryVectorStore = require('langchain/vectorstores/memory').MemoryVectorStore;
        } catch (e) {
          const { MemoryVectorStore: MVStore } = require('langchain');
          MemoryVectorStore = MVStore;
        }
      } catch (e) {
        throw new Error('无法导入MemoryVectorStore: ' + e.message);
      }

      try {
        // 测试嵌入功能是否正常工作
        const testEmbedding = await this.embeddings.embedQuery("测试文本");
        console.log('嵌入测试成功，向量维度:', testEmbedding.length);

        // 验证嵌入向量是否有效
        if (!testEmbedding || !Array.isArray(testEmbedding) || testEmbedding.length === 0) {
          throw new Error('嵌入向量无效或为空');
        }

        // 创建向量存储
        console.log('正在创建向量存储，请稍候...');

        // 尝试不同的创建方式
        let vectorStore;
        try {
          // 方式1：使用fromTexts
          vectorStore = await MemoryVectorStore.fromTexts(
            ["初始化向量存储"],
            { novelId },
            this.embeddings
          );
        } catch (e1) {
          console.warn('方式1创建失败，尝试方式2:', e1.message);
          try {
            // 方式2：创建实例后添加文档
            vectorStore = new MemoryVectorStore(this.embeddings);
            await vectorStore.addDocuments([
              { pageContent: "初始化向量存储", metadata: { novelId } }
            ]);
          } catch (e2) {
            console.warn('方式2也失败，尝试方式3:', e2.message);
            try {
              // 方式3：直接创建空实例
              vectorStore = new MemoryVectorStore(this.embeddings);
            } catch (e3) {
              throw new Error(`所有创建方式都失败: ${e3.message}`);
            }
          }
        }

        // 验证创建的向量存储是否有效
        if (!vectorStore || typeof vectorStore.similaritySearch !== 'function') {
          throw new Error('创建的向量存储无效或缺少必要方法');
        }

        console.info(`成功创建向量存储: ${novelId}`);
        return vectorStore;
      } catch (storeError) {
        console.error('MemoryVectorStore创建失败:', storeError.message);

        // 提供更详细的错误信息
        let errorMessage = '向量存储创建失败';
        if (storeError.message.includes('Jina AI')) {
          errorMessage = `向量存储创建失败 - 嵌入服务错误: ${storeError.message}`;
        } else {
          errorMessage = `向量存储创建失败: ${storeError.message}`;
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error(`创建向量存储失败: ${error.message}`);
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

      console.info(`向向量存储添加了 ${documents.length} 个文档`);
      return true;
    } catch (error) {
      console.error(`添加文档到向量存储失败: ${error.message}`);
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
      // 检查查询参数
      if (!query || typeof query !== 'string') {
        console.warn('查询参数无效');
        return [];
      }

      // 加载向量存储
      const vectorStore = await this.loadVectorStore(novelId);
      if (!vectorStore) {
        console.warn(`向量存储不存在或加载失败: ${novelId}`);
        return [];
      }

      // 执行相似性搜索
      let results;
      try {
        results = await vectorStore.similaritySearch(query, { k: this.retrievalK });
      } catch (searchError) {
        console.error(`相似性搜索失败: ${searchError.message}`);
        // 尝试使用另一种搜索方法
        try {
          results = await vectorStore.similaritySearch(query, this.retrievalK);
        } catch (fallbackError) {
          console.error(`备用搜索方法也失败: ${fallbackError.message}`);
          return [];
        }
      }

      // 验证搜索结果
      if (!results || !Array.isArray(results)) {
        console.warn('搜索结果格式无效');
        return [];
      }

      console.info(`从向量存储检索到 ${results.length} 个相关文档`);
      return results;
    } catch (error) {
      console.error(`向量检索失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 删除向量存储
   * @param {string} novelId - 小说ID
   * @returns {boolean} - 是否成功删除
   */
  async deleteVectorStore(novelId) {
    try {
      const storePath = path.join(this.vectorStorePath, novelId);

      if (await fs.pathExists(storePath)) {
        await fs.remove(storePath);
        console.info(`删除向量存储: ${novelId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`删除向量存储失败: ${error.message}`);
      throw error;
    }
  }
}

module.exports = VectorStoreManager;
