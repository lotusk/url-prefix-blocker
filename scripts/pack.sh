#!/bin/sh
set -e
cd "$(dirname "$0")/.."

version=$(node -p "require('./extension/manifest.json').version")
out="dist/url-prefix-blocker-$version.zip"

mkdir -p dist
rm -f "$out"
cd extension
zip -r -q "../$out" . -x "*.DS_Store"
cd ..
echo "$out"
