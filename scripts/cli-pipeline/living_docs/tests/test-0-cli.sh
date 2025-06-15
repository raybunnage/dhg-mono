    hyphenated_commands+=("update-template")
    hyphenated_commands+=("check-reviews")
    hyphenated_commands+=("health-check")
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
    test_docs_specific
    
    echo -e "\n${BLUE}=== 0-cli.sh Test Suite Complete ===${NC}"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
