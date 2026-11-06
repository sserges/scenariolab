FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app/backend

COPY backend/pyproject.toml backend/uv.lock backend/README.md ./
RUN python -m pip install --no-cache-dir uv \
    && uv sync --locked --no-dev --no-install-project

COPY backend/src ./src
RUN uv sync --locked --no-dev \
    && useradd --create-home --uid 10001 scenariolab \
    && chown -R scenariolab:scenariolab /app/backend

ENV PATH="/app/backend/.venv/bin:${PATH}"
USER 10001:10001

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT','8000') + '/api/health', timeout=2)"

CMD ["sh", "-c", "exec uvicorn scenariolab_api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
