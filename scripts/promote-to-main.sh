#!/bin/bash

# This script promotes changes from the staging branch to the main branch

# Ensure we're starting from a clean state
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working directory is not clean. Please commit or stash your changes."
  exit 1
fi

# Make sure we have the latest code
echo "Fetching latest changes..."
git fetch origin

# Switch to staging and pull latest
echo "Updating staging branch..."
git checkout staging
git pull origin staging

# Switch to main and pull latest
echo "Updating main branch..."
git checkout main
git pull origin main

# Merge staging into main
echo "Merging staging into main..."
git merge --no-ff staging -m "Promote staging to main"

# Push changes
echo "Pushing changes to main..."
git push origin main

# Switch back to staging
git checkout staging

echo "Done! Changes from staging have been promoted to main."
echo "If you want to create a release, run one of the following:"
echo "  npm run release:patch"
echo "  npm run release:minor"
echo "  npm run release:major" 