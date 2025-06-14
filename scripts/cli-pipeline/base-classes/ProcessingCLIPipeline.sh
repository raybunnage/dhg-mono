#!/usr/bin/env bash

# ProcessingCLIPipeline.sh - For data processing workflows and pipelines
# Extends CLIPipelineBase with processing utilities, progress tracking, and batch operations

# Source the base class
source "$(dirname "${BASH_SOURCE[0]}")/CLIPipelineBase.sh"

# Processing pipeline specific variables
PROCESSING_QUEUE=()
BATCH_SIZE=10
MAX_PARALLEL_JOBS=3
PROGRESS_FILE=""
RESUME_SUPPORT=true
ERROR_RECOVERY=true

# Initialize processing pipeline with workflow management
init_processing_pipeline() {
    local pipeline_name="$1"
    local pipeline_description="$2"
    shift 2
    
    # Initialize base class
    init_cli_pipeline "$pipeline_name" "$pipeline_description" "$@"
    
    # Setup processing infrastructure
    setup_processing_infrastructure
    
    # Initialize progress tracking
    init_progress_tracking
}

# Setup processing infrastructure
setup_processing_infrastructure() {
    # Create temporary directories for processing
    PROCESSING_TEMP_DIR="/tmp/cli-processing-$PIPELINE_NAME-$$"
    mkdir -p "$PROCESSING_TEMP_DIR"
    
    PROGRESS_FILE="$PROCESSING_TEMP_DIR/progress.log"
    QUEUE_FILE="$PROCESSING_TEMP_DIR/queue.txt"
    RESULTS_FILE="$PROCESSING_TEMP_DIR/results.txt"
    ERRORS_FILE="$PROCESSING_TEMP_DIR/errors.txt"
    
    log_debug "Processing infrastructure setup at: $PROCESSING_TEMP_DIR"
    
    # Setup cleanup on exit
    trap cleanup_processing_infrastructure EXIT
}

# Initialize progress tracking
init_progress_tracking() {
    if [[ "$RESUME_SUPPORT" == "true" ]]; then
        # Create progress tracking file
        echo "timestamp|item|status|notes" > "$PROGRESS_FILE"
        log_debug "Progress tracking initialized: $PROGRESS_FILE"
    fi
}

# Add items to processing queue
add_to_queue() {
    local items=("$@")
    
    for item in "${items[@]}"; do
        PROCESSING_QUEUE+=("$item")
        echo "$item" >> "$QUEUE_FILE"
    done
    
    log_info "Added ${#items[@]} items to processing queue"
    log_debug "Total queue size: ${#PROCESSING_QUEUE[@]}"
}

# Process queue with progress tracking
process_queue() {
    local processor_function="$1"
    local description="$2"
    
    if [[ -z "$processor_function" ]]; then
        log_error "Processor function required"
        return 1
    fi
    
    local total_items=${#PROCESSING_QUEUE[@]}
    local processed=0
    local failed=0
    local start_time=$(date +%s)
    
    log_info "Starting queue processing: $total_items items"
    log_info "Processor: $processor_function"
    log_info "Batch size: $BATCH_SIZE"
    
    # Process items in batches
    for ((i=0; i<total_items; i+=BATCH_SIZE)); do
        local batch_end=$((i + BATCH_SIZE - 1))
        if [[ $batch_end -ge $total_items ]]; then
            batch_end=$((total_items - 1))
        fi
        
        local batch_items=("${PROCESSING_QUEUE[@]:$i:$BATCH_SIZE}")
        local batch_number=$(((i / BATCH_SIZE) + 1))
        local total_batches=$(((total_items + BATCH_SIZE - 1) / BATCH_SIZE))
        
        log_info "Processing batch $batch_number/$total_batches (${#batch_items[@]} items)"
        
        # Process batch
        if process_batch "$processor_function" "$description" "${batch_items[@]}"; then
            processed=$((processed + ${#batch_items[@]}))
            log_success "Batch $batch_number completed successfully"
        else
            failed=$((failed + ${#batch_items[@]}))
            log_error "Batch $batch_number failed"
            
            if [[ "$ERROR_RECOVERY" == "true" ]]; then
                log_info "Attempting individual item recovery for failed batch"
                recover_failed_batch "$processor_function" "$description" "${batch_items[@]}"
            fi
        fi
        
        # Show progress
        show_progress $processed $total_items $start_time
    done
    
    # Final summary
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_info "Queue processing completed:"
    log_info "  Total items: $total_items"
    log_info "  Successfully processed: $processed"
    log_info "  Failed: $failed"
    log_info "  Duration: ${duration}s"
    log_info "  Rate: $(echo "scale=2; $total_items / $duration" | bc 2>/dev/null || echo "N/A") items/second"
    
    # Return appropriate exit code
    if [[ $failed -eq 0 ]]; then
        return 0
    elif [[ $processed -gt 0 ]]; then
        log_warn "Partial success: $processed/$total_items completed"
        return 2
    else
        log_error "Complete failure: no items processed successfully"
        return 1
    fi
}

# Process a batch of items
process_batch() {
    local processor_function="$1"
    local description="$2"
    shift 2
    local batch_items=("$@")
    
    log_debug "Processing batch with ${#batch_items[@]} items"
    
    # Process items in parallel if supported
    if [[ $MAX_PARALLEL_JOBS -gt 1 ]]; then
        process_batch_parallel "$processor_function" "$description" "${batch_items[@]}"
    else
        process_batch_sequential "$processor_function" "$description" "${batch_items[@]}"
    fi
}

# Process batch sequentially
process_batch_sequential() {
    local processor_function="$1"
    local description="$2"
    shift 2
    local batch_items=("$@")
    
    for item in "${batch_items[@]}"; do
        if process_single_item "$processor_function" "$description" "$item"; then
            record_progress "$item" "completed" "Successfully processed"
        else
            record_progress "$item" "failed" "Processing failed"
            return 1
        fi
    done
    
    return 0
}

# Process batch in parallel
process_batch_parallel() {
    local processor_function="$1"
    local description="$2" 
    shift 2
    local batch_items=("$@")
    
    local pids=()
    local job_count=0
    
    for item in "${batch_items[@]}"; do
        # Wait if we've reached max parallel jobs
        if [[ $job_count -ge $MAX_PARALLEL_JOBS ]]; then
            wait_for_job pids
            job_count=$((job_count - 1))
        fi
        
        # Start background job
        (
            if process_single_item "$processor_function" "$description" "$item"; then
                record_progress "$item" "completed" "Successfully processed"
                exit 0
            else
                record_progress "$item" "failed" "Processing failed"
                exit 1
            fi
        ) &
        
        pids+=($!)
        job_count=$((job_count + 1))
    done
    
    # Wait for all remaining jobs
    local failed_jobs=0
    for pid in "${pids[@]}"; do
        if ! wait $pid; then
            failed_jobs=$((failed_jobs + 1))
        fi
    done
    
    return $failed_jobs
}

# Wait for one job to complete
wait_for_job() {
    local -n pids_ref=$1
    
    # Wait for any job to complete
    wait -n
    
    # Remove completed jobs from array
    local new_pids=()
    for pid in "${pids_ref[@]}"; do
        if kill -0 $pid 2>/dev/null; then
            new_pids+=($pid)
        fi
    done
    pids_ref=("${new_pids[@]}")
}

# Process a single item
process_single_item() {
    local processor_function="$1"
    local description="$2"
    local item="$3"
    
    log_debug "Processing item: $item"
    
    # Execute the processor function with tracking
    track_and_execute "${processor_function}_${item//[^a-zA-Z0-9]/_}" "$description: $item" \
        "$processor_function" "$item"
}

# Recover failed batch by processing items individually
recover_failed_batch() {
    local processor_function="$1"
    local description="$2"
    shift 2
    local batch_items=("$@")
    
    log_info "Attempting individual recovery for ${#batch_items[@]} items"
    
    local recovered=0
    for item in "${batch_items[@]}"; do
        log_debug "Attempting recovery for: $item"
        
        if process_single_item "$processor_function" "$description" "$item"; then
            record_progress "$item" "recovered" "Recovered after batch failure"
            recovered=$((recovered + 1))
        else
            record_progress "$item" "failed_recovery" "Recovery attempt failed"
        fi
    done
    
    log_info "Recovery completed: $recovered/${#batch_items[@]} items recovered"
}

# Record progress for an item
record_progress() {
    local item="$1"
    local status="$2"
    local notes="$3"
    
    if [[ "$RESUME_SUPPORT" == "true" && -n "$PROGRESS_FILE" ]]; then
        local timestamp=$(date -Iseconds)
        echo "$timestamp|$item|$status|$notes" >> "$PROGRESS_FILE"
    fi
}

# Show progress update
show_progress() {
    local processed="$1"
    local total="$2"
    local start_time="$3"
    
    local percentage=$((processed * 100 / total))
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))
    
    if [[ $elapsed -gt 0 ]]; then
        local rate=$(echo "scale=2; $processed / $elapsed" | bc 2>/dev/null || echo "0")
        local eta_seconds=$(echo "scale=0; ($total - $processed) / $rate" | bc 2>/dev/null || echo "0")
        local eta_minutes=$((eta_seconds / 60))
        
        log_info "Progress: $processed/$total ($percentage%) - Rate: $rate items/s - ETA: ${eta_minutes}m"
    else
        log_info "Progress: $processed/$total ($percentage%)"
    fi
}

# Resume processing from checkpoint
resume_processing() {
    local processor_function="$1"
    local description="$2"
    
    if [[ ! -f "$PROGRESS_FILE" ]]; then
        log_error "No progress file found for resume: $PROGRESS_FILE"
        return 1
    fi
    
    log_info "Resuming processing from checkpoint"
    
    # Find completed items
    local completed_items=()
    while IFS='|' read -r timestamp item status notes; do
        if [[ "$status" == "completed" || "$status" == "recovered" ]]; then
            completed_items+=("$item")
        fi
    done < "$PROGRESS_FILE"
    
    # Remove completed items from queue
    local remaining_queue=()
    for item in "${PROCESSING_QUEUE[@]}"; do
        local found=false
        for completed in "${completed_items[@]}"; do
            if [[ "$item" == "$completed" ]]; then
                found=true
                break
            fi
        done
        if [[ "$found" == "false" ]]; then
            remaining_queue+=("$item")
        fi
    done
    
    PROCESSING_QUEUE=("${remaining_queue[@]}")
    
    log_info "Resume state: ${#completed_items[@]} completed, ${#PROCESSING_QUEUE[@]} remaining"
    
    if [[ ${#PROCESSING_QUEUE[@]} -eq 0 ]]; then
        log_success "All items already processed - nothing to resume"
        return 0
    fi
    
    # Continue processing
    process_queue "$processor_function" "$description"
}

# Validate input data
validate_input() {
    local input_file="$1"
    local validation_function="$2"
    
    if [[ ! -f "$input_file" ]]; then
        log_error "Input file not found: $input_file"
        return 1
    fi
    
    local line_count=0
    local valid_count=0
    local invalid_count=0
    
    while IFS= read -r line; do
        line_count=$((line_count + 1))
        
        if [[ -n "$validation_function" ]] && ! "$validation_function" "$line"; then
            invalid_count=$((invalid_count + 1))
            log_debug "Invalid line $line_count: $line"
        else
            valid_count=$((valid_count + 1))
        fi
    done < "$input_file"
    
    log_info "Input validation: $valid_count valid, $invalid_count invalid (total: $line_count)"
    
    if [[ $invalid_count -gt 0 ]]; then
        log_warn "Input contains $invalid_count invalid entries"
        return 2
    fi
    
    return 0
}

# Generate processing report
generate_processing_report() {
    local output_file="$1"
    
    if [[ -z "$output_file" ]]; then
        output_file="/tmp/processing-report-$PIPELINE_NAME-$(date +%s).md"
    fi
    
    cat > "$output_file" << EOF
# Processing Report: $PIPELINE_NAME

## Summary
- **Pipeline**: $PIPELINE_NAME
- **Generated**: $(date)
- **Processing Directory**: $PROCESSING_TEMP_DIR

## Configuration
- **Batch Size**: $BATCH_SIZE
- **Max Parallel Jobs**: $MAX_PARALLEL_JOBS
- **Resume Support**: $RESUME_SUPPORT
- **Error Recovery**: $ERROR_RECOVERY

## Results
EOF
    
    if [[ -f "$PROGRESS_FILE" ]]; then
        echo "### Processing Statistics" >> "$output_file"
        
        local total_items=$(wc -l < "$PROGRESS_FILE" 2>/dev/null || echo "0")
        local completed=$(grep -c "|completed|" "$PROGRESS_FILE" 2>/dev/null || echo "0")
        local failed=$(grep -c "|failed|" "$PROGRESS_FILE" 2>/dev/null || echo "0")
        local recovered=$(grep -c "|recovered|" "$PROGRESS_FILE" 2>/dev/null || echo "0")
        
        echo "- **Total Items**: $total_items" >> "$output_file"
        echo "- **Completed**: $completed" >> "$output_file"
        echo "- **Failed**: $failed" >> "$output_file"
        echo "- **Recovered**: $recovered" >> "$output_file"
        echo "- **Success Rate**: $(echo "scale=1; ($completed + $recovered) * 100 / $total_items" | bc 2>/dev/null || echo "N/A")%" >> "$output_file"
    fi
    
    echo "" >> "$output_file"
    echo "## Files Generated" >> "$output_file"
    echo "- **Progress Log**: $PROGRESS_FILE" >> "$output_file"
    echo "- **Queue File**: $QUEUE_FILE" >> "$output_file"
    echo "- **Results File**: $RESULTS_FILE" >> "$output_file"
    echo "- **Errors File**: $ERRORS_FILE" >> "$output_file"
    
    log_success "Processing report generated: $output_file"
    echo "$output_file"
}

# Cleanup processing infrastructure
cleanup_processing_infrastructure() {
    if [[ -n "$PROCESSING_TEMP_DIR" && -d "$PROCESSING_TEMP_DIR" ]]; then
        log_debug "Cleaning up processing infrastructure: $PROCESSING_TEMP_DIR"
        
        # Preserve important files
        if [[ -f "$PROGRESS_FILE" ]]; then
            cp "$PROGRESS_FILE" "/tmp/last-progress-$PIPELINE_NAME.log" 2>/dev/null || true
        fi
        
        # Clean up temporary directory
        rm -rf "$PROCESSING_TEMP_DIR" 2>/dev/null || true
    fi
}

# Processing-specific help message
show_processing_help() {
    echo -e "${BLUE}$PIPELINE_DESCRIPTION${NC}"
    echo -e "${CYAN}(Processing CLI Pipeline)${NC}"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Processing Commands:"
    echo "  process <input>            Process input data or files"
    echo "  resume                     Resume processing from checkpoint"
    echo "  validate <input>           Validate input before processing"
    echo "  status                     Show processing status"
    echo "  report [output-file]       Generate processing report"
    echo ""
    
    # Show pipeline-specific commands
    local commands
    commands=$(discover_commands)
    if [[ -n "$commands" ]]; then
        echo "Pipeline-Specific Commands:"
        while IFS= read -r cmd; do
            if [[ ! "$cmd" =~ ^(process|resume|validate|status|report)$ ]]; then
                echo "  $(printf "%-20s" "$cmd") Pipeline-specific processing command"
            fi
        done <<< "$commands"
        echo ""
    fi
    
    echo "Processing Options:"
    echo "  --batch-size N             Set batch size (default: $BATCH_SIZE)"
    echo "  --parallel N               Set max parallel jobs (default: $MAX_PARALLEL_JOBS)"
    echo "  --no-resume                Disable resume support"
    echo "  --no-recovery              Disable error recovery"
    echo ""
    echo "Global Options:"
    echo "  --debug                    Enable debug mode"
    echo "  --verbose                  Enable verbose output" 
    echo "  --help, -h                 Show this help message"
    echo ""
    echo "Framework Info:"
    echo "  Type: Processing CLI Pipeline"
    echo "  Pipeline: $PIPELINE_NAME v$PIPELINE_VERSION"
    echo "  Base Class: CLIPipelineBase v$CLI_BASE_VERSION"
}

# Override base show_help
show_help() {
    show_processing_help
}

# Export processing pipeline functions
export -f init_processing_pipeline
export -f add_to_queue process_queue
export -f process_single_item
export -f resume_processing
export -f validate_input
export -f generate_processing_report
export -f record_progress show_progress