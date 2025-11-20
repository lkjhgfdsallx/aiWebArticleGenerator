<template>
  <div class="chapter-editor-container">
    <el-page-header @back="() => $router.push(`/novel/${novelId}`)" :title="`第${chapterNumber}章 - ${chapterInfo.title || ''}`">
      <template #extra>
        <el-button-group>
          <el-button 
            type="primary" 
            :disabled="!hasDraft"
            @click="saveChapter"
            :loading="finalizing"
          >
            保存修改
          </el-button>
          <el-button
            type="primary"
            :disabled="!hasDraft"
            @click="finalizeChapter"
            :loading="finalizing"
          >
            定稿章节
          </el-button>
        </el-button-group>
      </template>
    </el-page-header>

    <el-container>
      <el-aside width="300px" class="sidebar">
        <el-card header="章节信息" class="chapter-info">
          <div class="info-item">
            <span class="label">章节标题：</span>
            <span>{{ chapterInfo.title || '未加载' }}</span>
          </div>
          <div class="info-item">
            <span class="label">本章定位：</span>
            <span>{{ chapterInfo.role || '未加载' }}</span>
          </div>
          <div class="info-item">
            <span class="label">核心作用：</span>
            <span>{{ chapterInfo.purpose || '未加载' }}</span>
          </div>
          <div class="info-item">
            <span class="label">悬念密度：</span>
            <span>{{ chapterInfo.suspenseLevel || '未加载' }}</span>
          </div>
          <div class="info-item">
            <span class="label">伏笔操作：</span>
            <span>{{ chapterInfo.foreshadowing || '未加载' }}</span>
          </div>
          <div class="info-item">
            <span class="label">认知颠覆：</span>
            <span>{{ chapterInfo.plotTwistLevel || '未加载' }}</span>
          </div>
          <div class="info-item">
            <span class="label">本章简述：</span>
            <span>{{ chapterInfo.summary || '未加载' }}</span>
          </div>
        </el-card>

        <el-card header="章节参数" class="chapter-params">
          <el-form :model="chapterParams" label-width="80px" size="small">
            <el-form-item label="字数">
              <el-input-number v-model="chapterParams.wordNumber" :min="500" :max="10000" />
            </el-form-item>

            <el-form-item label="人物">
              <el-input v-model="chapterParams.charactersInvolved" placeholder="涉及的主要人物" />
            </el-form-item>

            <el-form-item label="道具">
              <el-input v-model="chapterParams.keyItems" placeholder="关键道具" />
            </el-form-item>

            <el-form-item label="场景">
              <el-input v-model="chapterParams.sceneLocation" placeholder="场景地点" />
            </el-form-item>

            <el-form-item label="时限">
              <el-input v-model="chapterParams.timeConstraint" placeholder="时间压力" />
            </el-form-item>

            <el-form-item label="指导">
              <el-input 
                v-model="chapterParams.userGuidance" 
                type="textarea" 
                :rows="3"
                placeholder="用户指导性意见"
              />
            </el-form-item>

            <el-form-item>
              <el-button 
                type="primary" 
                @click="generateDraft"
                :loading="generating"
                style="width: 100%"
              >
                生成草稿
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card header="知识库" class="knowledge-panel">
          <el-input 
            v-model="knowledgeQuery"
            placeholder="搜索知识库"
            @keyup.enter="searchKnowledge"
          >
            <template #append>
              <el-button @click="searchKnowledge">
                <el-icon><Search /></el-icon>
              </el-button>
            </template>
          </el-input>

          <div v-if="knowledgeResults.length > 0" class="knowledge-results">
            <div 
              v-for="(result, index) in knowledgeResults" 
              :key="index"
              class="knowledge-item"
              @click="insertKnowledge(result.content)"
            >
              <div class="knowledge-content">{{ result.content.substring(0, 100) }}...</div>
            </div>
          </div>
        </el-card>
      </el-aside>

      <el-main class="main-content">
        <div class="editor-container">
          <SimpleTextEditor ref="editorRef" v-model="editorContent" class="editor" />
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import SimpleTextEditor from '@/components/SimpleTextEditor.vue'
import api from '@/utils/api'

const route = useRoute()
const router = useRouter()
const novelId = route.params.novelId
const chapterNumber = parseInt(route.params.chapterNumber)

// 状态
const chapterInfo = ref({})
const chapterParams = reactive({
  wordNumber: 3000,
  charactersInvolved: '',
  keyItems: '',
  sceneLocation: '',
  timeConstraint: '',
  userGuidance: ''
})
const knowledgeQuery = ref('')
const knowledgeResults = ref([])
const hasDraft = ref(false)
const generating = ref(false)
const finalizing = ref(false)
const saving = ref(false)

// 编辑器实例
const editorRef = ref(null)
// 编辑器内容
const editorContent = ref('')

// 初始化编辑器
function initEditor() {
  nextTick(() => {
    if (editorRef.value) {
      // 初始化后尝试加载章节内容
      fetchChapterContent()
        
    }
  })
}

// 获取章节信息
async function fetchChapterInfo() {
  try {
    // 从小说目录解析章节信息
    const response = await api.get(`/novel/${novelId}/blueprint`)
    console.log('API响应:', response)
    console.log('API响应类型:', typeof response)
    
    // 获取blueprint文本，处理各种可能的响应格式
    let blueprintText = ''
    if (typeof response === 'string') {
      // 尝试解析JSON字符串
      try {
        const parsedResponse = JSON.parse(response)
        if (parsedResponse && parsedResponse.data && parsedResponse.data.blueprint) {
          blueprintText = parsedResponse.data.blueprint
        }
      } catch (e) {
        console.error('解析响应JSON失败:', e)
        blueprintText = response // 如果解析失败，直接使用原始字符串
      }
    } else if (response && typeof response === 'object' && response.data && typeof response.data === 'string') {
      blueprintText = response.data
    } else if (response && typeof response === 'object' && response.blueprint) {
      blueprintText = response.blueprint
    } else if (response && typeof response === 'object' && response.data && response.data.blueprint) {
      blueprintText = response.data.blueprint
    }

    // 使用字符串分割提取章节信息
    console.log('章节号:', chapterNumber)
    console.log('blueprint文本:', blueprintText)
    
    // 按章节分割blueprint文本
    const chapters = blueprintText.split(/\n\n/)
    const targetChapter = chapters.find(ch => ch.includes(`第${chapterNumber}章`))
    
    console.log('目标章节:', targetChapter)
    
    if (targetChapter) {
      // 提取各字段
      const titleMatch = targetChapter.match(/第${chapterNumber}章\s*-\s*([^\n]+)/)
      const roleMatch = targetChapter.match(/本章定位：([^\n]+)/)
      const purposeMatch = targetChapter.match(/核心作用：([^\n]+)/)
      const suspenseMatch = targetChapter.match(/悬念密度：([^\n]+)/)
      const foreshadowingMatch = targetChapter.match(/伏笔操作：([^\n]+)/)
      const plotTwistMatch = targetChapter.match(/认知颠覆：([^\n]+)/)
      const summaryMatch = targetChapter.match(/本章简述：([^\n]+)/)
      
      chapterInfo.value = {
        title: titleMatch ? titleMatch[1].trim() : `第${chapterNumber}章`,
        role: roleMatch ? roleMatch[1].trim() : '未设置',
        purpose: purposeMatch ? purposeMatch[1].trim() : '未设置',
        suspenseLevel: suspenseMatch ? suspenseMatch[1].trim() : '未设置',
        foreshadowing: foreshadowingMatch ? foreshadowingMatch[1].trim() : '未设置',
        plotTwistLevel: plotTwistMatch ? plotTwistMatch[1].trim() : '未设置',
        summary: summaryMatch ? summaryMatch[1].trim() : '未设置'
      }
    }
    
    // 确保数据已更新到视图
    console.log('章节信息已更新:', chapterInfo.value)
  } catch (error) {
    console.error('获取章节信息失败:', error)
    ElMessage.error('获取章节信息失败')
  }
}

// 获取章节内容
async function fetchChapterContent() {
  try {
    const response = await api.get(`/novel/${novelId}/chapters/${chapterNumber}`)
    console.log('章节内容响应:', response) // 添加调试日志

    if (response && response.data && response.data.content) {
      hasDraft.value = true
      editorContent.value = response.data.content
    }
  } catch (error) {
    console.error('获取章节内容失败:', error) // 添加错误日志
    ElMessage.error('获取章节内容失败')
  }
}

// 生成章节草稿
async function generateDraft() {
  try {
    generating.value = true

    // 从本地存储获取LLM配置
    let llmConfig = {
      provider: 'openai',
      apiKey: '',
      baseURL: '',
      model: '',
      temperature: 0.7,
      maxTokens: 4096,
      timeout: 600
    }

    try {
      const savedConfig = localStorage.getItem('ai_novel_generator_config')
      if (savedConfig) {
        const config = JSON.parse(savedConfig)
        if (config.llmConfigs && config.llmConfigs.default) {
          const defaultConfig = config.llmConfigs.default
          llmConfig.provider = defaultConfig.interfaceFormat || 'openai'
          llmConfig.model = defaultConfig.modelName || 'gpt-4'
          llmConfig.temperature = defaultConfig.temperature || 0.7
          llmConfig.maxTokens = defaultConfig.maxTokens || 4096
          llmConfig.apiKey = defaultConfig.apiKey || ''
          llmConfig.baseURL = defaultConfig.baseUrl || 'https://api.openai.com/v1'
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    }

    const response = await api.post(`/novel/${novelId}/chapters/${chapterNumber}/draft`, {
      userGuidance: chapterParams.userGuidance || '',
      config: llmConfig
    })

    const data = response.data || response
    editorContent.value = data.content

    hasDraft.value = true
    ElMessage.success('章节草稿生成成功')
  } catch (error) {
    ElMessage.error('生成章节草稿失败')
  } finally {
    generating.value = false
  }
}

// 保存章节内容
async function saveChapter() {
  try {
    saving.value = true
    
    // 获取编辑器内容
    const content = editorContent.value
    
    if (!content || content.trim() === '') {
      ElMessage.warning('章节内容不能为空')
      return
    }

    const response = await api.put(`/novel/${novelId}/chapters/${chapterNumber}`, {
      content: content
    })

    hasDraft.value = true
    ElMessage.success('章节内容保存成功')
  } catch (error) {
    ElMessage.error('保存章节内容失败')
  } finally {
    saving.value = false
  }
}

// 定稿章节
async function finalizeChapter() {
  try {
    finalizing.value = true

    // 从本地存储获取LLM配置
    let llmConfig = {
      provider: 'openai',
      apiKey: '',
      baseURL: '',
      model: '',
      temperature: 0.7,
      maxTokens: 4096,
      timeout: 600
    }

    try {
      const savedConfig = localStorage.getItem('ai_novel_generator_config')
      if (savedConfig) {
        const config = JSON.parse(savedConfig)
        if (config.llmConfigs && config.llmConfigs.default) {
          const defaultConfig = config.llmConfigs.default
          llmConfig.provider = defaultConfig.interfaceFormat || 'openai'
          llmConfig.model = defaultConfig.modelName || 'gpt-4'
          llmConfig.temperature = defaultConfig.temperature || 0.7
          llmConfig.maxTokens = defaultConfig.maxTokens || 4096
          llmConfig.apiKey = defaultConfig.apiKey || ''
          llmConfig.baseURL = defaultConfig.baseUrl || 'https://api.openai.com/v1'
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    }

    const response = await api.post(`/novel/${novelId}/chapters/${chapterNumber}/finalize`, {
      config: llmConfig
    })

    ElMessage.success('章节定稿成功')

    // 跳转到小说详情页
    router.push(`/novel/${novelId}`)
  } catch (error) {
    ElMessage.error('章节定稿失败')
  } finally {
    finalizing.value = false
  }
}

// 搜索知识库
async function searchKnowledge() {
  if (!knowledgeQuery.value.trim()) {
    knowledgeResults.value = []
    return
  }

  try {
    const response = await api.get(`/novel/${novelId}/search?query=${encodeURIComponent(knowledgeQuery.value)}`)
    knowledgeResults.value = response.data || response
  } catch (error) {
    ElMessage.error('搜索知识库失败')
  }
}

// 插入知识内容
function insertKnowledge(content) {
  if (editorRef.value) {
    // 使用SimpleTextEditor的insertText方法
    editorRef.value.insertText(`\n\n${content}\n\n`)
    // 聚焦到编辑器
    editorRef.value.focus()
  }
}

// 组件挂载时初始化
onMounted(async () => {
  // 先获取章节信息
  await fetchChapterInfo()
  // 然后初始化编辑器（编辑器初始化后会自动加载章节内容）
  initEditor()
})

// 组件卸载时清理
// SimpleTextEditor组件会自动清理，无需手动处理
</script>

<style scoped>
.chapter-editor-container {
  height: 100vh;
  background-color: #f5f5f5;
}

.sidebar {
  padding: 20px;
  overflow-y: auto;
}

.chapter-info, .chapter-params, .knowledge-panel {
  margin-bottom: 20px;
}

.info-item {
  margin-bottom: 10px;
  font-size: 14px;
}

.label {
  font-weight: bold;
  margin-right: 10px;
}

.main-content {
  padding: 0;
}

.editor-container {
  height: calc(100vh - 60px);
  padding: 20px;
}

.editor {
  height: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.knowledge-results {
  margin-top: 10px;
  max-height: 300px;
  overflow-y: auto;
}

.knowledge-item {
  padding: 8px;
  border-bottom: 1px solid #ebeef5;
  cursor: pointer;
}

.knowledge-item:hover {
  background-color: #f5f7fa;
}

.knowledge-content {
  font-size: 12px;
  color: #606266;
}
</style>
