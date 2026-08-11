#!/usr/bin/env bash

# ByLucky deployment menu for a Linux VPS.
# It manages this repository's PostgreSQL service and local Node runtime.

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.dev.yml"
ENV_FILE="$PROJECT_DIR/.env"
ENV_EXAMPLE="$PROJECT_DIR/.env.example"
PASSWORD_HASH_SCRIPT="$PROJECT_DIR/scripts/hash-admin-password-stdin.ts"
RUNTIME_DIR="$PROJECT_DIR/.bylucky-runtime"
LOG_DIR="$PROJECT_DIR/logs/production"
WEB_PID_FILE="$RUNTIME_DIR/web.pid"
WORKER_PID_FILE="$RUNTIME_DIR/worker.pid"
WEB_LOG_FILE="$LOG_DIR/web.log"
WORKER_LOG_FILE="$LOG_DIR/worker.log"
POSTGRES_PORT="${POSTGRES_PORT:-5431}"
MANAGED_DATABASE_URL="postgresql://bylucky:bylucky_dev@localhost:${POSTGRES_PORT}/bylucky"

cd "$PROJECT_DIR"

say() {
  printf '\n%s\n' "$*"
}

die() {
  printf '\nError: %s\n' "$*" >&2
  exit 1
}

trap 'printf "\nDeployment stopped at line %s.\n" "$LINENO" >&2' ERR

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

ensure_docker_engine() {
  local docker_error docker_context
  if docker info >/dev/null 2>&1; then
    return
  fi

  docker_error="$(docker info 2>&1 || true)"
  docker_context="$(docker context show 2>/dev/null || true)"
  if [[ "$docker_error" == *"permission denied"* ]]; then
    die $'Docker Engine is running, but this user cannot access it.\nOn Linux, add the deployment user to the docker group (`sudo usermod -aG docker $USER`), sign out and back in, then verify `docker info`.\nDo not run the application as root just to bypass Docker permissions.\nCurrent Docker context: '"${docker_context:-unknown}"
  fi

  die "Docker Engine cannot be reached. Start the docker service (`sudo systemctl start docker`), then verify `docker info` before rerunning deploy.sh."
}

require_prerequisites() {
  [[ -f "$COMPOSE_FILE" ]] || die "Missing $COMPOSE_FILE"
  [[ -f "$ENV_EXAMPLE" ]] || die "Missing $ENV_EXAMPLE"

  require_command node
  require_command npm
  require_command docker
  require_command awk
  require_command mktemp
  require_command nohup
  require_command ps

  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  [[ "$node_major" =~ ^[0-9]+$ ]] && (( node_major >= 22 && node_major < 23 )) || die "Node.js 22 is required."
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."
  ensure_docker_engine
}

get_env_value() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 0
  awk -v key="$key" 'index($0, key "=") == 1 { print substr($0, length(key) + 2); exit }' "$ENV_FILE"
}

upsert_env() {
  local key="$1"
  local value="$2"
  local temporary_file

  temporary_file="$(mktemp "$PROJECT_DIR/.env.tmp.XXXXXX")"
  awk -v key="$key" -v value="$value" '
    index($0, key "=") == 1 { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' "$ENV_FILE" > "$temporary_file"
  mv -- "$temporary_file" "$ENV_FILE"
  chmod 600 "$ENV_FILE" 2>/dev/null || true
}

prepare_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    chmod 600 "$ENV_FILE" 2>/dev/null || true
  fi
  repair_env_file
}

repair_env_file() {
  local temporary_file line repaired_count=0
  [[ -f "$ENV_FILE" ]] || return

  temporary_file="$(mktemp "$PROJECT_DIR/.env.repair.XXXXXX")"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*# || "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      printf '%s\n' "$line" >> "$temporary_file"
    else
      printf '# Disabled invalid .env line: %s\n' "$line" >> "$temporary_file"
      ((repaired_count += 1))
    fi
  done < "$ENV_FILE"

  if (( repaired_count > 0 )); then
    mv -- "$temporary_file" "$ENV_FILE"
    chmod 600 "$ENV_FILE" 2>/dev/null || true
    say "Disabled $repaired_count non-variable note(s) in .env so Docker Compose can read the file."
  else
    rm -f -- "$temporary_file"
  fi
}

ensure_managed_database_url() {
  local existing_url
  existing_url="$(get_env_value "DATABASE_URL")"

  if [[ -z "$existing_url" || "$existing_url" == replace-with-* ]]; then
    upsert_env "DATABASE_URL" "$MANAGED_DATABASE_URL"
    return
  fi

  [[ "$existing_url" == "$MANAGED_DATABASE_URL" ]] || die "deploy.sh only manages the PostgreSQL database from docker-compose.dev.yml. DATABASE_URL must be $MANAGED_DATABASE_URL"
}

ensure_secret() {
  local key="$1"
  local current_value
  current_value="$(get_env_value "$key")"
  if [[ -n "$current_value" && "$current_value" != replace-with-* ]]; then
    return
  fi

  local generated_value
  generated_value="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))')"
  upsert_env "$key" "$generated_value"
}

ensure_secrets() {
  ensure_secret "SESSION_SECRET"
  ensure_secret "CODE_HMAC_SECRET"
  ensure_secret "CONFIG_ENCRYPTION_KEY"
}

dependencies_are_ready() {
  [[ -f "$PROJECT_DIR/node_modules/next/package.json" ]] \
    && [[ -f "$PROJECT_DIR/node_modules/tsx/package.json" ]] \
    && [[ -f "$PROJECT_DIR/node_modules/typescript/package.json" ]]
}

ensure_dependencies() {
  if dependencies_are_ready; then
    if [[ -f "$PROJECT_DIR/node_modules/.package-lock.json" && "$PROJECT_DIR/package-lock.json" -nt "$PROJECT_DIR/node_modules/.package-lock.json" ]]; then
      say "package-lock.json is newer than node_modules. Refreshing dependencies before deployment."
      stop_runtime
      if ! npm ci; then
        die "Could not install Node dependencies. Stop any remaining ByLucky process and rerun deploy.sh."
      fi
      return
    fi
    say "Using the existing Node dependencies."
    return
  fi

  say "Node dependencies are missing or incomplete. Installing from package-lock.json."
  if ! npm ci; then
    die "Could not install Node dependencies. Stop any remaining ByLucky process and rerun deploy.sh."
  fi
}

configure_app_url() {
  local existing_url requested_url
  existing_url="$(get_env_value "APP_URL")"
  [[ -n "$existing_url" && "$existing_url" != replace-with-* ]] || existing_url="http://localhost:3000"

  read -r -p "Public application URL [$existing_url]: " requested_url
  requested_url="${requested_url%$'\r'}"
  requested_url="${requested_url:-$existing_url}"
  [[ "$requested_url" =~ ^https?://[^[:space:]]+$ ]] || die "APP_URL must begin with http:// or https:// and contain no spaces."
  upsert_env "APP_URL" "$requested_url"
}

prompt_admin_credentials() {
  local username password confirmation password_hash

  while true; do
    read -r -p "Administrator username: " username
    username="${username%$'\r'}"
    [[ "$username" =~ ^[A-Za-z0-9_.@-]{1,128}$ ]] && break
    printf 'Use 1-128 letters, numbers, dots, underscores, @, or hyphens.\n' >&2
  done

  while true; do
    read -r -s -p "Administrator password (at least 12 characters): " password
    printf '\n'
    read -r -s -p "Confirm administrator password: " confirmation
    printf '\n'
    [[ "$password" == "$confirmation" ]] || { printf 'Passwords do not match.\n' >&2; continue; }
    (( ${#password} >= 12 && ${#password} <= 1024 )) || { printf 'Password must contain 12-1024 characters.\n' >&2; continue; }
    break
  done
  unset confirmation

  [[ -f "$PASSWORD_HASH_SCRIPT" ]] || die "Missing $PASSWORD_HASH_SCRIPT"
  password_hash="$(printf '%s' "$password" | node --conditions=react-server --import tsx "$PASSWORD_HASH_SCRIPT")"
  unset password
  [[ -n "$password_hash" ]] || die "Could not generate the administrator password hash."

  upsert_env "ADMIN_USERNAME" "$username"
  upsert_env "ADMIN_PASSWORD_HASH" "$password_hash"
  unset password_hash username
}

wait_for_database() {
  local attempt
  for attempt in {1..30}; do
    if docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U bylucky -d bylucky >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done
  die "PostgreSQL did not become ready within 60 seconds."
}

start_database() {
  docker compose -f "$COMPOSE_FILE" up -d db
  wait_for_database
}

recorded_process_is_expected() {
  local pid="$1"
  local marker="$2"
  local command_line
  command_line="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  [[ "$command_line" == *"$marker"* ]]
}

stop_recorded_process() {
  local label="$1"
  local pid_file="$2"
  local marker="$3"
  local pid attempt

  [[ -f "$pid_file" ]] || return
  pid="$(tr -d '[:space:]' < "$pid_file")"
  if [[ ! "$pid" =~ ^[0-9]+$ ]] || ! kill -0 "$pid" 2>/dev/null; then
    rm -f -- "$pid_file"
    return
  fi
  if ! recorded_process_is_expected "$pid" "$marker"; then
    printf 'Not stopping %s PID %s because it no longer matches this project.\n' "$label" "$pid" >&2
    return
  fi

  kill "$pid"
  for attempt in {1..15}; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill -KILL "$pid"
  fi
  rm -f -- "$pid_file"
}

stop_runtime() {
  stop_recorded_process "ByLucky web server" "$WEB_PID_FILE" "next"
  stop_recorded_process "ByLucky worker" "$WORKER_PID_FILE" "dist-worker/index.cjs"
}

wait_for_web_server() {
  local attempt
  for attempt in {1..30}; do
    if node -e '
      const net = require("node:net");
      const socket = net.createConnection({ host: "127.0.0.1", port: 3000 });
      socket.setTimeout(1000);
      socket.once("connect", () => { socket.destroy(); process.exit(0); });
      socket.once("timeout", () => { socket.destroy(); process.exit(1); });
      socket.once("error", () => process.exit(1));
    ' >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done
  return 1
}

start_runtime() {
  mkdir -p "$RUNTIME_DIR" "$LOG_DIR"
  stop_runtime

  NODE_ENV=production PORT=3000 nohup "$PROJECT_DIR/node_modules/.bin/next" start --hostname 127.0.0.1 --port 3000 > "$WEB_LOG_FILE" 2>&1 &
  printf '%s\n' "$!" > "$WEB_PID_FILE"

  NODE_ENV=production nohup node --conditions=react-server "$PROJECT_DIR/dist-worker/index.cjs" > "$WORKER_LOG_FILE" 2>&1 &
  printf '%s\n' "$!" > "$WORKER_PID_FILE"

  sleep 2
  local web_pid worker_pid
  web_pid="$(<"$WEB_PID_FILE")"
  worker_pid="$(<"$WORKER_PID_FILE")"
  kill -0 "$web_pid" 2>/dev/null || { tail -n 30 "$WEB_LOG_FILE" >&2 || true; die "The web server did not start."; }
  kill -0 "$worker_pid" 2>/dev/null || { tail -n 30 "$WORKER_LOG_FILE" >&2 || true; die "The worker did not start."; }
  if ! wait_for_web_server; then
    tail -n 30 "$WEB_LOG_FILE" >&2 || true
    stop_runtime
    die "The web server did not start listening on 127.0.0.1:3000."
  fi

  say "ByLucky is running. Web PID: $web_pid. Worker PID: $worker_pid."
  printf 'Logs: %s\n' "$LOG_DIR"
}

first_deployment() {
  require_prerequisites
  ensure_dependencies
  prepare_env_file
  ensure_managed_database_url
  ensure_secrets
  configure_app_url
  prompt_admin_credentials
  start_database
  NODE_ENV=production npm run db:migrate
  npm run worker:build
  NODE_ENV=production npm run build
  start_runtime
}

change_admin_credentials() {
  require_prerequisites
  ensure_dependencies
  prepare_env_file
  ensure_managed_database_url
  prompt_admin_credentials

  if [[ -f "$WEB_PID_FILE" || -f "$WORKER_PID_FILE" ]]; then
    stop_runtime
    start_runtime
    say "Administrator credentials were updated and the local runtime was restarted."
  else
    say "Administrator credentials were updated. Run option 1 to start a first deployment."
  fi
}

clear_data_and_redeploy() {
  require_prerequisites
  ensure_dependencies
  prepare_env_file
  ensure_managed_database_url

  say "This deletes only the PostgreSQL volume declared by docker-compose.dev.yml."
  say "Source files and .env secrets are kept. This cannot be undone."
  local confirmation
  read -r -p "Type ERASE to delete all ByLucky database data and redeploy: " confirmation
  confirmation="${confirmation%$'\r'}"
  [[ "$confirmation" == "ERASE" ]] || { say "Canceled."; return; }

  stop_runtime
  docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans
  rm -rf -- "$RUNTIME_DIR"
  first_deployment
}

show_menu() {
  cat <<'MENU'

ByLucky deployment menu

1. First deployment (requires administrator username and password)
2. Change administrator username and password
3. Delete all ByLucky database data, then redeploy
0. Exit
MENU
}

main() {
  local selection
  while true; do
    show_menu
    if ! read -r -p "Choose an action: " selection; then
      say "Input closed."
      exit 0
    fi
    selection="${selection%$'\r'}"
    case "$selection" in
      1) first_deployment ;;
      2) change_admin_credentials ;;
      3) clear_data_and_redeploy ;;
      0) say "Exited."; exit 0 ;;
      *) printf 'Please enter 1, 2, 3, or 0.\n' >&2 ;;
    esac
  done
}

main "$@"
