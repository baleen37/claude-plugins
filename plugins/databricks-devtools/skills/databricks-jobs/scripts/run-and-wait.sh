#!/usr/bin/env bash
#
# run-and-wait.sh - Execute a Databricks job and wait for completion
#
# Usage:
#   ./run-and-wait.sh <job-id> [options]
#
# Options:
#   --notebook-params JSON  Parameters to pass to the job
#   --timeout SECONDS       Maximum time to wait (default: 3600)
#   --poll-interval SECONDS Time between status checks (default: 10)
#   --verbose               Enable verbose output
#
# Exit codes:
#   0 - Job completed successfully
#   1 - Job failed
#   2 - Job timed out
#   3 - Invalid arguments
#   4 - Databricks CLI error
#
# Examples:
#   ./run-and-wait.sh 123
#   ./run-and-wait.sh 123 --timeout 7200
#   ./run-and-wait.sh 123 --notebook-params '{"date":"2024-01-15"}'

set -euo pipefail

# Default values
TIMEOUT=3600
POLL_INTERVAL=10
VERBOSE=false
NOTEBOOK_PARAMS=""

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $*"
    fi
}

# Print usage
usage() {
    cat <<EOF
Usage: $(basename "$0") <job-id> [options]

Execute a Databricks job and wait for completion.

Arguments:
  job-id                The ID of the job to run

Options:
  --notebook-params JSON  Parameters to pass to the job (JSON string)
  --timeout SECONDS       Maximum time to wait for completion (default: 3600)
  --poll-interval SECONDS Time between status checks (default: 10)
  --verbose               Enable verbose output
  -h, --help              Show this help message

Examples:
  $(basename "$0") 123
  $(basename "$0") 123 --timeout 7200
  $(basename "$0") 123 --notebook-params '{"date":"2024-01-15"}'
  $(basename "$0") 123 --notebook-params '{"env":"prod"}' --verbose

EOF
}

# Parse command line arguments
parse_args() {
    if [[ $# -eq 0 ]]; then
        log_error "Missing job-id argument"
        usage
        exit 3
    fi

    JOB_ID="$1"
    shift

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --notebook-params)
                if [[ -z "${2:-}" ]]; then
                    log_error "Missing value for --notebook-params"
                    exit 3
                fi
                NOTEBOOK_PARAMS="$2"
                shift 2
                ;;
            --timeout)
                if [[ -z "${2:-}" ]] || ! [[ "$2" =~ ^[0-9]+$ ]]; then
                    log_error "Invalid timeout value. Must be a positive integer."
                    exit 3
                fi
                TIMEOUT="$2"
                shift 2
                ;;
            --poll-interval)
                if [[ -z "${2:-}" ]] || ! [[ "$2" =~ ^[0-9]+$ ]]; then
                    log_error "Invalid poll-interval value. Must be a positive integer."
                    exit 3
                fi
                POLL_INTERVAL="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 3
                ;;
        esac
    done

    # Validate job_id is numeric
    if ! [[ "$JOB_ID" =~ ^[0-9]+$ ]]; then
        log_error "Invalid job-id: $JOB_ID (must be numeric)"
        exit 3
    fi

    log_debug "Job ID: $JOB_ID"
    log_debug "Timeout: $TIMEOUT seconds"
    log_debug "Poll interval: $POLL_INTERVAL seconds"
}

# Start the job and get run_id
start_job() {
    log_info "Starting job $JOB_ID..."

    local cmd=(databricks jobs run-now --job-id "$JOB_ID")

    if [[ -n "$NOTEBOOK_PARAMS" ]]; then
        log_debug "Using notebook params: $NOTEBOOK_PARAMS"
        cmd+=(--notebook-params "$NOTEBOOK_PARAMS")
    fi

    if [[ "$VERBOSE" == "true" ]]; then
        cmd+=(--debug)
    fi

    # Execute command and capture output
    local output
    if ! output=$("${cmd[@]}" 2>&1); then
        log_error "Failed to start job"
        log_error "$output"
        exit 4
    fi

    # Extract run_id from output
    RUN_ID=$(echo "$output" | jq -r '.run_id // empty')

    if [[ -z "$RUN_ID" ]] || [[ "$RUN_ID" == "null" ]]; then
        log_error "Failed to extract run_id from response"
        log_error "Response: $output"
        exit 4
    fi

    log_success "Job started with run_id: $RUN_ID"
}

# Poll job status
poll_status() {
    local elapsed=0

    log_info "Waiting for job to complete..."
    log_info "Timeout set to $TIMEOUT seconds ($((TIMEOUT / 60)) minutes)"

    while [[ $elapsed -lt $TIMEOUT ]]; do
        # Get run status
        local status_output
        if ! status_output=$(databricks jobs get-run --run-id "$RUN_ID" 2>&1); then
            log_error "Failed to get run status"
            log_error "$status_output"
            exit 4
        fi

        local state
        state=$(echo "$status_output" | jq -r '.state.life_cycle_state // "UNKNOWN"')
        local result_state
        result_state=$(echo "$status_output" | jq -r '.state.result_state // "null"')
        local state_message
        state_message=$(echo "$status_output" | jq -r '.state.state_message // ""')

        log_debug "State: $state, Result: $result_state"

        case "$state" in
            TERMINATED)
                # Check result state
                if [[ "$result_state" == "SUCCESS" ]]; then
                    log_success "Job completed successfully"
                    return 0
                else
                    log_error "Job failed with result state: $result_state"
                    if [[ -n "$state_message" ]]; then
                        log_error "Message: $state_message"
                    fi
                    return 1
                fi
                ;;
            RUNNING|PENDING|BLOCKED)
                local progress=$((elapsed * 100 / TIMEOUT))
                log_info "Job $state... (${progress}% of timeout)"
                ;;
            INTERNAL_ERROR)
                log_error "Job encountered an internal error"
                if [[ -n "$state_message" ]]; then
                    log_error "Message: $state_message"
                fi
                return 1
                ;;
            SKIPPED)
                log_warning "Job was skipped"
                return 0
                ;;
            TERMINATING)
                log_info "Job is terminating..."
                ;;
            *)
                log_warning "Unknown state: $state"
                ;;
        esac

        # Wait before next poll
        sleep "$POLL_INTERVAL"
        elapsed=$((elapsed + POLL_INTERVAL))
    done

    log_error "Job timed out after $TIMEOUT seconds"
    return 2
}

# Display run output on failure
display_output() {
    log_info "Fetching run output..."

    local output
    if ! output=$(databricks jobs get-run-output --run-id "$RUN_ID" 2>&1); then
        log_warning "Could not fetch run output"
        return
    fi

    local error_summary
    error_summary=$(echo "$output" | jq -r '.error_summary // empty')

    if [[ -n "$error_summary" ]] && [[ "$error_summary" != "null" ]]; then
        log_error "Error summary:"
        echo "$error_summary"
    fi

    if [[ "$VERBOSE" == "true" ]]; then
        echo "$output" | jq .
    fi
}

# Main execution
main() {
    parse_args "$@"
    start_job
    poll_status
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        display_output
    fi

    exit $exit_code
}

# Run main function
main "$@"
