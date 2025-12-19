#!/bin/bash
# One-time setup script for metronome on the server
# Run this on the droplet: ./setup.sh

set -e

APP_NAME="metronome"
APP_DIR="/home/ernesto/apps/$APP_NAME"
PORT=3001

echo "Setting up $APP_NAME..."

# Create apps directory if it doesn't exist
mkdir -p /home/ernesto/apps

# Copy nginx config
sudo cp "$APP_DIR/deploy/nginx.conf" "/etc/nginx/sites-available/$APP_NAME.ernesto.dev"
sudo ln -sf "/etc/nginx/sites-available/$APP_NAME.ernesto.dev" "/etc/nginx/sites-enabled/"

# Test nginx config
sudo nginx -t

# Copy systemd service
sudo cp "$APP_DIR/deploy/$APP_NAME.service" "/etc/systemd/system/"
sudo systemctl daemon-reload
sudo systemctl enable $APP_NAME

# Reload nginx
sudo systemctl reload nginx

echo ""
echo "Setup complete! Next steps:"
echo "1. Run: sudo certbot --nginx -d $APP_NAME.ernesto.dev"
echo "2. The GitHub Action will handle deployments on push to main"
echo ""
echo "To manually start the service: sudo systemctl start $APP_NAME"
echo "To check status: sudo systemctl status $APP_NAME"
echo "To view logs: journalctl -u $APP_NAME -f"
