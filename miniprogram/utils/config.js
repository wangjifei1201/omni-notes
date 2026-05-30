/**
 * 小程序配置文件
 */

// 环境配置
const ENV = {
  DEV: 'development',
  PROD: 'production',
};

// API 地址配置
const API_URLS = {
  [ENV.DEV]: 'http://192.168.1.30:8000/api/v1',      // 本地真机调试（Mac 局域网 IP）
  [ENV.PROD]: 'https://wangxiyue.cloud/api/v1',   // 生产环境
};

// 根据小程序版本自动选择环境：上传后的正式版连接生产，开发/预览/真机调试连接本地
function getCurrentEnv() {
  try {
    const accountInfo = wx.getAccountInfoSync();
    const envVersion = accountInfo.miniProgram.envVersion;
    return envVersion === 'release' ? ENV.PROD : ENV.DEV;
  } catch (e) {
    return ENV.DEV;
  }
}

const currentEnv = getCurrentEnv();

// 导出配置
module.exports = {
  // 当前环境
  env: currentEnv,
  
  // API 地址
  apiUrl: API_URLS[currentEnv],
  
  // 是否为生产环境
  isProduction: currentEnv === ENV.PROD,
  
  // 是否为开发环境
  isDevelopment: currentEnv === ENV.DEV,
  
  // 超时时间(毫秒)
  timeout: 30000,
  
  // 其他配置
  appVersion: '1.0.0',
};