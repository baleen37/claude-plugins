---
name: databricks-jobs
description: |
  This skill should be used when the user asks to "create databricks job",
  "run databricks workflow", "list databricks jobs", "monitor databricks job",
  "databricks job failed", or needs guidance on Databricks jobs, workflows,
  job runs, triggers, or job scheduling.
version: 1.0.0
---

# Databricks Jobs and Workflows

## Overview

Databricks Jobs enable scheduled and triggered execution of notebooks, scripts, and workflows. This skill covers job creation, management, monitoring, and troubleshooting.

## Job Concepts

### Job vs Workflow

- **Job**: A scheduled or triggered task with configurable parameters
- **Workflow**: A directed acyclic graph (DAG) of tasks with dependencies

### Job Types

1. **Notebook Job** - Run a Databricks notebook
2. **Script Job** - Run Python, Scala, or Java script
3. **SQL Task** - Execute SQL queries or dashboards
4. **Workflow Job** - Multi-task orchestration with dependencies

## Creating Jobs

### Using Databricks CLI

**Create a notebook job:**

```bash
databricks jobs create --json job-config.json
```

**Sample job-config.json:**

```json
{
  "name": "Daily ETL",
  "tasks": [
    {
      "task_key": "extract",
      "notebook_task": {
        "notebook_path": "/Users/user@example.com/Extract"
      }
    }
  ]
}
```

**Create a workflow with multiple tasks:**

```json
{
  "name": "Data Pipeline",
  "tasks": [
    {
      "task_key": "extract",
      "notebook_task": {
        "notebook_path": "/Users/user@example.com/Extract"
      }
    },
    {
      "task_key": "transform",
      "depends_on": [{"task_key": "extract"}],
      "notebook_task": {
        "notebook_path": "/Users/user@example.com/Transform"
      }
    },
    {
      "task_key": "load",
      "depends_on": [{"task_key": "transform"}],
      "notebook_task": {
        "notebook_path": "/Users/user@example.com/Load"
      }
    }
  ]
}
```

### Job Parameters

**Define parameters in job configuration:**

```json
{
  "name": "Parameterized Job",
  "tasks": [
    {
      "task_key": "main",
      "notebook_task": {
        "notebook_path": "/Users/user@example.com/Main",
        "base_parameters": {
          "date": "{{job.parameters.run_date}}",
          "environment": "{{job.parameters.env}}"
        }
      }
    }
  ],
  "parameters": [
    {"name": "run_date", "default": "2024-01-01"},
    {"name": "env", "default": "dev"}
  ]
}
```

**Access parameters in notebooks:**

```python
# Databricks Notebook
dbutils.widgets.get("date")
dbutils.widgets.get("environment")
```

## Listing and Managing Jobs

### List Jobs

```bash
# List all jobs
databricks jobs list

# List with output format
databricks jobs list --output json
```

### Get Job Details

```bash
# Get job by ID
databricks jobs get --job-id 123

# Get job by name (requires search)
databricks jobs list | grep "Job Name"
```

### Update Job

```bash
databricks jobs reset --json updated-config.json --job-id 123
```

### Delete Job

```bash
databricks jobs delete --job-id 123
```

## Running Jobs

### Run Job Now

```bash
# Run job immediately
databricks jobs run-now --job-id 123

# Run with parameters
databricks jobs run-now --job-id 123 --json '{"run_name": "Manual Run"}'
```

### Run with Custom Parameters

```bash
databricks jobs run-now --job-id 123 --notebook-params '{"date": "2024-01-15", "env": "prod"}'
```

## Monitoring Jobs

### List Runs

```bash
# List recent runs for a job
databricks jobs list-runs --job-id 123

# List all runs with limit
databricks jobs list-runs --job-id 123 --limit 50

# List active runs only
databricks jobs list-runs --active-only
```

### Get Run Details

```bash
# Get specific run details
databricks jobs get-run --run-id 456

# Get run output
databricks jobs get-run-output --run-id 456
```

### Run States

- **PENDING** - Queued, waiting to start
- **RUNNING** - Currently executing
- **TERMINATING** - Stopping
- **TERMINATED** - Completed successfully
- **SKIPPED** - Not executed (condition not met)
- **INTERNAL_ERROR** - Databricks platform error
- **FAILED** - Job execution failed
- **TIMEDOUT** - Exceeded timeout limit
- **CANCELED** - Manually canceled

## Scheduling Jobs

### Schedule Configuration

**Add schedule to job:**

```json
{
  "name": "Scheduled Job",
  "schedule": {
    "quartz_cron_expression": "0 0 2 * * ?",
    "timezone_id": "America/Los_Angeles",
    "pause_status": "UNPAUSED"
  }
}
```

**Cron Expression Format:**

- Seconds Minutes Hours Day-of-Month Month Day-of-Week
- Example: `0 0 2 * * ?` = Daily at 2 AM

**Common Schedules:**

- Hourly: `0 0 * * * ?`
- Daily at midnight: `0 0 0 * * ?`
- Weekly (Monday): `0 0 0 ? * MON`
- Monthly (1st): `0 0 0 1 * ?`

## Triggers

### File Arrival Trigger

Trigger job when files arrive in cloud storage:

```json
{
  "name": "File Triggered Job",
  "trigger": {
    "file_arrival": {
      "url": "s3://my-bucket/data/",
      "min_time_between_trigger_seconds": 60
    }
  }
}
```

### Continuous Jobs

For streaming workloads:

```json
{
  "name": "Streaming Job",
  "continuous": {
    "pause_status": "UNPAUSED"
  }
}
```

## Troubleshooting

### Common Issues

**Job stuck in PENDING:**

- Check cluster availability
- Verify cluster is not at capacity
- Review job queue settings

**Job FAILED:**

- Check run output for error messages: `databricks jobs get-run-output --run-id 456`
- Review notebook logs
- Verify cluster compatibility

**Timeout issues:**

- Increase timeout setting in job configuration
- Optimize notebook/script performance
- Check for resource constraints

### Cancel Run

```bash
# Cancel a running job
databricks jobs cancel-run --run-id 456
```

## Best Practices

### Job Design

- Use workflows for multi-step processes
- Define clear task dependencies
- Set appropriate timeouts
- Configure retry policies for transient failures

### Parameter Management

- Use default values for optional parameters
- Validate parameters in notebook/script
- Document parameter requirements

### Monitoring

- Set up notifications for job failures
- Use descriptive job names
- Tag jobs for organization
- Review job metrics regularly

## Additional Resources

### Reference Files

- **`references/workflows.md`** - Advanced workflow patterns
- **`references/troubleshooting.md`** - Detailed troubleshooting guide

### Example Files

- **`examples/simple-job.json`** - Basic job configuration
- **`examples/workflow.json`** - Multi-task workflow example
- **`examples/scheduled-job.json`** - Scheduled job example

### Scripts

- **`scripts/run-and-wait.sh`** - Execute job and wait for completion
- **`scripts/list-failed-runs.sh`** - List failed job runs
