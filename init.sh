#!/bin/bash
#
# RMonitor Converter - Initialization Script
# Инициализирует проект после клонирования
#
# Usage:
#   ./init.sh              - Интерактивный режим
#   ./init.sh --defaults   - Использовать значения по умолчанию
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

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo ""
echo "============================================================"
echo "  RMonitor Converter - Initialization"
echo "============================================================"
echo ""

# Check bun
if ! command -v bun &> /dev/null; then
    log_error "Bun is not installed!"
    log_info "Install bun: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Run TypeScript initializer
if [[ "$1" == "--defaults" ]] || [[ "$1" == "-d" ]]; then
    bun run init.ts --defaults
else
    bun run init.ts
fi

echo ""
log_success "Initialization complete!"
echo ""
echo "To start the services:"
echo "  ./start.sh          # Daemon mode"
echo "  ./start.sh --dev    # Development mode"
echo ""
