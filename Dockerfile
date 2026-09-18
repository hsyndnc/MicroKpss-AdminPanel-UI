# ==========================================================================
# MicroKpss Admin Panel — production Docker imajı (Next.js 16, standalone)
# --------------------------------------------------------------------------
# Çok aşamalı build: bağımlılıklar -> derleme -> ince çalışma imajı.
# next.config.ts'te output: "standalone" olmalı (bu imaj onu bekler).
# Çalışma anında env compose'dan gelir: BACKEND_URL, (ops.) PIPELINE_URL...
# ==========================================================================

# --- Aşama 1: bağımlılıklar ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` yerine `npm install`: lock'ta @img/sharp-wasm32'ın linux'a özgü
# emnapi optional-dep'leri (node_modules girdileri) eksik — darwin'de üretilen
# lock bunları yazmıyor, `npm ci`'nin katı senkron kontrolü bu yüzden patlıyor.
# `npm install` lock'u temel alır (sürümler sabit) ama boşluğu tolere eder.
RUN npm install --no-audit --no-fund

# --- Aşama 2: derleme ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Aşama 3: çalışma (yalın) ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# root olmayan kullanıcı (güvenlik)
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# standalone çıktısı: minimal server.js + gerekli node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
