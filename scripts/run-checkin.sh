#!/usr/bin/env bash
# Trae Work 每日签到的 cron 包装脚本：切到 skill 目录、跑签脚本、追加日志。
# 独立于 TRAE 客户端运行（只依赖系统 node 与本地登录态）。
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN=${TRAE_CHECKIN_NODE:-/usr/local/bin/node}
LOG_DIR="$SKILL_DIR/logs"
mkdir -p "$LOG_DIR"

{
  printf '\n==== [%s] 开始 =====\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
  cd "$SKILL_DIR"
  "$NODE_BIN" scripts/checkin.js
  printf '==== [%s] 结束 =====\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
} >> "$LOG_DIR/checkin.log" 2>&1