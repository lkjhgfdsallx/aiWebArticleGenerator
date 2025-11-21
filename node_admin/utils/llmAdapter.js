/**
 * 大语言模型适配器
 * 统一不同LLM提供商的接口
 */
const axios = require('axios');
const { OpenAI } = require('openai');
const { ChatOpenAI } = require('@langchain/openai');
const { BaseChatModel } = require('@langchain/core/language_models/base');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

class BaseLLMAdapter {
  constructor(config) {
    this.config = config;
  }

  async invoke(prompt) {
    throw new Error('Subclasses must implement invoke method');
  }
  
  /**
   * 专门用于第一章生成的方法，添加更严格的控制
   * @param {string} prompt - 提示词
   * @returns {string} - 生成的文本
   */
  async invokeFirstChapter(prompt) {
    // 为第一章生成添加系统消息
    const systemMessage = `你是一位专业的小说作家，现在正在创作小说的第一章。

【严格限制】
1. 你必须只生成第一章内容，绝对不能提前展开后续章节的情节
2. 你可以使用全局信息来理解背景和设定，但不要在第一章中展开未来章节的内容
3. 你可以在第一章中为后续章节埋下伏笔，但不要揭示这些伏笔的后续发展
4. 不要出现"第二章"、"接下来"、"后来"等指向未来章节的词语
5. 确保第一章内容完整，不要留下"未完待续"的暗示

【创作要求】
- 只专注于第一章内容的创作
- 确保内容符合小说设定和第一章的定位
- 保持文笔流畅，情节紧凑
- 确保字数符合要求`;
    
    return this.invokeWithSystemMessage(prompt, systemMessage);
  }
  
  /**
   * 使用系统消息调用LLM
   * @param {string} prompt - 用户提示词
   * @param {string} systemMessage - 系统消息
   * @returns {string} - 生成的文本
   */
  async invokeWithSystemMessage(prompt, systemMessage) {
    // 默认实现，子类可以覆盖
    return this.invoke(`${systemMessage}\n\n${prompt}`);
  }
}

class OpenAIAdapter extends BaseLLMAdapter {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.openai.com/v1/chat/completions';
    this.model = config.model || 'gpt-4';
    this.temperature = config.temperature || 0.7;
    this.maxTokens = config.maxTokens || 4096;
  }

  async invoke(prompt) {
    return this.invokeWithSystemMessage(prompt);
  }
  
  async invokeWithSystemMessage(prompt, systemMessage = null) {
    try {
      const messages = [];
      
      // 如果有系统消息，添加到消息数组开头
      if (systemMessage) {
        messages.push({
          role: "system",
          content: systemMessage
        });
      }
      
      // 添加用户消息
      messages.push({
        role: "user",
        content: prompt
      });
      
      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          messages: messages,
          temperature: this.temperature,
          max_tokens: this.maxTokens
        },
        {
          headers: {
            'accept': '*/*',
            'accept-language': 'zh-CN,zh;q=0.9',
            'authorization': `Bearer ${this.apiKey}`,
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'origin': 'null',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API调用错误:', error);
      throw error;
    }
  }
}

class DeepSeekAdapter extends BaseLLMAdapter {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
    this.model = config.model;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
  }

  async invoke(prompt) {
    return this.invokeWithSystemMessage(prompt);
  }
  
  async invokeWithSystemMessage(prompt, systemMessage = null) {
    try {
      const messages = [];
      
      // 如果有系统消息，添加到消息数组开头
      if (systemMessage) {
        messages.push({
          role: "system",
          content: systemMessage
        });
      }
      
      // 添加用户消息
      messages.push({
        role: "user",
        content: prompt
      });
      
      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          messages: messages,
          extra_body: {
            reasoning: {
              enabled: true
            }
          }
        },
        {
          headers: {
            'accept': '*/*',
            'accept-language': 'zh-CN,zh;q=0.9',
            'authorization': `Bearer ${this.apiKey}`,
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'origin': 'null',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
          }
        }
      );

      // 检查响应格式
      if (!response.data) {
        throw new Error('DeepSeek API返回空响应');
      }
      
      // 处理可能的响应格式差异
      if (response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content;
      } else if (response.data.content) {
        return response.data.content;
      } else if (response.data.output && response.data.output.text) {
        return response.data.output.text;
      } else {
        console.error('DeepSeek API返回的响应格式:', JSON.stringify(response.data, null, 2));
        throw new Error('无法解析DeepSeek API响应格式');
      }
    } catch (error) {
      console.error('DeepSeek API调用错误:', error);
      throw error;
    }
  }
}

class GeminiAdapter extends BaseLLMAdapter {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;
    this.model = config.model || 'gemini-pro';
    this.temperature = config.temperature || 0.7;
    this.maxTokens = config.maxTokens || 4096;
  }

  async invoke(prompt) {
    try {
      const response = await axios.post(
        `${this.baseURL}?key=${this.apiKey}`,
        {
          contents: [{ 
            parts: [{ text: prompt }] 
          }],
          generationConfig: {
            temperature: this.temperature,
            maxOutputTokens: this.maxTokens
          }
        },
        {
          headers: {
            'accept': '*/*',
            'accept-language': 'zh-CN,zh;q=0.9',
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'origin': 'null',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
          }
        }
      );

      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Gemini API调用错误:', error);
      throw error;
    }
  }
}

class AzureOpenAIAdapter extends BaseLLMAdapter {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
    this.model = config.deployment || config.model;
    this.temperature = config.temperature || 0.7;
    this.maxTokens = config.maxTokens || 4096;
    this.apiVersion = config.apiVersion || '2023-12-01-preview';
  }

  async invoke(prompt) {
    return this.invokeWithSystemMessage(prompt);
  }
  
  async invokeWithSystemMessage(prompt, systemMessage = null) {
    try {
      const messages = [];
      
      // 如果有系统消息，添加到消息数组开头
      if (systemMessage) {
        messages.push({
          role: "system",
          content: systemMessage
        });
      }
      
      // 添加用户消息
      messages.push({
        role: "user",
        content: prompt
      });
      
      const response = await axios.post(
        `${this.baseURL}/openai/deployments/${this.model}/chat/completions?api-version=${this.apiVersion}`,
        {
          messages: messages,
          temperature: this.temperature,
          max_tokens: this.maxTokens
        },
        {
          headers: {
            'accept': '*/*',
            'accept-language': 'zh-CN,zh;q=0.9',
            'api-key': this.apiKey,
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'origin': 'null',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Azure OpenAI API调用错误:', error);
      throw error;
    }
  }
}

class OllamaAdapter extends BaseLLMAdapter {
  constructor(config) {
    super(config);
    this.baseURL = config.baseURL || 'http://localhost:11434';
    this.model = config.model || 'llama2';
    this.temperature = config.temperature || 0.7;
    this.maxTokens = config.maxTokens || 4096;
  }

  async invoke(prompt) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/chat`,
        {
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          options: {
            temperature: this.temperature,
            num_predict: this.maxTokens
          }
        },
        {
          headers: {
            'accept': '*/*',
            'accept-language': 'zh-CN,zh;q=0.9',
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'origin': 'null',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
          }
        }
      );

      return response.data.message.content;
    } catch (error) {
      console.error('Ollama API调用错误:', error);
      throw error;
    }
  }
}

/**
 * 工厂函数：根据provider创建对应的适配器实例
 * @param {string} provider - LLM提供商
 * @param {object} config - 配置对象
 * @returns {BaseLLMAdapter} - 适配器实例
 */
function createLLMAdapter(provider, config) {
  switch (provider.toLowerCase()) {
    case 'openai':
      return new OpenAIAdapter(config);
    case 'deepseek':
      return new DeepSeekAdapter(config);
    case 'gemini':
      return new GeminiAdapter(config);
    case 'azure_openai':
      return new AzureOpenAIAdapter(config);
    case 'ollama':
      return new OllamaAdapter(config);
    default:
      throw new Error(`不支持的LLM提供商: ${provider}`);
  }
}

module.exports = {
  BaseLLMAdapter,
  OpenAIAdapter,
  DeepSeekAdapter,
  GeminiAdapter,
  AzureOpenAIAdapter,
  OllamaAdapter,
  createLLMAdapter
};
