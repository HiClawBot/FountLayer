# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3

FROM ${NODE_IMAGE} AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

COPY . .

RUN pnpm install --frozen-lockfile

ARG NEXT_PUBLIC_GATEWAY_BASE_URL=http://localhost:3300
ENV NEXT_PUBLIC_GATEWAY_BASE_URL=${NEXT_PUBLIC_GATEWAY_BASE_URL}

RUN pnpm \
      --filter @fountlayer/gateway... \
      --filter @fountlayer/console... \
      --filter @fountlayer/demo-pdf-reader... \
      build \
  && pnpm --filter @fountlayer/gateway deploy --prod --legacy /out/gateway

FROM ${NODE_IMAGE} AS runtime-base

ARG VERSION=0.5.0-beta.2
ARG VCS_REF=unknown

RUN rm -rf /usr/local/lib/node_modules/npm \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx

LABEL org.opencontainers.image.title="FountLayer" \
      org.opencontainers.image.description="Self-hosted LLM last-mile distribution beta" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.revision=${VCS_REF} \
      org.opencontainers.image.version=${VERSION}

ENV NODE_ENV=production
STOPSIGNAL SIGTERM

FROM runtime-base AS gateway

WORKDIR /app
COPY --from=builder --chown=node:node /out/gateway ./

ENV GATEWAY_HOST=0.0.0.0
ENV GATEWAY_PORT=3300
EXPOSE 3300
USER node

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3300/health/dependencies').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "dist/index.js"]

FROM runtime-base AS console

WORKDIR /app
COPY --from=builder --chown=node:node /workspace/apps/console/.next/standalone ./
COPY --from=builder --chown=node:node /workspace/apps/console/.next/static ./apps/console/.next/static

ENV HOSTNAME=0.0.0.0
ENV PORT=3301
EXPOSE 3301
USER node

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3301/login').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "apps/console/server.js"]

FROM runtime-base AS demo

WORKDIR /app
COPY --from=builder --chown=node:node /workspace/apps/demo-pdf-reader/.next/standalone ./
COPY --from=builder --chown=node:node /workspace/apps/demo-pdf-reader/.next/static ./apps/demo-pdf-reader/.next/static

ENV HOSTNAME=0.0.0.0
ENV PORT=3302
EXPOSE 3302
USER node

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3302/').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "apps/demo-pdf-reader/server.js"]
