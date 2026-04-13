#!/bin/bash

###############################################################################
# SalesHQ iOS Sync Script
# Automates the process of syncing web changes to iOS app
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DIST_DIR="dist"
WEB_FILES=(
  "index.html"
  "app.js"
  "nurture-campaign-system.js"
  "learning-agent-system.js"
  "nurture-ui-components.js"
  "saleshq-canva-integration.js"
  "saleshq-outlook-canva.js"
  "saleshq-canva-enriched-integration.js"
  "saleshq-outlook-integration-code.js"
  "signature-manager-with-images.js"
  "ios-native-integration.js"
)

CSS_FILES=(
  "saleshq-canva-styles.css"
  "saleshq-outlook-canva-styles.css"
  "signature-manager-styles.css"
)

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  🍎 SalesHQ iOS Sync Script${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if dist directory exists
if [ ! -d "$DIST_DIR" ]; then
  echo -e "${YELLOW}📁 Creating dist directory...${NC}"
  mkdir -p "$DIST_DIR"
fi

# Copy web files
echo -e "${YELLOW}📄 Copying web files...${NC}"
for file in "${WEB_FILES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$DIST_DIR/"
    echo -e "${GREEN}  ✓ $file${NC}"
  else
    echo -e "${RED}  ✗ $file (not found)${NC}"
  fi
done

# Copy CSS files
echo -e "${YELLOW}🎨 Copying CSS files...${NC}"
for file in "${CSS_FILES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$DIST_DIR/"
    echo -e "${GREEN}  ✓ $file${NC}"
  else
    echo -e "${RED}  ✗ $file (not found)${NC}"
  fi
done

# Copy assets if they exist
if [ -d "assets" ]; then
  echo -e "${YELLOW}🖼️  Copying assets...${NC}"
  cp -r assets "$DIST_DIR/"
  echo -e "${GREEN}  ✓ assets/${NC}"
fi

# Sync to iOS
echo ""
echo -e "${YELLOW}📱 Syncing to iOS...${NC}"
npx cap sync ios

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  ✅ iOS sync completed successfully!${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo -e "  1. Run: ${YELLOW}npx cap open ios${NC} to open Xcode"
  echo -e "  2. Click ▶️  to build and run"
  echo ""
else
  echo ""
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}  ❌ iOS sync failed!${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  exit 1
fi
