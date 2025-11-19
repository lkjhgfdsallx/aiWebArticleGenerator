/**
 * 用户相关API路由
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs-extra');
const path = require('path');
// const logger = require('../utils/logger');

// 用户数据存储路径
const usersPath = path.join(__dirname, '../data/users.json');

// 确保用户数据文件存在
async function ensureUsersFile() {
  if (!(await fs.pathExists(usersPath))) {
    await fs.writeJson(usersPath, []);
  }
}

// 生成JWT令牌
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证必填字段
    if (!username || !password) {
      return res.status(400).json({ 
        error: '缺少必填字段',
        required: ['username', 'password']
      });
    }

    // 确保用户数据文件存在
    await ensureUsersFile();

    // 读取现有用户
    const users = await fs.readJson(usersPath);

    // 检查用户名是否已存在
    if (users.some(user => user.username === username)) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    // 创建新用户
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      username,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await fs.writeJson(usersPath, users);

    // 生成令牌
    const token = generateToken(newUser);

    res.status(201).json({ 
      success: true, 
      message: '注册成功',
      token,
      user: {
        id: newUser.id,
        username: newUser.username
      }
    });
  } catch (error) {
    console.error('用户注册失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证必填字段
    if (!username || !password) {
      return res.status(400).json({ 
        error: '缺少必填字段',
        required: ['username', 'password']
      });
    }

    // 确保用户数据文件存在
    await ensureUsersFile();

    // 读取用户
    const users = await fs.readJson(usersPath);
    const user = users.find(u => u.username === username);

    // 检查用户是否存在
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成令牌
    const token = generateToken(user);

    res.json({ 
      success: true, 
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('用户登录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
