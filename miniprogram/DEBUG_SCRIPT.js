// 快速诊断脚本 - 在微信开发者工具控制台运行

// 1. 检查 API 配置
console.log('=== API 配置检查 ===');
const config = require('miniprogram/utils/config');
console.log('当前环境:', config.env);
console.log('API 地址:', config.apiUrl);

// 2. 检查存储状态
console.log('\n=== 存储状态检查 ===');
console.log('auth_token:', wx.getStorageSync('auth_token'));
console.log('user_id:', wx.getStorageSync('user_id'));
console.log('app_state:', wx.getStorageSync('app_state'));

// 3. 检查应用状态
console.log('\n=== 应用状态检查 ===');
const store = require('miniprogram/utils/store');
console.log('Store 状态:', store.getState());

// 4. 测试 API 连接
console.log('\n=== API 连接测试 ===');
const { authApi } = require('miniprogram/utils/api');

// 测试游客登录
authApi.createGuest()
  .then(user => {
    console.log('✓ 游客登录成功:', user);
    console.log('✓ API 连接正常');
  })
  .catch(err => {
    console.error('✗ 游客登录失败:', err.message);
    console.error('✗ API 连接异常');
  });

// 5. 检查当前页面状态
console.log('\n=== 当前页面状态 ===');
const pages = getCurrentPages();
if (pages.length > 0) {
  const currentPage = pages[pages.length - 1];
  console.log('当前页面:', currentPage.route);
  console.log('页面数据:', currentPage.data);
}
