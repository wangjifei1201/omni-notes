/**
 * API 服务层 - 封装所有HTTP请求
 */

const config = require('./config');

/**
 * 构建查询字符串 (微信小程序兼容)
 */
function buildQueryString(params = {}) {
  const parts = [];
  for (const key in params) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
    }
  }
  return parts.join('&');
}

// API 地址配置
const API_BASE_URL = config.apiUrl;

// 获取存储的token
function getToken() {
  return wx.getStorageSync('auth_token') || '';
}

// 获取存储的用户ID
function getUserId() {
  return wx.getStorageSync('user_id') || '';
}

/**
 * 发送HTTP请求
 */
function request(method, url, data = null, options = {}) {
  return new Promise((resolve, reject) => {
    const header = {
      'Content-Type': 'application/json',
      ...options.header,
    };

    const token = getToken();
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }

    const fullUrl = `${API_BASE_URL}${url}`;
    console.log(`[API] ${method} ${fullUrl}`);
    console.log('[API] Headers:', header);
    console.log('[API] Data:', data);

    wx.request({
      url: fullUrl,
      method,
      data,
      header,
      timeout: 30000, // 30秒超时
      success: (res) => {
        console.log(`[API] Response (${res.statusCode}):`, res.data);
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // 清除token，跳转到登录
          wx.removeStorageSync('auth_token');
          wx.removeStorageSync('user_id');
          wx.navigateTo({ url: '/pages/auth/login/index' });
          reject(new Error('未授权，请重新登录'));
        } else {
          const errorMsg = res.data?.detail || res.data?.message || `请求失败 (${res.statusCode})`;
          reject(new Error(errorMsg));
        }
      },
      fail: (err) => {
        console.error('[API] Request failed:', err);
        // 处理网络错误
        if (err.errMsg.includes('timeout')) {
          reject(new Error('请求超时，请检查网络连接或服务器地址'));
        } else if (err.errMsg.includes('ERR_CONNECT_REFUSED')) {
          reject(new Error('无法连接到服务器，请检查 API 地址配置'));
        } else {
          reject(new Error(err.errMsg || '网络请求失败'));
        }
      },
    });
  });
}

// ============ Auth API ============
const authApi = {
  // 注册
  register: (email, password, username) => {
    return request('POST', '/auth/register', {
      email,
      password,
      username,
    });
  },

  // 登录
  login: (email, password) => {
    return request('POST', '/auth/login', {
      email,
      password,
    });
  },

  // 获取当前用户
  getCurrentUser: () => {
    return request('GET', '/auth/me');
  },

  // 登出
  logout: () => {
    return request('POST', '/auth/logout');
  },

  // 创建游客账户
  createGuest: () => {
    return request('POST', '/auth/guest');
  },

  // 修改密码
  changePassword: (oldPassword, newPassword) => {
    return request('POST', '/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },

  // 发送手机号验证码
  sendPhoneCode: (phone) => {
    return request('POST', '/auth/send-phone-code', {
      phone,
    });
  },

  // 手机号验证码登录
  phoneLogin: (phone, code) => {
    return request('POST', '/auth/phone-login', {
      phone,
      code,
    });
  },

  // 微信授权登录（新版API）
  wechatPhoneLogin: (code) => {
    return request('POST', '/auth/wechat-phone-login', {
      code,  // 新版只需要手机号code
    });
  },
};

// ============ Video API ============
const videoApi = {
  // 解析视频
  parse: (url) => {
    return request('POST', '/videos/parse', {
      url,
    });
  },
};

// ============ Analysis API ============
const analysisApi = {
  // 创建分析任务
  create: (url, analysisType = 'comprehensive', useWhisper = true, whisperModel = 'base') => {
    return request('POST', '/analysis', {
      url,
      analysis_type: analysisType,
      use_whisper: useWhisper,
      whisper_model: whisperModel,
    });
  },

  // 获取分析进度
  getProgress: (taskId) => {
    return request('GET', `/analysis/${taskId}/status`);
  },

  // 获取分析结果
  getById: (taskId) => {
    return request('GET', `/analysis/${taskId}`);
  },

  // 获取可用的AI模型
  getModels: () => {
    return request('GET', '/analysis/models');
  },

  // 获取分析任务列表
  getList: (params = {}) => {
    const queryString = buildQueryString(params);
    return request('GET', `/analysis?${queryString}`);
  },
};

// ============ History API ============
const historyApi = {
  // 获取历史记录列表
  getList: (params = {}) => {
    const queryString = buildQueryString(params);
    return request('GET', `/history?${queryString}`);
  },

  // 获取历史记录详情
  getById: (historyId) => {
    return request('GET', `/history/${historyId}`);
  },

  // 删除历史记录
  delete: (historyId) => {
    return request('DELETE', `/history/${historyId}`);
  },

  // 批量删除历史记录
  batchDelete: (historyIds) => {
    return request('POST', '/history/batch-delete', {
      history_ids: historyIds,
    });
  },

  // 收藏/取消收藏
  toggleFavorite: (historyId, isFavorite) => {
    return request('PATCH', `/history/${historyId}`, {
      is_favorite: isFavorite,
    });
  },

  // 更新分组
  updateGroup: (historyId, groupId) => {
    return request('PATCH', `/history/${historyId}`, {
      group_id: groupId,
    });
  },
};

// ============ Groups API ============
const groupsApi = {
  // 获取分组列表
  getList: () => {
    return request('GET', '/groups');
  },

  // 创建分组
  create: (name, description = '') => {
    return request('POST', '/groups', {
      name,
      description,
    });
  },

  // 更新分组
  update: (groupId, name, description) => {
    return request('PATCH', `/groups/${groupId}`, {
      name,
      description,
    });
  },

  // 删除分组
  delete: (groupId) => {
    return request('DELETE', `/groups/${groupId}`);
  },
};

// ============ Config API ============
const configApi = {
  // 获取用户配置
  getConfig: () => {
    return request('GET', '/config');
  },

  // 更新用户配置
  updateConfig: (config) => {
    return request('PATCH', '/config', config);
  },
};

module.exports = {
  authApi,
  videoApi,
  analysisApi,
  historyApi,
  groupsApi,
  configApi,
  request,
  getToken,
  getUserId,
};
