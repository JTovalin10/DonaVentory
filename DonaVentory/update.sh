#!/bin/bash
set -e

echo "→ Removing node_modules and package-lock.json..."
rm -rf node_modules package-lock.json

echo "→ Pulling latest changes..."
git pull

echo "→ Installing dependencies..."
npm install

echo "✓ Done."
