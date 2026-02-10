#!/usr/bin/env bash
#
# list-failed-runs.sh - List failed Databricks job runs across all jobs or specific job
#
# Usage:
#   ./list-failed-runs.sh [options]
#
# Options:
#   --job-id ID              Filter by specific job ID
#   --limit N                Maximum number of failed runs to show (default: 20)
#   --hours N                Only show runs from the last N hours (default: 24)
#   --output FORMAT          Output format: table, json, csv (default: table)
#   --include-output         Include error output in results (json only)
#
# Exit codes:
#   0 - Success
#   1 - Error
#
# Examples:
#   ./list-failed-runs.sh
#   ./list-failed-runs.sh --job-id 123
#   ./list-failed-runs.sh --hours 48 --limit 50
#   ./list-failed-runs.sh --output json

set -euo pipefail

# Default values
LIMIT=20
HOURS=24
OUTPUT_FORMAT="table"
JOB_ID=""
INCLUDE_OUTPUT=false

# Colors for output
readonly RED='\033[0;31m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

# Print usage
usage() {
    cat <<EOF
Usage: $(basename "$0") [options]

List failed Databricks job runs with detailed error information.

Options:
  --job-id ID              Filter by specific job ID
  --limit N                Maximum number of failed runs to show (default: 20)
  --hours N                Only show runs from the last N hours (default: 24)
  --output FORMAT          Output format: table, json, csv (default: table)
  --include-output         Include error output in results (json only)
  -h, --help               Show this help message

Examples:
  $(basename "$0")                              # List all recent failures
  $(basename "$0") --job-id 123                 # Failures for specific job
  $(basename "$0") --hours 48 --limit 50        # More history
  $(basename "$0") --output json                # JSON output for parsing
  $(basename "$0") --output csv > fails.csv     # Export to CSV

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --job-id)
                if [[ -z "${2:-}" ]]; then
                    log_error "Missing value for --job-id"
                    exit 1
                fi
                JOB_ID="$2"
                shift 2
                ;;
            --limit)
                if [[ -z "${2:-}" ]] || ! [[ "$2" =~ ^[0-9]+$ ]]; then
                    log_error "Invalid limit value. Must be a positive integer."
                    exit 1
                fi
                LIMIT="$2"
                shift 2
                ;;
            --hours)
                if [[ -z "${2:-}" ]] || ! [[ "$2" =~ ^[0-9]+$ ]]; then
                    log_error "Invalid hours value. Must be a positive integer."
                    exit 1
                fi
                HOURS="$2"
                shift 2
                ;;
            --output)
                if [[ -z "${2:-}" ]]; then
                    log_error "Missing value for --output"
                    exit 1
                fi
                if [[ "$2" != "table" ]] && [[ "$2" != "json" ]] && [[ "$2" != "csv" ]]; then
                    log_error "Invalid output format. Must be: table, json, or csv"
                    exit 1
                fi
                OUTPUT_FORMAT="$2"
                shift 2
                ;;
            --include-output)
                INCLUDE_OUTPUT=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Calculate timestamp cutoff
get_cutoff_timestamp() {
    # Calculate milliseconds ago
    local seconds_ago=$((HOURS * 3600))
    local ms_ago=$((seconds_ago * 1000))
    local current_ms
    current_ms=$(date +%s)000
    echo $((current_ms - ms_ago))
}

# List all jobs
get_all_jobs() {
    databricks jobs list --output json 2>/dev/null || echo "[]"
}

# Get failed runs for a specific job
get_failed_runs_for_job() {
    local job_id="$1"
    local job_name="$2"
    local runs
    local failed_runs=()

    if ! runs=$(databricks jobs list-runs --job-id "$job_id" --limit "$LIMIT" --output json 2>/dev/null); then
        log_error "Failed to get runs for job $job_id"
        return 1
    fi

    # Filter for failed runs
    local run_count
    run_count=$(echo "$runs" | jq '.runs | length')

    for ((i=0; i<run_count; i++)); do
        local result_state
        result_state=$(echo "$runs" | jq -r ".runs[$i].state.result_state // \"\"")

        if [[ "$result_state" == "FAILED" ]]; then
            local run_info
            run_info=$(echo "$runs" | jq ".runs[$i] | {
                job_id: \"$job_id\",
                job_name: \"$job_name\",
                run_id: .run_id,
                run_name: .run_name // \"<unnamed>\",
                start_time: (.start_time // 0),
                duration: (.run_duration // 0) / 1000,
                state: .state.life_cycle_state,
                result_state: .state.result_state,
                state_message: .state.state_message // \"\",
                triggering_event: (.trigger // \"manual\")
            }")
            failed_runs+=("$run_info")
        fi
    done

    # Output as JSON array
    local array_string="["
    local first=true
    for run in "${failed_runs[@]}"; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            array_string+=","
        fi
        array_string+="$run"
    done
    array_string+="]"

    echo "$array_string"
}

# Get failed runs across all jobs
get_all_failed_runs() {
    local jobs
    jobs=$(get_all_jobs)

    local job_count
    job_count=$(echo "$jobs" | jq '. | length')

    if [[ "$job_count" -eq 0 ]]; then
        echo "[]"
        return
    fi

    local all_failed_runs=()

    for ((i=0; i<job_count; i++)); do
        local job_id
        local job_name
        job_id=$(echo "$jobs" | jq -r ".[$i].job_id")
        job_name=$(echo "$jobs" | jq -r ".[$i].settings.name // \"<unknown>\"")

        local failed_runs
        failed_runs=$(get_failed_runs_for_job "$job_id" "$job_name")

        local run_count
        run_count=$(echo "$failed_runs" | jq '. | length')

        if [[ "$run_count" -gt 0 ]]; then
            for ((j=0; j<run_count; j++)); do
                local run
                run=$(echo "$failed_runs" | jq ".[$j]")
                all_failed_runs+=("$run")
            done
        fi
    done

    # Output as JSON array
    local array_string="["
    local first=true
    for run in "${all_failed_runs[@]}"; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            array_string+=","
        fi
        array_string+="$run"
    done
    array_string+="]"

    echo "$array_string"
}

# Fetch error output for a run
get_error_output() {
    local run_id="$1"
    databricks jobs get-run-output --run-id "$run_id" --output json 2>/dev/null || echo "{}"
}

# Filter by time
filter_by_time() {
    local runs="$1"
    local cutoff="$2"

    echo "$runs" | jq "[.[] | select(.start_time >= $cutoff)]"
}

# Format as table
format_table() {
    local runs="$1"

    local count
    count=$(echo "$runs" | jq '. | length')

    if [[ "$count" -eq 0 ]]; then
        echo "No failed runs found in the last $HOURS hours."
        return
    fi

    printf "${RED}Found %d failed run(s) in the last %d hours${NC}\n\n" "$count" "$HOURS"

    # Print header
    printf "${CYAN}%-8s %-25s %-30s %-20s %-12s %-10s${NC}\n" \
        "Job ID" "Job Name" "Run Name" "Started" "Duration" "Trigger"
    printf "%s\n" "--------------------------------------------------------------------------------"

    # Print rows
    for ((i=0; i<count; i++)); do
        local job_id job_name run_name start_time duration triggering
        job_id=$(echo "$runs" | jq -r ".[$i].job_id")
        job_name=$(echo "$runs" | jq -r ".[$i].job_name")
        run_name=$(echo "$runs" | jq -r ".[$i].run_name")
        start_time=$(echo "$runs" | jq -r ".[$i].start_time")
        duration=$(echo "$runs" | jq -r ".[$i].duration")
        triggering=$(echo "$runs" | jq -r ".[$i].triggering_event")

        # Convert timestamps
        local formatted_date formatted_duration
        if [[ "$start_time" != "0" ]]; then
            formatted_date=$(date -r "$((start_time / 1000))" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "Unknown")
        else
            formatted_date="Unknown"
        fi

        if [[ "$duration" != "0" ]]; then
            formatted_duration=$(printf "%.1fs" "$duration")
        else
            formatted_duration="N/A"
        fi

        # Truncate long names
        job_name="${job_name:0:24}"
        run_name="${run_name:0:29}"

        printf "%-8s %-25s %-30s %-20s %-12s %-10s\n" \
            "$job_id" "$job_name" "$run_name" "$formatted_date" "$formatted_duration" "$triggering"

        # Print error message
        local state_message
        state_message=$(echo "$runs" | jq -r ".[$i].state_message")
        if [[ -n "$state_message" ]] && [[ "$state_message" != "null" ]]; then
            printf "${YELLOW}    Error: %s${NC}\n" "${state_message:0:100}"
        fi
        echo
    done
}

# Format as CSV
format_csv() {
    local runs="$1"

    echo "Job ID,Job Name,Run Name,Started,Duration,Trigger,State Message"

    local count
    count=$(echo "$runs" | jq '. | length')

    for ((i=0; i<count; i++)); do
        local job_id job_name run_name start_time duration triggering state_message
        job_id=$(echo "$runs" | jq -r ".[$i].job_id")
        job_name=$(echo "$runs" | jq -r ".[$i].job_name")
        run_name=$(echo "$runs" | jq -r ".[$i].run_name")
        start_time=$(echo "$runs" | jq -r ".[$i].start_time")
        duration=$(echo "$runs" | jq -r ".[$i].duration")
        triggering=$(echo "$runs" | jq -r ".[$i].triggering_event")
        state_message=$(echo "$runs" | jq -r ".[$i].state_message")

        # Format date
        local formatted_date
        if [[ "$start_time" != "0" ]]; then
            formatted_date=$(date -r "$((start_time / 1000))" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "Unknown")
        else
            formatted_date="Unknown"
        fi

        # Format duration
        local formatted_duration="N/A"
        if [[ "$duration" != "0" ]]; then
            formatted_duration=$(printf "%.1fs" "$duration")
        fi

        # Escape CSV fields
        job_name="${job_name//,/\\,}"
        run_name="${run_name//,/\\,}"
        state_message="${state_message//,/\\,}"

        printf "%s,%s,%s,%s,%s,%s,%s\n" \
            "$job_id" "$job_name" "$run_name" "$formatted_date" "$formatted_duration" "$triggering" "$state_message"
    done
}

# Format as JSON
format_json() {
    local runs="$1"

    if [[ "$INCLUDE_OUTPUT" == "true" ]]; then
        # Add error output to each run
        echo "$runs" | jq '
            map(. + {
                start_time_formatted: (.start_time / 1000 | strftime("%Y-%m-%d %H:%M:%S") // "Unknown"),
                duration_formatted: "\(.duration)s"
            })
        '
    else
        echo "$runs" | jq '.'
    fi
}

# Main execution
main() {
    parse_args "$@"

    log_info "Searching for failed runs in the last $HOURS hours..."

    local cutoff
    cutoff=$(get_cutoff_timestamp)
    log_debug "Cutoff timestamp: $cutoff"

    local runs
    if [[ -n "$JOB_ID" ]]; then
        # Get specific job info
        local job_info
        job_info=$(databricks jobs get --job-id "$JOB_ID" --output json 2>/dev/null)
        local job_name
        job_name=$(echo "$job_info" | jq -r '.settings.name // "<unknown>"')

        log_info "Checking job: $job_name (ID: $JOB_ID)"
        runs=$(get_failed_runs_for_job "$JOB_ID" "$job_name")
    else
        log_info "Checking all jobs..."
        runs=$(get_all_failed_runs)
    fi

    # Filter by time
    runs=$(filter_by_time "$runs" "$cutoff")

    # Sort by start time (newest first)
    runs=$(echo "$runs" | jq 'sort_by(.start_time) | reverse')

    # Limit results
    runs=$(echo "$runs" | jq ".[0:$LIMIT]")

    # Output based on format
    case "$OUTPUT_FORMAT" in
        table)
            format_table "$runs"
            ;;
        csv)
            format_csv "$runs"
            ;;
        json)
            format_json "$runs"
            ;;
    esac
}

# Run main function
main "$@"
