# syntax=docker/dockerfile:1

# ---- Dependencies ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts

# ---- Build ----
FROM deps AS build
# Vite inlines VITE_* at build time; the build fails if they are invalid.
ARG VITE_API_BASE_URL
ARG VITE_APP_ENV=production
ARG VITE_APP_NAME="Erzurum Bilim Merkezi"
# Safe default: the in-browser mock backend is never served as the live app (ADR 0013).
ARG VITE_COMING_SOON=true
# Launching (VITE_COMING_SOON=false) needs the Supabase backend; the build refuses the mock.
ARG VITE_BACKEND=mock
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_APP_ENV=$VITE_APP_ENV \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_COMING_SOON=$VITE_COMING_SOON \
    VITE_BACKEND=$VITE_BACKEND \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
# Production images must point at a real API — don't silently fall back to localhost.
RUN test -n "$VITE_API_BASE_URL" || (echo "Build arg VITE_API_BASE_URL is required" >&2 && exit 1)
COPY . .
RUN npm run build

# ---- Runtime: static files served by non-root nginx ----
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
