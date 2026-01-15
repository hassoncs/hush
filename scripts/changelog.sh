#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

show_commits() {
    local from_tag="$1"
    local range=""
    
    if [ -n "$from_tag" ]; then
        range="${from_tag}..HEAD"
    else
        latest_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
        if [ -n "$latest_tag" ]; then
            range="${latest_tag}..HEAD"
            echo "Commits since $latest_tag:"
        else
            range=""
            echo "All commits (no tags found):"
        fi
    fi
    
    echo ""
    
    if [ -n "$range" ]; then
        git log --no-merges --format="  %h %s" "$range" 2>/dev/null || echo "  (no commits)"
    else
        git log --no-merges --format="  %h %s" -20
    fi
    
    echo ""
}

show_breaking() {
    echo "Breaking changes (commits with ! or BREAKING CHANGE):"
    echo ""
    
    latest_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    range="${latest_tag}..HEAD"
    
    if [ -z "$latest_tag" ]; then
        range="HEAD~20..HEAD"
    fi
    
    git log --no-merges --format="%H %s" "$range" 2>/dev/null | while read -r sha subject; do
        if [[ "$subject" =~ ^[a-z]+\([a-z]+\)!: ]] || [[ "$subject" =~ ^[a-z]+!: ]]; then
            echo "  ${sha:0:7} $subject"
        fi
        
        body=$(git log -1 --format="%b" "$sha" 2>/dev/null)
        if echo "$body" | grep -qi "BREAKING CHANGE"; then
            if ! [[ "$subject" =~ ! ]]; then
                echo "  ${sha:0:7} $subject"
            fi
        fi
    done
    
    echo ""
}

suggest_bump() {
    latest_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [ -z "$latest_tag" ]; then
        echo "Suggested bump: (no previous tag, start with 1.0.0)"
        return
    fi
    
    range="${latest_tag}..HEAD"
    commits=$(git log --no-merges --format="%s" "$range" 2>/dev/null)
    
    has_breaking=0
    has_feat=0
    has_fix=0
    
    while IFS= read -r subject; do
        if [[ "$subject" =~ ^[a-z]+\([a-z]+\)!: ]] || [[ "$subject" =~ ^[a-z]+!: ]]; then
            has_breaking=1
        elif [[ "$subject" =~ ^feat ]]; then
            has_feat=1
        elif [[ "$subject" =~ ^fix ]]; then
            has_fix=1
        fi
    done <<< "$commits"
    
    current_version="${latest_tag#v}"
    IFS='.' read -r major minor patch <<< "$current_version"
    
    if [ $has_breaking -eq 1 ]; then
        echo "Suggested bump: MAJOR ($current_version -> $((major + 1)).0.0)"
    elif [ $has_feat -eq 1 ]; then
        echo "Suggested bump: MINOR ($current_version -> $major.$((minor + 1)).0)"
    else
        echo "Suggested bump: PATCH ($current_version -> $major.$minor.$((patch + 1)))"
    fi
}

case "${1:-}" in
    --show-commits|-c)
        show_commits "$2"
        ;;
    --show-breaking|-b)
        show_breaking
        ;;
    --suggest-bump|-s)
        suggest_bump
        ;;
    --help|-h)
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Helper script to show commits for changelog writing."
        echo "The AI agent writes the actual changelog content."
        echo ""
        echo "Options:"
        echo "  --show-commits, -c [TAG]  Show commits since TAG (default: latest tag)"
        echo "  --show-breaking, -b       Show commits with breaking changes"
        echo "  --suggest-bump, -s        Suggest version bump based on commits"
        echo "  --help, -h                Show this help"
        ;;
    *)
        show_commits
        suggest_bump
        ;;
esac
