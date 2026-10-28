# =============================================================================
# Guilda — Frontend Dockerfile (development)
# Node 22.14.0 LTS — must match .tool-versions
# =============================================================================
FROM node:22.14.0-slim AS dev

WORKDIR /app

# Copy package manifests for layer caching
# (source is mounted as a volume in compose.yaml)
COPY package.json package-lock.json* ./
RUN npm install

# Vite dev server — bind to 0.0.0.0 so it's reachable from the host
ENV HOST=0.0.0.0
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
