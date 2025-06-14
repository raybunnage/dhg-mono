#!/usr/bin/env bash

# Beta Group Helper Functions

# Function to check Google API dependencies
check_google_deps() {
    local pipeline=$1
    echo "Checking Google API dependencies for $pipeline..."
    grep -E "(google|drive|oauth|gapi)" "scripts/cli-pipeline/**/$pipeline" 2>/dev/null || echo "No Google dependencies found"
}

# Function to check AI service usage
check_ai_usage() {
    local pipeline=$1
    echo "Checking AI service usage for $pipeline..."
    grep -E "(claude|openai|gpt|anthropic)" "scripts/cli-pipeline/**/$pipeline" 2>/dev/null || echo "No AI services found"
}

# Function to estimate complexity
estimate_complexity() {
    local pipeline=$1
    local lines=$(wc -l < "scripts/cli-pipeline/**/$pipeline" 2>/dev/null || echo "0")
    
    if [ $lines -lt 100 ]; then
        echo "LOW - Good starting point!"
    elif [ $lines -lt 300 ]; then
        echo "MEDIUM - Moderate complexity"
    else
        echo "HIGH - Complex pipeline, save for later"
    fi
}

# Export functions
export -f check_google_deps
export -f check_ai_usage
export -f estimate_complexity
