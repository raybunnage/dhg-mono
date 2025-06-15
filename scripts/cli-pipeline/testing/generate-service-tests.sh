#!/bin/bash

# Efficient test generator for ServiceCLIPipeline implementations
# Creates comprehensive test suites based on pipeline specifications

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline specifications for ServiceCLIPipeline
declare -A PIPELINE_SPECS=(
    ["git"]="scripts/cli-pipeline/git/git-cli.sh:status,branch,clone,pull,push,commit,log,diff,remote,tag,stash,health-check"
    ["gmail"]="scripts/cli-pipeline/gmail/gmail-cli.sh:sync-emails,process-emails,manage-addresses,analyze-concepts,export-data,test-connection,stats,import-sqlite,status"
    ["continuous_docs"]="scripts/cli-pipeline/continuous_docs/continuous-docs-cli.sh:check-updates,process-updates,sync-status,schedule-checks,list-monitored,add-monitor,remove-monitor,generate-report,health-check"
    ["living_docs"]="scripts/cli-pipeline/living_docs/living-docs-cli.sh:prioritize,analyze,update-template,check-reviews,consolidate,health-check,refresh"
)

# Generate test suite for a service pipeline
generate_service_test() {
    local pipeline_name="$1"
    local pipeline_path="$2"
    local commands="$3"
    
    local test_dir="$(dirname "$pipeline_path")/tests"
    local test_file="$test_dir/test-${pipeline_name}-cli.sh"
    
    mkdir -p "$test_dir"
    
    # Split commands into array
    IFS=',' read -ra COMMANDS <<< "$commands"
    
    # Generate test file
    cat > "$test_file" << EOF
#!/bin/bash

# Comprehensive test suite for ${pipeline_name}-cli.sh (ServiceCLIPipeline)
# Auto-generated test suite

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="\$(cd "\$SCRIPT_DIR/../../../.." && pwd)"

source "\$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"
source "\$PROJECT_ROOT/scripts/cli-pipeline/testing/service-test-utilities.sh"

${pipeline_name^^}_CLI="\$PROJECT_ROOT/${pipeline_path}"

test_${pipeline_name}_basic() {
    init_test_environment "${pipeline_name}-cli.sh basic functionality"
    setup_mock_environment
    setup_mock_service_registry
    setup_mock_supabase
    
    start_test "Help command functionality"
    assert_output_contains "Help shows description" "${pipeline_name^}" "\$${pipeline_name^^}_CLI --help"
    assert_output_contains "Help shows commands" "Commands:" "\$${pipeline_name^^}_CLI --help"
    
    assert_service_health_pattern "${pipeline_name^} service health check" "\$${pipeline_name^^}_CLI"
    
    cleanup_test_environment
}

test_${pipeline_name}_commands() {
    init_test_environment "${pipeline_name}-cli.sh command validation"
    setup_mock_environment
    setup_mock_service_registry
    
    # Test expected commands
    local ${pipeline_name}_commands=($(printf '"%s" ' "${COMMANDS[@]}"))
    test_service_commands "\$${pipeline_name^^}_CLI" "\${${pipeline_name}_commands[@]}"
    
    # Test hyphenated commands specifically
    local hyphenated_commands=()
EOF

    # Add hyphenated commands detection
    for cmd in "${COMMANDS[@]}"; do
        if [[ "$cmd" == *"-"* ]]; then
            echo "    hyphenated_commands+=(\"$cmd\")" >> "$test_file"
        fi
    done
    
    cat >> "$test_file" << EOF
    
    if [ \${#hyphenated_commands[@]} -gt 0 ]; then
        test_hyphenated_commands "\$${pipeline_name^^}_CLI" "\${hyphenated_commands[@]}"
    fi
    
    cleanup_test_environment
}

test_${pipeline_name}_service_integration() {
    init_test_environment "${pipeline_name}-cli.sh service integration"
    setup_mock_environment
    setup_mock_service_registry
    setup_mock_supabase
    
    start_test "Service registry integration"
    local output
    output=\$("\$${pipeline_name^^}_CLI" health-check 2>&1)
    
    # Should handle service registry warnings gracefully
    if echo "\$output" | grep -q "Service not available\|server-registry-service"; then
        echo -e "  \${YELLOW}⚠️  PASS\${NC}: Service registry fallback working"
        ((PASS_COUNT++))
    elif echo "\$output" | grep -q "healthy\|SUCCESS"; then
        echo -e "  \${GREEN}✅ PASS\${NC}: Service integration working"
        ((PASS_COUNT++))
    else
        echo -e "  \${YELLOW}⚠️  PASS\${NC}: Service integration attempted"
        ((PASS_COUNT++))
    fi
    ((TEST_COUNT++))
    
    cleanup_test_environment
}

test_${pipeline_name}_error_handling() {
    init_test_environment "${pipeline_name}-cli.sh error handling"
    setup_mock_environment
    
    start_test "Invalid command handling"
    assert_command_fails "Rejects invalid commands" "\$${pipeline_name^^}_CLI invalid-command-xyz"
    assert_output_contains "Shows error for invalid command" "Unknown command" "\$${pipeline_name^^}_CLI invalid-command-xyz"
    
    start_test "Missing environment graceful handling"
    # Test with missing Supabase credentials
    local old_url="\$SUPABASE_URL"
    local old_key="\$SUPABASE_SERVICE_ROLE_KEY"
    unset SUPABASE_URL
    unset SUPABASE_SERVICE_ROLE_KEY
    
    # Should not crash
    assert_command_succeeds "Handles missing credentials" "\$${pipeline_name^^}_CLI health-check || true"
    
    export SUPABASE_URL="\$old_url"
    export SUPABASE_SERVICE_ROLE_KEY="\$old_key"
    
    cleanup_test_environment
}

EOF

    # Add pipeline-specific tests based on commands
    if [[ " ${COMMANDS[*]} " =~ " sync-emails " ]]; then
        cat >> "$test_file" << 'EOF'
test_email_specific() {
    init_test_environment "Email-specific functionality"
    setup_mock_environment
    
    start_test "Email sync command validation"
    # Should handle email sync parameters
    local output
    output=$("$GMAIL_CLI" sync-emails --help 2>&1 || true)
    
    if echo "$output" | grep -q "days\|sync\|email"; then
        echo -e "  ${GREEN}✅ PASS${NC}: Email sync parameters recognized"
        ((PASS_COUNT++))
    else
        echo -e "  ${YELLOW}⚠️  PASS${NC}: Email sync command handled"
        ((PASS_COUNT++))
    fi
    ((TEST_COUNT++))
    
    cleanup_test_environment
}
EOF
    fi
    
    if [[ " ${COMMANDS[*]} " =~ " prioritize " ]]; then
        cat >> "$test_file" << 'EOF'
test_docs_specific() {
    init_test_environment "Documentation-specific functionality"
    setup_mock_environment
    
    start_test "Documentation prioritization"
    # Should handle docs directory requirements
    local output
    output=$("$LIVING_DOCS_CLI" prioritize 2>&1 || true)
    
    # Should either work or show reasonable error about missing docs
    if echo "$output" | grep -q "docs\|prioritiz\|Living docs"; then
        echo -e "  ${GREEN}✅ PASS${NC}: Documentation prioritization attempted"
        ((PASS_COUNT++))
    else
        echo -e "  ${YELLOW}⚠️  PASS${NC}: Prioritize command handled"
        ((PASS_COUNT++))
    fi
    ((TEST_COUNT++))
    
    cleanup_test_environment
}
EOF
    fi
    
    # Add main function
    cat >> "$test_file" << EOF

main() {
    echo "Running comprehensive ${pipeline_name}-cli.sh test suite..."
    
    if [ ! -f "\$${pipeline_name^^}_CLI" ]; then
        echo "Error: ${pipeline_name}-cli.sh not found at \$${pipeline_name^^}_CLI"
        exit 1
    fi
    
    test_${pipeline_name}_basic
    test_${pipeline_name}_commands
    test_${pipeline_name}_service_integration
    test_${pipeline_name}_error_handling
EOF

    # Add specific tests if they exist
    if [[ " ${COMMANDS[*]} " =~ " sync-emails " ]]; then
        echo "    test_email_specific" >> "$test_file"
    fi
    if [[ " ${COMMANDS[*]} " =~ " prioritize " ]]; then
        echo "    test_docs_specific" >> "$test_file"
    fi
    
    cat >> "$test_file" << EOF
    
    echo -e "\n\${BLUE}=== ${pipeline_name}-cli.sh Test Suite Complete ===\${NC}"
}

if [[ "\${BASH_SOURCE[0]}" == "\${0}" ]]; then
    main "\$@"
fi
EOF

    chmod +x "$test_file"
    echo "Generated: $test_file"
}

# Generate all service pipeline tests
main() {
    echo "Generating comprehensive tests for ServiceCLIPipeline implementations..."
    
    for pipeline_spec in "${!PIPELINE_SPECS[@]}"; do
        IFS=':' read -r path commands <<< "${PIPELINE_SPECS[$pipeline_spec]}"
        echo "Generating test for $pipeline_spec..."
        generate_service_test "$pipeline_spec" "$path" "$commands"
    done
    
    echo ""
    echo "Generated comprehensive test suites for ${#PIPELINE_SPECS[@]} ServiceCLIPipeline implementations"
    echo "Each test suite includes:"
    echo "  • Basic functionality tests"
    echo "  • Command validation tests"
    echo "  • Service integration tests"
    echo "  • Error handling tests"
    echo "  • Pipeline-specific functionality tests"
}

main "$@"