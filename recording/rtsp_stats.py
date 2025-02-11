# recording/rtsp_stats.py

import subprocess
import json
import cv2
import time
import numpy as np
import threading
import os
import re
from scapy.all import sniff, IP, TCP, UDP

# Update these paths to your actual locations
FFPROBE = r"C:\ffmpeg\bin\ffprobe.exe"
FFMPEG  = r"C:\ffmpeg\bin\ffmpeg.exe"

# Default measurement duration (in seconds)
DURATION = 5

# Global cache for GOP interval (to use when insufficient data is found)
gop_cache = "N/A"

# (We clear packet_sizes for each bitrate measurement cycle.)
packet_sizes = []

def run_subprocess(cmd, timeout=None):
    """
    Run a subprocess command and return the result.
    Returns None if the command fails or times out.
    """
    try:
        return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                              text=True, timeout=timeout, check=True)
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
        return None

def get_stream_info(rtsp_url):
    """
    Extract metadata from the RTSP stream using ffprobe.
    Returns a dictionary with:
      - "Video Codec"
      - "Resolution"
      - "Frame Rate" (as a string, e.g., "60.00 FPS")
      - "FPS" (numeric, for internal use)
    """
    cmd = [
        FFPROBE,
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-show_format",
        "-rtsp_transport", "tcp",
        rtsp_url
    ]
    result = run_subprocess(cmd)
    if not result:
        return {"Error": "FFprobe failed"}
    try:
        metadata = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"Error": "Invalid JSON from ffprobe"}
    
    info = {}
    fps = 30  # default FPS
    for stream in metadata.get("streams", []):
        if stream.get("codec_type") == "video":
            info["Video Codec"] = stream.get("codec_name", "Unknown")
            info["Resolution"] = f'{stream.get("width", "N/A")}x{stream.get("height", "N/A")}'
            try:
                avg_frame_rate = stream.get("avg_frame_rate", "30")
                fps = eval(avg_frame_rate)
                info["Frame Rate"] = f"{fps:.2f} FPS"
            except Exception:
                info["Frame Rate"] = "30.00 FPS"
                fps = 30
            break  # Use only the first video stream
    info["FPS"] = fps  # internal use
    return info

def measure_gop(rtsp_url, fps, duration=DURATION):
    """
    Measure the GOP (Group of Pictures) interval using FFmpeg.
    Returns a dictionary with "GOP Interval".
    """
    global gop_cache
    cmd = [
        FFMPEG, "-i", rtsp_url,
        "-vf", "select='eq(pict_type,I)',showinfo",
        "-an", "-f", "null", "-t", str(duration), "-"
    ]
    result = run_subprocess(cmd, timeout=duration+5)
    if not result:
        return {"GOP Interval": gop_cache}
    
    i_frame_timestamps = []
    for line in result.stderr.split("\n"):
        if "type:I" in line:
            match = re.search(r'pts:\s*(\d+)\s', line)
            if match:
                i_frame_timestamps.append(int(match.group(1)) / 90000.0)
    if len(i_frame_timestamps) < 2:
        return {"GOP Interval": gop_cache}
    gop_frames = round(np.mean(np.diff(i_frame_timestamps)) * fps)
    gop_cache = f"{int(gop_frames)} frames"
    return {"GOP Interval": gop_cache}

def measure_stream_latency(rtsp_url, duration=2):
    """
    Measure latency, jitter, and dropped frames using OpenCV.
    Returns a dictionary with:
      - "Latency" (in ms)
      - "Jitter" (in ms)
      - "Dropped Frames" (number)
    """
    cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
    if not cap.isOpened():
        return {"Latency": "N/A", "Jitter": "N/A", "Dropped Frames": "N/A"}
    frame_times = []
    dropped_frames = 0
    start_time = time.time()
    while time.time() - start_time < duration:
        ret, _ = cap.read()
        if ret:
            frame_times.append(time.time())
        else:
            dropped_frames += 1
        time.sleep(0.01)
    cap.release()
    if len(frame_times) < 2:
        return {"Latency": "N/A", "Jitter": "N/A", "Dropped Frames": "N/A"}
    intervals = np.diff(frame_times)
    avg_latency = np.mean(intervals) * 1000
    jitter = np.std(intervals) * 1000 if len(intervals) > 1 else 0
    return {
        "Latency": f"{avg_latency:.2f} ms",
        "Jitter": f"{jitter:.2f} ms",
        "Dropped Frames": dropped_frames
    }

def start_rtsp_stream(rtsp_url):
    """
    Start FFmpeg to keep the RTSP stream active (used for bitrate measurement).
    Returns the subprocess.Popen object.
    """
    cmd = [
        FFMPEG,
        "-rtsp_transport", "tcp",
        "-i", rtsp_url,
        "-an", "-f", "null", "-"
    ]
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(2)
    return process

def parse_rtsp_ip_port(rtsp_url):
    """
    Parse the RTSP URL to extract the IP and port.
    Returns a tuple (ip, port) with port defaulting to 554 if not specified.
    """
    pattern = r"rtsp://([^:/]+)(?::(\d+))?/"
    match = re.search(pattern, rtsp_url)
    if match:
        ip = match.group(1)
        port = int(match.group(2)) if match.group(2) else 554
        return ip, port
    return None, None

def packet_handler(packet):
    """Callback function to capture packet sizes for bitrate measurement."""
    global packet_sizes
    if IP in packet and (packet[IP].src or packet[IP].dst):
        if TCP in packet or UDP in packet:
            packet_sizes.append(len(packet))

def measure_live_bitrate(rtsp_url, duration=5):
    """
    Measure the real-time video bitrate (in Mbps) using packet sniffing.
    Returns a dictionary with "Video Bitrate".
    """
    global packet_sizes
    rtsp_ip, rtsp_port = parse_rtsp_ip_port(rtsp_url)
    process = start_rtsp_stream(rtsp_url)
    total_bits = 0
    start_time = time.time()
    while time.time() - start_time < duration:
        packet_sizes = []  # reset for each second
        sniff(filter=f"host {rtsp_ip} and port {rtsp_port}", prn=packet_handler, timeout=1, store=0)
        total_bits += sum(packet_sizes) * 8
    process.terminate()
    bitrate_mbps = (total_bits / duration) / 1_000_000
    return {"Video Bitrate": f"{bitrate_mbps:.2f} Mbps"}

def run_monitoring_cycle(rtsp_url):
    """
    Run one monitoring cycle on the given RTSP URL.
    Returns a dictionary containing the following keys:
      - "Video Codec"
      - "Resolution"
      - "Frame Rate"
      - "GOP Interval"
      - "Latency"
      - "Jitter"
      - "Dropped Frames"
      - "Video Bitrate"
    """
    results = {}
    info = get_stream_info(rtsp_url)
    fps = info.get("FPS", 30)
    results.update(info)

    def task_gop():
        results.update(measure_gop(rtsp_url, fps))
    def task_latency():
        results.update(measure_stream_latency(rtsp_url))
    def task_bitrate():
        results.update(measure_live_bitrate(rtsp_url, DURATION))

    threads = [
        threading.Thread(target=task_gop),
        threading.Thread(target=task_latency),
        threading.Thread(target=task_bitrate)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Remove internal key "FPS" and return only the desired keys.
    results.pop("FPS", None)
    keys = ["Video Codec", "Resolution", "Frame Rate", "GOP Interval", "Latency", "Jitter", "Dropped Frames", "Video Bitrate"]
    final_stats = {k: results.get(k, "N/A") for k in keys}
    return final_stats

# (Optionally, you can remove or modify the __main__ block for testing.)
if __name__ == "__main__":
    # For testing from the command line, allow passing an RTSP URL
    import sys
    if len(sys.argv) > 1:
        test_uri = sys.argv[1]
    else:
        test_uri = input("Enter RTSP URL: ")
    stats = run_monitoring_cycle(test_uri)
    print(json.dumps(stats, indent=2))
