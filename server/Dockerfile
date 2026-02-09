FROM python:3.11-slim

# System deps (no sonic-annotator - using Python vamp library instead)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    ca-certificates \
    curl \
    xz-utils \
    bzip2 \
    build-essential \
    pkg-config \
    libsndfile1 \
    libsndfile1-dev \
    vamp-plugin-sdk \
    libvamp-hostsdk3v5 \
    libboost-all-dev \
    && rm -rf /var/lib/apt/lists/*

# --- Build and install NNLS-Chroma/Chordino Vamp plugin ---
# Source: https://github.com/c4dm/nnls-chroma  [oai_citation:4‡GitHub](https://github.com/c4dm/nnls-chroma?utm_source=chatgpt.com)
RUN git clone --depth=1 https://github.com/c4dm/nnls-chroma.git /tmp/nnls-chroma \
 && mkdir -p /usr/local/lib/vamp \
 && cd /tmp/nnls-chroma \
 && make -f Makefile.linux \
 && cp -v nnls-chroma.so /usr/local/lib/vamp/ \
 && rm -rf /tmp/nnls-chroma

WORKDIR /app
COPY requirements.txt .
# Install numpy first (required for vamp package build)
RUN pip install --no-cache-dir numpy && pip install --no-cache-dir -r requirements.txt

# Create downloads directory
RUN mkdir -p /app/downloads && chmod 777 /app/downloads

COPY . .

# Check if cookies.txt exists in the build context and ensure it's readable
RUN if [ -f cookies.txt ]; then chmod 644 cookies.txt; fi

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
