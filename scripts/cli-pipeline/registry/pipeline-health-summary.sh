#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "📊 CLI PIPELINE HEALTH CHECK SUMMARY"
echo "===================================="
echo ""

# Count pipelines with health checks
echo "🔍 Checking pipeline health check implementations..."
echo ""

has_health_check=0
no_health_check=0
total=0

echo "PIPELINES WITH HEALTH CHECKS:"
echo "------------------------------"
for dir in $ROOT_DIR/scripts/cli-pipeline/*/; do
  pipeline_name=$(basename "$dir")
  cli_file="$dir/${pipeline_name}-cli.sh"
  
  if [ -f "$cli_file" ]; then
    ((total++))
    if grep -q "health-check)" "$cli_file" 2>/dev/null || grep -q "health_check)" "$cli_file" 2>/dev/null; then
      echo "✅ $pipeline_name"
      ((has_health_check++))
    fi
  fi
done

echo ""
echo "PIPELINES WITHOUT HEALTH CHECKS:"
echo "--------------------------------"
for dir in $ROOT_DIR/scripts/cli-pipeline/*/; do
  pipeline_name=$(basename "$dir")
  cli_file="$dir/${pipeline_name}-cli.sh"
  
  if [ -f "$cli_file" ]; then
    if ! grep -q "health-check)" "$cli_file" 2>/dev/null && ! grep -q "health_check)" "$cli_file" 2>/dev/null; then
      echo "❌ $pipeline_name"
      ((no_health_check++))
    fi
  fi
done

echo ""
echo "📈 SUMMARY:"
echo "-----------"
echo "Total pipelines: $total"
echo "With health checks: $has_health_check"
echo "Without health checks: $no_health_check"
echo "Coverage: $(( (has_health_check * 100) / total ))%"
echo ""

# Check master health check
echo "🎯 MASTER HEALTH CHECK STATUS:"
echo "------------------------------"
if [ -f "$ROOT_DIR/scripts/cli-pipeline/all_pipelines/run-all-health-checks.sh" ]; then
  echo "✅ Master health check script exists"
  
  # Count pipelines in master health check
  master_count=$(grep -c "run_health_check " "$ROOT_DIR/scripts/cli-pipeline/all_pipelines/run-all-health-checks.sh")
  echo "📊 Pipelines in master health check: $master_count"
else
  echo "❌ Master health check script not found"
fi

echo ""
echo "💡 RECOMMENDATIONS:"
echo "------------------"
if [ $no_health_check -gt 0 ]; then
  echo "1. Add health-check commands to the $no_health_check pipelines missing them"
  echo "2. Update registry_cli_pipelines.has_health_check for new implementations"
  echo "3. Add new pipelines to the master health check script"
  echo "4. Test with: ./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh master-health-check"
else
  echo "✅ All pipelines have health check implementations!"
  echo "   Test with: ./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh master-health-check"
fi