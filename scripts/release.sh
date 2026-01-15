#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "🚀 Hush Release Script"
echo ""

# Get current version
VERSION=$(node -p "require('./hush-cli/package.json').version")
echo "📦 Version: $VERSION"
echo ""

# Step 1: Build CLI
echo "🔨 Building hush-cli..."
cd hush-cli
pnpm build
echo "✓ CLI built"

# Step 2: Run tests
echo ""
echo "🧪 Running tests..."
pnpm test
echo "✓ Tests passed"
cd ..

# Step 3: Build docs
echo ""
echo "📚 Building docs..."
cd docs
pnpm build
echo "✓ Docs built"
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All builds complete! Ready to deploy."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 4: Get OTP
read -p "🔑 Enter npm OTP: " OTP
echo ""

if [ -z "$OTP" ]; then
    echo "❌ OTP required"
    exit 1
fi

# Step 5: Deploy in parallel
echo "🚀 Deploying..."
echo ""

(
    cd hush-cli
    echo "📦 Publishing to npm..."
    npm publish --otp="$OTP" 2>&1 | sed 's/^/   [npm] /'
    echo "✓ Published @chriscode/hush@$VERSION to npm"
) &
NPM_PID=$!

(
    cd docs
    echo "🌐 Deploying docs to Cloudflare Pages..."
    pnpm deploy 2>&1 | sed 's/^/   [docs] /'
    echo "✓ Docs deployed"
) &
DOCS_PID=$!

# Wait for both
wait $NPM_PID
NPM_EXIT=$?

wait $DOCS_PID
DOCS_EXIT=$?

echo ""
if [ $NPM_EXIT -eq 0 ] && [ $DOCS_EXIT -eq 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 Release complete!"
    echo ""
    echo "   npm: https://www.npmjs.com/package/@chriscode/hush"
    echo "   docs: https://hush-docs.pages.dev"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "❌ Release failed"
    [ $NPM_EXIT -ne 0 ] && echo "   npm publish failed (exit $NPM_EXIT)"
    [ $DOCS_EXIT -ne 0 ] && echo "   docs deploy failed (exit $DOCS_EXIT)"
    exit 1
fi
