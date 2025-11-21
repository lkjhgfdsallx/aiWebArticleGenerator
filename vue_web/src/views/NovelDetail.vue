<template>
  <div class="novel-detail-container">
    <el-page-header @back="() => $router.push('/dashboard')" :title="novelInfo.title">
      <template #extra>
        <el-button-group>
          <el-button 
            type="primary" 
            :disabled="novelInfo.status !== 'created' && novelInfo.status !== 'architecture_generated' && novelInfo.status !== 'blueprint_generated'"
            @click="generateArchitecture"
          >
            生成架构
          </el-button>
          <el-button 
            type="primary" 
            :disabled="novelInfo.status !== 'architecture_generated' && novelInfo.status !== 'blueprint_generated'"
            @click="generateBlueprint"
          >
            生成目录
          </el-button>
        </el-button-group>
        <el-button
          type="success"
          @click="openKnowledgeBase"
        >
          知识库管理
        </el-button>
      </template>
    </el-page-header>

    <el-container>
      <el-aside width="300px" class="sidebar">
        <el-card header="小说信息">
          <div class="info-item">
            <span class="label">类型：</span>
            <span>{{ novelInfo.genre }}</span>
          </div>
          <div class="info-item">
            <span class="label">主题：</span>
            <span>{{ novelInfo.topic }}</span>
          </div>
          <div class="info-item">
            <span class="label">章节数：</span>
            <span>{{ novelInfo.numChapters }}</span>
          </div>
          <div class="info-item">
            <span class="label">每章字数：</span>
            <span>{{ novelInfo.wordNumber }}</span>
          </div>
          <div class="info-item">
            <span class="label">状态：</span>
            <el-tag :type="getStatusType(novelInfo.status)">
              {{ getStatusText(novelInfo.status) }}
            </el-tag>
          </div>
        </el-card>

        <el-card header="章节列表" class="chapter-list">
          <div 
            v-for="chapter in chapters" 
            :key="chapter.number" 
            class="chapter-item"
            :class="{ active: currentChapter === chapter.number }"
            @click="openChapter(chapter.number)"
          >
            <span>第{{ chapter.number }}章</span>
            <el-icon v-if="chapter.hasContent" class="has-content"><Check /></el-icon>
          </div>
        </el-card>
      </el-aside>

      <el-main class="main-content">
        <el-tabs v-model="activeTab" class="content-tabs">
          <el-tab-pane label="小说架构" name="architecture">
            <div v-if="architecture" class="content-container">
              <div class="content-actions">
                <el-button type="primary" @click="editArchitecture">编辑</el-button>
              </div>
              <div class="content-display">{{ architecture }}</div>
            </div>
            <div v-else class="empty-state">
              <el-empty description="尚未生成小说架构" />
            </div>
          </el-tab-pane>

          <el-tab-pane label="章节目录" name="blueprint">
            <div v-if="blueprint" class="content-container">
              <div class="content-actions">
                <el-button type="primary" @click="editBlueprint">编辑</el-button>
              </div>
              <div class="content-display">{{ blueprint }}</div>
            </div>
            <div v-else class="empty-state">
              <el-empty description="尚未生成章节目录" />
            </div>
          </el-tab-pane>

          <el-tab-pane label="角色状态" name="characters">
            <div v-if="characterState" class="content-container">
              <div class="content-actions">
                <el-button type="primary" @click="editCharacterState">编辑</el-button>
              </div>
              <pre class="content-display">{{ characterState }}</pre>
            </div>
            <div v-else class="empty-state">
              <el-empty description="尚未生成角色状态" />
            </div>
          </el-tab-pane>

          <el-tab-pane label="全局摘要" name="summary">
            <div v-if="globalSummary" class="content-container">
              <div class="content-actions">
                <el-button type="primary" @click="editGlobalSummary">编辑</el-button>
              </div>
              <div class="content-display">{{ globalSummary }}</div>
            </div>
            <div v-else class="empty-state">
              <el-empty description="尚未生成全局摘要" />
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-main>
    </el-container>

    <!-- 生成架构对话框 -->
    <el-dialog v-model="showArchitectureDialog" title="生成小说架构" width="600px">
      <el-form :model="architectureForm" label-width="100px">
        <el-form-item label="用户指导">
          <el-input 
            v-model="architectureForm.userGuidance" 
            type="textarea" 
            :rows="4"
            placeholder="可选，提供对小说创作的指导性意见"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showArchitectureDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmGenerateArchitecture" :loading="generatingArchitecture">
          生成
        </el-button>
      </template>
    </el-dialog>

    <!-- 生成目录对话框 -->
    <el-dialog v-model="showBlueprintDialog" title="生成章节目录" width="600px">
      <el-form :model="blueprintForm" label-width="100px">
        <el-form-item label="用户指导">
          <el-input 
            v-model="blueprintForm.userGuidance" 
            type="textarea" 
            :rows="4"
            placeholder="可选，提供对章节目录的指导性意见"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showBlueprintDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmGenerateBlueprint" :loading="generatingBlueprint">
          生成
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import api from '@/utils/api'

const route = useRoute()
const router = useRouter()
const novelId = route.params.id

// 状态
const activeTab = ref('architecture')
const currentChapter = ref(null)
const novelInfo = ref({})
const chapters = ref([])
const architecture = ref('')
const blueprint = ref('')
const characterState = ref('')
const globalSummary = ref('')

// 对话框状态
const showArchitectureDialog = ref(false)
const showBlueprintDialog = ref(false)
const generatingArchitecture = ref(false)
const generatingBlueprint = ref(false)

// 表单数据
const architectureForm = reactive({
  userGuidance: ''
})

const blueprintForm = reactive({
  userGuidance: ''
})

// 获取状态类型
function getStatusType(status) {
  const statusMap = {
    'created': '',
    'architecture_generated': 'success',
    'blueprint_generated': 'warning',
    'in_progress': 'info'
  }
  return statusMap[status] || 'info'
}

// 获取状态文本
function getStatusText(status) {
  const statusMap = {
    'created': '已创建',
    'architecture_generated': '架构已生成',
    'blueprint_generated': '目录已生成',
    'in_progress': '创作中'
  }
  return statusMap[status] || '未知状态'
}

// 获取小说信息
async function fetchNovelInfo() {
  try {
    const { data } = await api.get(`/novel/${novelId}`)
    novelInfo.value = data
  } catch (error) {
    ElMessage.error('获取小说信息失败')
  }
}

// 获取章节列表
async function fetchChapters() {
  try {
    // 获取章节列表和blueprint
    const { data } = await api.get(`/novel/${novelId}/chapters`)
    
    // 使用后端返回的章节列表
    if (data && data.chapters) {
      chapters.value = data.chapters;
    } else {
      // 如果没有返回章节数组，则创建空数组
      chapters.value = [];
    }
  } catch (error) {
    ElMessage.error('获取章节列表失败')
  }
}

// 获取小说内容
async function fetchNovelContent() {
  try {
    // 获取小说架构
    try {
      const { data } = await api.get(`/novel/${novelId}/architecture`)
      if (data && data.architecture) {
        architecture.value = data.architecture
      }
    } catch (error) {
      console.log('获取小说架构失败或不存在')
    }

    // 获取章节目录
    try {
      const { data } = await api.get(`/novel/${novelId}/blueprint`)
      if (data && data.blueprint) {
        blueprint.value = data.blueprint
      }
    } catch (error) {
      console.log('获取章节目录失败或不存在')
    }

    // 获取角色状态
    try {
      const { data } = await api.get(`/novel/${novelId}/character-state`)
      if (data && data.characterState) {
        characterState.value = data.characterState
      }
    } catch (error) {
      console.log('获取角色状态失败或不存在')
    }

    // 获取全局摘要
    try {
      const { data } = await api.get(`/novel/${novelId}/global-summary`)
      if (data && data.globalSummary) {
        globalSummary.value = data.globalSummary
      }
    } catch (error) {
      console.log('获取全局摘要失败或不存在')
    }
  } catch (error) {
    console.error('获取小说内容失败:', error)
  }
}

// 打开章节
function openChapter(chapterNumber) {
  currentChapter.value = chapterNumber
  router.push(`/chapter/${novelId}/${chapterNumber}`)
}

// 生成架构
function generateArchitecture() {
  showArchitectureDialog.value = true
}

// 确认生成架构
async function confirmGenerateArchitecture() {
  try {
    generatingArchitecture.value = true
    
    const { data } = await api.post(`/novel/${novelId}/architecture`, {
      userGuidance: architectureForm.userGuidance
    })

    if (data.success) {
      architecture.value = data.data.architecture
      characterState.value = data.data.characterState

      // 更新小说状态
      novelInfo.value.status = 'architecture_generated'

      ElMessage.success('小说架构生成成功')
      showArchitectureDialog.value = false
      
      // 重新获取小说内容
      await fetchNovelContent()
    } else {
      ElMessage.error(data.message || '生成小说架构失败')
    }
  } catch (error) {
    console.error('生成小说架构错误:', error)
    ElMessage.error(error.response?.data?.error || '生成小说架构失败')
  } finally {
    generatingArchitecture.value = false
  }
}

// 生成目录
function generateBlueprint() {
  showBlueprintDialog.value = true
}

// 确认生成目录
async function confirmGenerateBlueprint() {
  try {
    generatingBlueprint.value = true
    
    const { data } = await api.post(`/novel/${novelId}/blueprint`, {
      userGuidance: blueprintForm.userGuidance
    })

    if (data.success) {
      blueprint.value = data.data.blueprint

      // 更新小说状态
      novelInfo.value.status = 'blueprint_generated'

      ElMessage.success('章节目录生成成功')
      showBlueprintDialog.value = false
      
      // 重新获取小说内容和章节列表
      await fetchNovelContent()
      await fetchChapters()
    } else {
      ElMessage.error(data.message || '生成章节目录失败')
    }
  } catch (error) {
    console.error('生成章节目录错误:', error)
    ElMessage.error(error.response?.data?.error || '生成章节目录失败')
  } finally {
    generatingBlueprint.value = false
  }
}

// 编辑架构
function editArchitecture() {
  activeTab.value = 'architecture'
  // 这里可以打开一个编辑器对话框
}

// 编辑目录
function editBlueprint() {
  activeTab.value = 'blueprint'
  // 这里可以打开一个编辑器对话框
}

// 编辑角色状态
function editCharacterState() {
  activeTab.value = 'characters'
  // 这里可以打开一个编辑器对话框
}

// 编辑全局摘要
function editGlobalSummary() {
  activeTab.value = 'summary'
  // 这里可以打开一个编辑器对话框
}

// 打开知识库
function openKnowledgeBase() {
  router.push(`/knowledge/${novelId}`)
}

// 组件挂载时获取数据
onMounted(() => {
  fetchNovelInfo()
  fetchChapters()
  fetchNovelContent()
})
</script>

<style scoped>
.novel-detail-container {
  height: 100vh;
  background-color: #f5f5f5;
}

.sidebar {
  padding: 20px;
}

.info-item {
  margin-bottom: 10px;
}

.label {
  font-weight: bold;
  margin-right: 10px;
}

.chapter-list {
  margin-top: 20px;
  max-height: 400px;
  overflow-y: auto;
}

.chapter-item {
  padding: 10px;
  border-bottom: 1px solid #ebeef5;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chapter-item:hover {
  background-color: #f5f7fa;
}

.chapter-item.active {
  background-color: #ecf5ff;
  color: #409eff;
}

.has-content {
  color: #67c23a;
}

.main-content {
  padding: 20px;
}

.content-tabs {
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.content-container {
  position: relative;
}

.content-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
}

.content-display {
  padding: 20px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Courier New', Courier, monospace;
  line-height: 1.6;
  max-height: 600px;
  overflow-y: auto;
}

.empty-state {
  padding: 40px 0;
  text-align: center;
}
</style>
