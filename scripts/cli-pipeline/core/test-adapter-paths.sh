#!/bin/bash
# test-adapter-paths.sh - Test script to verify path resolution in refactored structure

echo "Testing path resolution in refactored CLI Pipeline structure"
echo "============================================================"

# Define paths
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check document pipeline paths
DOC_PIPELINE="${SCRIPT_DIR}/cli-pipeline/document/document-pipeline-main.sh"
DOC_MANAGER="${SCRIPT_DIR}/cli-pipeline/document/document-pipeline-manager.sh"

# Check script pipeline paths
SCRIPT_PIPELINE="${SCRIPT_DIR}/cli-pipeline/scripts/script-pipeline-main.sh"
SCRIPT_MANAGER="${SCRIPT_DIR}/cli-pipeline/scripts/script-manager.sh"

# Display paths
echo "Root directory: ${ROOT_DIR}"
echo "Script directory: ${SCRIPT_DIR}"
echo ""
echo "Document Pipeline: ${DOC_PIPELINE}"
echo "Document Manager: ${DOC_MANAGER}"
echo ""
echo "Script Pipeline: ${SCRIPT_PIPELINE}"
echo "Script Manager: ${SCRIPT_MANAGER}"
echo ""

# Check if files exist
echo "Checking if files exist:"
echo "------------------------"
if [ -f "${DOC_PIPELINE}" ]; then
  echo "✅ Document Pipeline exists"
else
  echo "❌ Document Pipeline not found"
fi

if [ -f "${DOC_MANAGER}" ]; then
  echo "✅ Document Manager exists"
else
  echo "❌ Document Manager not found"
fi

if [ -f "${SCRIPT_PIPELINE}" ]; then
  echo "✅ Script Pipeline exists"
else
  echo "❌ Script Pipeline not found"
fi

if [ -f "${SCRIPT_MANAGER}" ]; then
  echo "✅ Script Manager exists"
else
  echo "❌ Script Manager not found"
fi

echo ""
echo "Testing document-pipeline-main.sh"
echo "---------------------------------"
# Check if we can run document-pipeline-main.sh help
if [ -f "${DOC_PIPELINE}" ]; then
  chmod +x "${DOC_PIPELINE}"
  "${DOC_PIPELINE}" help | head -n 5
else
  echo "Cannot test document pipeline - file not found"
fi

echo ""
echo "Testing script-pipeline-main.sh"
echo "-------------------------------"
# Check if we can run script-pipeline-main.sh help
if [ -f "${SCRIPT_PIPELINE}" ]; then
  chmod +x "${SCRIPT_PIPELINE}"
  "${SCRIPT_PIPELINE}" help | head -n 5
else
  echo "Cannot test script pipeline - file not found"
fi

echo ""
echo "Test completed"