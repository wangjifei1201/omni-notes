function createTunnelAgent(proxyUrl) {
    if (!proxyUrl) return null;
    try {
        let finalProxyUrl = proxyUrl;
        if (!finalProxyUrl.startsWith('http://') && !finalProxyUrl.startsWith('https://')) {
            finalProxyUrl = 'http://' + finalProxyUrl;
        }
        const proxyUrlObj = new URL(finalProxyUrl);
        const hostname = proxyUrlObj.hostname;
        const port = Number(proxyUrlObj.port) || 80;
        console.log('代理配置:', {host: hostname, port, auth: {username: proxyUrlObj.username, password: proxyUrlObj.password}});
        return {host: hostname, port, auth: proxyUrlObj.username ? {username: decodeURIComponent(proxyUrlObj.username), password: decodeURIComponent(proxyUrlObj.password)} : undefined};
    } catch (error) {
        console.error('错误:', error.message);
        return null;
    }
}

const config = createTunnelAgent('http://d2072651992:1ngjc7uy@222.35.227.96:21964');
console.log('最终配置:', JSON.stringify(config, null, 2));