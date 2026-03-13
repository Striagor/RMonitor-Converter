#!/bin/bash
#
# RMonitor Converter - Stop Script
# Останавливает все сервисы проекта
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Stop process by PID file
stop_by_pid() {
    local pid_file=$1
    local name=$2

    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            log_success "Stopped $name (PID: $pid)"
        else
            log_warn "$name is not running (stale PID file)"
        fi
        rm -f "$pid_file"
    fi
}

# Stop process by port
stop_by_port() {
    local port=$1
    local name=$2

    local pids=$(lsof -t -i :$port 2>/dev/null || true)

    if [[ -n "$pids" ]]; then
        for pid in $pids; do
            kill "$pid" 2>/dev/null || true
            log_success "Stopped $name on port $port (PID: $pid)"
        done
    fi
}

echo ""
echo "============================================================"
echo "  RMonitor Converter - Stopping Services"
echo "============================================================"
echo ""

# Try to stop by PID files first
stop_by_pid "logs/panel.pid" "Web Panel"
stop_by_pid "logs/converter.pid" "Converter Service"

# Also try to stop by port (fallback)
stop_by_port 3000 "Web Panel"
stop_by_port 50003 "Converter Service (WebSocket)"
stop_by_port 50004 "Converter Service (API)"

# Kill any remaining bun/node processes from this project
pkill -f "bun.*converter-service" 2>/dev/null || true
pkill -f "next dev -p 3000" 2>/dev/null || true

echo ""
log_success "All services stopped"
echo ""
