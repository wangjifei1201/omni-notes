const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);


const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001; // 固定端口5001
const DATA_DIR = path.join(__dirname, 'data');

// 确保数据目录存在
async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (e) {}
}
ensureDataDir();

// 翻译文本辅助函数
async function translateText(text, targetLang, config) {
    if (!text || text.trim() === '') return '';
    
    const prompt = `请将以下文本翻译为${targetLang}，保持原有格式和结构：

${text}

只输出翻译结果，不要添加解释或额外内容。`;
    
    const response = await axios.post(
        `${config.baseURL}/chat/completions`,
        {
            model: config.model,
            messages: [
                { role: 'system', content: '你是专业的翻译助手' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 2000
        },
        {
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000
        }
    );
    
    return response.data.choices[0].message.content.trim();
}

// 配置文件路径
const CONFIG_FILE = path.join(__dirname, 'config.json');

// 默认配置
const DEFAULT_CONFIG = {
    aiProvider: 'bailian',
    apiKey: '',
    baseURL: 'https://coding.dashscope.aliyuncs.com/v1',
    model: 'qwen3.5-plus',
    useWhisper: false,
    whisperModel: 'base',
    biliCookie: '',  // B站Cookie，用于下载视频时绕过412错误
    systemPython: 'python3',  // 系统python（有yt-dlp）
    whisperCmd: '/Library/Frameworks/Python.framework/Versions/3.8/bin/whisper'  // Whisper命令路径
};

// 加载配置
async function loadConfig() {
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (e) {
        return DEFAULT_CONFIG;
    }
}

// 保存配置
async function saveConfig(config) {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// 提取BV/AV号
function extractVideoId(input) {
    const patterns = [
        /bilibili\.com\/video\/(BV[\w]+)/i,
        /bilibili\.com\/video\/(av\d+)/i,
        /b23\.tv\/(\w+)/i,
        /^(BV[\w]+)$/i,
        /^(av\d+)$/i
    ];
    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// 获取视频信息
async function getVideoInfo(bvid) {
    const response = await axios.get(
        `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
        {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.bilibili.com'
            },
            timeout: 10000 // 10秒超时
        }
    );

    if (response.data.code !== 0) {
        throw new Error(response.data.message);
    }

    const data = response.data.data;
    return {
        bvid: data.bvid,
        avid: data.aid,
        title: data.title,
        description: data.desc,
        cover: data.pic,
        author: data.owner.name,
        duration: data.duration,
        views: data.stat.view,
        likes: data.stat.like,
        cid: data.cid
    };
}

// 获取视频字幕
async function getVideoSubtitle(avid, cid) {
    try {
        const response = await axios.get(
            `https://api.bilibili.com/x/player/wbi/v2?cid=${cid}&aid=${avid}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.bilibili.com'
                },
                timeout: 10000 // 10秒超时
            }
        );

        if (response.data.code !== 0) return null;

        const subtitles = response.data.data.subtitle?.subtitles;
        if (!subtitles || subtitles.length === 0) return null;

        const subtitleUrl = subtitles[0].subtitle_url;
        const fullUrl = subtitleUrl.startsWith('http') ? subtitleUrl : 'https:' + subtitleUrl;
        const contentResponse = await axios.get(fullUrl, { timeout: 10000 });
        return contentResponse.data;
    } catch (error) {
        return null;
    }
}

// 解析字幕
function parseSubtitle(subtitleData) {
    if (!subtitleData || !subtitleData.body) return null;

    const lines = subtitleData.body.map(item => ({
        start: formatTime(item.from),
        end: formatTime(item.to),
        content: item.content
    }));

    return { lines, fullText: lines.map(l => l.content).join('\n') };
}

// 下载视频音频（使用yt-dlp）
async function downloadAudio(bvid, title, progressCallback = null, biliCookie = null, proxyUrl = null, config = null) {
    const safeTitle = title.replace(/[^\w\s]/g, '').substring(0, 50) || 'video';
    const outputPath = path.join(DATA_DIR, `${bvid}_${safeTitle}.mp3`);
    
    try {
        // 检查文件是否已存在
        await fs.access(outputPath);
        console.log(`[下载] 文件已存在: ${outputPath}`);
        return outputPath;
    } catch {
        // 文件不存在，需要下载
        console.log(`[下载] 开始下载视频: ${bvid}`);
        const url = `https://www.bilibili.com/video/${bvid}`;
        
        // 创建临时cookie文件
        let cookieFile = null;
        if (biliCookie) {
            cookieFile = path.join(DATA_DIR, '.bili_cookies.txt');
            // 转换cookie字符串为Netscape格式
            const cookieLines = biliCookie.split(';').map(c => {
                const [name, value] = c.trim().split('=');
                if (name && value) {
                    return `.bilibili.com\tTRUE\t/\tFALSE\t0\t${name.trim()}\t${value.trim()}`;
                }
                return null;
            }).filter(Boolean);
            
            if (cookieLines.length > 0) {
                const cookieContent = '# Netscape HTTP Cookie File\n# This file was generated by Omni-Notes\n\n' + cookieLines.join('\n');
                await fs.writeFile(cookieFile, cookieContent);
                console.log(`[下载] Cookie文件已创建: ${cookieFile}`);
            }
        }
        
        // 使用 spawn 实时获取进度
        return new Promise((resolve, reject) => {
            const args = [
                '-m', 'yt_dlp',
                '-x',
                '--audio-format', 'mp3',
                '--audio-quality', '0',
                '-o', outputPath,
                '--newline',
                '--progress',
            ];
            
            // 如果提供了Cookie文件，使用--cookies参数
            if (cookieFile) {
                console.log('[下载] 使用Cookie文件');
                args.push('--cookies', cookieFile);
            }
            
            // 如果配置了代理，添加代理参数
            if (proxyUrl) {
                console.log(`[下载] 使用代理: ${proxyUrl}`);
                args.push('--proxy', proxyUrl);
            }
            
            args.push(url);
            
            const systemPython = config && config.systemPython ? config.systemPython : 'python3';
            console.log(`[下载] 执行命令: ${systemPython} ${args.join(' ')}`);
            
            const process = spawn(systemPython, args);
            let lastProgress = '';
            let errorOutput = '';
            
            process.stdout.on('data', (data) => {
                const text = data.toString();
                console.log(`[下载 stdout] ${text.trim()}`);
                
                // 解析进度
                const progressMatch = text.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)/);
                if (progressMatch && progressCallback) {
                    lastProgress = `${progressMatch[1]}% (${progressMatch[2]} @ ${progressMatch[3]})`;
                    progressCallback({
                        type: 'progress',
                        percent: parseFloat(progressMatch[1]),
                        size: progressMatch[2],
                        speed: progressMatch[3],
                        text: lastProgress
                    });
                }
            });
            
            process.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                console.log(`[下载 stderr] ${text.trim()}`);
            });
            
            process.on('close', async (code) => {
                // 清理cookie文件
                if (cookieFile) {
                    try {
                        await fs.unlink(cookieFile);
                        console.log('[下载] Cookie文件已清理');
                    } catch (e) {
                        // 忽略清理错误
                    }
                }
                
                if (code !== 0) {
                    console.error(`[下载] 进程退出码 ${code}, 错误: ${errorOutput}`);
                    reject(new Error(`下载失败 (退出码 ${code}): ${errorOutput.substring(0, 200)}`));
                    return;
                }
                
                try {
                    await fs.access(outputPath);
                    console.log(`[下载] 完成: ${outputPath}`);
                    resolve(outputPath);
                } catch (e) {
                    reject(new Error('下载完成但文件不存在'));
                }
            });
            
            process.on('error', (err) => {
                console.error(`[下载] 启动失败: ${err.message}`);
                reject(new Error('启动下载失败: ' + err.message));
            });
            
            // 5分钟超时
            setTimeout(() => {
                process.kill();
                reject(new Error('下载超时 (5分钟)'));
            }, 300000);
        });
    }
}

// 语音转文字（使用Whisper）
async function transcribeAudio(audioPath, whisperModel = 'base', progressCallback = null, config = null) {
    const outputPath = audioPath.replace('.mp3', '.json');
    
    try {
        // 检查是否已有转录结果
        const existing = await fs.readFile(outputPath, 'utf8');
        console.log(`[转录] 使用已有结果: ${outputPath}`);
        return JSON.parse(existing);
    } catch {
        // 执行Whisper转录（使用流式脚本）
        console.log(`[转录] 开始语音识别: ${audioPath}`);
        console.log(`[转录] 使用模型: ${whisperModel}`);
        
        // 使用流式Python脚本
        const scriptPath = path.join(__dirname, 'whisper_stream.py');
        const args = [
            scriptPath,
            audioPath,
            whisperModel,
            DATA_DIR,
            'Chinese'
        ];
        
        const systemPython = config && config.systemPython ? config.systemPython : 'python3';
        console.log(`[转录] 执行命令: ${systemPython} ${args.join(' ')}`);
        
        return new Promise((resolve, reject) => {
            const process = spawn(systemPython, args);
            let lastText = '';  // 最新识别的文本
            let progressPercent = 0;  // 进度百分比
            let lastTime = '';  // 最后时间
            
            process.stdout.on('data', (data) => {
                const text = data.toString();
                const lines = text.split('\n');
                
                for (const line of lines) {
                    if (!line.trim()) continue;
                    
                    console.log(`[转录] ${line.trim()}`);
                    
                    // 解析进度 [PROGRESS] 45%
                    const progressMatch = line.match(/\[PROGRESS\]\s*(\d+)%/);
                    if (progressMatch) {
                        progressPercent = parseInt(progressMatch[1]);
                    }
                    
                    // 解析文本 [TEXT] 识别的内容
                    const textMatch = line.match(/\[TEXT\]\s*(.+)/);
                    if (textMatch && textMatch[1].trim()) {
                        lastText = textMatch[1].trim();
                    }
                    
                    // 解析时间 [TIME] 00:10 --> 00:15
                    const timeMatch = line.match(/\[TIME\]\s*(\d+:\d+)\s*-->/);
                    if (timeMatch) {
                        lastTime = timeMatch[1];
                    }
                    
                    // 发送进度回调
                    if (progressCallback) {
                        progressCallback({
                            type: 'progress',
                            percent: progressPercent,
                            time: lastTime,
                            text: lastText,
                            raw: line.trim()
                        });
                    }
                }
            });
            
            let errorOutput = '';  // 收集错误输出
            
            process.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;  // 收集错误信息
                const lines = text.split('\n');
                
                for (const line of lines) {
                    if (!line.trim()) continue;
                    
                    console.log(`[转录 stderr] ${line.trim()}`);
                    
                    // 解析Whisper真实进度 (格式: "24%|██▍       | 14332/59498")
                    const realProgressMatch = line.match(/^(\d+)%\|/);
                    if (realProgressMatch) {
                        const realPercent = parseInt(realProgressMatch[1]);
                        // 优先使用真实进度，如果真实进度高于当前进度则更新
                        if (realPercent > progressPercent) {
                            progressPercent = realPercent;
                            
                            // 立即发送进度更新
                            if (progressCallback) {
                                progressCallback({
                                    type: 'progress',
                                    percent: progressPercent,
                                    time: lastTime,
                                    text: lastText,
                                    raw: line.trim()
                                });
                            }
                        }
                    }
                }
            });
            
            process.on('close', async (code) => {
                console.log(`[转录] 进程退出码: ${code}`);
                if (code !== 0) {
                    // 提取关键错误信息
                    let errorMessage = `Whisper 进程退出码 ${code}`;
                    
                    // 检查 SSL 证书错误
                    if (errorOutput.includes('SSL') || errorOutput.includes('CERTIFICATE_VERIFY_FAILED')) {
                        errorMessage = 'SSL 证书验证失败，无法下载 Whisper 模型。请检查网络连接或手动下载模型。';
                    } else if (errorOutput.includes('urlopen error')) {
                        errorMessage = '网络连接失败，无法下载 Whisper 模型。请检查网络连接。';
                    } else if (errorOutput.includes('No such file')) {
                        errorMessage = '找不到音频文件或模型文件。';
                    } else if (errorOutput.includes('[ERROR]')) {
                        // 提取 [ERROR] 后的内容
                        const errorMatch = errorOutput.match(/\[ERROR\]\s*(.+)/);
                        if (errorMatch) {
                            errorMessage = errorMatch[1].trim();
                        }
                    }
                    
                    // 如果错误信息太长，截取前200字符
                    if (errorMessage.length > 200) {
                        errorMessage = errorMessage.substring(0, 200) + '...';
                    }
                    
                    reject(new Error(errorMessage));
                    return;
                }
                try {
                    const result = await fs.readFile(outputPath, 'utf8');
                    console.log(`[转录] 完成，结果已保存: ${outputPath}`);
                    resolve(JSON.parse(result));
                } catch (e) {
                    reject(new Error('读取转录结果失败: ' + e.message));
                }
            });
            
            process.on('error', (err) => {
                console.error(`[转录] 启动失败: ${err.message}`);
                reject(new Error('启动 Whisper 失败: ' + err.message));
            });
            
            // 10分钟超时
            setTimeout(() => {
                process.kill();
                reject(new Error('转录超时'));
            }, 600000);
        });
    }
}

// 解析Whisper结果
function parseWhisperResult(whisperData) {
    const lines = whisperData.segments.map(seg => ({
        start: formatTime(seg.start),
        end: formatTime(seg.end),
        content: seg.text.trim()
    }));

    return { lines, fullText: lines.map(l => l.content).join('\n') };
}

// AI生成摘要 - 一次调用返回所有内容
async function generateAIContent(transcript, videoInfo, config, progressCallback = null) {
    console.log('[AI分析] 开始分析，一次调用生成全部内容...');
    
    // 计算待分析内容的总字数
    const transcriptLength = transcript ? transcript.length : 0;
    const titleLength = videoInfo.title ? videoInfo.title.length : 0;
    const descLength = videoInfo.description ? videoInfo.description.length : 0;
    const totalChars = transcriptLength + titleLength + descLength;
    
    console.log(`[AI分析] 待分析内容总字数: ${totalChars} 字`);
    console.log(`[AI分析]   - 视频标题: ${titleLength} 字`);
    console.log(`[AI分析]   - 视频简介: ${descLength} 字`);
    console.log(`[AI分析]   - 转录内容: ${transcriptLength} 字`);
    
    const startTime = Date.now();
    
    // 发送步骤开始信号，同时传递字数信息
    if (progressCallback) {
        progressCallback('summary', 'running', { totalChars, titleLength, descLength, transcriptLength });
        progressCallback('keypoints', 'running');
        progressCallback('chapters', 'running');
        progressCallback('mindmap', 'running');
    }
    
    const prompt = `请对以下视频内容进行深度分析，生成结构化的学习笔记。请按以下4个步骤进行分析：

视频标题：${videoInfo.title}
视频作者：${videoInfo.author}
视频简介：${videoInfo.description}
视频转录内容（前8000字）：
${transcript.substring(0, 8000)}

【重要：内容纠错指令】
转录内容可能来自语音识别，存在以下常见问题，请在分析时自动识别并纠正：
1. 同音字错误：如"原理"误识别为"元力"、"代码"误识别为"代码"等
2. 专业术语错误：如"Kubernetes"误识别为"酷贝尔内提斯"、"Python"误识别为"派森"等
3. 英文单词错误：如"API"误识别为"诶批埃"、"HTTP"误识别为"黑踢踢批"等
4. 数字和单位错误：如"10GB"误识别为"十吉比"、"50%"误识别为"百分之五十"等
5. 标点符号错误：语音识别常缺少标点或断句不当，请重新组织语句
6. 口语化表达：将口语化、重复、犹豫的表达整理为书面语

请按以下JSON格式输出分析结果（基于纠错后的内容）：
{
    "summary": "详细的视频内容摘要，包含：\n1. 视频背景和核心主题介绍\n2. 主要论点和观点的详细阐述（包含具体例子和数据）\n3. 叙事链：视频内容的逻辑发展脉络，从开始到结束的完整思路\n4. 结论和核心收获\n\n要求：\n- 字数：400-600字\n- 结构：分段清晰，每段一个主题\n- 内容：全面覆盖视频核心内容，不遗漏重要信息\n- 风格：专业、详细、易于理解",
    "keyPoints": [
        {"point": "核心要点1", "detail": "支撑该要点的详细内容说明，包括具体例子、数据、引用或解释。要求：2-4句话，内容充实，有深度。"},
        {"point": "核心要点2", "detail": "支撑该要点的详细内容说明，包括具体例子、数据、引用或解释。要求：2-4句话，内容充实，有深度。"},
        {"point": "核心要点3", "detail": "支撑该要点的详细内容说明，包括具体例子、数据、引用或解释。要求：2-4句话，内容充实，有深度。"},
        {"point": "核心要点4", "detail": "支撑该要点的详细内容说明，包括具体例子、数据、引用或解释。要求：2-4句话，内容充实，有深度。"},
        {"point": "核心要点5", "detail": "支撑该要点的详细内容说明，包括具体例子、数据、引用或解释。要求：2-4句话，内容充实，有深度。"}
    ],
    "chapters": [
        {"time": "00:00", "title": "章节标题", "summary": "章节内容摘要，包含该章节的核心观点和关键信息"}
    ],
    "mindmap": {
        "root": "核心主题",
        "branches": [
            {"title": "分支1", "items": ["要点1", "要点2", "要点3"]},
            {"title": "分支2", "items": ["要点1", "要点2"]},
            {"title": "分支3", "items": ["要点1", "要点2", "要点3"]},
            {"title": "分支4", "items": ["要点1", "要点2"]}
        ]
    }
}

要求：
1. summary要详细全面（400-600字），包含：
   - 视频背景和核心主题
   - 主要论点和观点的详细阐述（含具体例子和数据）
   - 叙事链：视频的逻辑发展脉络
   - 结论和核心收获
2. keyPoints提取5个最有价值的观点，每个要点包含：
   - point: 核心观点（简洁标题）
   - detail: 详细说明（2-4句话，包含具体例子、数据、引用，内容充实有深度）
3. chapters划分6-8个章节，time格式MM:SS，每个章节summary要详细
4. mindmap构建4个知识分支（使用正确的技术术语）
5. 统一转成标准中文，禁止使用繁体字。
6. 输出必须是合法JSON`;

    try {
        const response = await callAIAPI(prompt, config);
        
        // 解析JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('AI返回格式错误，无法解析JSON');
        }
        
        const result = JSON.parse(jsonMatch[0]);
        
        const endTime = Date.now();
        console.log(`[AI分析] 完成！耗时: ${(endTime - startTime) / 1000}秒`);
        
        // 发送步骤完成信号
        if (progressCallback) {
            progressCallback('summary', 'completed');
            progressCallback('keypoints', 'completed');
            progressCallback('chapters', 'completed');
            progressCallback('mindmap', 'completed');
        }
        
        return {
            summary: result.summary || '',
            keyPoints: result.keyPoints || [],
            chapters: result.chapters || [],
            mindmap: result.mindmap || { root: '', branches: [] }
        };
        
    } catch (error) {
        console.error('[AI分析] 失败:', error);
        throw error;
    }
}

// 调用AI API的通用函数
async function callAIAPI(prompt, config) {
    const response = await axios.post(
        `${config.baseURL}/chat/completions`,
        {
            model: config.model,
            messages: [
                { role: 'system', content: '你是专业的视频内容分析助手' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
        },
        {
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000 // 2分钟超时
        }
    );
    
    return response.data.choices[0].message.content;
}

// AI问答
async function answerQuestion(question, transcript, videoInfo, config) {
    // 计算待分析内容的总字数
    const transcriptLength = transcript ? transcript.length : 0;
    const questionLength = question ? question.length : 0;
    const titleLength = videoInfo.title ? videoInfo.title.length : 0;
    const totalChars = Math.min(transcriptLength, 5000) + questionLength + titleLength;
    
    console.log(`[AI问答] 待分析内容总字数: ${totalChars} 字`);
    console.log(`[AI问答]   - 视频标题: ${titleLength} 字`);
    console.log(`[AI问答]   - 转录内容(前5000字): ${Math.min(transcriptLength, 5000)} 字`);
    console.log(`[AI问答]   - 用户问题: ${questionLength} 字`);
    
    const prompt = `基于以下视频内容回答问题。

视频标题：${videoInfo.title}
视频转录内容（前5000字）：
${transcript.substring(0, 5000)}

【注意：转录内容可能来自语音识别，存在同音字、专业术语、英文单词等识别错误。请结合视频标题和上下文语义自动纠正后回答问题。】

用户问题：${question}

请根据视频内容给出准确、详细的回答（使用纠正后的专业术语）。`;

    const response = await axios.post(
        `${config.baseURL}/chat/completions`,
        {
            model: config.model,
            messages: [
                { role: 'system', content: '你是专业的视频内容问答助手' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
        },
        {
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data.choices[0].message.content;
}

// 格式化时间
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// API路由

// 获取配置
app.get('/api/config', async (req, res) => {
    const config = await loadConfig();
    res.json(config);
});

// 保存配置
app.post('/api/config', async (req, res) => {
    await saveConfig(req.body);
    res.json({ success: true });
});

// 历史记录文件路径
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');

// 加载历史记录
async function loadHistoryFromFile() {
    try {
        const data = await fs.readFile(HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// 保存历史记录
async function saveHistoryToFile(history) {
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// 加载分组
async function loadGroupsFromFile() {
    try {
        const data = await fs.readFile(GROUPS_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// 保存分组
async function saveGroupsToFile(groups) {
    await fs.writeFile(GROUPS_FILE, JSON.stringify(groups, null, 2));
}

// 获取历史记录
app.get('/api/history', async (req, res) => {
    try {
        const history = await loadHistoryFromFile();
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 保存历史记录
app.post('/api/history', async (req, res) => {
    try {
        const record = req.body;
        let history = await loadHistoryFromFile();
        
        // 检查是否已存在相同视频
        const existingIndex = history.findIndex(h => h.videoInfo.bvid === record.videoInfo.bvid);
        if (existingIndex >= 0) {
            // 保留原有分组信息
            const existingGroupId = history[existingIndex].groupId;
            history[existingIndex] = { ...record, groupId: existingGroupId };
        } else {
            history.unshift(record);
        }
        
        // 只保留最近50条
        if (history.length > 50) {
            history = history.slice(0, 50);
        }
        
        await saveHistoryToFile(history);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除历史记录
app.delete('/api/history/:bvid', async (req, res) => {
    try {
        let history = await loadHistoryFromFile();
        history = history.filter(h => h.videoInfo.bvid !== req.params.bvid);
        await saveHistoryToFile(history);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取分组
app.get('/api/groups', async (req, res) => {
    try {
        const groups = await loadGroupsFromFile();
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 保存分组
app.post('/api/groups', async (req, res) => {
    try {
        const groups = req.body;
        await saveGroupsToFile(groups);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新历史记录分组
app.put('/api/history/:bvid/group', async (req, res) => {
    try {
        const { groupId } = req.body;
        let history = await loadHistoryFromFile();
        
        const record = history.find(h => h.videoInfo.bvid === req.params.bvid);
        if (record) {
            record.groupId = groupId;
            await saveHistoryToFile(history);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 检测本地Whisper模型
app.get('/api/whisper-models', async (req, res) => {
    try {
        const os = require('os');
        const path = require('path');
        const fs = require('fs').promises;
        
        // 可能的模型目录路径
        const possiblePaths = [
            path.join(os.homedir(), '.cache', 'whisper'),  // Linux/Mac 默认路径
            path.join(os.homedir(), 'AppData', 'Local', 'whisper'),  // Windows 路径
            '/root/.cache/whisper',  // Linux root 用户
            '/home/openclaw/.cache/whisper',  // 特定用户
        ];
        
        let modelsDir = null;
        for (const dir of possiblePaths) {
            try {
                await fs.access(dir);
                modelsDir = dir;
                break;
            } catch {
                continue;
            }
        }
        
        if (!modelsDir) {
            return res.json({
                available: false,
                models: [],
                message: '未找到 Whisper 模型目录，请先在服务器上运行 whisper 命令下载模型'
            });
        }
        
        // 读取模型目录
        const files = await fs.readdir(modelsDir);
        const modelFiles = files.filter(f => f.endsWith('.pt'));
        
        // 解析模型名称
        const models = modelFiles.map(f => {
            const name = f.replace('.pt', '');
            const sizes = {
                'tiny': { size: '39 MB', desc: '最快，适合测试' },
                'base': { size: '74 MB', desc: '推荐，平衡速度和质量' },
                'small': { size: '244 MB', desc: '更准，适合生产' },
                'medium': { size: '769 MB', desc: '最准，需要更多内存' },
                'large': { size: '1550 MB', desc: '最佳质量，需要GPU' }
            };
            const info = sizes[name] || { size: '未知', desc: '' };
            return {
                name: name,
                file: f,
                size: info.size,
                desc: info.desc
            };
        });
        
        res.json({
            available: true,
            modelsDir: modelsDir,
            models: models,
            message: models.length > 0 ? `找到 ${models.length} 个模型` : '模型目录存在但没有找到模型文件'
        });
        
    } catch (error) {
        console.error('[检测模型] 错误:', error);
        res.status(500).json({
            available: false,
            models: [],
            message: '检测模型失败: ' + error.message
        });
    }
});

// 全局进度存储（用于轮询）
const analysisProgress = new Map();

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 获取分析进度
app.get('/api/analyze/progress/:id', (req, res) => {
    const progress = analysisProgress.get(req.params.id);
    if (!progress) {
        return res.status(404).json({ error: '进度不存在' });
    }
    res.json(progress);
});

// 分析视频（异步处理，立即返回analysisId）
app.post('/api/analyze', async (req, res) => {
    const analysisId = generateId();
    
    try {
        const { videoId, useWhisper = false } = req.body;
        const config = await loadConfig();

        if (!config.apiKey) {
            return res.status(400).json({ error: '请先配置AI API密钥' });
        }

        const bvid = extractVideoId(videoId);
        if (!bvid) {
            return res.status(400).json({ error: '无效的视频链接' });
        }

        // 初始化进度
        analysisProgress.set(analysisId, {
            id: analysisId,
            status: 'running',
            currentStep: 'extract',
            steps: {
                extract: { status: 'running', startTime: Date.now(), endTime: null },
                download: { status: 'pending', startTime: null, endTime: null },
                transcribe: { status: 'pending', startTime: null, endTime: null, model: config.whisperModel || 'base' },
                analyze: { status: 'pending', startTime: null, endTime: null }
            },
            startTime: Date.now(),
            whisperModel: config.whisperModel || 'base',
            result: null,
            error: null
        });

        // 立即返回analysisId，后台异步处理
        res.json({ analysisId, status: 'started' });

        // 后台异步处理分析任务
        processAnalysis(analysisId, bvid, useWhisper, config).catch(error => {
            console.error('分析任务失败:', error);
            const progress = analysisProgress.get(analysisId);
            if (progress) {
                progress.status = 'error';
                progress.error = error.message;
            }
        });

    } catch (error) {
        analysisProgress.delete(analysisId);
        console.error('启动分析失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取分析结果
app.get('/api/analyze/result/:id', (req, res) => {
    const progress = analysisProgress.get(req.params.id);
    if (!progress) {
        return res.status(404).json({ error: '分析任务不存在' });
    }
    
    if (progress.status === 'completed') {
        res.json({ status: 'completed', result: progress.result });
    } else if (progress.status === 'error') {
        res.status(500).json({ status: 'error', error: progress.error });
    } else if (progress.status === 'no_subtitle') {
        res.status(404).json({ 
            status: 'no_subtitle', 
            videoInfo: progress.videoInfo,
            progress: progress
        });
    } else {
        res.json({ status: 'running', progress: progress });
    }
});

// 后台处理分析任务
async function processAnalysis(analysisId, bvid, useWhisper, config) {
    let progress = analysisProgress.get(analysisId);
    
    try {
        // 获取视频信息
        const videoInfo = await getVideoInfo(bvid);

        // 尝试获取字幕
        let subtitleData = await getVideoSubtitle(videoInfo.avid, videoInfo.cid);
        let transcriptData;
        let source = 'subtitle';

        if (subtitleData) {
            // 使用CC字幕
            transcriptData = parseSubtitle(subtitleData);
            progress.steps.extract.status = 'completed';
            progress.steps.extract.endTime = Date.now();
            // CC字幕不需要下载和转录，直接标记为跳过
            progress.steps.download.status = 'skipped';
            progress.steps.download.endTime = Date.now();
            progress.steps.transcribe.status = 'skipped';
            progress.steps.transcribe.endTime = Date.now();
        } else if (useWhisper) {
            // 使用Whisper语音转文字
            try {
                // 更新进度：开始下载
                analysisProgress.get(analysisId).currentStep = 'download';
                analysisProgress.get(analysisId).steps.extract.status = 'completed';
                analysisProgress.get(analysisId).steps.extract.endTime = Date.now();
                analysisProgress.get(analysisId).steps.download.status = 'running';
                analysisProgress.get(analysisId).steps.download.startTime = Date.now();
                
                // 下载并实时更新进度
                const biliCookie = config.biliCookie || process.env.BILI_COOKIE || null;
                const proxyUrl = (config.proxy && config.proxy.enabled) ? config.proxy.url : null;
                const audioPath = await downloadAudio(bvid, videoInfo.title, (update) => {
                    const prog = analysisProgress.get(analysisId);
                    if (prog) {
                        prog.downloadProgress = update;
                    }
                }, biliCookie, proxyUrl, config);
                
                // 更新进度：开始转录
                analysisProgress.get(analysisId).currentStep = 'transcribe';
                analysisProgress.get(analysisId).steps.download.status = 'completed';
                analysisProgress.get(analysisId).steps.download.endTime = Date.now();
                analysisProgress.get(analysisId).steps.transcribe.status = 'running';
                analysisProgress.get(analysisId).steps.transcribe.startTime = Date.now();
                
                // 转录并实时更新进度
                const whisperResult = await transcribeAudio(audioPath, config.whisperModel, (update) => {
                    const prog = analysisProgress.get(analysisId);
                    if (prog) {
                        prog.transcribeLive = update;
                    }
                }, config);
                transcriptData = parseWhisperResult(whisperResult);
                source = 'whisper';
                
                analysisProgress.get(analysisId).steps.transcribe.status = 'completed';
                analysisProgress.get(analysisId).steps.transcribe.endTime = Date.now();
            } catch (error) {
                // 判断是下载失败还是转录失败
                const currentStep = analysisProgress.get(analysisId).currentStep;
                
                if (currentStep === 'transcribe' || error.message.includes('Whisper') || error.message.includes('转录')) {
                    // 转录步骤失败
                    progress.steps.transcribe.status = 'error';
                    progress.steps.transcribe.endTime = Date.now();
                    progress.steps.transcribe.error = error.message;
                    // 确保下载步骤标记为完成（因为下载成功后才进入转录）
                    if (progress.steps.download.status === 'running') {
                        progress.steps.download.status = 'completed';
                        progress.steps.download.endTime = Date.now();
                    }
                } else {
                    // 下载步骤失败
                    progress.steps.download.status = 'error';
                    progress.steps.download.endTime = Date.now();
                    progress.steps.download.error = error.message;
                }
                
                progress.status = 'error';
                progress.error = '下载/转录失败: ' + error.message;
                console.error(`[分析任务 ${analysisId}] ${currentStep} 失败:`, error);
                // 60秒后清理
                setTimeout(() => analysisProgress.delete(analysisId), 60000);
                return;
            }
        } else {
            // 更新进度为完成提取步骤
            progress.steps.extract.status = 'completed';
            progress.steps.extract.endTime = Date.now();
            progress.status = 'no_subtitle';
            progress.videoInfo = {
                bvid: videoInfo.bvid,
                title: videoInfo.title,
                author: videoInfo.author,
                cover: videoInfo.cover,
                duration: formatTime(videoInfo.duration),
                views: videoInfo.views
            };
            
            // 60秒后清理进度数据
            setTimeout(() => analysisProgress.delete(analysisId), 60000);
            return;
        }

        // AI分析
        progress.currentStep = 'analyze';
        progress.steps.analyze.status = 'running';
        progress.steps.analyze.startTime = Date.now();
        
        let aiResult;
        try {
            aiResult = await generateAIContent(transcriptData.fullText, videoInfo, config, (node, status, charInfo) => {
                const prog = analysisProgress.get(analysisId);
                if (prog) {
                    prog.analyzeNode = { node, status, time: Date.now() };
                    // 保存字数信息
                    if (charInfo && charInfo.totalChars) {
                        prog.charInfo = charInfo;
                    }
                }
            });
        } catch (aiError) {
            progress.status = 'error';
            progress.error = 'AI分析失败: ' + (aiError.response?.data?.error?.message || aiError.message);
            console.error('AI分析错误:', aiError);
            // 60秒后清理
            setTimeout(() => analysisProgress.delete(analysisId), 60000);
            return;
        }
        
        progress.steps.analyze.status = 'completed';
        progress.steps.analyze.endTime = Date.now();
        progress.status = 'completed';

        const result = {
            videoInfo: {
                bvid: videoInfo.bvid,
                title: videoInfo.title,
                author: videoInfo.author,
                description: videoInfo.description,
                cover: videoInfo.cover,
                duration: formatTime(videoInfo.duration),
                views: videoInfo.views,
                likes: videoInfo.likes
            },
            transcript: transcriptData.lines,
            transcriptSource: source,
            summary: aiResult.summary,
            keyPoints: aiResult.keyPoints,
            chapters: aiResult.chapters,
            mindmap: aiResult.mindmap,
            analysisId
        };

        // 保存结果到进度对象
        progress.result = result;
        
        // 清理进度数据
        setTimeout(() => analysisProgress.delete(analysisId), 60000);
        
    } catch (error) {
        // 重新获取 progress 对象（可能在 catch 块中未定义）
        progress = analysisProgress.get(analysisId);
        if (progress) {
            progress.status = 'error';
            progress.error = error.message;
        }
        console.error('分析失败:', error);
        // 60秒后清理
        setTimeout(() => analysisProgress.delete(analysisId), 60000);
    }
}

// 问答
app.post('/api/ask', async (req, res) => {
    try {
        const { question, transcript, videoInfo } = req.body;
        const config = await loadConfig();

        if (!config.apiKey) {
            return res.status(400).json({ error: '请先配置AI API密钥' });
        }

        const answer = await answerQuestion(question, transcript, videoInfo, config);
        res.json({ answer });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 重新生成摘要
app.post('/api/regenerate', async (req, res) => {
    try {
        const { transcript, videoInfo, config: clientConfig } = req.body;
        
        // 使用客户端传来的配置或加载服务器配置
        let config = clientConfig;
        if (!config || !config.apiKey) {
            config = await loadConfig();
        }
        
        if (!config.apiKey) {
            return res.status(400).json({ error: '请先配置AI API密钥' });
        }

        // 重新生成AI内容
        const aiResult = await generateAIContent(transcript, videoInfo, config);
        
        res.json({
            summary: aiResult.summary,
            keyPoints: aiResult.keyPoints,
            chapters: aiResult.chapters,
            mindmap: aiResult.mindmap
        });
    } catch (error) {
        console.error('重新生成摘要失败:', error);
        res.status(500).json({ 
            error: error.response?.data?.error?.message || error.message || '重新生成失败' 
        });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 翻译内容
app.post('/api/translate', async (req, res) => {
    try {
        const { result, targetLang } = req.body;
        const config = await loadConfig();
        
        if (!config.apiKey) {
            return res.status(400).json({ error: '请先配置AI API密钥' });
        }
        
        const langNames = {
            'en': 'English',
            'zh': '简体中文',
            'zh-tw': '繁体中文',
            'ja': '日语',
            'ko': '韩语',
            'es': '西班牙语',
            'fr': '法语',
            'de': '德语',
            'ru': '俄语',
            'ar': '阿拉伯语'
        };
        
        const targetLangName = langNames[targetLang] || targetLang;
        console.log(`[翻译] 开始翻译为 ${targetLangName}`);
        
        // 翻译摘要
        console.log('[翻译] 翻译摘要...');
        const translatedSummary = await translateText(result.summary, targetLangName, config);
        
        // 翻译核心要点
        console.log('[翻译] 翻译核心要点...');
        const translatedKeyPoints = [];
        for (const kp of result.keyPoints) {
            if (typeof kp === 'string') {
                translatedKeyPoints.push(await translateText(kp, targetLangName, config));
            } else {
                translatedKeyPoints.push({
                    point: await translateText(kp.point, targetLangName, config),
                    detail: await translateText(kp.detail, targetLangName, config)
                });
            }
        }
        
        // 翻译章节
        console.log('[翻译] 翻译章节...');
        const translatedChapters = [];
        for (const ch of result.chapters) {
            translatedChapters.push({
                time: ch.time,
                title: await translateText(ch.title, targetLangName, config),
                summary: await translateText(ch.summary, targetLangName, config)
            });
        }
        
        console.log('[翻译] 翻译完成');
        
        res.json({
            summary: translatedSummary,
            keyPoints: translatedKeyPoints,
            chapters: translatedChapters,
            targetLang: targetLang,
            targetLangName: targetLangName
        });
        
    } catch (error) {
        console.error('[翻译] 错误:', error);
        res.status(500).json({ error: error.message || '翻译失败' });
    }
});

// 翻译全部内容（分部分进行，避免超时）
app.post('/api/translate-all', async (req, res) => {
    try {
        const { result, targetLang } = req.body;
        const config = await loadConfig();
        
        if (!config.apiKey) {
            return res.status(400).json({ error: '请先配置 AI API 密钥' });
        }
        
        const langNames = {
            'en': 'English',
            'zh': '简体中文',
            'ja': '日语',
            'ko': '韩语',
            'es': '西班牙语',
            'fr': '法语',
            'de': '德语'
        };
        
        const targetLangName = langNames[targetLang] || targetLang;
        console.log(`[翻译] 开始翻译为 ${targetLangName}`);
        
        // 保存原文
        const originalSummary = result.summary;
        const originalKeyPoints = JSON.parse(JSON.stringify(result.keyPoints));
        const originalChapters = JSON.parse(JSON.stringify(result.chapters));
        
        // 翻译摘要（第一部分）- 摘要可能很长，分段翻译
        console.log('[翻译] 翻译摘要...');
        let translatedSummary;
        try {
            // 如果摘要太长，只翻译前500字
            const summaryToTranslate = result.summary.length > 500 
                ? result.summary.substring(0, 500) + '...' 
                : result.summary;
            translatedSummary = await translateTextWithTimeout(summaryToTranslate, targetLangName, config, 120000);
        } catch (e) {
            console.error('[翻译] 摘要翻译超时，使用原文:', e.message);
            translatedSummary = result.summary;
        }
        
        // 翻译核心要点（第二部分，逐条翻译）
        console.log('[翻译] 翻译核心要点...');
        const translatedKeyPoints = [];
        for (let i = 0; i < result.keyPoints.length; i++) {
            const kp = result.keyPoints[i];
            console.log(`[翻译] 翻译要点 ${i+1}/${result.keyPoints.length}...`);
            try {
                if (typeof kp === 'string') {
                    translatedKeyPoints.push(await translateTextWithTimeout(kp, targetLangName, config, 120000));
                } else {
                    const translatedPoint = await translateTextWithTimeout(kp.point, targetLangName, config, 120000);
                    const translatedDetail = await translateTextWithTimeout(kp.detail, targetLangName, config, 120000);
                    translatedKeyPoints.push({
                        point: translatedPoint,
                        detail: translatedDetail
                    });
                }
            } catch (e) {
                console.error(`[翻译] 要点 ${i+1} 翻译失败，使用原文:`, e.message);
                translatedKeyPoints.push(kp);
            }
        }
        
        // 翻译章节（第三部分，逐条翻译）
        console.log('[翻译] 翻译章节...');
        const translatedChapters = [];
        for (let i = 0; i < result.chapters.length; i++) {
            const ch = result.chapters[i];
            console.log(`[翻译] 翻译章节 ${i+1}/${result.chapters.length}...`);
            try {
                const translatedTitle = await translateTextWithTimeout(ch.title, targetLangName, config, 120000);
                const translatedSummary = await translateTextWithTimeout(ch.summary, targetLangName, config, 120000);
                translatedChapters.push({
                    time: ch.time,
                    title: translatedTitle,
                    summary: translatedSummary
                });
            } catch (e) {
                console.error(`[翻译] 章节 ${i+1} 翻译失败，使用原文:`, e.message);
                translatedChapters.push(ch);
            }
        }
        
        // 翻译思维导图（第四部分）
        console.log('[翻译] 翻译思维导图...');
        let translatedMindmap = null;
        if (result.mindmap) {
            try {
                const translatedRoot = await translateTextWithTimeout(result.mindmap.root, targetLangName, config, 120000);
                const translatedBranches = [];
                for (const b of result.mindmap.branches) {
                    const translatedTitle = await translateTextWithTimeout(b.title, targetLangName, config, 120000);
                    const translatedItems = [];
                    for (const item of b.items) {
                        translatedItems.push(await translateTextWithTimeout(item, targetLangName, config, 10000));
                    }
                    translatedBranches.push({
                        title: translatedTitle,
                        items: translatedItems
                    });
                }
                translatedMindmap = {
                    root: translatedRoot,
                    branches: translatedBranches
                };
            } catch (e) {
                console.error('[翻译] 思维导图翻译失败，使用原文:', e.message);
                translatedMindmap = result.mindmap;
            }
        }
        
        console.log('[翻译] 翻译完成');
        
        res.json({
            summary: translatedSummary,
            keyPoints: translatedKeyPoints,
            chapters: translatedChapters,
            mindmap: translatedMindmap,
            originalSummary: originalSummary,
            originalKeyPoints: originalKeyPoints,
            originalChapters: originalChapters,
            targetLang: targetLang,
            targetLangName: targetLangName
        });
        
    } catch (error) {
        console.error('[翻译] 错误:', error);
        res.status(500).json({ error: error.message || '翻译失败' });
    }
});

// 带超时的翻译函数（带重试）
async function translateTextWithTimeout(text, targetLang, config, timeoutMs = 120000, retries = 2) {
    if (!text || text.trim() === '') return '';
    
    // 截断过长的文本
    const maxLength = 300;
    const truncatedText = text.length > maxLength 
        ? text.substring(0, maxLength) + '...' 
        : text;
    
    const prompt = `翻译为${targetLang}：\n\n${truncatedText}\n\n只输出翻译结果：`;
    
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await axios.post(
                `${config.baseURL}/chat/completions`,
                {
                    model: config.model,
                    messages: [
                        { role: 'system', content: '你是翻译助手，只输出翻译结果' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 1000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${config.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: timeoutMs
                }
            );
            
            return response.data.choices[0].message.content.trim();
        } catch (e) {
            console.log(`[翻译] 第${i+1}次尝试失败:`, e.message);
            if (i === retries) throw e;
            await new Promise(r => setTimeout(r, 1000)); // 等待1秒后重试
        }
    }
}

// 重新生成全部内容
app.post('/api/regenerate-all', async (req, res) => {
    try {
        const { transcript, videoInfo, config: clientConfig } = req.body;
        
        let config = clientConfig;
        if (!config || !config.apiKey) {
            config = await loadConfig();
        }
        
        if (!config.apiKey) {
            return res.status(400).json({ error: '请先配置 AI API 密钥' });
        }
        
        console.log('[重新生成] 开始重新分析内容...');
        
        // 重新生成 AI 内容（分步骤）
        const aiResult = await generateAIContent(transcript, videoInfo, config);
        
        console.log('[重新生成] 完成');
        
        res.json(aiResult);
        
    } catch (error) {
        console.error('[重新生成] 错误:', error);
        res.status(500).json({ 
            error: error.response?.data?.error?.message || error.message || '重新生成失败' 
        });
    }
});

// 检查 yt-dlp 状态
app.get('/api/check-ytdlp', async (req, res) => {
    try {
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);
        
        // 加载配置
        const config = await loadConfig();
        const systemPython = config.systemPython || 'python3';
        
        // 检查 yt-dlp 版本
        const { stdout } = await execPromise(`${systemPython} -m yt_dlp --version`);
        
        res.json({ 
            status: 'ok', 
            version: stdout.trim(),
            python: systemPython,
            dataDir: DATA_DIR
        });
    } catch (error) {
        // 加载配置
        const config = await loadConfig();
        const systemPython = config.systemPython || 'python3';
        
        res.status(500).json({ 
            status: 'error', 
            error: error.message,
            python: systemPython
        });
    }
});

// 静态文件
app.use('/', express.static(__dirname));

const server = app.listen(PORT, () => {
    const actualPort = server.address().port;
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║     📝 Omni-Notes - 智能视频笔记助手           ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log(`║  📱 访问地址: http://localhost:${actualPort}          ║`);
    console.log('║  ⚙️  请先配置AI API: /api/config               ║');
    console.log('╚════════════════════════════════════════════════╝');
});

// 翻译摘要（独立任务）

module.exports = app;