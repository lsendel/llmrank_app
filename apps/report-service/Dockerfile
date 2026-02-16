FROM node:20-slim AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy package.json files for all relevant workspaces
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/reports/package.json packages/reports/
COPY apps/report-service/package.json apps/report-service/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
COPY packages/reports/ packages/reports/
COPY apps/report-service/ apps/report-service/

# Build the report service (bundles workspace deps into single file)
WORKDIR /app/apps/report-service
RUN pnpm build

# Production stage
FROM node:20-slim AS production

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy package.json files
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/reports/package.json packages/reports/
COPY apps/report-service/package.json apps/report-service/

# Install production deps only (ignore-scripts to skip husky prepare)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built output only (workspace deps are bundled into dist/index.js)
COPY --from=base /app/apps/report-service/dist/ apps/report-service/dist/

WORKDIR /app/apps/report-service

EXPOSE 8080

CMD ["node", "dist/index.js"]
