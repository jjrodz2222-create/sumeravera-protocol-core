# Multi-stage build for ultra-lightweight, high-performance runtime
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy full source tree
COPY . .

# Build production assets / bundles
RUN npm run build --if-present

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install python runtime for mathematical engine execution
RUN apk add --no-cache python3 py3-pip

# Copy built application and production dependencies
COPY --from=builder /app ./

# Expose HTTP API / Management Console and WebSocket Ingress ports
EXPOSE 3000 8080

# Health check to ensure ingress responsiveness
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Start the SumerAvera Protocol Core Framework Gateway
CMD ["npm", "start"]
