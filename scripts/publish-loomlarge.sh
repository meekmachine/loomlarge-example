#!/bin/bash
# Build and publish LoomLarge to npm
# Usage: ./scripts/publish-loomlarge.sh [patch|minor|major]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
LOOMLARGE_DIR="$APP_DIR/../LoomLarge"

if [ ! -d "$LOOMLARGE_DIR" ]; then
  echo "Error: LoomLarge not found at $LOOMLARGE_DIR"
  exit 1
fi

cd "$LOOMLARGE_DIR"

# Optional version bump
if [ -n "$1" ]; then
  echo "Bumping version ($1)..."
  npm version "$1" --no-git-tag-version
fi

# Build
echo "Building..."
npm run build

# Show what will be published
echo ""
echo "Package contents:"
npm pack --dry-run

echo ""
read -p "Publish to npm? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  npm publish

  # Push git changes if version was bumped
  if [ -n "$1" ]; then
    VERSION=$(node -p "require('./package.json').version")
    git add package.json package-lock.json
    git commit -m "v$VERSION"
    git push
  fi

  echo "Published! To use in app, run: npm install loomlarge@latest"
else
  echo "Cancelled."
fi
