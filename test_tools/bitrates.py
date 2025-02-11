import subprocess
import os
import sys

RTSP_URL = "rtsp://192.168.12.111:554/1"
FFMPEG = r"C:\ffmpeg\bin\ffmpeg.exe"  # Update this with the correct FFmpeg path
TEMP_FILE = "temp_stream.ts"  # Temporary file for bitrate measurement

def estimate_bitrate_from_file(rtsp_url, duration=10):
    try:
        # Ensure temp file is deleted if it exists
        if os.path.exists(TEMP_FILE):
            os.remove(TEMP_FILE)

        # FFmpeg command to capture a segment of the stream
        ffmpeg_cmd = [
            FFMPEG,
            "-rtsp_transport", "tcp",
            "-i", rtsp_url,
            "-t", str(duration),
            "-an",  # Disable audio
            "-c", "copy",  # Copy the stream without re-encoding
            "-f", "mpegts",  # Use MPEG-TS format for better analysis
            "-y", TEMP_FILE  # Save to temp file
        ]

        print("Running FFmpeg command:", " ".join(ffmpeg_cmd))

        ffmpeg_result = subprocess.run(
            ffmpeg_cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            text=True, 
            encoding="utf-8",
            errors="ignore",
            timeout=duration + 5
        )

        print("FFmpeg finished with return code:", ffmpeg_result.returncode)

        if ffmpeg_result.returncode != 0:
            print("FFmpeg stderr:", ffmpeg_result.stderr)
            return {"Error": f"FFmpeg Error: {ffmpeg_result.returncode}"}

        # Get file size
        if not os.path.exists(TEMP_FILE):
            return {"Error": "Temporary file not created"}

        file_size_bytes = os.path.getsize(TEMP_FILE)  # Get size in bytes
        os.remove(TEMP_FILE)  # Delete temp file after measurement

        # Calculate bitrate
        file_size_bits = file_size_bytes * 8  # Convert bytes to bits
        bitrate_bps = file_size_bits / duration  # Bits per second
        bitrate_mbps = bitrate_bps / 1_000_000  # Convert to Mbps

        return {"Estimated Bitrate (Mbps)": f"{bitrate_mbps:.2f} Mbps"}

    except subprocess.TimeoutExpired:
        return {"Error": "FFmpeg timed out"}
    except Exception as e:
        return {"Error": f"An unexpected error occurred: {e}"}

if __name__ == "__main__":
    bitrate_info = estimate_bitrate_from_file(RTSP_URL)
    print(bitrate_info)
