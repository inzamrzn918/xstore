#!/bin/bash

echo "================================"
echo "SecurePrintShare - Quick Setup"
echo "Using UV + Bun"
echo "================================"
echo ""

# Check UV installation
echo "Checking UV installation..."
if ! command -v uv &> /dev/null; then
    echo "UV is not installed. Installing UV..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    echo "Please restart your terminal and run this script again."
    exit 1
else
    echo "UV is installed!"
    uv --version
fi

echo ""

# Check Bun installation
echo "Checking Bun installation..."
if ! command -v bun &> /dev/null; then
    echo "Bun is not installed. Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    echo "Please restart your terminal and run this script again."
    exit 1
else
    echo "Bun is installed!"
    bun --version
fi

echo ""
echo "================================"
echo "Setting up Backend (UV + Python 3.12)"
echo "================================"
cd backend

echo "Creating virtual environment with Python 3.12..."
uv venv --python 3.12

echo "Installing dependencies..."
source .venv/bin/activate
uv pip install -e .

if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
fi

echo ""
echo "Backend setup complete!"
echo ""

cd ..

echo ""
echo "================================"
echo "Setting up Mobile App (Bun)"
echo "================================"
cd mobile-app

echo "Installing dependencies with Bun..."
bun install

echo ""
echo "Mobile app setup complete!"
echo ""

cd ..

echo ""
echo "================================"
echo "Setting up Desktop Client (Bun)"
echo "================================"
cd desktop-client

echo "Installing dependencies with Bun..."
bun install

echo ""
echo "Desktop client setup complete!"
echo ""

cd ..

echo ""
echo "================================"
echo "Your local IP address:"
echo "================================"
if [[ "$OSTYPE" == "darwin"* ]]; then
    ipconfig getifaddr en0
else
    hostname -I | awk '{print $1}'
fi
echo ""
echo "IMPORTANT: Update mobile-app/App.js with your IP address!"
echo ""

echo "================================"
echo "Setup Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Update mobile-app/App.js with your IP address"
echo "2. Start backend: cd backend && source .venv/bin/activate && python main.py"
echo "3. Start mobile: cd mobile-app && bun run start"
echo "4. Start desktop: cd desktop-client && bun run start"
echo ""
