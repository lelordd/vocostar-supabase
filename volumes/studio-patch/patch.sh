#!/bin/sh

echo "Applying Supabase Studio Edge Functions Patch..."

# Find the bundled JS files that contain the 'edge-functions' and 'new' logic
# and replace the `IS_PLATFORM` boolean check preventing the UI from showing.
# Note: In compiled React code, it usually looks like `!X.IS_PLATFORM` or just `IS_PLATFORM`.

# 1. Enable DeployButton / New Function page
# This is tricky because the compiled chunk names change. We search all .js files.
echo "Patching DeployEdgeFunctionButton..."
find /app/apps/studio/.next -type f -name "*.js" -exec sed -i 's/disabled:!.\.IS_PLATFORM/disabled:false/g' {} +
find /app/apps/studio/.next -type f -name "*.js" -exec sed -i 's/!.\.IS_PLATFORM?"Unable to deploy function as project is inactive":void 0/void 0/g' {} +

# 2. Reroute the API call for deployment.
# Studio tries to hit /api/v1/projects/:ref/functions/deploy
# We replace it to hit our custom Kong route /api/v1/projects/:ref/functions-manager-deploy
# so Kong can route it to port 8085 (functions-manager)
echo "Patching Deploy API Route..."
find /app/apps/studio/.next -type f -name "*.js" -exec sed -i 's/\/v1\/projects\/\[ref\]\/functions\/deploy/\/v1\/projects\/\[ref\]\/functions-manager-deploy/g' {} +
find /app/apps/studio/.next -type f -name "*.js" -exec sed -i 's/\/v1\/projects\/{ref}\/functions\/deploy/\/v1\/projects\/{ref}\/functions-manager-deploy/g' {} +

echo "Patch complete. Starting Studio..."
exec "$@"
