import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

// 配置存储键名
const CONFIG_KEY = 'ai_novel_generator_config'

// 从本地存储加载配置
function loadConfig() {
  try {
    const savedConfig = localStorage.getItem(CONFIG_KEY)
    if (savedConfig) {
      return JSON.parse(savedConfig)
    }
  } catch (error) {
    console.error('加载配置失败:', error)
    ElMessage.error('加载配置失败')
  }

  // 返回默认配置
  return {
    llmConfigs: {
      default: {
        interfaceFormat: 'openai',
        apiKey: '',
        baseUrl: '',
        modelName: 'gpt-4',
        temperature: 0.7,
        maxTokens: 4096,
        timeout: 600
      }
    },
    defaultLlmConfig: 'default',
    embedding: {
      provider: 'openai',
      model: 'text-embedding-ada-002',
      retrievalK: 4
    }
  }
}

// 保存配置到本地存储
function saveConfig(config) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
    return true
  } catch (error) {
    console.error('保存配置失败:', error)
    ElMessage.error('保存配置失败')
    return false
  }
}

// 当前配置
const config = ref(loadConfig())

// 更新配置
function updateConfig(newConfig) {
  Object.assign(config.value, newConfig)
  return saveConfig(config.value)
}

// 重置配置为默认值
function resetConfig() {
  config.value = loadConfig()
  return saveConfig(config.value)
}

// 获取当前LLM配置
function getCurrentLLMConfig() {
  const configName = config.value.defaultLlmConfig || 'default'
  return config.value.llmConfigs[configName] || config.value.llmConfigs.default
}

// 添加或更新LLM配置
function setLLMConfig(name, llmConfig) {
  if (!config.value.llmConfigs) {
    config.value.llmConfigs = {}
  }
  config.value.llmConfigs[name] = llmConfig
  return saveConfig(config.value)
}

// 设置默认LLM配置
function setDefaultLLMConfig(name) {
  if (config.value.llmConfigs && config.value.llmConfigs[name]) {
    config.value.defaultLlmConfig = name
    return saveConfig(config.value)
  }
  return false
}

export {
  config,
  updateConfig,
  resetConfig,
  getCurrentLLMConfig,
  setLLMConfig,
  setDefaultLLMConfig
}
