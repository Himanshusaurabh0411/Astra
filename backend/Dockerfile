# ==============================================================================
# TerraPulse Backend Dockerfile
# Space-to-Ground Geospatial Engine & Tactical Mesh Hub
# ==============================================================================
FROM python:3.12-slim AS runtime

WORKDIR /app

# Install minimal OS dependencies for health checks and network tooling
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Optimize Python bytecode and output streaming
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code and seeded data
COPY . /app/

# Expose FastAPI service port
EXPOSE 8000

# Healthcheck to ensure FastAPI service is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Launch production Uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
