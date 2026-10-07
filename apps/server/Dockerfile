# Dhwani SI API Server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

# Install dependencies
RUN npm ci --only=production

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S vanni -u 1001 -G nodejs

# Copy built files
COPY --from=builder --chown=vanni:nodejs /app/dist ./dist
COPY --from=builder --chown=vanni:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=vanni:nodejs /app/package.json ./

# Switch to non-root user
USER vanni

# Expose port
EXPOSE 4100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4100/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Start server
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
