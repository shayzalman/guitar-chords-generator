#!/bin/bash
# Export YouTube cookies from your browser and upload to GCS.
#
# yt-dlp extracts cookies directly from your browser — no extension needed.
# Just make sure you're logged into YouTube in Chrome.
#
# Re-run this when downloads start failing (cookies expired).

set -e

BUCKET="zrk-chrd"
COOKIE_FILE="./cookies.txt"
BROWSER="${1:-chrome}"

echo "==> Extracting YouTube cookies from $BROWSER..."

python -m yt_dlp \
  --cookies-from-browser "$BROWSER" \
  --cookies "$COOKIE_FILE" \
  --skip-download \
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

echo "==> Cookies saved to $COOKIE_FILE"
echo "==> Uploading to GCS..."

gsutil cp "$COOKIE_FILE" "gs://$BUCKET/cookies.txt"

echo "==> Done! Force a cold start to pick up new cookies:"
echo '    gcloud run services update guitar-chords-server --region me-west1 --set-env-vars "COOKIE_REFRESH=$(date +%s)"'

rm -f "$COOKIE_FILE"
