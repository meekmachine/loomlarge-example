#!/bin/bash
# Link local LoomLarge for development
# This creates a symlink so changes in ../LoomLarge are immediately available

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
LOOMLARGE_DIR="$APP_DIR/../LoomLarge"

# Clone if doesn't exist
if [ ! -d "$LOOMLARGE_DIR" ]; then
  echo "LoomLarge not found at $LOOMLARGE_DIR"
  echo "Cloning from GitHub..."
  git clone https://github.com/meekmachine/LoomLarge.git "$LOOMLARGE_DIR"
  cd "$LOOMLARGE_DIR"
  npm install
  npm run build
fi

# Build LoomLarge first
echo "Building LoomLarge..."
cd "$LOOMLARGE_DIR"
npm run build

# Create the symlink
echo "Linking loomlarge -> $LOOMLARGE_DIR"
cd "$APP_DIR"
rm -rf node_modules/loomlarge
ln -s "$LOOMLARGE_DIR" node_modules/loomlarge

echo "Done! LoomLarge is now symlinked for development."
