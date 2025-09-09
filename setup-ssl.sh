#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Setting up SSL certificates for local development${NC}"
echo ""

# Get local IP address
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LOCAL_IP=$(ipconfig getifaddr en0)
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP=$(ipconfig getifaddr en1)
    fi
else
    # Linux
    LOCAL_IP=$(hostname -I | awk '{print $1}')
fi

if [ -z "$LOCAL_IP" ]; then
    echo -e "${RED}❌ Could not determine local IP address${NC}"
    echo "Please manually set LOCAL_IP environment variable"
    exit 1
fi

echo -e "${GREEN}✅ Local IP address: ${LOCAL_IP}${NC}"
echo ""

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo -e "${YELLOW}⚠️  mkcert is not installed${NC}"
    echo ""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Installing mkcert via Homebrew..."
        brew install mkcert
    else
        echo "Please install mkcert:"
        echo "  Ubuntu/Debian: apt install libnss3-tools && brew install mkcert"
        echo "  Arch: pacman -S nss && brew install mkcert"
        echo "  Or download from: https://github.com/FiloSottile/mkcert/releases"
        exit 1
    fi
fi

# Create certs directory
mkdir -p certs
cd certs

# Check if certificates already exist
if [ -f "cert.pem" ] && [ -f "key.pem" ]; then
    echo -e "${GREEN}✅ SSL certificates already exist${NC}"
    echo -e "${BLUE}Skipping certificate generation...${NC}"
else
    # Install local CA (first time only)
    echo -e "${BLUE}Installing local Certificate Authority...${NC}"
    mkcert -install

    # Generate certificates for IP address
    echo -e "${BLUE}Generating SSL certificates for ${LOCAL_IP}...${NC}"
    mkcert $LOCAL_IP localhost 127.0.0.1 ::1

    # Rename certificates to standard names
    mv "${LOCAL_IP}+3.pem" cert.pem 2>/dev/null || true
    mv "${LOCAL_IP}+3-key.pem" key.pem 2>/dev/null || true

    echo -e "${GREEN}✅ SSL certificates generated in ./certs/${NC}"
fi
echo ""

# Create .env.local if it doesn't exist
cd ..
if [ ! -f .env.local ]; then
    echo -e "${BLUE}Creating .env.local file...${NC}"
    cp .env.example .env.local 2>/dev/null || touch .env.local
fi

# Update backend URL in .env.local
echo -e "${BLUE}Updating environment variables...${NC}"

# Check if VITE_BACKEND_URL exists and update it
if grep -q "VITE_BACKEND_URL=" .env.local; then
    # On macOS use -i '' for in-place editing, on Linux just -i
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|VITE_BACKEND_URL=.*|VITE_BACKEND_URL=https://${LOCAL_IP}:4443|" .env.local
    else
        sed -i "s|VITE_BACKEND_URL=.*|VITE_BACKEND_URL=https://${LOCAL_IP}:4443|" .env.local
    fi
else
    echo "VITE_BACKEND_URL=https://${LOCAL_IP}:4443" >> .env.local
fi

echo -e "${GREEN}✅ Environment variables updated${NC}"
echo ""

# Display instructions
echo -e "${GREEN}🎉 SSL Setup Complete!${NC}"
echo ""
echo -e "${BLUE}Access your application from any device on the network:${NC}"
echo -e "  Frontend: ${GREEN}https://${LOCAL_IP}:8443${NC}"
echo -e "  Backend:  ${GREEN}https://${LOCAL_IP}:4443${NC}"
echo ""
echo -e "${BLUE}To start the development servers with SSL:${NC}"
echo -e "  ${YELLOW}npm run dev:ssl${NC}       # Start frontend with HTTPS"
echo -e "  ${YELLOW}npm run dev:backend${NC}   # Start backend with HTTPS"
echo ""
echo -e "${BLUE}Or run both:${NC}"
echo -e "  ${YELLOW}npm run dev:all${NC}"
echo ""
echo -e "${YELLOW}Note: You may need to accept the certificate warning in your browser${NC}"
echo -e "${YELLOW}      on each device when first accessing the site.${NC}"