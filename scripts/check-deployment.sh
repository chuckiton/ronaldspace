#!/bin/sh
set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
deployment_root="$repository_root/ronald/www"
status=0
source_files="
constants.js
GeraldSynth.js
GordonObject.js
main.js
RonaldHistory.js
RonaldInput.js
RonaldPath.js
RonaldSpace.js
universes.js
"

check_file() {
    source_file=$1
    deployed_file=$2

    if ! cmp -s "$source_file" "$deployed_file"; then
        echo "Out of sync: ${source_file#"$repository_root"/}"
        status=1
    fi
}

check_file "$repository_root/index.html" "$deployment_root/index.html"
check_file "$repository_root/style.css" "$deployment_root/style.css"
check_file \
    "$repository_root/fonts/ProFontNerdFont-Regular.ttf" \
    "$deployment_root/fonts/ProFontNerdFont-Regular.ttf"

for source_file in $source_files; do
    check_file \
        "$repository_root/src/$source_file" \
        "$deployment_root/src/$source_file"
done

if [ "$status" -ne 0 ]; then
    echo "Run ./scripts/sync-deployment.sh before publishing."
    exit "$status"
fi

echo "ronald/www matches the canonical frontend."
