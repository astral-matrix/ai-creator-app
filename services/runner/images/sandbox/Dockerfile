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

# Create non-root user
RUN useradd -m -s /bin/bash -u 1000 sandbox

# Create workspace directory
RUN mkdir -p /workspace && chown sandbox:sandbox /workspace

# Set working directory
WORKDIR /workspace

# Switch to non-root user
USER sandbox

# Set environment variables
ENV NODE_ENV=development
ENV HOME=/home/sandbox
ENV PATH="/home/sandbox/.local/bin:$PATH"

# Default command - keep container running
CMD ["tail", "-f", "/dev/null"]
