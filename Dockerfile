FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build && rm -rf .next/cache

FROM builder AS prod-deps
RUN pnpm prune --prod

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
# The policy seeder intentionally reads the canonical policy source at startup.
# Keep that single source file in the minimal runner image without shipping the
# rest of the application source tree.
COPY --from=builder /app/src/lib/policy-documents.ts ./src/lib/policy-documents.ts
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY startup.sh ./startup.sh
RUN chmod +x ./startup.sh
EXPOSE 3000
CMD ["./startup.sh"]
