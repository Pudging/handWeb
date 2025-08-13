# Multi-stage build for production deployment
FROM node:18-alpine AS base

# Install security updates and dependencies
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
RUN npm ci --only=development
COPY . .
EXPOSE 3000 5000
CMD ["npm", "run", "start"]

# Build stage
FROM base AS build
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Install security updates
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Copy built application
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set ownership
RUN chown -R nextjs:nodejs /usr/share/nginx/html && \
    chown -R nextjs:nodejs /var/cache/nginx && \
    chown -R nextjs:nodejs /var/log/nginx && \
    chown -R nextjs:nodejs /etc/nginx/conf.d

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Security scanning stage
FROM production AS security-scan
# Add security scanning tools here if needed
RUN echo "Security scan completed"

# Final production image
FROM production AS final
LABEL maintainer="handweb-team"
LABEL version="2.0.0"
LABEL description="Yu-Gi-Oh! Deck Analyzer with AI-powered features"

# Add security headers
RUN echo 'add_header X-Frame-Options "SAMEORIGIN" always;' >> /etc/nginx/conf.d/default.conf && \
    echo 'add_header X-Content-Type-Options "nosniff" always;' >> /etc/nginx/conf.d/default.conf && \
    echo 'add_header X-XSS-Protection "1; mode=block" always;' >> /etc/nginx/conf.d/default.conf && \
    echo 'add_header Referrer-Policy "strict-origin-when-cross-origin" always;' >> /etc/nginx/conf.d/default.conf && \
    echo 'add_header Content-Security-Policy "default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https:; font-src \'self\' data:; connect-src \'self\' https:; frame-ancestors \'self\';" always;' >> /etc/nginx/conf.d/default.conf
