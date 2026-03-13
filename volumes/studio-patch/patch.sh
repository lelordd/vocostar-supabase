#!/bin/sh
set -e

echo "=== Applying Supabase Studio Edge Functions Patch ==="

CHUNKS_DIR="/app/apps/studio/.next/static/chunks"

if [ ! -d "$CHUNKS_DIR" ]; then
    echo "ERROR: chunks dir not found at $CHUNKS_DIR"
    exit 1
fi

# Find the chunk that contains the "Deploy a new function" UI button text
# and patch all IS_PLATFORM checks to `true` within that file
PATCHED=0
for file in $(grep -rl "Deploy a new function" "$CHUNKS_DIR"); do
    echo "Found Ed Functions chunk: $file"
    # Replace `X.IS_PLATFORM&&` (where IS_PLATFORM is true = render button) with `true&&`
    sed -i 's/[A-Za-z_$]\+\.IS_PLATFORM&&/true\&\&/g' "$file"
    # Replace `!X.IS_PLATFORM&&` (where !IS_PLATFORM = HIDE button) with `false&&`
    sed -i 's/![A-Za-z_$]\+\.IS_PLATFORM&&/false\&\&/g' "$file"
    PATCHED=$((PATCHED + 1))
    echo "Patched: $file"
done

echo "=== Patch applied to $PATCHED chunk(s). Starting Studio... ==="
exec docker-entrypoint.sh node apps/studio/server.js
