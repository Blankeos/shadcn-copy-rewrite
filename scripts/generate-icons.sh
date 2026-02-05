#!/usr/bin/env bash
set -euo pipefail

input_path=${1:-"public/scr_logo.png"}
output_dir=${2:-"public"}

if ! command -v sips >/dev/null 2>&1; then
  echo "Error: sips is required (macOS)." >&2
  exit 1
fi

if [[ ! -f "$input_path" ]]; then
  echo "Error: input file not found: $input_path" >&2
  exit 1
fi

mkdir -p "$output_dir"

sips -Z 16 "$input_path" --out "$output_dir/icon-16.png"
sips -Z 32 "$input_path" --out "$output_dir/icon-32.png"
sips -Z 48 "$input_path" --out "$output_dir/icon-48.png"
sips -Z 128 "$input_path" --out "$output_dir/icon-128.png"

echo "Wrote icons to $output_dir"
