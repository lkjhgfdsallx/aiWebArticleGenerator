import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getCurrentLLMConfig } from '@/stores/config'
import router from '@/router'

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 60000 // 60秒超时
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    const userStore = useUserStore()
    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`
    }
    
    // 对于需要LLM配置的请求，添加前端配置的LLM信息
    if (config.method === 'post' && 
        (config.url.includes('/novel/') || 
         config.url.includes('/chapter/') || 
         config.url.includes('/knowledge/')) && !config.url.includes('/import')) {
      const llmConfig = getCurrentLLMConfig()
      if (llmConfig && !config.data.config) {
        config.data = {
          ...config.data,
          config: {
            provider: llmConfig.interfaceFormat || 'openai',
            apiKey: llmConfig.apiKey || '',
            baseURL: llmConfig.baseUrl || '',
            model: llmConfig.modelName || '',
            temperature: llmConfig.temperature || 0.7,
            maxTokens: llmConfig.maxTokens || 4096,
            timeout: llmConfig.timeout || 600
          }
        }
      }
    }
    
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    const { response } = error

    if (response) {
      const { status, data } = response

      if (status === 401) {
        // 未授权，跳转到登录页
        const userStore = useUserStore()
        userStore.logout()
        router.push('/login')
        ElMessage.error('登录已过期，请重新登录')
      } else {
        ElMessage.error(data.error || '请求失败')
      }
    } else {
      ElMessage.error('网络错误，请检查网络连接')
    }

    return Promise.reject(error)
  }
)

export default api
