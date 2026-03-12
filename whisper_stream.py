#!/usr/bin/env python3
"""
Whisper 流式转录脚本 - 带中间进度更新
"""
import sys
import json
import os
import time
import whisper
import torch
import numpy as np
import warnings
warnings.filterwarnings("ignore")

def format_time(seconds):
    """格式化时间为 MM:SS"""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"

def transcribe_with_progress(audio_path, model_name="base", output_dir="./data", language="Chinese"):
    """转录音频并输出进度"""
    
    try:
        print("[STATUS] 正在启动语音识别...", flush=True)
        print(f"[STATUS] 加载模型: {model_name}", flush=True)
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[STATUS] 使用设备: {device}", flush=True)
        
        # 加载模型
        model = whisper.load_model(model_name).to(device)
        print("[STATUS] 模型加载完成", flush=True)
        print("[PROGRESS] 10%", flush=True)
        
        # 加载音频
        print(f"[STATUS] 加载音频: {audio_path}", flush=True)
        audio = whisper.load_audio(audio_path)
        duration = len(audio) / whisper.audio.SAMPLE_RATE
        print(f"[STATUS] 音频时长: {duration:.2f}秒 ({format_time(duration)})", flush=True)
        print("[PROGRESS] 20%", flush=True)
        
        # 使用后台线程更新进度
        progress = [20]  # 使用列表以便在闭包中修改
        transcribing = True
        
        def update_progress():
            """后台线程：模拟进度更新"""
            while transcribing and progress[0] < 90:
                time.sleep(2)  # 每2秒更新一次
                if progress[0] < 85:
                    progress[0] += 5
                    print(f"[PROGRESS] {progress[0]}%", flush=True)
                    print(f"[STATUS] 转录中...", flush=True)
        
        # 启动进度更新线程
        import threading
        progress_thread = threading.Thread(target=update_progress)
        progress_thread.daemon = True
        progress_thread.start()
        
        # 执行转录
        print("[STATUS] 开始转录...", flush=True)
        result = model.transcribe(
            audio_path,
            language=language,
            task="transcribe",
            fp16=False,
            verbose=False
        )
        
        # 停止进度线程
        transcribing = False
        progress_thread.join(timeout=1)
        
        print("[PROGRESS] 90%", flush=True)
        
        # 获取分段结果
        segments = result.get("segments", [])
        total_segments = len(segments)
        
        if total_segments == 0:
            # 如果没有分段，从完整文本创建
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
        print(f"[STATUS] 识别到 {total_segments} 个片段", flush=True)
        
        for i, seg in enumerate(segments):
            text = seg.get("text", "").strip()
            start = seg.get("start", 0)
            end = seg.get("end", 0)
            
            if text:
                print(f"[TEXT] {text}", flush=True)
            print(f"[TIME] {format_time(start)} --> {format_time(end)}", flush=True)
            sys.stdout.flush()
        
        # 保存结果
        print("[PROGRESS] 100%", flush=True)
        output_path = os.path.join(output_dir, os.path.basename(audio_path).replace('.mp3', '.json'))
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump({"segments": segments}, f, ensure_ascii=False, indent=2)
        
        print(f"[STATUS] 转录完成，共 {len(segments)} 段", flush=True)
        print(f"[STATUS] 结果保存到: {output_path}", flush=True)
        
        return output_path
        
    except Exception as e:
        print(f"[ERROR] 转录失败: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python whisper_stream.py <audio_path> [model_name] [output_dir] [language]", file=sys.stderr)
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "base"
    output_dir = sys.argv[3] if len(sys.argv) > 3 else "./data"
    language = sys.argv[4] if len(sys.argv) > 4 else "Chinese"
    
    transcribe_with_progress(audio_path, model_name, output_dir, language)
