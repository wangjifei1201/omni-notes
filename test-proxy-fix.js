#!/usr/bin/env node
/**
 * 测试代理解析修复
 */

// 模拟 buildPrivateProxyUrl 和 getProxyFromAPI 的逻辑
function buildPrivateProxyUrl(proxyIp, username, password) {
    if (!proxyIp || !username || !password) {
        console.error('[代理] 参数不完整: 需要proxyIp、username、password');
        return null;
    }
    
    // proxyIp 可能是 "1.2.3.4" 或 "1.2.3.4:8080" 格式
    // 构建标准的代理URL：http://username:password@host:port/ 或 http://username:password@host/
    let proxyUrl;
    if (proxyIp.includes(':')) {
        // 已包含端口
        proxyUrl = `http://${username}:${password}@${proxyIp}/`;
    } else {
        // 不包含端口，使用默认HTTP端口
        proxyUrl = `http://${username}:${password}@${proxyIp}:80/`;
    }
    
    console.log(`[代理] 构建私密代理URL: http://***:***@${proxyIp}/`);
    return proxyUrl;
}

function parseProxyData(proxyData) {
    // 解析代理格式，可能形如：
    // "1.2.3.4:8080" 
    // "1.2.3.4:8080|http"
    // "1.2.3.4:8080|http;5.6.7.8:8081|http" (多个)
    // 取第一个代理
    let proxyStr = proxyData;
    if (proxyData.includes(';')) {
        proxyStr = proxyData.split(';')[0]; // 取第一个代理
    }
    
    proxyStr = proxyStr.split('|')[0]; // 移除协议标记部分
    proxyStr = proxyStr.trim();
    
    return proxyStr;
}

function testCreateTunnelAgent(proxyUrl) {
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
        const hostname = proxyUrlObj.hostname || 'unknown';
        const port = proxyUrlObj.port || '80';
        console.log(`[隧道代理] ✓ 成功创建代理配置: ${hostname}:${port}`);
        
        return {
            http: finalProxyUrl,
            https: finalProxyUrl
        };
    } catch (error) {
        console.error(`[隧道代理] ✗ 创建代理配置失败: ${error.message}, URL: ${proxyUrl}`);
        return null;
    }
}

// 测试用例
console.log('\n=== 测试代理解析逻辑 ===\n');

const testCases = [
    '1.2.3.4:8080',
    '1.2.3.4:8080|http',
    '1.2.3.4:8080|http;5.6.7.8:8081|http',
    '{"code": 0, "data": "1.2.3.4:8080", "msg": "success"}',
    '1.2.3.4'
];

const username = 'd2072651992';
const password = '1ngjc7uy';

testCases.forEach((testData, index) => {
    console.log(`测试 ${index + 1}: 原始数据`);
    console.log(`  输入: ${testData}`);
    
    // 模拟API返回为JSON的情况
    let proxyData = testData;
    if (testData.startsWith('{')) {
        try {
            const jsonData = JSON.parse(testData);
            proxyData = jsonData.data;
            console.log(`  解析JSON后: ${proxyData}`);
        } catch (e) {
            console.log(`  JSON解析失败`);
        }
    }
    
    // 解析代理数据
    const parsed = parseProxyData(proxyData);
    console.log(`  解析后: ${parsed}`);
    
    // 构建代理URL
    const proxyUrl = buildPrivateProxyUrl(parsed, username, password);
    console.log(`  代理URL: ${proxyUrl}`);
    
    // 测试URL创建
    if (proxyUrl) {
        testCreateTunnelAgent(proxyUrl);
    }
    
    console.log('');
});

console.log('=== 测试完成 ===\n');
