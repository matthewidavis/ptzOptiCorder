import subprocess
import psutil
import time

RTSP_URL = "rtsp://192.168.12.111:554/1"  # Replace with your camera IP
DURATION = 5  # Monitoring duration in seconds
FFMPEG = r"C:\ffmpeg\bin\ffmpeg.exe"  # Update with your FFmpeg path

def get_active_network_interface():
    """Finds the most active network interface (used for RTSP traffic)."""
    net_io = psutil.net_io_counters(pernic=True)
    best_iface = None
    max_bytes = 0

    for iface, stats in net_io.items():
        total_traffic = stats.bytes_recv + stats.bytes_sent
        if total_traffic > max_bytes:
            max_bytes = total_traffic
            best_iface = iface

    return best_iface

def monitor_rtsp_bitrate(rtsp_url, duration=5):
    try:
        interface = get_active_network_interface()
        if not interface:
            return {"Error": "No active network interfaces detected"}

        # Start FFmpeg to pull the RTSP stream
        ffmpeg_cmd = [
            FFMPEG,
            "-rtsp_transport", "tcp",
            "-i", rtsp_url,
            "-t", str(duration),  # Limit capture duration
            "-an",  # Disable audio
            "-f", "null",  # Discard video output
            "-"
        ]

        print(f"Starting RTSP stream: {rtsp_url}")
        ffmpeg_process = subprocess.Popen(
            ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )

        # Start network monitoring
        net_io_start = psutil.net_io_counters(pernic=True)
        start_bytes = net_io_start[interface].bytes_recv

        time.sleep(duration)  # Monitor traffic while FFmpeg is running

        # Stop FFmpeg
        ffmpeg_process.terminate()
        ffmpeg_process.wait()

        # Get final network stats
        net_io_end = psutil.net_io_counters(pernic=True)
        end_bytes = net_io_end[interface].bytes_recv

        # Calculate bitrate
        total_bytes = end_bytes - start_bytes
        total_bits = total_bytes * 8
        bitrate_mbps = total_bits / (duration * 1_000_000)  # Convert to Mbps

        return {"Estimated Bitrate (Mbps)": f"{bitrate_mbps:.2f} Mbps"}

    except Exception as e:
        return {"Error": f"An unexpected error occurred: {e}"}

if __name__ == "__main__":
    bitrate_info = monitor_rtsp_bitrate(RTSP_URL, DURATION)
    print(bitrate_info)
