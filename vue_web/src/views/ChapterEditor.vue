<template>
  <div class="chapter-editor-container">
    <el-page-header @back="() => $router.push(`/novel/${novelId}`)" :title="`第${chapterNumber}章 - ${chapterInfo.title || ''}`">
      <template #extra>
        <el-button-group>
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
          <div ref="editor" class="editor"></div>
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
import * as monaco from 'monaco-editor'
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

// 编辑器实例
let editor = null
const editorElement = ref(null)

// 初始化Monaco编辑器
function initEditor() {
  nextTick(() => {
    if (editorElement.value) {
      editor = monaco.editor.create(editorElement.value, {
        value: '',
        language: 'plaintext',
        theme: 'vs-dark',
        automaticLayout: true,
        wordWrap: 'on',
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        lineHeight: 1.6
      })
    }
  })
}

// 获取章节信息
async function fetchChapterInfo() {
  try {
    // 从小说目录解析章节信息
    const { data } = await api.get(`/novel/${novelId}/blueprint`)
    const blueprintText = data.blueprint

    // 使用正则表达式提取章节信息
    const chapterRegex = new RegExp(`第${chapterNumber}章\s*-\s*([^\n]+)\s*本章定位：([^\n]+)\s*核心作用：([^\n]+)\s*悬念密度：([^\n]+)\s*伏笔操作：([^\n]+)\s*认知颠覆：([^\n]+)\s*本章简述：([^\n]+)`, 'g')
    const match = chapterRegex.exec(blueprintText)

    if (match) {
      chapterInfo.value = {
        title: match[1].trim(),
        role: match[2].trim(),
        purpose: match[3].trim(),
        suspenseLevel: match[4].trim(),
        foreshadowing: match[5].trim(),
        plotTwistLevel: match[6].trim(),
        summary: match[7].trim()
      }
    }
  } catch (error) {
    ElMessage.error('获取章节信息失败')
  }
}

// 获取章节内容
async function fetchChapterContent() {
  try {
    const { data } = await api.get(`/novel/${novelId}/chapters/${chapterNumber}`)

    if (data.content) {
      hasDraft.value = true
      if (editor) {
        editor.setValue(data.content)
      }
    }
  } catch (error) {
    ElMessage.error('获取章节内容失败')
  }
}

// 生成章节草稿
async function generateDraft() {
  try {
    generating.value = true

    const { data } = await api.post(`/novel/${novelId}/chapters/${chapterNumber}/draft`, {
      config: {
        provider: 'openai', // 应该从全局配置获取
        apiKey: '', // 应该从全局配置获取
        baseURL: '', // 应该从全局配置获取
        model: '', // 应该从全局配置获取
        temperature: 0.7,
        maxTokens: 4096
      },
      chapterParams
    })

    if (editor) {
      editor.setValue(data.content)
    }

    hasDraft.value = true
    ElMessage.success('章节草稿生成成功')
  } catch (error) {
    ElMessage.error('生成章节草稿失败')
  } finally {
    generating.value = false
  }
}

// 定稿章节
async function finalizeChapter() {
  try {
    finalizing.value = true

    const { data } = await api.post(`/novel/${novelId}/chapters/${chapterNumber}/finalize`, {
      config: {
        provider: 'openai', // 应该从全局配置获取
        apiKey: '', // 应该从全局配置获取
        baseURL: '', // 应该从全局配置获取
        model: '', // 应该从全局配置获取
        temperature: 0.7,
        maxTokens: 4096
      }
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
    const { data } = await api.get(`/novel/${novelId}/knowledge/search?query=${encodeURIComponent(knowledgeQuery.value)}`)
    knowledgeResults.value = data
  } catch (error) {
    ElMessage.error('搜索知识库失败')
  }
}

// 插入知识内容
function insertKnowledge(content) {
  if (editor) {
    const selection = editor.getSelection()
    const model = editor.getModel()

    if (selection.isEmpty()) {
      // 没有选中内容，在光标位置插入
      const position = editor.getPosition()
      model.pushEditOperations(
        [{ range: new monaco.Range(position, position), text: `

${content}

` }],
        ''
      )
    } else {
      // 有选中内容，替换选中的内容
      model.pushEditOperations(
        [{ range: selection, text: content }],
        ''
      )
    }

    // 聚焦到编辑器
    editor.focus()
  }
}

// 组件挂载时初始化
onMounted(() => {
  initEditor()
  fetchChapterInfo()
  fetchChapterContent()
})

// 组件卸载时清理
onUnmounted(() => {
  if (editor) {
    editor.dispose()
  }
})
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
