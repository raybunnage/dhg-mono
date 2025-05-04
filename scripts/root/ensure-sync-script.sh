#!/bin/bash
# ensure-sync-script.sh - Ensures that final-sync.js exists in scripts/root
# Copies the file if it doesn't exist from scripts/root to scripts/cli-pipeline

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

SOURCE_PATH="${PROJECT_ROOT}/scripts/root/final-sync.js"
TARGET_DIR="${PROJECT_ROOT}/scripts/cli-pipeline"
TARGET_PATH="${TARGET_DIR}/final-sync.js"

# Check if source file exists
if [ ! -f "${SOURCE_PATH}" ]; then
    echo "❌ Error: Source file ${SOURCE_PATH} not found"
    exit 1
fi

# Check if target directory exists
if [ ! -d "${TARGET_DIR}" ]; then
    echo "Creating directory ${TARGET_DIR}..."
    mkdir -p "${TARGET_DIR}"
fi

# Create a symlink from target to source
if [ ! -f "${TARGET_PATH}" ] && [ ! -L "${TARGET_PATH}" ]; then
    echo "Creating symlink from ${TARGET_PATH} to ${SOURCE_PATH}..."
    ln -s "${SOURCE_PATH}" "${TARGET_PATH}"
    echo "✅ Symlink created successfully"
else
    echo "Target already exists, checking if it's a symlink to the correct file..."
    if [ -L "${TARGET_PATH}" ]; then
        TARGET_DEST=$(readlink "${TARGET_PATH}")
        if [ "${TARGET_DEST}" == "${SOURCE_PATH}" ]; then
            echo "✅ Symlink is already correct"
        else
            echo "⚠️ Symlink exists but points to different file: ${TARGET_DEST}"
            echo "Updating symlink..."
            rm "${TARGET_PATH}"
            ln -s "${SOURCE_PATH}" "${TARGET_PATH}"
            echo "✅ Symlink updated successfully"
        fi
    else
        echo "⚠️ Target exists but is not a symlink. Backing up and replacing..."
        mv "${TARGET_PATH}" "${TARGET_PATH}.bak.$(date +%Y%m%d%H%M%S)"
        ln -s "${SOURCE_PATH}" "${TARGET_PATH}"
        echo "✅ Original file backed up and symlink created"
    fi
fi

echo "All set! The sync script is now available in both locations:"
echo "- Source: ${SOURCE_PATH}"
echo "- Target: ${TARGET_PATH}"