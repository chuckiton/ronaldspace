#!/bin/sh
set -eu

script_path=$0
while [ -L "$script_path" ]; do
    script_directory=$(CDPATH= cd -- "$(dirname -- "$script_path")" && pwd)
    script_target=$(readlink "$script_path")
    case $script_target in
        /*) script_path=$script_target ;;
        *) script_path=$script_directory/$script_target ;;
    esac
done
repository_root=$(CDPATH= cd -- "$(dirname -- "$script_path")/.." && pwd)
deploy_host=${RONALD_DEPLOY_HOST:-}
deploy_root=${RONALD_DEPLOY_ROOT:-}
rsync_options="-av --progress"

if [ -z "$deploy_host" ]; then
    echo "RONALD_DEPLOY_HOST is required." >&2
    echo "Fish: set -Ux RONALD_DEPLOY_HOST user@server" >&2
    exit 2
fi

if [ -z "$deploy_root" ]; then
    echo "RONALD_DEPLOY_ROOT is required." >&2
    echo "Fish: set -Ux RONALD_DEPLOY_ROOT /path/to/ronald" >&2
    exit 2
fi

if [ "${1:-}" = "--dry-run" ]; then
    rsync_options="$rsync_options --dry-run"
elif [ "$#" -ne 0 ]; then
    echo "Usage: $0 [--dry-run]" >&2
    exit 2
fi

echo "Deploying container configuration to $deploy_host:$deploy_root/"
rsync $rsync_options \
    "$repository_root/deploy/docker-compose.yaml" \
    "$repository_root/deploy/nginx.conf" \
    "$deploy_host:$deploy_root/"

echo "Deploying canonical frontend to $deploy_host:$deploy_root/www/"
# --delete removes stale files only inside the dedicated remote document root.
# The container configuration and any other stack files remain untouched.
rsync $rsync_options --delete \
    "$repository_root/index.html" \
    "$repository_root/style.css" \
    "$repository_root/fonts" \
    "$repository_root/src" \
    "$deploy_host:$deploy_root/www/"

echo "Deployment files synchronized."
