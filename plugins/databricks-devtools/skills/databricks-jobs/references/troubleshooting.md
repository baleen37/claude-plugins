# Databricks Jobs Troubleshooting Guide

## Overview

This guide provides detailed troubleshooting steps for common issues with Databricks Jobs and Workflows.

## Investigation Tools

### Essential Commands

```bash
# List all jobs
databricks jobs list --output json

# Get job configuration
databricks jobs get --job-id 123

# List recent runs
databricks jobs list-runs --job-id 123 --limit 10

# Get specific run details
databricks jobs get-run --run-id 456

# Get run output (includes error messages)
databricks jobs get-run-output --run-id 456

# List active runs across all jobs
databricks jobs list-runs --active-only
```

### Run Status Meanings

| Status | Description | Next Steps |
|--------|-------------|------------|
| `PENDING` | Queued, waiting to start | Check cluster availability, queue position |
| `RUNNING` | Currently executing | Monitor logs, check timeout settings |
| `TERMINATING` | Stopping (user or system initiated) | Wait for termination, check reason |
| `TERMINATED` | Completed successfully | Review output logs |
| `SKIPPED` | Condition not met or disabled | Check task conditions, job settings |
| `INTERNAL_ERROR` | Databricks platform error | Retry, check status page |
| `FAILED` | Task execution failed | Review error logs, fix issue |
| `TIMEDOUT` | Exceeded timeout limit | Increase timeout, optimize code |
| `CANCELED` | Manually canceled | Check who canceled and why |

## Common Issues and Solutions

### Job Stuck in PENDING

**Symptoms:** Job created but never starts executing.

**Investigation:**

```bash
# Check cluster status
databricks clusters list

# Check if cluster exists and is available
databricks clusters get --cluster-id "cluster-id"

# List all pending runs to see queue position
databricks jobs list-runs --job-id 123 | grep PENDING
```

**Common Causes:**

1. **Cluster not available** - Cluster is terminated or doesn't exist
   - Solution: Create or restart the cluster

2. **Cluster at capacity** - All nodes in use
   - Solution: Wait for resources or scale cluster

3. **Invalid cluster configuration**
   - Solution: Verify cluster settings, try creating cluster manually

4. **Job queue settings** - Maximum concurrent jobs reached
   - Solution: Increase maximum concurrent runs or reduce parallel jobs

**Check cluster in job config:**

```bash
databricks jobs get --job-id 123 | jq '.settings'
```

### Job FAILED

**Symptoms:** Job starts but fails during execution.

**Investigation:**

```bash
# Get error details from run output
databricks jobs get-run-output --run-id 456

# If output truncated, get full run details
databricks jobs get-run --run-id 456

# Check which task failed in workflow
databricks jobs get-run --run-id 456 | jq '.tasks[] | select(.state.life_cycle_state == "FAILED")'
```

**Common Causes:**

1. **Notebook/script error**
   - Check error message in run output
   - Manually run notebook to reproduce
   - Review logs for stack trace

2. **Permission issues**
   - Verify job creator has access to notebooks
   - Check service principal permissions
   - Ensure cluster has access to data sources

3. **Missing dependencies**
   - Verify libraries are installed on cluster
   - Check workspace paths exist
   - Confirm data files are accessible

4. **Resource constraints**
   - Cluster ran out of memory
   - Disk space exceeded
   - Solution: Scale cluster or optimize code

### TIMEOUT Issues

**Symptoms:** Job runs but exceeds time limit.

**Investigation:**

```bash
# Check current timeout setting
databricks jobs get --job-id 123 | jq '.settings.timeout_seconds'

# Check task-level timeouts
databricks jobs get --job-id 123 | jq '.settings.tasks[].timeout_seconds'
```

**Solutions:**

1. **Increase timeout** in job configuration
2. **Optimize notebook/script** for better performance
3. **Use larger cluster** with more resources
4. **Split long-running job** into multiple tasks
5. **Check for infinite loops** or inefficient code

### Schedule Not Triggering

**Symptoms:** Scheduled job doesn't run at expected time.

**Investigation:**

```bash
# Check schedule configuration
databricks jobs get --job-id 123 | jq '.settings.schedule'

# Check pause status
databricks jobs get --job-id 123 | jq '.settings.schedule.pause_status'
```

**Common Causes:**

1. **Schedule paused** - `pause_status` is `PAUSED`
   - Solution: Update schedule to set `pause_status: UNPAUSED`

2. **Incorrect cron expression**
   - Verify timezone matches expectation
   - Test cron expression using online validator
   - Example: `0 0 2 * * ?` = Daily at 2 AM

3. **Timezone mismatch**
   - Confirm `timezone_id` is correct
   - Convert desired time to job's timezone

### Parameters Not Passed Correctly

**Symptoms:** Notebook doesn't receive expected parameters.

**Investigation:**

```bash
# Check job parameters definition
databricks jobs get --job-id 123 | jq '.settings.parameters'

# Check task parameters
databricks jobs get --job-id 123 | jq '.settings.tasks[].notebook_task.base_parameters'
```

**Common Issues:**

1. **Parameter name mismatch** - Job parameter doesn't match notebook widget
   - Solution: Ensure names match exactly

2. **Missing default values**
   - Solution: Add default values for optional parameters

3. **JSON syntax errors** in run-now command
   - Solution: Validate JSON before submitting

4. **Parameter not defined in notebook**
   - Solution: Create widget in notebook: `dbutils.widgets.text("param", "default")`

## Cluster Issues

### Cluster Not Starting

```bash
# Check cluster events
databricks clusters events --cluster-id "cluster-id"

# Check cluster state
databricks clusters get --cluster-id "cluster-id" | jq '.state'
```

**Common Issues:**

- Invalid cloud resource configuration
- Spot instance unavailable
- Cluster policy restrictions
- Insufficient cloud quota

### Cluster Terminated During Job

**Investigation:**

```bash
# Check cluster termination reason
databricks clusters get --cluster-id "cluster-id" | jq '.termination_reason'
```

**Common Causes:**

- Auto-termination enabled and job took too long
- Manual termination
- Cloud provider terminated instance
- Cluster max runtime exceeded

## Workflow-Specific Issues

### Dependency Not Working

**Symptoms:** Tasks run in wrong order or tasks don't wait for dependencies.

**Investigation:**

```bash
# Get workflow run with task states
databricks jobs get-run --run-id 456 | jq '.tasks[] | {task_key, state: .state.life_cycle_state, depends_on}'
```

**Common Issues:**

1. **Circular dependencies** - Tasks depend on each other
   - Solution: Redesign workflow to eliminate circular deps

2. **Missing dependency** - Task references non-existent task
   - Solution: Verify task keys match in depends_on

3. **Condition outcomes** - Task only runs on specific outcome
   - Check `outcome` field in depends_on configuration

### Conditional Task Not Running

**Symptoms:** Conditional tasks never execute.

**Investigation:**

```bash
# Check task condition
databricks jobs get --job-id 123 | jq '.settings.tasks[] | select(.task_key == "conditional") | .condition'
```

**Common Issues:**

1. **Condition never evaluates to true**
   - Test condition expression manually
   - Verify task values are being set correctly

2. **Syntax error in condition expression**
   - Validate expression syntax
   - Check for proper quoting

## Performance Issues

### Slow Job Execution

**Investigation:**

```bash
# Check run duration
databricks jobs get-run --run-id 456 | jq '.run_duration'

# Compare with historical runs
databricks jobs list-runs --job-id 123 --limit 20 | jq '.runs[] | {run_id, duration: .run_duration, state: .state.result_state}'
```

**Optimization Strategies:**

1. **Enable Photon** for SQL workloads
2. **Use autoscaling** clusters
3. **Enable result caching**
4. **Optimize Delta Lake queries**
5. **Use job clusters** instead of all-purpose for production

### Cluster Taking Too Long to Start

**Solutions:**

1. Use **pooled clusters** or **job clusters**
2. Enable **cluster autoscaling**
3. Pre-warm cluster before schedule
4. Use **Spot instances** for cost savings

## Debugging Techniques

### Enable Debug Logging

In notebook:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Use dbutils for Debugging

```python
# Print values during execution
dbutils.widgets.get("my_param")

# List mounted storage
dbutils.fs.ls("/mnt/data")

# Check cluster info
dbutils.cluster.getClusterUsageStats()
```

### Capture Diagnostics

```bash
# Export run details for analysis
databricks jobs get-run --run-id 456 > run-debug.json

# Export job configuration
databricks jobs get --job-id 123 > job-config-debug.json
```

## Recovery Procedures

### Restart Failed Job

```bash
# Re-run with same parameters
databricks jobs run-now --job-id 123
```

### Clone Job for Testing

```bash
# Export job config
databricks jobs get --job-id 123 > job-backup.json

# Create new job from config (modify job_id/name)
databricks jobs create --json job-backup.json
```

### Rollback to Previous Configuration

Keep versioned job configurations:

```bash
# Save job config with timestamp
databricks jobs get --job-id 123 > "job-$(date +%Y%m%d-%H%M%S).json"
```

## Contacting Support

When contacting Databricks support, include:

1. Job ID and Run ID
2. Full job configuration: `databricks jobs get --job-id 123`
3. Run output: `databricks jobs get-run-output --run-id 456`
4. Cluster configuration if applicable
5. Timestamps of the issue
6. Error messages from logs

```bash
# Gather all diagnostic info
{
  echo "=== Job Info ==="
  databricks jobs get --job-id 123
  echo "=== Run Info ==="
  databricks jobs get-run --run-id 456
  echo "=== Run Output ==="
  databricks jobs get-run-output --run-id 456
  echo "=== Cluster Info ==="
  databricks clusters get --cluster-id "cluster-id"
} > diagnostics-$(date +%Y%m%d-%H%M%S).txt
```
