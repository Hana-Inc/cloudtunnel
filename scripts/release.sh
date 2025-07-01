#!/bin/bash

# CloudTunnel Release Script
# Usage: ./scripts/release.sh [patch|minor|major]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if release type is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Release type not specified${NC}"
    echo "Usage: $0 [patch|minor|major]"
    exit 1
fi

RELEASE_TYPE=$1

# Validate release type
if [[ ! "$RELEASE_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}Error: Invalid release type '$RELEASE_TYPE'${NC}"
    echo "Valid types: patch, minor, major"
    exit 1
fi

echo -e "${GREEN}🚀 Starting CloudTunnel release process...${NC}"

# Check if on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}Warning: Not on main branch (current: $CURRENT_BRANCH)${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}Error: You have uncommitted changes${NC}"
    echo "Please commit or stash your changes before releasing"
    exit 1
fi

# Run tests
echo -e "${GREEN}Running tests...${NC}"
npm test

# Build the project
echo -e "${GREEN}Building project...${NC}"
npm run build

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}Current version: $CURRENT_VERSION${NC}"

# Bump version
echo -e "${GREEN}Bumping version ($RELEASE_TYPE)...${NC}"
npm version $RELEASE_TYPE -m "chore: release v%s"

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}New version: $NEW_VERSION${NC}"

# Push to git
echo -e "${GREEN}Pushing to git...${NC}"
git push origin main
git push origin "v$NEW_VERSION"

echo -e "${GREEN}✅ Release v$NEW_VERSION complete!${NC}"
echo ""
echo "GitHub Actions will now:"
echo "1. Create a GitHub release"
echo "2. Publish to npm"
echo ""
echo "Monitor the progress at: https://github.com/Hana-Inc/cloudtunnel/actions"