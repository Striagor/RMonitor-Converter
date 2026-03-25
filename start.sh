#!/bin/bash
#
# RMonitor Converter - Start Script
# Запускает все сервисы проекта
#
# Usage:
#   ./start.sh          - Запуск в режиме демона (фоновый режим)
#   ./start.sh --dev    - Запуск в режиме разработки (с логами в консоли)
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

# Parse arguments
DAEMON_MODE=true
if [[ "$1" == "--dev" ]] || [[ "$1" == "-d" ]]; then
    DAEMON_MODE=false
fi

# Function to print colored output
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if bun is installed
check_bun() {
    if ! command -v bun &> /dev/null; then
        log_error "Bun is not installed!"
        log_info "Install bun: curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi
    log_success "Bun found: $(bun --version)"
}

# Check if node_modules exist
check_dependencies() {
    if [[ ! -d "node_modules" ]]; then
        log_warn "Dependencies not installed, running bun install..."
        bun install
    fi

    if [[ ! -d "mini-services/converter-service/node_modules" ]]; then
        log_warn "Converter service dependencies not installed, running bun install..."
        cd mini-services/converter-service && bun install && cd ../..
    fi
}

# Check if database exists
check_database() {
    if [[ ! -f "db/custom.db" ]]; then
        log_warn "Database not found!"
        log_info "Run './init.sh' or 'bun run init.ts --defaults' first"
        exit 1
    fi
}

# Check if ports are available
check_ports() {
    local ports=(3000 50003 50004)
    local ports_busy=()

    for port in "${ports[@]}"; do
        if lsof -i :$port &> /dev/null; then
            ports_busy+=($port)
        fi
    done

    if [[ ${#ports_busy[@]} -gt 0 ]]; then
        log_warn "Ports ${ports_busy[*]} are already in use"
        log_info "Run './stop.sh' to stop existing services"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Start converter service
start_converter() {
    log_info "Starting Converter Service..."

    cd mini-services/converter-service

    if $DAEMON_MODE; then
        nohup bun run dev > ../../logs/converter.log 2>&1 &
        echo $! > ../../logs/converter.pid
    else
        bun run dev &
    fi

    cd ../..

    # Wait for service to start
    sleep 2

    if curl -s http://localhost:50004/api/health > /dev/null 2>&1; then
        log_success "Converter Service started (port 50003/50004)"
    else
        log_warn "Converter Service may not have started correctly"
    fi
}

# Start web panel
start_panel() {
    log_info "Starting Web Panel..."

    if $DAEMON_MODE; then
        nohup bun run dev > logs/panel.log 2>&1 &
        echo $! > logs/panel.pid
    else
        bun run dev
    fi
}

# Main
main() {
    echo ""
    echo "============================================================"
    echo "  RMonitor Converter - Starting Services"
    echo "============================================================"
    echo ""

    # Create logs directory
    mkdir -p logs

    # Run checks
    check_bun
    check_dependencies
    check_database
    check_ports

    echo ""

    if $DAEMON_MODE; then
        log_info "Starting in daemon mode..."
        start_converter
        start_panel

        sleep 3

        echo ""
        log_success "All services started!"
        echo ""
        echo "  Web Panel:     http://localhost:3000"
        echo "  WebSocket:     ws://localhost:50003"
        echo "  Management API: http://localhost:50004"
        echo ""
        echo "  Logs: ./logs/panel.log, ./logs/converter.log"
        echo "  Stop: ./stop.sh"
        echo ""
    else
        log_info "Starting in development mode..."
        start_converter
        log_success "Converter Service started"
        log_info "Starting Web Panel (press Ctrl+C to stop)..."
        echo ""
        start_panel
    fi
}

main
