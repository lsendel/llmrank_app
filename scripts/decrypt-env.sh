#!/usr/bin/env bash
# Decrypt .env.age → .env using your local age key
# Usage: bash scripts/decrypt-env.sh [key-path]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
KEY_FILE="${1:-$HOME/.age/key.txt}"

if [ ! -f "$KEY_FILE" ]; then
  echo "Error: age key not found at $KEY_FILE"
  echo "Generate one with: age-keygen -o ~/.age/key.txt"
  echo "Then ask for your public key to be added as a recipient."
  exit 1
fi

if [ ! -f "$PROJECT_ROOT/.env.age" ]; then
  echo "Error: $PROJECT_ROOT/.env.age not found"
  exit 1
fi

age -d -i "$KEY_FILE" "$PROJECT_ROOT/.env.age" > "$PROJECT_ROOT/.env"
echo "Decrypted .env.age → .env"
