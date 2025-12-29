#!/bin/bash
# Unlink local LoomLarge and install from npm registry
# Use this to test the published npm package instead of the local symlink

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

cd "$APP_DIR"

# Remove the symlink if it exists
if [ -L "node_modules/loomlarge" ]; then
  echo "Removing symlink to local LoomLarge..."
  rm node_modules/loomlarge
else
  echo "No symlink found, removing existing loomlarge..."
  rm -rf node_modules/loomlarge
fi

# Install from npm registry
echo "Installing loomlarge from npm..."
npm install loomlarge

echo "Done! Now using the published npm version of loomlarge."
echo "Run 'npm run link:loomlarge' to switch back to local development."
