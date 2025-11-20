<template>
  <div class="simple-text-editor" ref="editorContainer">
    <textarea
      ref="textarea"
      v-model="content"
      class="editor-textarea"
      :style="{ height: height }"
      @input="handleInput"
      @keydown="handleKeydown"
      :placeholder="placeholder"
    ></textarea>
    <div class="word-count">
      字数：{{ wordCount }}
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'

// 定义组件属性
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  height: {
    type: String,
    default: '100%'
  },
  placeholder: {
    type: String,
    default: '请输入内容...'
  }
})

// 定义事件
const emit = defineEmits(['update:modelValue', 'change'])

// 组件状态
const content = ref(props.modelValue)
const textarea = ref(null)
const editorContainer = ref(null)

// 监听modelValue变化
watch(() => props.modelValue, (newValue) => {
  if (newValue !== content.value) {
    content.value = newValue
  }
})

// 监听内容变化
watch(content, (newValue) => {
  emit('update:modelValue', newValue)
  emit('change', newValue)
})

// 计算字数
const wordCount = computed(() => {
  if (!content.value) return 0
  // 对于中文，每个字符计为一个字
  // 对于英文，按空格分割后计算单词数
  const chineseChars = (content.value.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = content.value.replace(/[\u4e00-\u9fa5]/g, '').trim() ? 
    content.value.replace(/[\u4e00-\u9fa5]/g, '').trim().split(/\s+/).filter(word => word.length > 0).length : 0
  return chineseChars + englishWords
})

// 处理输入事件
function handleInput() {
  // 自动调整高度
  adjustHeight()
}

// 处理键盘事件
function handleKeydown(event) {
  // Tab键处理
  if (event.key === 'Tab') {
    event.preventDefault()
    const start = textarea.value.selectionStart
    const end = textarea.value.selectionEnd
    const newValue = content.value.substring(0, start) + '  ' + content.value.substring(end)
    content.value = newValue

    // 恢复光标位置
    setTimeout(() => {
      textarea.value.selectionStart = textarea.value.selectionEnd = start + 2
    }, 0)
  }
}

// 调整文本域高度
function adjustHeight() {
  if (!textarea.value) return
  textarea.value.style.height = 'auto'
  textarea.value.style.height = textarea.value.scrollHeight + 'px'
}

// 设置编辑器内容
function setValue(value) {
  content.value = value
  adjustHeight()
}

// 获取编辑器内容
function getValue() {
  return content.value
}

// 在光标位置插入文本
function insertText(text) {
  if (!textarea.value) return

  const start = textarea.value.selectionStart
  const end = textarea.value.selectionEnd
  const newValue = content.value.substring(0, start) + text + content.value.substring(end)
  content.value = newValue

  // 恢复光标位置
  setTimeout(() => {
    textarea.value.selectionStart = textarea.value.selectionEnd = start + text.length
    textarea.value.focus()
  }, 0)
}

// 获取选中的文本
function getSelectedText() {
  if (!textarea.value) return ''
  return content.value.substring(textarea.value.selectionStart, textarea.value.selectionEnd)
}

// 暴露方法
defineExpose({
  setValue,
  getValue,
  insertText,
  getSelectedText,
  focus: () => textarea.value?.focus()
})

// 组件挂载后初始化
onMounted(() => {
  adjustHeight()
})
</script>

<style scoped>
.simple-text-editor {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
}

.editor-textarea {
  width: 100%;
  min-height: 200px;
  padding: 15px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  resize: none;
  outline: none;
  background-color: #1e1e1e;
  color: #d4d4d4;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  flex: 1;
  margin-bottom: 0;
}

.editor-textarea::placeholder {
  color: #8c8c8c;
}

.editor-textarea:focus {
  border-color: #409eff;
}

.word-count {
  text-align: right;
  padding: 5px 15px;
  font-size: 12px;
  color: #8c8c8c;
  background-color: #1e1e1e;
  border: 1px solid #dcdfe6;
  border-top: none;
  border-radius: 0 0 4px 4px;
}
</style>
