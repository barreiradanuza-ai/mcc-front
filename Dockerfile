# Imagem pronta do portal (usada para publicar no Railway sem depender do build dele).
FROM node:22-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# DATABASE_URL só para o prisma generate / next build; nenhuma conexão é feita.
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/db
RUN npx prisma generate && npx next build

FROM base AS run
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 8080
# Mesmo comando do Railway: aplica migrações e sobe o Next na porta do ambiente.
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p ${PORT:-8080}"]
