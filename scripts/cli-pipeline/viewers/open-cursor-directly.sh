#!/bin/bash

# Direct test script to open Cursor worktrees
echo "Testing Cursor worktree opening..."

case "$1" in
    1) /Applications/Cursor.app/Contents/MacOS/Cursor /Users/raybunnage/Documents/github/dhg-mono ;;
    2) /Applications/Cursor.app/Contents/MacOS/Cursor /Users/raybunnage/Documents/github/dhg-mono-admin-code ;;
    3) /Applications/Cursor.app/Contents/MacOS/Cursor /Users/raybunnage/Documents/github/dhg-mono-dhg-hub ;;
    4) /Applications/Cursor.app/Contents/MacOS/Cursor /Users/raybunnage/Documents/github/dhg-mono-feature/dhg-mono-docs ;;
    5) /Applications/Cursor.app/Contents/MacOS/Cursor /Users/raybunnage/Documents/github/dhg-mono-gmail-cli-pipeline-research-app ;;
    6) /Applications/Cursor.app/Contents/MacOS/Cursor /Users/raybunnage/Documents/github/dhg-mono-improve-audio ;;
    7) /Applications/Cursor.app/Contents/MacOS/Cursor /Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines ;;
    8) /Applications/Cursor.app/Contents/MacOS/Cursor /Users/raybunnage/Documents/github/dhg-mono-improve-google ;;
    9) /Applications/Cursor.app/Contents/MacOS/Cursor /Users/raybunnage/Documents/github/dhg-mono-improve-suite ;;
    0) /Applications/Cursor.app/Contents/MacOS/Cursor /Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks ;;
    *)
        echo "Usage: $0 [1-9,0]"
        echo "1 = Development, 2 = Admin Code, 3 = Hub, etc."
        ;;
esac