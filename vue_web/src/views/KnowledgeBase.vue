<template>
  <div class="knowledge-base-container">
    <el-page-header @back="() => $router.push(`/novel/${novelId}`)" :title="'知识库管理'">
      <template #extra>
        <el-button-group>
          <el-button
            type="primary"
            @click="showUploadDialog = true"
          >
            上传知识文件
          </el-button>
          <el-button
            type="danger"
            @click="confirmClearKnowledgeBase"
          >
            清空知识库
          </el-button>
        </el-button-group>
      </template>
    </el-page-header>

    <el-container>
      <el-main class="main-content">
        <el-card header="知识库搜索">
          <el-input
            v-model="searchQuery"
            placeholder="搜索知识库内容"
            @keyup.enter="searchKnowledge"
            clearable
          >
            <template #append>
              <el-button @click="searchKnowledge">
                <el-icon><Search /></el-icon>
              </el-button>
            </template>
          </el-input>
        </el-card>

        <el-card header="搜索结果" class="search-results" v-if="searchResults.length > 0">
          <div
            v-for="(result, index) in searchResults"
            :key="index"
            class="search-result-item"
          >
            <div class="result-header">
              <span class="result-filename">{{ result.metadata.filename || '未知文件' }}</span>
              <span class="result-type">{{ result.metadata.type || '未知类型' }}</span>
            </div>
            <div class="result-content">{{ result.content }}</div>
          </div>
        </el-card>

        <el-empty v-else-if="hasSearched && searchResults.length === 0" description="没有找到相关内容" />

        <el-empty v-if="!hasSearched" description="请输入关键词搜索知识库" />
      </el-main>
    </el-container>

    <!-- 上传对话框 -->
    <el-dialog v-model="showUploadDialog" title="上传知识文件" width="500px">
      <el-upload
        class="upload-demo"
        drag
        multiple
        :auto-upload="false"
        :on-change="handleFileChange"
        :file-list="fileList"
        :limit="10"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          将文件拖到此处，或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 txt/pdf/doc/docx 格式文件，单个文件不超过 10MB
          </div>
        </template>
      </el-upload>

      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" @click="uploadFiles" :loading="uploading">
          上传
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, UploadFilled } from '@element-plus/icons-vue'
import api from '@/utils/api'

const route = useRoute()
const novelId = route.params.id

// 状态
const searchQuery = ref('')
const searchResults = ref([])
const hasSearched = ref(false)
const showUploadDialog = ref(false)
const fileList = ref([])
const uploading = ref(false)

// 搜索知识库
async function searchKnowledge() {
  if (!searchQuery.value.trim()) {
    ElMessage.warning('请输入搜索关键词')
    return
  }

  try {
    hasSearched.value = true
    const response = await api.get(`/novel/${novelId}/search?query=${encodeURIComponent(searchQuery.value)}`)

    if (response && response.success) {
      searchResults.value = response.data || []
    } else {
      searchResults.value = []
    }
  } catch (error) {
    console.error('搜索知识库失败:', error)
    ElMessage.error('搜索知识库失败')
    searchResults.value = []
  }
}

// 处理文件选择
function handleFileChange(file, files) {
  // 这里可以添加文件类型验证
  const allowedTypes = ['text/plain', 'application/pdf', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword']

  // 获取文件对象，可能是file.raw或直接是file
  const fileObj = file.raw || file
  
  if (!fileObj || !allowedTypes.includes(fileObj.type)) {
    ElMessage.error(`不支持的文件类型: ${fileObj.type || '未知'}`)
    return false
  }

  if (fileObj.size > 10 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过 10MB')
    return false
  }

  fileList.value = files
  return true
}

// 上传文件
async function uploadFiles() {
  if (fileList.value.length === 0) {
    ElMessage.warning('请选择要上传的文件')
    return
  }

  try {
    uploading.value = true

    // 创建FormData对象
    const formData = new FormData()
    fileList.value.forEach(file => {
      // 获取文件对象，可能是file.raw或直接是file
      const fileObj = file.raw || file
      if (fileObj) {
        formData.append('files', fileObj)
      }
    })

    // 上传文件
    const response = await api.post(`/novel/${novelId}/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    if (response && response.success) {
      ElMessage.success(response.message || '文件上传成功')
      fileList.value = []
      showUploadDialog.value = false
    } else {
      ElMessage.error(response.message || '文件上传失败')
    }
  } catch (error) {
    console.error('上传文件失败:', error)
    ElMessage.error(error.response?.data?.error || '文件上传失败')
  } finally {
    uploading.value = false
  }
}

// 确认清空知识库
async function confirmClearKnowledgeBase() {
  try {
    await ElMessageBox.confirm(
      '确定要清空知识库吗？此操作不可恢复！',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    // 用户确认，执行清空操作
    const response = await api.delete(`/novel/${novelId}/clear`)

    if (response && response.success) {
      ElMessage.success('知识库已清空')
      searchResults.value = []
    } else {
      ElMessage.error(response.message || '清空知识库失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('清空知识库失败:', error)
      ElMessage.error(error.response?.data?.error || '清空知识库失败')
    }
  }
}
</script>

<style scoped>
.knowledge-base-container {
  height: 100vh;
  background-color: #f5f5f5;
}

.main-content {
  padding: 20px;
}

.search-results {
  margin-top: 20px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.search-result-item {
  margin-bottom: 20px;
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 15px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.result-filename {
  font-weight: bold;
  color: #409eff;
}

.result-type {
  background-color: #f0f2f5;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #909399;
}

.result-content {
  line-height: 1.6;
  color: #606266;
}

.upload-demo {
  width: 100%;
}
</style>
