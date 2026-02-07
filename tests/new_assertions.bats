#!/usr/bin/env bats
# Test: New assertion helper functions

load helpers/bats_helper

@test "assert_file_not_exists passes when file does not exist" {
    local non_existent="${TEST_TEMP_DIR}/does-not-exist.txt"
    assert_file_not_exists "$non_existent" "File should not exist"
}

@test "assert_file_not_exists fails when file exists" {
    local existing="${TEST_TEMP_DIR}/exists.txt"
    touch "$existing"

    run assert_file_not_exists "$existing"
    [ "$status" -ne 0 ]
}

@test "assert_dir_not_exists passes when directory does not exist" {
    local non_existent="${TEST_TEMP_DIR}/does-not-exist"
    assert_dir_not_exists "$non_existent" "Directory should not exist"
}

@test "assert_contains passes when haystack contains needle" {
    assert_contains "hello world" "world" "Should contain substring"
}

@test "assert_contains fails when haystack does not contain needle" {
    run assert_contains "hello world" "goodbye"
    [ "$status" -ne 0 ]
}

@test "assert_not_contains passes when haystack does not contain needle" {
    assert_not_contains "hello world" "goodbye" "Should not contain substring"
}

@test "assert_gt passes when actual is greater" {
    assert_gt "10" "5" "Should be greater"
}

@test "assert_gt fails when actual is less" {
    run assert_gt "3" "10"
    [ "$status" -ne 0 ]
}

@test "assert_lt passes when actual is less" {
    assert_lt "3" "10" "Should be less"
}

@test "assert_lt fails when actual is greater" {
    run assert_lt "15" "10"
    [ "$status" -ne 0 ]
}

@test "assert_array_contains passes when element exists" {
    local array="apple banana cherry"
    assert_array_contains "banana" "$array" "Should contain element"
}

@test "assert_array_contains fails when element does not exist" {
    local array="apple banana cherry"
    run assert_array_contains "dragonfruit" "$array"
    [ "$status" -ne 0 ]
}

@test "assert_executable passes for executable files" {
    local script="${TEST_TEMP_DIR}/test-script.sh"
    echo "#!/bin/bash" > "$script"
    chmod +x "$script"

    assert_executable "$script" "Should be executable"
}

@test "assert_executable fails for non-executable files" {
    local file="${TEST_TEMP_DIR}/non-executable.txt"
    touch "$file"

    run assert_executable "$file"
    [ "$status" -ne 0 ]
}

@test "count_lines returns correct line count" {
    local file="${TEST_TEMP_DIR}/lines.txt"
    printf "line1\nline2\nline3\n" > "$file"

    local count
    count=$(count_lines "$file")
    assert_eq "$count" "3" "Should have 3 lines"
}

@test "file_size returns correct size" {
    local file="${TEST_TEMP_DIR}/size.txt"
    echo "hello" > "$file"

    local size
    size=$(file_size "$file")
    assert_gt "$size" "0" "File should have size"
}

@test "assert_file_size_gt passes when file is large enough" {
    local file="${TEST_TEMP_DIR}/large-file.txt"
    printf "xxxxxxxxxx" > "$file"  # 10 bytes

    assert_file_size_gt "$file" "5" "File should be larger than 5 bytes"
}

@test "assert_file_size_gt fails when file is too small" {
    local file="${TEST_TEMP_DIR}/small-file.txt"
    echo "x" > "$file"  # 2 bytes (includes newline)

    run assert_file_size_gt "$file" "100"
    [ "$status" -ne 0 ]
}
