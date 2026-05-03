/**
 * 小程序配置文件
 */

// 环境配置
const ENV = {
  DEV: 'development',
  PROD: 'production',
};

// 当前环境 (开发时改为 ENV.DEV，上线时改为 ENV.PROD)
const currentEnv = ENV.DEV;

// API 地址配置
const API_URLS = {
  [ENV.DEV]: 'http://192.168.1.163:8000/api/v1',      // 本地开发（局域网IP）
  [ENV.PROD]: 'https://your-domain.com/api/v1',   // 生产环境，请修改为实际地址
};

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