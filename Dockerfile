# Apex Abstracts — Phase-1 hosted backend (persistent Node server, not serverless).
# Runs the chatbot UI + /api/generate (live NCC assessor) + /api/gdoc.
FROM node:20-slim

WORKDIR /app

# Copy the whole repo (the server reads Apex_Title_Studio.html at the root and tools/pipeline.mjs).
# node_modules is excluded via .dockerignore so deps install fresh (no puppeteer).
COPY . .

# Install only the backend runtime dep (cheerio). No dev deps, no Chromium.
RUN cd backend && npm install --omit=dev --no-audit --no-fund

ENV NODE_ENV=production
# The host injects PORT; server.mjs falls back to 8787 locally.
EXPOSE 8787

CMD ["node", "backend/server.mjs"]
