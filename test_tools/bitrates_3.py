import subprocess
from scapy.all import sniff, IP, TCP, UDP
import time

RTSP_URL = "rtsp://192.168.12.111:554/1"  # Update with your RTSP stream
RTSP_IP = "192.168.12.111"  # Camera IP
RTSP_PORT = 554  # Default RTSP port
FFMPEG = r"C:\ffmpeg\bin\ffmpeg.exe"  # Update with your FFmpeg path
DURATION = 5  # Monitoring duration in seconds

packet_sizes = []

def start_rtsp_stream():
    """Starts FFmpeg to keep the RTSP stream active in the background."""
    print(f"✅ Initiating RTSP stream: {RTSP_URL}")

    ffmpeg_cmd = [
        FFMPEG,
        "-rtsp_transport", "tcp",
        "-i", RTSP_URL,
        "-an",  # Disable audio
        "-f", "null",  # Discard output (only streaming)
        "-"
    ]

    process = subprocess.Popen(
        ffmpeg_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    time.sleep(2)  # Give the stream time to start
    return process

def packet_handler(packet):
    """Captures RTSP packets and logs their size."""
    global packet_sizes
    if IP in packet:
        if packet[IP].src == RTSP_IP or packet[IP].dst == RTSP_IP:
            if TCP in packet or UDP in packet:
                packet_sizes.append(len(packet))

def measure_live_bitrate(duration=5):
    """Sniffs RTSP packets and calculates bitrate in real-time."""
    global packet_sizes

    ffmpeg_process = start_rtsp_stream()  # Start RTSP connection

    print(f"✅ Monitoring RTSP traffic from {RTSP_IP} for {duration} seconds...")

    start_time = time.time()
    while time.time() - start_time < duration:
        packet_sizes = []  # Reset every second
        sniff(
            filter=f"host {RTSP_IP} and port {RTSP_PORT}",
            prn=packet_handler,
            timeout=1,
            store=0
        )

        if packet_sizes:
            total_bytes = sum(packet_sizes)
            total_bits = total_bytes * 8
            bitrate_mbps = total_bits / 1_000_000  # Convert to Mbps
            print(f"📊 Live Bitrate: {bitrate_mbps:.2f} Mbps")
        else:
            print("⚠️ No packets detected (stream inactive?).")

    print("✅ Monitoring complete.")
    ffmpeg_process.terminate()  # Stop FFmpeg after measurement

if __name__ == "__main__":
    measure_live_bitrate(DURATION)
