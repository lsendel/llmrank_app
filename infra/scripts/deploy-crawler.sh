#!/bin/bash
set -e

# Deploy Crawler to Fly.io
echo '🚀 Deploying Crawler to Fly.io...'
cd apps/crawler

# Ensure flyctl is installed or available
if ! command -v fly &> /dev/null; then
    echo 'Error: fly CLI not found. Please install it first.'
    exit 1
fi

# Deploy
fly deploy --ha=false

echo '✅ Crawler deployment initiated!'

