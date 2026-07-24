#!/bin/sh
set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
deployment_root="$repository_root/ronald/www"
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

cp "$repository_root/index.html" "$deployment_root/index.html"
cp "$repository_root/style.css" "$deployment_root/style.css"
cp "$repository_root/fonts/ProFontNerdFont-Regular.ttf" "$deployment_root/fonts/ProFontNerdFont-Regular.ttf"

for source_file in $source_files; do
    cp "$repository_root/src/$source_file" "$deployment_root/src/$source_file"
done

echo "Synchronized canonical frontend files to ronald/www."
