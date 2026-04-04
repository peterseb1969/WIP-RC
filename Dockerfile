# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files and lib tarballs first for cache efficiency
COPY package.json package-lock.json ./
COPY libs/ libs/
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine AS production
WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
COPY libs/ libs/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy server source (run via tsx)
COPY server/ server/
COPY tsconfig.json ./

# Copy built frontend
COPY --from=build /app/dist dist/

# Add static file serving to Express for production
# (In dev, Vite serves the frontend; in prod, Express serves dist/)

ENV NODE_ENV=production
ENV PORT=3010

EXPOSE 3010

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3010/health || exit 1

CMD ["npx", "tsx", "server/index.ts"]
