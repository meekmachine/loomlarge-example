#!/bin/bash
set -e

echo "Building for production..."
yarn build

echo "Deploying to gh-pages..."
# Skip LFS during gh-pages clone to avoid timeouts
GIT_LFS_SKIP_SMUDGE=1 gh-pages -d dist --dotfiles

echo "Deployment complete!"
