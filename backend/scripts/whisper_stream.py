#!/usr/bin/env python3
"""
Whisper 流式转录脚本 - 稳定的进度输出
"""
import sys
import json
import os
import time
import threading
import whisper
import torch
import warnings

# 禁用警告
warnings.filterwarnings("ignore")

# 设置无缓冲输出
sys.stdout = os.fdopen(sys.stdout.fileno(), 'w', 1)
sys.stderr = os.fdopen(sys.stderr.fileno(), 'w', 1)

# 全局进度状态
progress_state = {"running": True, "last_output": 20}

def format_time(seconds):
    """格式化时间为 MM:SS"""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"

def output_progress(percent):
    """输出进度，避免重复"""
    global progress_state
    if percent > progress_state["last_output"]:
        progress_state["last_output"] = percent
        sys.stdout.write(f"[PROGRESS] {percent}%\n")
        sys.stdout.flush()

def output_status(msg):
    """输出状态信息"""
    sys.stdout.write(f"[STATUS] {msg}\n")
    sys.stdout.flush()

def output_text(text):
    """输出识别的文本"""
    sys.stdout.write(f"[TEXT] {text}\n")
    sys.stdout.flush()

def output_time(start, end):
    """输出时间信息"""
    sys.stdout.write(f"[TIME] {format_time(start)} --> {format_time(end)}\n")
    sys.stdout.flush()

def transcribe_with_progress(audio_path, model_name="base", output_dir="./data", language="Chinese"):
    """转录音频并输出进度"""
    global progress_state
    
    try:
        output_status("正在启动语音识别...")
        output_status(f"加载模型: {model_name}")
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        output_status(f"使用设备: {device}")
        
        # 加载模型
        model = whisper.load_model(model_name).to(device)
        output_status("模型加载完成")
        output_progress(10)
        
        # 加载音频
        output_status(f"加载音频: {audio_path}")
        audio = whisper.load_audio(audio_path)
        duration = len(audio) / whisper.audio.SAMPLE_RATE
        output_status(f"音频时长: {duration:.2f}秒 ({format_time(duration)})")
        output_progress(20)
        
        # 启动进度更新线程
        progress_state["running"] = True
        progress_state["last_output"] = 20
        
        def progress_updater():
            """基于时间估算进度"""
            # 估算转录速度：通常是实时速度的 2-4 倍
            speed_factor = 4.0 if device == "cuda" else 2.5
            estimated_duration = duration / speed_factor
            
            start_time = time.time()
            while progress_state["running"]:
                elapsed = time.time() - start_time
                if elapsed > 0:
                    # 计算预期进度 (20% - 85%)
                    expected_progress = min(85, 20 + (elapsed / estimated_duration) * 65)
                    current_percent = int(expected_progress)
                    output_progress(current_percent)
                time.sleep(0.5)  # 每0.5秒更新一次
        
        updater_thread = threading.Thread(target=progress_updater)
        updater_thread.daemon = True
        updater_thread.start()
        
        # 执行转录
        output_status("开始转录...")
        
        result = model.transcribe(
            audio_path,
            language=language,
            task="transcribe",
            fp16=False,
            verbose=False
        )
        
        # 停止进度更新
        progress_state["running"] = False
        updater_thread.join(timeout=2)
        
        output_progress(90)
        
        # 获取分段结果
        segments = result.get("segments", [])
        total_segments = len(segments)
        
        if total_segments == 0:
            full_text = result.get("text", "").strip()
            if full_text:
                segments = [{
                    "id": 0,
                    "start": 0,
                    "end": duration,
                    "text": full_text
                }]
                total_segments = 1
        
        # 输出每个分段
        output_status(f"识别到 {total_segments} 个片段")
        
        for i, seg in enumerate(segments):
            text = seg.get("text", "").strip()
            start = seg.get("start", 0)
            end = seg.get("end", 0)
            
            if text:
                output_text(text)
            output_time(start, end)
        
        # 保存结果
        output_progress(100)
        output_path = os.path.join(output_dir, os.path.basename(audio_path).replace('.mp3', '.json'))
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump({"segments": segments}, f, ensure_ascii=False, indent=2)
        
        output_status(f"转录完成，共 {len(segments)} 段")
        output_status(f"结果保存到: {output_path}")
        
        return output_path
        
    except Exception as e:
        progress_state["running"] = False
        sys.stderr.write(f"[ERROR] 转录失败: {str(e)}\n")
        sys.stderr.flush()
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: python whisper_stream.py <audio_path> [model_name] [output_dir] [language]\n")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "base"
    output_dir = sys.argv[3] if len(sys.argv) > 3 else "./data"
    language = sys.argv[4] if len(sys.argv) > 4 else "Chinese"
    
    transcribe_with_progress(audio_path, model_name, output_dir, language)
