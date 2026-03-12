// 这个脚本用于修复翻译功能
// 需要在浏览器控制台执行以下代码来更新 startTranslate 函数

const newStartTranslate = `
async function startTranslate(targetLang) {
    closeTranslateModal();
    
    if (!currentResult) {
        showError('没有可翻译的内容');
        return;
    }
    
    switchTab('summary');
    
    const quickActions = document.getElementById('videoQuickActions');
    const originalActions = quickActions.innerHTML;
    quickActions.innerHTML = '<button class="quick-action-btn" disabled>🌐 翻译中...</button>';
    
    try {
        const response = await fetch('/api/translate-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                result: currentResult,
                targetLang: targetLang
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '翻译失败');
        }
        
        const translated = await response.json();
        
        currentResult.translations = currentResult.translations || {};
        currentResult.translations[targetLang] = translated;
        
        currentResult.currentTranslation = {
            lang: targetLang,
            translated: translated,
            original: {
                summary: document.getElementById('summaryContent').innerHTML,
                points: document.getElementById('pointList').innerHTML,
                chapters: document.getElementById('chaptersList').innerHTML
            }
        };
        
        showTranslationInPlace(translated);
        
        quickActions.innerHTML = \`
            <button class="quick-action-btn" onclick="showTranslateModal()">🌐 翻译</button>
            <button class="quick-action-btn" onclick="regenerateAll()">🔄 重新生成</button>
            <button class="quick-action-btn" onclick="toggleTranslationView()">👁️ 查看原文</button>
        \`;
        
    } catch (error) {
        console.error('翻译错误:', error);
        showError('翻译失败：' + error.message);
        quickActions.innerHTML = originalActions;
    }
}
`;

console.log('请将以下代码复制到浏览器控制台执行:');
console.log(newStartTranslate);
