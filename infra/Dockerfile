# ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
# ─────────────────────────────────────────────────────────────
# Stage 1 — build
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências primeiro (camada cacheável)
COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile

# Copia o restante do código
COPY . .

# Recebe as variáveis de ambiente em build-time via ARG
# (necessário porque o Vite embute os valores no bundle estático)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_NAME=EduGest
ARG VITE_STORAGE_BUCKET=project-wg-files
ARG VITE_TURN_URLS=
ARG VITE_TURN_USERNAME=
ARG VITE_TURN_CREDENTIAL=
ARG VITE_WEBRTC_ICE_SERVERS=

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_STORAGE_BUCKET=$VITE_STORAGE_BUCKET
ENV VITE_TURN_URLS=$VITE_TURN_URLS
ENV VITE_TURN_USERNAME=$VITE_TURN_USERNAME
ENV VITE_TURN_CREDENTIAL=$VITE_TURN_CREDENTIAL
ENV VITE_WEBRTC_ICE_SERVERS=$VITE_WEBRTC_ICE_SERVERS

RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 2 — serve (imagem final ~25 MB)
# ─────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove config padrão do nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia nossa config customizada (SPA routing + compressão)
COPY infra/nginx.conf /etc/nginx/conf.d/app.conf

# Copia o build gerado pelo Vite
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Expõe a porta 80
EXPOSE 80

# Nginx roda em foreground
CMD ["nginx", "-g", "daemon off;"]
