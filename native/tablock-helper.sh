#!/bin/bash
# Tab Lock Native Helper - Linux/macOS
# Auto-discovers profiles and prevents extension removal.

set -e

running=true

read_message() {
    local len_bytes
    IFS= read -r -n 4 -d '' len_bytes 2>/dev/null || return 1
    [ ${#len_bytes} -lt 4 ] && return 1
    printf -v len "%u" $(printf "%d" "'${len_bytes:0:1}'") \
        $(printf "%d" "'${len_bytes:1:1}'") \
        $(printf "%d" "'${len_bytes:2:1}'") \
        $(printf "%d" "'${len_bytes:3:1}'")
    [ "$len" -eq 0 ] && return 1
    IFS= read -r -n "$len" -d '' payload 2>/dev/null || return 1
    echo "$payload"
    return 0
}

send_message() {
    local json="$1"
    local bytes="${#json}"
    printf "$(printf '\\x%02x\\x%02x\\x%02x\\x%02x' \
        $((bytes & 0xFF)) $(((bytes >> 8) & 0xFF)) \
        $(((bytes >> 16) & 0xFF)) $(((bytes >> 24) & 0xFF)))"
    echo "$json"
}

find_profiles() {
    local dirs=""
    for base in "$HOME/.mozilla/firefox" "$HOME/.zen" "$HOME/.waterfox"; do
        [ -d "$base" ] && for d in "$base"/*/; do
            [ -f "${d}extensions.json" ] && dirs="$dirs ${d%/}"
        done
    done
    if [[ "$OSTYPE" == "darwin"* ]]; then
        for base in "$HOME/Library/Application Support/Firefox/Profiles" "$HOME/Library/Application Support/Zen Browser/Profiles"; do
            [ -d "$base" ] && for d in "$base"/*/; do
                [ -f "${d}extensions.json" ] && dirs="$dirs ${d%/}"
            done
        done
    fi
    echo "$dirs"
}

backup_extension() {
    for profile in $(find_profiles); do
        python3 -c "
import json
with open('$profile/extensions.json') as f: data = json.load(f)
for a in data.get('addons', []):
    if a.get('id') == 'tablock@zen.example':
        with open('/tmp/tablock_backup.json', 'w') as f: json.dump(a, f)
        break
" 2>/dev/null || true
    done
}

watch_profiles() {
    local pid_file="/tmp/tablock_helper.pid"
    echo $$ > "$pid_file"

    while $running; do
        sleep 4
        for profile in $(find_profiles); do
            local ext_file="$profile/extensions.json"
            local xpi_file="$profile/extensions/tablock@zen.example.xpi"
            [ ! -f "$ext_file" ] && continue

            if ! grep -q '"id": "tablock@zen.example"' "$ext_file" 2>/dev/null; then
                if [ -f "/tmp/tablock_backup.json" ]; then
                    python3 -c "
import json
with open('$ext_file') as f: data = json.load(f)
with open('/tmp/tablock_backup.json') as f: entry = json.load(f)
if isinstance(data.get('addons'), list):
    found = any(a.get('id') == 'tablock@zen.example' for a in data['addons'])
    if not found:
        data['addons'].append(entry)
        with open('$ext_file', 'w') as f: json.dump(data, f, indent=2)
" 2>/dev/null || true
                fi
            fi

            if [ ! -f "$xpi_file" ]; then
                local backup_xpi="$HOME/.local/share/tablock-helper/TabLock.xpi"
                [ ! -f "$backup_xpi" ] && backup_xpi="/tmp/TabLock.xpi"
                if [ -f "$backup_xpi" ]; then
                    mkdir -p "$(dirname "$xpi_file")" 2>/dev/null
                    cp "$backup_xpi" "$xpi_file" 2>/dev/null || true
                fi
            fi
        done
    done
}

backup_extension
send_message '{"status":"started"}'
watch_profiles
