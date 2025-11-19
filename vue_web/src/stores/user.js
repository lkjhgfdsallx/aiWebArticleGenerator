import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Cookies from 'js-cookie'

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = ref(Cookies.get('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || '{}'))

  // 计算属性
  const isAuthenticated = computed(() => !!token.value)

  // 方法
  function setToken(newToken) {
    token.value = newToken
    Cookies.set('token', newToken, { expires: 7 })
  }

  function setUser(newUser) {
    user.value = newUser
    localStorage.setItem('user', JSON.stringify(newUser))
  }

  function logout() {
    token.value = ''
    user.value = {}
    Cookies.remove('token')
    localStorage.removeItem('user')
  }

  return {
    token,
    user,
    isAuthenticated,
    setToken,
    setUser,
    logout
  }
})
