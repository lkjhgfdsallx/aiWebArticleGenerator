
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

    // 验证嵌入对象是否正确初始化
    if (!this.embeddings || typeof this.embeddings.embedQuery !== 'function') {
      throw new Error('嵌入对象初始化失败或缺少必要方法');
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

      // 尝试从文件加载向量存储数据
      const vectorDataPath = path.join(storePath, 'vector_data.json');
      if (!(await fs.pathExists(vectorDataPath))) {
        console.warn(`向量存储数据文件不存在: ${vectorDataPath}`);
        return null;
      }

      // 读取向量存储数据
      const vectorData = await fs.readJson(vectorDataPath);
      if (!vectorData || !Array.isArray(vectorData.documents)) {
        console.warn(`向量存储数据格式无效: ${vectorDataPath}`);
        return null;
      }

      console.log(`准备加载向量存储: ${novelId}，包含 ${vectorData.documents.length} 个文档`);

      // 导入MemoryVectorStore
      let MemoryVectorStore;
      try {
        MemoryVectorStore = require('langchain/vectorstores/memory').MemoryVectorStore;
      } catch (e) {
        console.warn('尝试第一种导入方式失败:', e.message);
        try {
          const { MemoryVectorStore: MVStore } = require('langchain');
          MemoryVectorStore = MVStore;
        } catch (e2) {
          console.warn('尝试第二种导入方式失败:', e2.message);
          try {
            // 尝试直接导入
            MemoryVectorStore = require('langchain').MemoryVectorStore;
          } catch (e3) {
            console.error('所有导入MemoryVectorStore的方式都失败了:', e3.message);
            return null;
          }
        }
      }

      // 创建内存向量存储实例
      const vectorStore = new MemoryVectorStore(this.embeddings);

      // 从保存的数据中重建文档
      if (vectorData.documents.length > 0) {
        const { Document } = require('@langchain/core/documents');
        const documents = vectorData.documents.map(doc => {
          // 确保文档内容不为空
          const content = doc.pageContent || '';
          const metadata = doc.metadata || {};
          // 如果有向量数据，将其添加到元数据中
          if (doc.vector) {
            metadata.vector = doc.vector;
          }
          return new Document({ pageContent: content, metadata });
        });

        console.log(`准备添加 ${documents.length} 个文档到向量存储`);

        try {
          await vectorStore.addDocuments(documents);
          console.log(`成功添加 ${documents.length} 个文档到向量存储`);
        } catch (addError) {
          console.error('添加文档到向量存储失败:', addError.message);
          console.error('错误详情:', addError);

          // 尝试逐个添加文档
          console.log('尝试逐个添加文档...');
          let successCount = 0;

          for (let i = 0; i < documents.length; i++) {
            try {
              await vectorStore.addDocuments([documents[i]]);
              successCount++;
            } catch (docError) {
              console.error(`添加文档 ${i} 失败:`, docError.message);
            }
          }

          console.log(`成功添加 ${successCount}/${documents.length} 个文档`);
        }
      }

      // 验证向量存储是否有效
      if (!vectorStore || typeof vectorStore.similaritySearch !== 'function') {
        console.error('加载的向量存储无效或缺少必要方法');
        return null;
      }

      console.info(`成功加载向量存储: ${novelId}，包含 ${vectorData.documents.length} 个文档`);
      return vectorStore;
    } catch (error) {
      console.error(`加载向量存储失败: ${error.message}`);
      console.error('错误堆栈:', error.stack);
      return null;
    }
  }

  /**
   * 创建新的向量存储
   * @param {string} novelId - 小说ID
   * @returns {MemoryVectorStore} - 向量存储实例
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

      // 确保向量存储目录存在
      const storePath = path.join(this.vectorStorePath, novelId);
      await fs.ensureDir(storePath);

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

        // 保存向量存储元数据
        const vectorDataPath = path.join(storePath, 'vector_data.json');
        await fs.writeJson(vectorDataPath, {
          novelId,
          createdAt: new Date().toISOString(),
          embeddingsProvider: this.embeddingsProvider,
          embeddingsModel: this.embeddingsModel,
          documents: [] // 初始为空，将在添加文档时更新
        });

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
      // 确保向量存储目录存在
      const storePath = path.join(this.vectorStorePath, novelId);
      await fs.ensureDir(storePath);

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

      // 添加文档到内存向量存储
      await vectorStore.addDocuments(documents);

      // 保存文档数据到磁盘
      const vectorDataPath = path.join(storePath, 'vector_data.json');

      // 读取现有数据
      let vectorData;
      try {
        vectorData = await fs.readJson(vectorDataPath);
      } catch (e) {
        // 如果文件不存在或格式错误，创建新数据结构
        vectorData = {
          novelId,
          createdAt: new Date().toISOString(),
          embeddingsProvider: this.embeddingsProvider,
          embeddingsModel: this.embeddingsModel,
          documents: []
        };
      }

      // 生成文档的向量
      const embeddings = await this.embeddings.embedDocuments(texts);
      
      // 添加新文档
      const newDocs = documents.map((doc, i) => ({
        pageContent: doc.pageContent,
        metadata: doc.metadata,
        vector: embeddings[i] // 保存向量数据
      }));

      vectorData.documents = [...(vectorData.documents || []), ...newDocs];
      vectorData.updatedAt = new Date().toISOString();

      // 保存到磁盘
      await fs.writeJson(vectorDataPath, vectorData);

      console.info(`向向量存储添加了 ${documents.length} 个文档，总计 ${vectorData.documents.length} 个文档`);
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
        // 使用正确的参数格式
        results = await vectorStore.similaritySearch(query, this.retrievalK);
      } catch (searchError) {
        console.error(`相似性搜索失败: ${searchError.message}`);
        console.error('错误详情:', searchError);

        // 尝试使用另一种搜索方法
        try {
          results = await vectorStore.similaritySearchWithScore(query, this.retrievalK);
          // 如果使用similaritySearchWithScore，需要转换结果格式
          if (results && Array.isArray(results)) {
            results = results.map(([doc, score]) => doc);
          }
        } catch (fallbackError) {
          console.error(`备用搜索方法也失败: ${fallbackError.message}`);

          // 尝试直接从向量数据中搜索
          try {
            console.log('尝试直接从向量数据中搜索...');
            const storePath = path.join(this.vectorStorePath, novelId);
            const vectorDataPath = path.join(storePath, 'vector_data.json');

            if (await fs.pathExists(vectorDataPath)) {
              const vectorData = await fs.readJson(vectorDataPath);

              if (vectorData && vectorData.documents && Array.isArray(vectorData.documents)) {
                // 简单的文本匹配搜索作为后备
                const lowerQuery = query.toLowerCase();
                const matchedDocs = vectorData.documents.filter(doc => 
                  doc.pageContent && doc.pageContent.toLowerCase().includes(lowerQuery)
                );

                console.log(`文本匹配搜索找到 ${matchedDocs.length} 个结果`);

                // 转换为Document对象
                const { Document } = require('@langchain/core/documents');
                return matchedDocs.map(doc => 
                  new Document({ pageContent: doc.pageContent, metadata: doc.metadata })
                );
              }
            }
          } catch (directSearchError) {
            console.error(`直接搜索也失败: ${directSearchError.message}`);
          }

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
      console.error('错误堆栈:', error.stack);
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
