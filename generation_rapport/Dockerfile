FROM python:3.11-slim

# Install system deps required by Whisper / audio processing
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ffmpeg \
       libsndfile1 \
       build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY cedric_requirements.txt /app/cedric_requirements.txt

# Upgrade pip and install Python deps
RUN python -m pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r /app/cedric_requirements.txt \
    && pip install --no-cache-dir fastapi uvicorn[standard] python-multipart

# Copy package source
COPY . /app

# Create output directory for generated PDFs
RUN mkdir -p /app/output

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Launch FastAPI server
CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000"]
