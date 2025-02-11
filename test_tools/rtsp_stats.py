import subprocess
import json
import cv2
import time
import numpy as np
import threading
import os
import re
from scapy.all import sniff, IP, TCP, UDP

# Path to ffmpeg & ffprobe (UPDATE TO YOUR ACTUAL PATHS)
FFPROBE = r"C:\ffmpeg\bin\ffprobe.exe"
FFMPEG = r"C:\ffmpeg\bin\ffmpeg.exe"
RTSP_URL = "rtsp://192.168.12.111:554/1"
RTSP_IP = "192.168.12.111"
RTSP_PORT = 554
DURATION = 5  # Monitoring duration in seconds

# Global cache
gop_cache = "N/A"
packet_sizes = []

def get_stream_info(rtsp_url):
    """Extract metadata from RTSP stream using ffprobe."""
    cmd = [
        FFPROBE, "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format",
        "-rtsp_transport", "tcp", rtsp_url
    ]
    try:
        metadata_bytes = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        metadata = json.loads(metadata_bytes.stdout)
    except Exception as e:
        return {"Error": str(e)}

    video_info = {"Video Bitrate": "N/A"}  # Default placeholder
    fps = 30  # Default FPS

    for stream in metadata.get("streams", []):
        if stream.get("codec_type") == "video":
            video_info["Resolution"] = f'{stream.get("width", "N/A")}x{stream.get("height", "N/A")}'
            video_info["Frame Rate"] = f'{eval(stream.get("avg_frame_rate", "30")):.2f} FPS'
            fps = eval(stream.get("avg_frame_rate", "30"))

    return {**video_info, "FPS": fps}


def measure_gop(rtsp_url, fps, duration=5):
    """Measure GOP interval dynamically using FFmpeg."""
    global gop_cache
    try:
        cmd = [
            FFMPEG, "-i", rtsp_url,
            "-vf", "select='eq(pict_type,I)',showinfo",
            "-an", "-f", "null", "-t", str(duration), "-"
        ]
        result = subprocess.run(cmd, stderr=subprocess.PIPE, text=True, timeout=duration + 5, check=True)

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

    except Exception as e:
        return {"Error": str(e)}


def measure_stream_latency(rtsp_url, duration=2):
    """Measure latency, jitter, and dropped frames using OpenCV."""
    cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)

    if not cap.isOpened():
        return {"Error": "Failed to open stream"}

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
        return {"Error": "Insufficient data"}

    frame_intervals = np.diff(frame_times)
    avg_latency = np.mean(frame_intervals) * 1000
    jitter = np.std(frame_intervals) * 1000 if len(frame_intervals) > 1 else 0

    return {
        "Latency": f"{avg_latency:.2f} ms",
        "Jitter": f"{jitter:.2f} ms",
        "Dropped Frames": dropped_frames
    }


def start_rtsp_stream():
    """Starts FFmpeg to keep the RTSP stream active in the background."""
    ffmpeg_cmd = [
        FFMPEG,
        "-rtsp_transport", "tcp",
        "-i", RTSP_URL,
        "-an", "-f", "null", "-"
    ]
    process = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(2)
    return process


def packet_handler(packet):
    """Captures RTSP packets and logs their size."""
    global packet_sizes
    if IP in packet and (packet[IP].src == RTSP_IP or packet[IP].dst == RTSP_IP):
        if TCP in packet or UDP in packet:
            packet_sizes.append(len(packet))


def measure_live_bitrate(duration=5):
    """Measures the real-time bitrate and returns the value instead of printing separately."""
    global packet_sizes
    ffmpeg_process = start_rtsp_stream()

    total_bits = 0
    start_time = time.time()
    while time.time() - start_time < duration:
        packet_sizes = []  
        sniff(
            filter=f"host {RTSP_IP} and port {RTSP_PORT}",
            prn=packet_handler,
            timeout=1,
            store=0
        )

        if packet_sizes:
            total_bits += sum(packet_sizes) * 8  

    ffmpeg_process.terminate()

    bitrate_mbps = (total_bits / duration) / 1_000_000  # Mbps calculation
    return {"Video Bitrate": f"{bitrate_mbps:.2f} Mbps"}


def clear_console():
    """Clears the terminal screen."""
    os.system('cls' if os.name == 'nt' else 'clear')


def run_continuous_monitoring(interval=5):
    """Runs RTSP monitoring continuously with interval updates."""
    while True:
        results = {}

        # Collect stream information
        results["stream_info"] = get_stream_info(RTSP_URL)
        fps = results["stream_info"].get("FPS", 30)

        # Run GOP, Latency, and Bitrate in parallel
        def run_gop_task():
            results["gop_info"] = measure_gop(RTSP_URL, fps)

        def run_opencv_task():
            results["latency_info"] = measure_stream_latency(RTSP_URL)

        def run_bitrate_task():
            results["bitrate_info"] = measure_live_bitrate(DURATION)

        t1 = threading.Thread(target=run_gop_task)
        t2 = threading.Thread(target=run_opencv_task)
        t3 = threading.Thread(target=run_bitrate_task)

        t1.start()
        t2.start()
        t3.start()

        t1.join()
        t2.join()
        t3.join()

        # Merge results into a single dictionary
        final_info = {**results["stream_info"], **results["gop_info"], **results["latency_info"], **results["bitrate_info"]}

        clear_console()
        print("\n--- RTSP Stream Stats ---")
        for key, value in final_info.items():
            print(f"{key}: {value}")

        print("\nUpdating in {} seconds...\n".format(interval))
        time.sleep(interval)


if __name__ == "__main__":
    run_continuous_monitoring(interval=5)
