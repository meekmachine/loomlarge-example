#!/bin/bash
set -e

echo "Building for production..."
yarn build

echo "Deploying to gh-pages..."
gh-pages -d dist --dotfiles

echo "Deployment complete!"
