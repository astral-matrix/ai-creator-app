FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY dist ./dist

# Run as non-root
RUN adduser -D runner
USER runner

EXPOSE 4050

CMD ["node", "dist/index.js"]
