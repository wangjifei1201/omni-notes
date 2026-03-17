#!/usr/bin/env node
/**
 * 测试代理配置是否正确
 */

const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');
const HttpProxyAgent = require('http-proxy-agent');

// 模拟 createTunnelAgent 函数
function createTunnelAgent(proxyUrl) {
    if (!proxyUrl) {
        console.log('[隧道代理] 代理URL为空，不使用代理');
        return null;
    }

    try {
        // 确保URL有协议前缀
        let finalProxyUrl = proxyUrl;
        if (!finalProxyUrl.startsWith('http://') && !finalProxyUrl.startsWith('https://')) {
            finalProxyUrl = 'http://' + finalProxyUrl;
        }

        const proxyUrlObj = new URL(finalProxyUrl);
        const hostname = proxyUrlObj.hostname;
        const port = Number(proxyUrlObj.port) || (proxyUrlObj.protocol === 'https:' ? 443 : 80);
        console.log(`[隧道代理] 使用代理: ${hostname}:${port}`);

        // 返回 axios 支持的 proxy 配置
        const proxyConfig = {
            host: hostname,
            port: port,
        };

        if (proxyUrlObj.username || proxyUrlObj.password) {
            proxyConfig.auth = {
                username: decodeURIComponent(proxyUrlObj.username),
                password: decodeURIComponent(proxyUrlObj.password)
            };
        }

        return proxyConfig;
    } catch (error) {
        console.error(`[隧道代理] 创建代理配置失败: ${error.message}, URL: ${proxyUrl}`);
        return null;
    }
}

// 测试代理配置
async function testProxy() {
    const proxyUrl = 'http://d2072651992:1ngjc7uy@222.35.227.96:21964';
    const proxyConfig = createTunnelAgent(proxyUrl);

    if (!proxyConfig) {
        console.log('代理配置创建失败');
        return;
    }

    console.log('代理配置:', JSON.stringify(proxyConfig, null, 2));

    // 构建代理URL用于代理包
    const agentProxyUrl = `http://${proxyConfig.auth ? `${proxyConfig.auth.username}:${proxyConfig.auth.password}@` : ''}${proxyConfig.host}:${proxyConfig.port}`;
    console.log('代理URL:', agentProxyUrl);

    const axiosConfig = {
        timeout: 5000,
        httpAgent: new HttpProxyAgent(agentProxyUrl),
        httpsAgent: new HttpsProxyAgent(agentProxyUrl)
    };

    try {
        console.log('测试代理连接...');
        const response = await axios.get('https://httpbin.org/ip', axiosConfig);
        console.log('成功! 响应:', response.data);
    } catch (error) {
        console.log('代理测试失败:', error.message);
    }
}

testProxy();