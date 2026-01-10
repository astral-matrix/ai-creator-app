# Sandbox container image for AI Creator workspaces
FROM node:20-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    bash \
    coreutils \
    curl \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm@9

# Use the existing 'node' user (UID 1000) instead of creating a new one
# The node:20 image already has a 'node' user with UID 1000

# Create workspace directory
RUN mkdir -p /workspace && chown node:node /workspace

# Set working directory
WORKDIR /workspace

# Switch to non-root user
USER node

# Set environment variables
ENV NODE_ENV=development
ENV HOME=/home/node
ENV PATH="/home/node/.local/bin:$PATH"

# Default command - keep container running
CMD ["tail", "-f", "/dev/null"]
