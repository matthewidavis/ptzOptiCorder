import subprocess
import re
import numpy as np

# Path to ffmpeg
FFMPEG = r"C:\ffmpeg\bin\ffmpeg.exe"
RTSP_URL = "rtsp://192.168.12.111:554/1"

def measure_gop(rtsp_url, fps=60, duration=5):
    cmd = [
        FFMPEG, "-i", rtsp_url,
        "-vf", "select='eq(pict_type,I)',showinfo",
        "-t", str(duration),
        "-an", "-f", "null", "-"
    ]

    result = subprocess.run(cmd, stderr=subprocess.PIPE, text=True, timeout=duration + 5)

    i_frame_timestamps = []
    for line in result.stderr.split("\n"):
        if "type:I" in line:
            match = re.search(r'pts:\s*(\d+)\s', line)
            if match:
                pts_time = int(match.group(1)) / 90000.0
                i_frame_timestamps.append(pts_time)

    if len(i_frame_timestamps) < 2:
        return "N/A"

    gop_differences = np.diff(i_frame_timestamps)
    avg_gop_time = np.mean(gop_differences)
    gop_frames = round(avg_gop_time * fps)

    return f"{int(gop_frames)} frames"

gop_result = measure_gop(RTSP_URL, fps=60, duration=5)
print(f"[FINAL RESULT] GOP Interval: {gop_result}")