# SNSTR Images

This directory contains images used in the repository documentation. These images are excluded from the npm package to keep the library lightweight.

## Images to Add

Please download and add the following images to this directory:

1. **snstr.jpg** - SNSTR Logo
   - Current CDN URL: https://plebdevs-bucket.nyc3.cdn.digitaloceanspaces.com/snstr.jpg
   - Download and save as: `snstr.jpg`

2. **snstr-starter-pack.png** - SNSTR Starter Pack
   - Current CDN URL: https://plebdevs-bucket.nyc3.cdn.digitaloceanspaces.com/snstr-starter-pack.png
   - Download and save as: `snstr-starter-pack.png`

## How to Add Images

1. Download the images from the CDN URLs above
2. Place them in this directory (`.github/images/`)
3. Commit and push to the repository

## Why Store Images Here?

- **Repository inclusion**: Images are part of the repository and version controlled
- **No CDN dependency**: Removes dependency on external CDN services
- **GitHub hosting**: Images are served directly from GitHub's infrastructure
- **NPM exclusion**: Images are excluded from the npm package via `.npmignore`
- **Performance**: GitHub's CDN provides fast, reliable image delivery

## Image URLs in README

Once images are added, they will be accessible via GitHub's raw content URLs:
- Logo: `https://raw.githubusercontent.com/AustinKelsay/snstr/main/.github/images/snstr.jpg`
- Starter Pack: `https://raw.githubusercontent.com/AustinKelsay/snstr/main/.github/images/snstr-starter-pack.png`

Note: Replace `main` with the appropriate branch name if needed.