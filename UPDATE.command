#!/bin/bash
cd "$(dirname "$0")"
echo "Updating DonaVentory..."
echo ""
git pull
echo ""
echo "Installing dependencies..."
npm install
echo ""
echo "Update complete!"
read -p "Press enter to exit"
