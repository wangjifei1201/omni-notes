const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Python路径配置
const SYSTEM_PYTHON = 'python3';  // 系统python（有yt-dlp）
const WHISPER_CMD = '/Library/Frameworks/Python.framework/Versions/3.8/bin/whisper';

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
    biliCookie: ''  // B站Cookie，用于下载视频时绕过412错误
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
async function downloadAudio(bvid, title, progressCallback = null, biliCookie = null) {
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
                const cookieContent = '# Netscape HTTP Cookie File\n# This file was generated by bilibili-summarizer\n\n' + cookieLines.join('\n');
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
                // B站反爬虫绕过
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                '--referer', 'https://www.bilibili.com',
                '--add-header', 'Origin:https://www.bilibili.com',
                '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                '--add-header', 'Accept-Language:zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
                '--add-header', 'Accept-Encoding:gzip, deflate, br',
                '--add-header', 'DNT:1',
                '--add-header', 'Connection:keep-alive',
                '--add-header', 'Upgrade-Insecure-Requests:1',
                '--add-header', 'Sec-Fetch-Dest:document',
                '--add-header', 'Sec-Fetch-Mode:navigate',
                '--add-header', 'Sec-Fetch-Site:none',
                '--add-header', 'Sec-Fetch-User:?1',
                '--add-header', 'Cache-Control:max-age=0',
                '--no-check-certificates',
                '--geo-bypass',
                '--sleep-requests', '1',
                '--extractor-retries', '3',
                '--fragment-retries', '3',
                '--buffer-size', '16K'
            ];
            
            // 如果提供了Cookie文件，使用--cookies参数
            if (cookieFile) {
                console.log('[下载] 使用Cookie文件');
                args.push('--cookies', cookieFile);
            }
            
            args.push(url);
            
            console.log(`[下载] 执行命令: ${SYSTEM_PYTHON} ${args.join(' ')}`);
            
            const process = spawn(SYSTEM_PYTHON, args);
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
async function transcribeAudio(audioPath, whisperModel = 'base', progressCallback = null) {
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
        
        console.log(`[转录] 执行命令: ${SYSTEM_PYTHON} ${args.join(' ')}`);
        
        return new Promise((resolve, reject) => {
            const process = spawn(SYSTEM_PYTHON, args);
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
            
            process.stderr.on('data', (data) => {
                const text = data.toString();
                console.log(`[转录 stderr] ${text.trim()}`);
            });
            
            process.on('close', async (code) => {
                console.log(`[转录] 进程退出码: ${code}`);
                if (code !== 0) {
                    reject(new Error(`Whisper 进程退出码 ${code}`));
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

// AI生成摘要 - 拆分为多个独立调用
async function generateAIContent(transcript, videoInfo, config, progressCallback = null) {
    const results = {
        summary: '',
        keyPoints: [],
        chapters: [],
        mindmap: { root: '', branches: [] }
    };
    
    // 步骤1: 生成摘要
    console.log('[AI分析] 步骤1: 生成摘要');
    if (progressCallback) progressCallback('summary', 'running');
    try {
        const summaryPrompt = `请对以下视频内容生成一个简洁的摘要，3-4段话概括核心内容。

视频标题：${videoInfo.title}
视频作者：${videoInfo.author}
视频转录内容（前5000字）：
${transcript.substring(0, 5000)}

【注意：转录可能来自语音识别，请自动纠正同音字、专业术语等错误】

请直接输出摘要内容，不要添加标题或额外说明。`;

        const summaryResponse = await callAIAPI(summaryPrompt, config);
        results.summary = summaryResponse;
        if (progressCallback) progressCallback('summary', 'completed');
        console.log('[AI分析] 摘要生成完成');
    } catch (error) {
        console.error('[AI分析] 摘要生成失败:', error);
        throw new Error('生成摘要失败: ' + error.message);
    }
    
    // 步骤2: 提取核心要点
    console.log('[AI分析] 步骤2: 提取核心要点');
    if (progressCallback) progressCallback('keypoints', 'running');
    try {
        const keyPointsPrompt = `请从以下视频内容中提取5个核心要点，每个要点包含标题和详细说明。

视频标题：${videoInfo.title}
视频转录内容（前5000字）：
${transcript.substring(0, 5000)}

【注意：自动纠正语音识别错误，使用正确的专业术语】

请按以下JSON格式输出：
{
    "keyPoints": [
        {"point": "要点标题", "detail": "详细说明内容"},
        {"point": "要点标题", "detail": "详细说明内容"},
        {"point": "要点标题", "detail": "详细说明内容"},
        {"point": "要点标题", "detail": "详细说明内容"},
        {"point": "要点标题", "detail": "详细说明内容"}
    ]
}

要求：
1. 每个要点标题简洁明了
2. detail包含2-4句话解释，有具体例子或数据支撑
3. 输出必须是合法JSON`;

        const keyPointsResponse = await callAIAPI(keyPointsPrompt, config);
        const keyPointsMatch = keyPointsResponse.match(/\{[\s\S]*\}/);
        if (keyPointsMatch) {
            const parsed = JSON.parse(keyPointsMatch[0]);
            results.keyPoints = parsed.keyPoints || [];
        }
        if (progressCallback) progressCallback('keypoints', 'completed');
        console.log('[AI分析] 核心要点提取完成');
    } catch (error) {
        console.error('[AI分析] 核心要点提取失败:', error);
        throw new Error('提取核心要点失败: ' + error.message);
    }
    
    // 步骤3: 划分章节
    console.log('[AI分析] 步骤3: 划分章节');
    if (progressCallback) progressCallback('chapters', 'running');
    try {
        const chaptersPrompt = `请对以下视频内容进行章节划分，识别6-8个主要章节。

视频标题：${videoInfo.title}
视频时长：${videoInfo.duration}
视频转录内容（前5000字）：
${transcript.substring(0, 5000)}

【注意：自动纠正语音识别错误】

请按以下JSON格式输出：
{
    "chapters": [
        {"time": "00:00", "title": "章节标题", "summary": "章节内容摘要"},
        {"time": "05:30", "title": "章节标题", "summary": "章节内容摘要"}
    ]
}

要求：
1. 划分6-8个章节
2. time格式为MM:SS
3. 每个章节有标题和内容摘要
4. 输出必须是合法JSON`;

        const chaptersResponse = await callAIAPI(chaptersPrompt, config);
        const chaptersMatch = chaptersResponse.match(/\{[\s\S]*\}/);
        if (chaptersMatch) {
            const parsed = JSON.parse(chaptersMatch[0]);
            results.chapters = parsed.chapters || [];
        }
        if (progressCallback) progressCallback('chapters', 'completed');
        console.log('[AI分析] 章节划分完成');
    } catch (error) {
        console.error('[AI分析] 章节划分失败:', error);
        throw new Error('划分章节失败: ' + error.message);
    }
    
    // 步骤4: 构建思维导图
    console.log('[AI分析] 步骤4: 构建思维导图');
    if (progressCallback) progressCallback('mindmap', 'running');
    try {
        const mindmapPrompt = `请基于以下视频内容构建一个思维导图，包含核心主题和4个知识分支。

视频标题：${videoInfo.title}
视频转录内容（前3000字）：
${transcript.substring(0, 3000)}

【注意：自动纠正语音识别错误，使用正确的专业术语】

请按以下JSON格式输出：
{
    "mindmap": {
        "root": "核心主题",
        "branches": [
            {"title": "分支1标题", "items": ["要点1", "要点2", "要点3"]},
            {"title": "分支2标题", "items": ["要点1", "要点2"]},
            {"title": "分支3标题", "items": ["要点1", "要点2", "要点3"]},
            {"title": "分支4标题", "items": ["要点1", "要点2"]}
        ]
    }
}

要求：
1. root是视频的核心主题
2. 4个分支涵盖视频的主要内容
3. 每个分支有2-3个要点
4. 输出必须是合法JSON`;

        const mindmapResponse = await callAIAPI(mindmapPrompt, config);
        const mindmapMatch = mindmapResponse.match(/\{[\s\S]*\}/);
        if (mindmapMatch) {
            const parsed = JSON.parse(mindmapMatch[0]);
            results.mindmap = parsed.mindmap || { root: '', branches: [] };
        }
        if (progressCallback) progressCallback('mindmap', 'completed');
        console.log('[AI分析] 思维导图构建完成');
    } catch (error) {
        console.error('[AI分析] 思维导图构建失败:', error);
        throw new Error('构建思维导图失败: ' + error.message);
    }
    
    return results;
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
                const audioPath = await downloadAudio(bvid, videoInfo.title, (update) => {
                    const prog = analysisProgress.get(analysisId);
                    if (prog) {
                        prog.downloadProgress = update;
                    }
                }, biliCookie);
                
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
                });
                transcriptData = parseWhisperResult(whisperResult);
                source = 'whisper';
                
                analysisProgress.get(analysisId).steps.transcribe.status = 'completed';
                analysisProgress.get(analysisId).steps.transcribe.endTime = Date.now();
            } catch (error) {
                // 更新下载步骤为失败状态
                progress.steps.download.status = 'error';
                progress.steps.download.endTime = Date.now();
                progress.steps.download.error = error.message;
                progress.status = 'error';
                progress.error = '下载/转录失败: ' + error.message;
                console.error(`[分析任务 ${analysisId}] 下载失败:`, error);
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
            aiResult = await generateAIContent(transcriptData.fullText, videoInfo, config, (node, status) => {
                const prog = analysisProgress.get(analysisId);
                if (prog) {
                    prog.analyzeNode = { node, status, time: Date.now() };
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

// 翻译全部内容（对照模式）
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
        
        // 保存原文
        const originalSummary = result.summary;
        const originalKeyPoints = JSON.parse(JSON.stringify(result.keyPoints));
        const originalChapters = JSON.parse(JSON.stringify(result.chapters));
        
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
        
        // 翻译思维导图
        console.log('[翻译] 翻译思维导图...');
        let translatedMindmap = null;
        if (result.mindmap) {
            const translatedRoot = await translateText(result.mindmap.root, targetLangName, config);
            const translatedBranches = await Promise.all(
                result.mindmap.branches.map(async b => ({
                    title: await translateText(b.title, targetLangName, config),
                    items: await Promise.all(b.items.map(item => translateText(item, targetLangName, config)))
                }))
            );
            translatedMindmap = {
                root: translatedRoot,
                branches: translatedBranches
            };
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
        
        // 检查 yt-dlp 版本
        const { stdout } = await execPromise(`${SYSTEM_PYTHON} -m yt_dlp --version`);
        
        res.json({ 
            status: 'ok', 
            version: stdout.trim(),
            python: SYSTEM_PYTHON,
            dataDir: DATA_DIR
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            error: error.message,
            python: SYSTEM_PYTHON
        });
    }
});

// 静态文件
app.use('/', express.static(__dirname));

const server = app.listen(PORT, () => {
    const actualPort = server.address().port;
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║     📝 视频AI速记 - B站视频智能分析助手        ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log(`║  📱 访问地址: http://localhost:${actualPort}          ║`);
    console.log('║  ⚙️  请先配置AI API: /api/config               ║');
    console.log('╚════════════════════════════════════════════════╝');
});

module.exports = app;