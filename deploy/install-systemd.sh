#!/bin/bash
#
# Install RMonitor Converter as systemd service
#
# Usage: sudo ./install-systemd.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}This script must be run as root${NC}"
    exit 1
fi

# Get project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_USER="${SUDO_USER:-rmonitor}"

echo -e "${BLUE}Installing RMonitor Converter as systemd service...${NC}"
echo "Project directory: $PROJECT_DIR"
echo "Service user: $SERVICE_USER"
echo ""

# Create user if not exists
if ! id -u rmonitor &>/dev/null; then
    echo "Creating rmonitor user..."
    useradd -r -s /bin/false rmonitor
fi

# Set permissions
echo "Setting permissions..."
chown -R rmonitor:rmonitor "$PROJECT_DIR"
chmod -R 755 "$PROJECT_DIR"

# Update service files with correct paths
sed -i "s|/opt/rmonitor-converter|$PROJECT_DIR|g" "$PROJECT_DIR/deploy/rmonitor-converter.service"
sed -i "s|/opt/rmonitor-converter|$PROJECT_DIR|g" "$PROJECT_DIR/deploy/rmonitor-panel.service"
sed -i "s|User=rmonitor|User=$SERVICE_USER|g" "$PROJECT_DIR/deploy/rmonitor-converter.service"
sed -i "s|User=rmonitor|User=$SERVICE_USER|g" "$PROJECT_DIR/deploy/rmonitor-panel.service"

# Copy service files
echo "Copying service files..."
cp "$PROJECT_DIR/deploy/rmonitor-converter.service" /etc/systemd/system/
cp "$PROJECT_DIR/deploy/rmonitor-panel.service" /etc/systemd/system/

# Reload systemd
echo "Reloading systemd..."
systemctl daemon-reload

# Enable services
echo "Enabling services..."
systemctl enable rmonitor-converter.service
systemctl enable rmonitor-panel.service

# Start services
echo "Starting services..."
systemctl start rmonitor-converter.service
sleep 2
systemctl start rmonitor-panel.service

# Check status
echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo "Services:"
systemctl status rmonitor-converter.service --no-pager || true
echo ""
systemctl status rmonitor-panel.service --no-pager || true

echo ""
echo "Useful commands:"
echo "  sudo systemctl status rmonitor-converter"
echo "  sudo systemctl status rmonitor-panel"
echo "  sudo systemctl restart rmonitor-converter"
echo "  sudo journalctl -u rmonitor-converter -f"
echo ""
