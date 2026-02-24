"""
get_transcripts.py
Fetches the 15 most recent videos from the Retrouver Sa Voie YouTube channel
and saves their French transcripts as individual .txt files plus a combined file.
"""

import os
import re
import sys
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)

CHANNEL_URL = "https://www.youtube.com/@RetrouverSaVoie/videos"
NUM_VIDEOS = 15
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "transcripts")
COMBINED_FILE = os.path.join(OUTPUT_DIR, "all_transcripts.txt")


def sanitize_filename(title: str) -> str:
    """Remove or replace characters that are invalid in filenames."""
    title = re.sub(r'[\\/*?:"<>|]', "", title)
    title = re.sub(r"\s+", "_", title.strip())
    return title[:200]  # cap length


def fetch_channel_videos(channel_url: str, limit: int) -> list[dict]:
    """Return a list of {id, title} dicts for the most recent `limit` videos."""
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "playlist_end": limit,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(channel_url, download=False)

    videos = []
    for entry in info.get("entries", []):
        if entry and entry.get("id"):
            videos.append({"id": entry["id"], "title": entry.get("title", entry["id"])})
    return videos


def fetch_french_transcript(video_id: str):
    """
    Fetch the French transcript for a video.
    Returns the plain text on success, None on failure.
    Tries manually-created French first, then auto-generated French.
    """
    ytt = YouTubeTranscriptApi()
    try:
        transcript_list = ytt.list(video_id)
        transcript = transcript_list.find_transcript(["fr"])
        fetched = transcript.fetch()
        lines = [snippet.text for snippet in fetched]
        return "\n".join(lines)
    except NoTranscriptFound:
        print(f"  [!] No French transcript found for {video_id}")
        return None
    except TranscriptsDisabled:
        print(f"  [!] Transcripts disabled for {video_id}")
        return None
    except VideoUnavailable:
        print(f"  [!] Video unavailable: {video_id}")
        return None
    except Exception as exc:
        print(f"  [!] Unexpected error for {video_id}: {exc}")
        return None


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"Fetching {NUM_VIDEOS} most recent videos from: {CHANNEL_URL}")
    videos = fetch_channel_videos(CHANNEL_URL, NUM_VIDEOS)
    print(f"Found {len(videos)} video(s).\n")

    if not videos:
        print("No videos found. Exiting.")
        sys.exit(1)

    combined_parts = []
    saved = 0

    for i, video in enumerate(videos, start=1):
        vid_id = video["id"]
        title = video["title"]
        print(f"[{i}/{len(videos)}] {title}")

        transcript_text = fetch_french_transcript(vid_id)
        if transcript_text is None:
            continue

        safe_name = sanitize_filename(title)
        out_path = os.path.join(OUTPUT_DIR, f"{safe_name}.txt")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(f"Title: {title}\n")
            f.write(f"Video ID: {vid_id}\n")
            f.write(f"URL: https://www.youtube.com/watch?v={vid_id}\n")
            f.write("=" * 60 + "\n\n")
            f.write(transcript_text)
        print(f"  -> Saved: transcripts/{safe_name}.txt")

        combined_parts.append(
            f"{'=' * 60}\n"
            f"Title: {title}\n"
            f"Video ID: {vid_id}\n"
            f"URL: https://www.youtube.com/watch?v={vid_id}\n"
            f"{'=' * 60}\n\n"
            f"{transcript_text}\n\n"
        )
        saved += 1

    if combined_parts:
        with open(COMBINED_FILE, "w", encoding="utf-8") as f:
            f.write(f"Retrouver Sa Voie — Combined Transcripts\n")
            f.write(f"Videos: {saved} | Channel: {CHANNEL_URL}\n\n")
            f.write("\n".join(combined_parts))
        print(f"\nCombined file saved: transcripts/all_transcripts.txt")
    else:
        print("\nNo transcripts were saved.")

    print(f"\nDone. {saved}/{len(videos)} transcripts fetched successfully.")


if __name__ == "__main__":
    main()
