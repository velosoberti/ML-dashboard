#!/usr/bin/env bash
# ============================================================================
# Diabetes ML Platform — Start All Services
# ============================================================================
# Usage:  ./start.sh          Start everything
#         ./start.sh stop     Stop everything
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

log()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()   { echo -e "${GREEN}[OK]${NC}    $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()  { echo -e "${RED}[ERR]${NC}   $1"; }

# ── Stop mode ──
if [[ "$1" == "stop" ]]; then
    log "Stopping all services..."

    # Flask API
    if [[ -f "$PROJECT_ROOT/.pid_api" ]]; then
        kill "$(cat "$PROJECT_ROOT/.pid_api")" 2>/dev/null && ok "Flask API stopped" || warn "Flask API was not running"
        rm -f "$PROJECT_ROOT/.pid_api"
    fi

    # Dashboard
    if [[ -f "$PROJECT_ROOT/.pid_dashboard" ]]; then
        kill "$(cat "$PROJECT_ROOT/.pid_dashboard")" 2>/dev/null && ok "Dashboard stopped" || warn "Dashboard was not running"
        rm -f "$PROJECT_ROOT/.pid_dashboard"
    fi

    # ZenML
    uv run zenml down 2>/dev/null && ok "ZenML stopped" || warn "ZenML was not running"

    # Docker services
    docker compose -f "$PROJECT_ROOT/docker/mlflow/docker-compose.yaml" down 2>/dev/null && ok "MLflow stopped" || warn "MLflow was not running"
    docker compose -f "$PROJECT_ROOT/docker/airflow/docker-compose.yaml" down 2>/dev/null && ok "Airflow stopped" || warn "Airflow was not running"

    ok "All services stopped."
    exit 0
fi

# ============================================================================
# START
# ============================================================================

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Diabetes ML Platform — Starting Services   ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Ensure uv is installed ──
if ! command -v uv &>/dev/null; then
    warn "uv not found. Installing..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
    if ! command -v uv &>/dev/null; then
        err "Failed to install uv. Install manually: https://docs.astral.sh/uv/getting-started/installation/"
        exit 1
    fi
    ok "uv installed"
else
    ok "uv found ($(uv --version))"
fi

# ── 2. uv sync ──
log "Installing/syncing dependencies with uv..."
uv sync
ok "Dependencies synced"

# ── 2. Docker network ──
log "Ensuring docker network 'mlops-network' exists..."
docker network create mlops-network 2>/dev/null && ok "Created mlops-network" || ok "mlops-network already exists"

# ── 3. MLflow (Docker) ──
log "Starting MLflow (port 5000)..."
docker compose -f "$PROJECT_ROOT/docker/mlflow/docker-compose.yaml" up -d --build
ok "MLflow starting at http://localhost:5000"

# ── 4. Airflow (Docker) ──
log "Starting Airflow (port 8080)..."
docker compose -f "$PROJECT_ROOT/docker/airflow/docker-compose.yaml" up -d --build
ok "Airflow starting at http://localhost:8080  (user: airflow / pass: airflow)"

# ── 5. ZenML ──
log "Starting ZenML server (port 8237)..."
if ! uv run zenml status 2>/dev/null | grep -q "running"; then
    uv run zenml up
fi
ok "ZenML at http://localhost:8237"

# ── 6. Flask Prediction API ──
log "Starting Flask API (port 8000)..."
# Kill previous instance if still running
if [[ -f "$PROJECT_ROOT/.pid_api" ]]; then
    kill "$(cat "$PROJECT_ROOT/.pid_api")" 2>/dev/null || true
    rm -f "$PROJECT_ROOT/.pid_api"
fi
nohup uv run python "$PROJECT_ROOT/api/run.py" > "$PROJECT_ROOT/.log_api.log" 2>&1 &
echo $! > "$PROJECT_ROOT/.pid_api"
ok "Flask API starting at http://localhost:8000"

# ── 7. Dashboard ──
log "Starting Dashboard (port 8085)..."
if [[ -f "$PROJECT_ROOT/.pid_dashboard" ]]; then
    kill "$(cat "$PROJECT_ROOT/.pid_dashboard")" 2>/dev/null || true
    rm -f "$PROJECT_ROOT/.pid_dashboard"
fi
nohup uv run python "$PROJECT_ROOT/dashboard/server/server.py" --port 8085 > "$PROJECT_ROOT/.log_dashboard.log" 2>&1 &
echo $! > "$PROJECT_ROOT/.pid_dashboard"
ok "Dashboard starting at http://localhost:8085"

# ── Summary ──
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            All services launched              ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  MLflow      ${CYAN}http://localhost:5000${NC}            ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Airflow     ${CYAN}http://localhost:8080${NC}            ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ZenML       ${CYAN}http://localhost:8237${NC}            ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Flask API   ${CYAN}http://localhost:8000${NC}            ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Dashboard   ${CYAN}http://localhost:8085${NC}            ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Stop everything:  ${YELLOW}./start.sh stop${NC}"
echo -e "  API logs:         ${YELLOW}tail -f .log_api.log${NC}"
echo -e "  Dashboard logs:   ${YELLOW}tail -f .log_dashboard.log${NC}"
echo ""
