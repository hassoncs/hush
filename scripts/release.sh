#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[ok]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
error() { echo -e "${RED}[error]${NC} $1"; exit 1; }

RELEASE_VERSION=""
DRY_RUN=0
SKIP_PUSH=0

while [[ $# -gt 0 ]]; do
    case $1 in
        --version)
            RELEASE_VERSION="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=1
            shift
            ;;
        --skip-push)
            SKIP_PUSH=1
            shift
            ;;
        --help|-h)
            echo "Usage: $0 --version X.Y.Z [OPTIONS]"
            echo ""
            echo "Mechanical release operations. Agent decides version and writes content."
            echo ""
            echo "Options:"
            echo "  --version X.Y.Z   Release version (required)"
            echo "  --dry-run         Preview without making changes"
            echo "  --skip-push       Don't push to remote (for local testing)"
            echo "  --help, -h        Show this help"
            echo ""
            echo "Pre-requisites (agent must do before running):"
            echo "  1. Update hush-cli/package.json version"
            echo "  2. Update CHANGELOG.md with release notes"
            echo "  3. Write migration guide if major version"
            echo "  4. Commit all changes"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

if [ -z "$RELEASE_VERSION" ]; then
    error "Version required. Usage: $0 --version X.Y.Z"
fi

if [[ ! "$RELEASE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    error "Invalid version format: $RELEASE_VERSION. Use semver (e.g., 2.4.0)"
fi

echo ""
echo "========================================"
echo "  Release: v$RELEASE_VERSION"
echo "========================================"
echo ""

if [ $DRY_RUN -eq 1 ]; then
    warn "DRY RUN - no changes will be made"
    echo ""
fi

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    error "Must be on main branch. Currently on: $CURRENT_BRANCH"
fi

if [ -n "$(git status --porcelain)" ]; then
    error "Working tree not clean. Commit or stash changes first."
fi

PKG_VERSION=$(node -p "require('./hush-cli/package.json').version")
if [ "$PKG_VERSION" != "$RELEASE_VERSION" ]; then
    error "package.json version ($PKG_VERSION) doesn't match release version ($RELEASE_VERSION)"
fi

log "Version matches package.json: $RELEASE_VERSION"

if ! grep -q "## \[$RELEASE_VERSION\]" CHANGELOG.md; then
    warn "CHANGELOG.md doesn't have entry for [$RELEASE_VERSION]"
    warn "Add changelog entry before release"
fi

if [ $DRY_RUN -eq 1 ]; then
    echo ""
    echo "Dry run complete. Would have:"
    echo "  - Created tag: v$RELEASE_VERSION"
    echo "  - Pushed to origin"
    exit 0
fi

log "Creating tag: v$RELEASE_VERSION"
git tag "v$RELEASE_VERSION"

if [ $SKIP_PUSH -eq 0 ]; then
    log "Pushing to origin..."
    git push origin main
    git push origin "v$RELEASE_VERSION"
    log "Pushed tag v$RELEASE_VERSION"
else
    warn "Skipping push (--skip-push)"
fi

echo ""
echo "========================================"
echo "  Release v$RELEASE_VERSION complete"
echo "========================================"
echo ""
echo "GitHub Actions will now:"
echo "  - Run CI checks"
echo "  - Publish to npm"
echo "  - Deploy docs"
echo ""
echo "Monitor: https://github.com/hassoncs/hush/actions"
