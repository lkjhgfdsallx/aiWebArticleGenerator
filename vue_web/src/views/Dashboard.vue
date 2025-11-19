<template>
  <div class="dashboard-container">
    <el-container>
      <el-aside width="200px" class="sidebar">
        <div class="logo">
          <h2>AI小说生成器</h2>
        </div>
        <el-menu
          :default-active="activeMenu"
          class="sidebar-menu"
          @select="handleMenuSelect"
        >
          <el-menu-item index="novels">
            <el-icon><Document /></el-icon>
            <span>我的小说</span>
          </el-menu-item>
          <el-menu-item index="settings">
            <el-icon><Setting /></el-icon>
            <span>系统设置</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-container>
        <el-header class="header">
          <div class="header-right">
            <el-dropdown @command="handleCommand">
              <span class="user-info">
                <el-avatar :size="30" :src="userAvatar" />
                <span>{{ userStore.user.username }}</span>
                <el-icon class="el-icon--right"><arrow-down /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="profile">个人信息</el-dropdown-item>
                  <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-header>

        <el-main class="main-content">
          <div v-if="activeMenu === 'novels'" class="novels-container">
            <div class="page-header">
              <h1>我的小说</h1>
              <el-button type="primary" @click="showCreateDialog = true">
                <el-icon><Plus /></el-icon>
                创建新小说
              </el-button>
            </div>

            <el-table :data="novels" stripe style="width: 100%">
              <el-table-column prop="title" label="小说标题" min-width="180" />
              <el-table-column prop="genre" label="类型" width="120" />
              <el-table-column prop="numChapters" label="章节数" width="100" />
              <el-table-column prop="status" label="状态" width="120">
                <template #default="scope">
                  <el-tag :type="getStatusType(scope.row.status)">
                    {{ getStatusText(scope.row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="updatedAt" label="更新时间" width="180">
                <template #default="scope">
                  {{ formatDate(scope.row.updatedAt) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="260" fixed="right">
                <template #default="scope">
                  <el-button size="small" @click="openNovel(scope.row.id)">
                    打开
                  </el-button>
                  <el-button size="small" type="danger" @click="deleteNovel(scope.row.id)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>

            <div v-if="novels.length === 0" class="empty-state">
              <el-empty description="暂无小说，点击上方按钮创建新小说" />
            </div>
          </div>

          <div v-if="activeMenu === 'settings'" class="settings-container">
            <h1>系统设置</h1>
            <el-form :model="llmConfig" label-width="120px">
              <el-form-item label="LLM提供商">
                <el-select v-model="llmConfig.provider" placeholder="选择LLM提供商">
                  <el-option label="OpenAI" value="openai" />
                  <el-option label="DeepSeek" value="deepseek" />
                  <el-option label="Gemini" value="gemini" />
                  <el-option label="Azure OpenAI" value="azure_openai" />
                  <el-option label="Ollama" value="ollama" />
                </el-select>
              </el-form-item>

              <el-form-item label="API密钥">
                <el-input v-model="llmConfig.apiKey" type="password" show-password />
              </el-form-item>

              <el-form-item label="API地址">
                <el-input v-model="llmConfig.baseURL" />
              </el-form-item>

              <el-form-item label="模型名称">
                <el-input v-model="llmConfig.model" />
              </el-form-item>

              <el-form-item label="温度">
                <el-slider v-model="llmConfig.temperature" :min="0" :max="1" :step="0.1" />
              </el-form-item>

              <el-form-item label="最大令牌数">
                <el-input-number v-model="llmConfig.maxTokens" :min="100" :max="32000" />
              </el-form-item>

              <el-form-item>
                <el-button type="primary" @click="testLLMConfig">测试配置</el-button>
                <el-button type="success" @click="saveLLMConfig">保存配置</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-main>
      </el-container>
    </el-container>

    <!-- 创建小说对话框 -->
    <el-dialog v-model="showCreateDialog" title="创建新小说" width="500px">
      <el-form :model="newNovel" :rules="novelRules" ref="novelFormRef" label-width="100px">
        <el-form-item label="小说标题" prop="title">
          <el-input v-model="newNovel.title" />
        </el-form-item>

        <el-form-item label="类型" prop="genre">
          <el-select v-model="newNovel.genre" placeholder="请选择小说类型">
            <el-option label="玄幻" value="玄幻" />
            <el-option label="科幻" value="科幻" />
            <el-option label="都市" value="都市" />
            <el-option label="历史" value="历史" />
            <el-option label="武侠" value="武侠" />
            <el-option label="言情" value="言情" />
            <el-option label="悬疑" value="悬疑" />
          </el-select>
        </el-form-item>

        <el-form-item label="主题" prop="topic">
          <el-input v-model="newNovel.topic" type="textarea" :rows="3" />
        </el-form-item>

        <el-form-item label="章节数" prop="numChapters">
          <el-input-number v-model="newNovel.numChapters" :min="1" :max="200" />
        </el-form-item>

        <el-form-item label="每章字数" prop="wordNumber">
          <el-input-number v-model="newNovel.wordNumber" :min="500" :max="10000" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createNovel" :loading="creating">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Setting, Plus, ArrowDown } from '@element-plus/icons-vue'
import api from '@/utils/api'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

// 状态
const activeMenu = ref('novels')
const showCreateDialog = ref(false)
const creating = ref(false)
const novels = ref([])
const novelFormRef = ref(null)

// LLM配置
const llmConfig = reactive({
  provider: 'openai',
  apiKey: '',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 4096
})

// 新小说表单
const newNovel = reactive({
  title: '',
  genre: '玄幻',
  topic: '',
  numChapters: 10,
  wordNumber: 3000
})

// 表单验证规则
const novelRules = {
  title: [
    { required: true, message: '请输入小说标题', trigger: 'blur' }
  ],
  genre: [
    { required: true, message: '请选择小说类型', trigger: 'change' }
  ],
  topic: [
    { required: true, message: '请输入小说主题', trigger: 'blur' }
  ],
  numChapters: [
    { required: true, message: '请输入章节数', trigger: 'blur' }
  ],
  wordNumber: [
    { required: true, message: '请输入每章字数', trigger: 'blur' }
  ]
}

// 用户头像
const userAvatar = ref('')

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

// 格式化日期
function formatDate(dateStr) {
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// 菜单选择处理
function handleMenuSelect(index) {
  activeMenu.value = index
}

// 下拉菜单命令处理
function handleCommand(command) {
  if (command === 'logout') {
    userStore.logout()
    router.push('/login')
    ElMessage.success('已退出登录')
  }
}

// 获取小说列表
async function fetchNovels() {
  try {
    const { data } = await api.get('/novel')
    novels.value = data
  } catch (error) {
    ElMessage.error('获取小说列表失败')
  }
}

// 创建小说
async function createNovel() {
  if (!novelFormRef.value) return

  try {
    await novelFormRef.value.validate()
    creating.value = true

    const { data } = await api.post('/novel/create', newNovel)

    ElMessage.success('小说创建成功')
    showCreateDialog.value = false

    // 重置表单
    Object.assign(newNovel, {
      title: '',
      genre: '玄幻',
      topic: '',
      numChapters: 10,
      wordNumber: 3000
    })

    // 刷新列表
    fetchNovels()
  } catch (error) {
    ElMessage.error('创建小说失败')
  } finally {
    creating.value = false
  }
}

// 打开小说
function openNovel(novelId) {
  router.push(`/novel/${novelId}`)
}

// 删除小说
async function deleteNovel(novelId) {
  try {
    await ElMessageBox.confirm('确定要删除这部小说吗？此操作不可恢复', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await api.delete(`/novel/${novelId}`)
    ElMessage.success('小说已删除')

    // 刷新列表
    fetchNovels()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除小说失败')
    }
  }
}

// 测试LLM配置
async function testLLMConfig() {
  try {
    const { data } = await api.post('/config/test-llm', { config: llmConfig })
    ElMessage.success('LLM配置测试成功')
  } catch (error) {
    ElMessage.error('LLM配置测试失败')
  }
}

// 保存LLM配置
async function saveLLMConfig() {
  try {
    // 将配置保存到本地存储
    const config = {
      llmConfigs: {
        default: {
          interfaceFormat: llmConfig.provider,
          modelName: llmConfig.model,
          temperature: llmConfig.temperature,
          maxTokens: llmConfig.maxTokens,
          apiKey: llmConfig.apiKey,
          baseUrl: llmConfig.baseURL,
          timeout: 600
        }
      },
      defaultLlmConfig: 'default'
    }

    localStorage.setItem('ai_novel_generator_config', JSON.stringify(config))
    ElMessage.success('配置保存成功')
  } catch (error) {
    console.error('保存配置失败:', error)
    ElMessage.error('保存配置失败')
  }
}

// 从本地存储加载配置
function loadLLMConfig() {
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
}

// 组件挂载时获取小说列表和加载配置
onMounted(() => {
  fetchNovels()
  loadLLMConfig()
})
</script>

<style scoped>
.dashboard-container {
  height: 100vh;
}

.sidebar {
  background-color: #304156;
  color: #fff;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #263445;
}

.logo h2 {
  color: #fff;
  margin: 0;
  font-size: 18px;
}

.sidebar-menu {
  border-right: none;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 20px;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.user-info span {
  margin-left: 8px;
}

.main-content {
  background-color: #f5f5f5;
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0;
  font-size: 22px;
  color: #303133;
}

.novels-container {
  background-color: #fff;
  border-radius: 4px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.settings-container {
  background-color: #fff;
  border-radius: 4px;
  padding: 20px;
  max-width: 800px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.empty-state {
  margin-top: 50px;
  text-align: center;
}
</style>
