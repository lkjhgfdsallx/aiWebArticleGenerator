/**
 * Jina AI 嵌入模型类
 * 用于替代 OpenAI 的嵌入模型
 */
const axios = require('axios');

class JinaEmbeddings {
  constructor(config) {
    this.apiKey = config.apiKey || 'jina_4f4b6f197baf4f25a7d7a18a15e7894f1Vgi3FSAJ8jcleositNGzBXNykbP';
    this.model = config.model || 'jina-embeddings-v3';
    this.task = config.task || 'text-matching';
    this.baseUrl = 'https://api.jina.ai/v1/embeddings';
    this.timeout = config.timeout || 60000; // 默认60秒超时

    // 绑定方法
    this.embedQuery = this.embedQuery.bind(this);
    this.embedDocuments = this.embedDocuments.bind(this);
    this._embedDocuments = this._embedDocuments.bind(this);
  }

  /**
   * 对单个文本进行向量化
   * @param {string} text - 要向量化的文本
   * @returns {Promise<number[]>} - 文本的向量表示
   */
  async embedQuery(text) {
    const response = await this._embedDocuments([text]);
    return response[0];
  }

  /**
   * 对多个文本进行向量化
   * @param {string[]} texts - 要向量化的文本数组
   * @returns {Promise<number[][]>} - 文本的向量表示数组
   */
  async embedDocuments(texts) {
    return this._embedDocuments(texts);
  }

  /**
   * 调用 Jina AI API 进行向量化
   * @param {string[]} texts - 要向量化的文本数组
   * @returns {Promise<number[][]>} - 文本的向量表示数组
   */
  async _embedDocuments(texts, retryCount = 0) {
    const maxRetries = 3;
    try {
      // 准备请求数据
      // 确保文本是字符串数组，并过滤空文本
      const validTexts = texts.filter(text => text && typeof text === 'string' && text.trim().length > 0);
      
      if (validTexts.length === 0) {
        throw new Error('没有有效的文本可以处理');
      }
      
      // 限制文本长度，Jina API可能有长度限制
      const maxLength = 8000; // 保守估计的字符限制
      const processedTexts = validTexts.map(text => {
        if (text.length > maxLength) {
          console.warn(`文本过长，将被截断: ${text.length} > ${maxLength}`);
          return text.substring(0, maxLength);
        }
        return text;
      });
      
      const requestData = {
        model: this.model,
        task: this.task,
        input: processedTexts
      };

      // 使用更详细的配置
      const axiosConfig = {
        method: 'post',
        url: this.baseUrl,
        data: requestData,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'AI-NovelGenerator/1.0'
        },
        timeout: this.timeout,
        // 添加更多配置以确保连接稳定
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      };

      const response = await axios(axiosConfig);

      // 检查响应数据结构
      if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
        throw new Error('Jina AI API 返回数据格式不正确');
      }

      // 提取嵌入向量
      const embeddings = response.data.data.map(item => {
        if (!item || !item.embedding || !Array.isArray(item.embedding)) {
          throw new Error('Jina AI API 返回的嵌入向量格式不正确');
        }
        return item.embedding;
      });

      return embeddings;
    } catch (error) {
      // 如果是网络错误或超时，且还有重试机会，则重试
      if ((error.code === 'ECONNABORTED' || error.code === 'ECONNRESET' || error.message.includes('timeout')) && retryCount < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2 ** retryCount * 1000));
        return this._embedDocuments(texts, retryCount + 1);
      }

      // 提供更详细的错误信息
      let errorMessage = 'Jina AI 嵌入失败';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Jina AI API 请求超时，请检查网络连接或稍后重试';
      } else if (error.response) {
        // 处理400错误，通常是请求参数问题
        if (error.response.status === 400) {
          errorMessage = `Jina AI API 请求参数错误: ${error.response.data?.error?.message || error.response.data?.message || '请检查输入文本格式和长度'}`;
        } else {
          errorMessage = `Jina AI API 错误: ${error.response.status} - ${error.response.data?.error?.message || error.response.data?.message || error.message}`;
        }
      } else if (error.request) {
        errorMessage = 'Jina AI API 网络错误，请检查网络连接';
      } else {
        errorMessage = `Jina AI 嵌入失败: ${error.message}`;
      }

      throw new Error(errorMessage);
    }
  }
}

module.exports = JinaEmbeddings;
