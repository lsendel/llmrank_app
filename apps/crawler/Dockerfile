# Multi-stage Dockerfile for the Rust Crawler (Fly.io compatible)

# --- Builder Stage ---
FROM rust:1.93-slim-bookworm AS builder

# Install build dependencies for OpenSSL and other native libs
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/crawler
COPY Cargo.toml Cargo.lock ./

# Create dummy src for dependency caching
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src target/release/deps/crawler*

# Copy actual source and build
COPY src/ src/
RUN cargo build --release

# --- Runtime Stage ---
FROM node:20-bookworm-slim

WORKDIR /app

# Install Chromium, curl (for healthcheck), and runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Lighthouse and puppeteer-core globally (pinned versions)
RUN npm install -g lighthouse@13.0.3 puppeteer-core

# Copy render scripts
COPY scripts/ /app/scripts/

# Copy the binary from builder
COPY --from=builder /usr/src/crawler/target/release/crawler /usr/local/bin/crawler

ENV CHROME_PATH=/usr/bin/chromium
ENV RENDERER_SCRIPT_PATH=/app/scripts/render-links.mjs
ENV RUST_LOG=info
ENV PORT=8080

EXPOSE 8080

CMD ["crawler"]
