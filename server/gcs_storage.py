import os
import io
import json
import logging

logger = logging.getLogger(__name__)

GCS_BUCKET = os.environ.get("GCS_BUCKET")

_client = None
_bucket = None


def _get_bucket():
    global _client, _bucket
    if not GCS_BUCKET:
        return None
    if _bucket is None:
        from google.cloud import storage
        _client = storage.Client()
        _bucket = _client.bucket(GCS_BUCKET)
    return _bucket


def fetch_cookies(dest_path="cookies.txt"):
    """Download cookies.txt from the bucket root if it exists."""
    bucket = _get_bucket()
    if not bucket:
        return False
    blob = bucket.blob("cookies.txt")
    if not blob.exists():
        logger.info("No cookies.txt found in GCS bucket")
        return False
    blob.download_to_filename(dest_path)
    logger.info("Downloaded cookies.txt from GCS bucket")
    return True


def is_enabled():
    return bool(GCS_BUCKET)


def load_json(video_id):
    bucket = _get_bucket()
    if not bucket:
        return None
    blob = bucket.blob(f"{video_id}/metadata.json")
    if not blob.exists():
        return None
    return json.loads(blob.download_as_text())


def save_json(video_id, data):
    bucket = _get_bucket()
    if not bucket:
        return
    blob = bucket.blob(f"{video_id}/metadata.json")
    blob.upload_from_string(
        json.dumps(data, ensure_ascii=False, indent=2),
        content_type="application/json",
    )


def upload_file(video_id, local_path):
    bucket = _get_bucket()
    if not bucket:
        return
    filename = os.path.basename(local_path)
    blob = bucket.blob(f"{video_id}/{filename}")
    blob.upload_from_filename(local_path)


def stream_audio(video_id):
    """Return (BytesIO, filename) for the MP3 in the bucket, or (None, None)."""
    bucket = _get_bucket()
    if not bucket:
        return None, None
    blobs = list(bucket.list_blobs(prefix=f"{video_id}/"))
    for blob in blobs:
        if blob.name.endswith(".mp3"):
            filename = blob.name.split("/")[-1]
            return io.BytesIO(blob.download_as_bytes()), filename
    return None, None
