# Advanced Workflow Patterns

## Overview

Databricks Workflows allow you to orchestrate complex data pipelines with multiple tasks, dependencies, and conditional execution. This guide covers advanced patterns beyond simple linear workflows.

## Task Dependencies

### Sequential Dependencies

```json
{
  "tasks": [
    {
      "task_key": "task1",
      "notebook_task": {"notebook_path": "/Users/user/task1"}
    },
    {
      "task_key": "task2",
      "depends_on": [{"task_key": "task1"}],
      "notebook_task": {"notebook_path": "/Users/user/task2"}
    }
  ]
}
```

### Multiple Dependencies (AND)

```json
{
  "task_key": "join",
  "depends_on": [
    {"task_key": "task1"},
    {"task_key": "task2"}
  ],
  "notebook_task": {"notebook_path": "/Users/user/join"}
}
```

### Fan-Out Pattern

```json
{
  "tasks": [
    {
      "task_key": "extract",
      "notebook_task": {"notebook_path": "/Users/user/extract"}
    },
    {
      "task_key": "process_a",
      "depends_on": [{"task_key": "extract"}],
      "notebook_task": {"notebook_path": "/Users/user/process_a"}
    },
    {
      "task_key": "process_b",
      "depends_on": [{"task_key": "extract"}],
      "notebook_task": {"notebook_path": "/Users/user/process_b"}
    }
  ]
}
```

## Conditional Execution

### Run If Task Succeeded

```json
{
  "task_key": "on_success",
  "depends_on": [
    {"task_key": "previous", "outcome": "SUCCESS"}
  ]
}
```

### Run If Task Failed

```json
{
  "task_key": "error_handler",
  "depends_on": [
    {"task_key": "data_quality", "outcome": "FAILURE"}
  ],
  "notebook_task": {"notebook_path": "/Users/user/alert_on_failure"}
}
```

### Multiple Condition Outcomes

```json
{
  "task_key": "cleanup",
  "depends_on": [
    {"task_key": "main_process", "outcome": "SUCCESS"},
    {"task_key": "main_process", "outcome": "FAILURE"}
  ]
}
```

## Task Types

### Notebook Task

```json
{
  "task_key": "notebook_task",
  "notebook_task": {
    "notebook_path": "/Users/user/my_notebook",
    "base_parameters": {
      "param1": "value1",
      "param2": "{{job.parameters.run_date}}"
    }
  }
}
```

### Python Script Task

```json
{
  "task_key": "python_task",
  "python_script_task": {
    "python_file": "Repos/user/project/main.py",
    "parameters": ["--input", "s3://bucket/data"]
  }
}
```

### SQL Task

```json
{
  "task_key": "sql_task",
  "sql_task": {
    "query": {
      "query_id": "1234567890abcdef"
    },
    "warehouse_id": "abcd1234"
  }
}
```

### Delta Live Tables Task

```json
{
  "task_key": "dlt_task",
  "pipeline_task": {
    "pipeline_id": "uuid-of-pipeline"
  }
}
```

### For Each Task

```json
{
  "task_key": "foreach_task",
  "foreach_task": {
    "inputs": "{{jobs.get_users.output.users}}",
    "task": {
      "notebook_task": {
        "notebook_path": "/Users/user/process_user"
      }
    }
  }
}
```

## Error Handling

### Retry Policy

```json
{
  "task_key": "with_retry",
  "notebook_task": {"notebook_path": "/Users/user/flaky_task"},
  "retry_on_timeout": true,
  "max_retries": 3,
  "min_retry_interval_millis": 60000,
  "timeout_seconds": 3600
}
```

### Error Notification Task

```json
{
  "name": "Pipeline with Error Handler",
  "tasks": [
    {
      "task_key": "main",
      "notebook_task": {"notebook_path": "/Users/user/main"}
    },
    {
      "task_key": "notify_on_failure",
      "depends_on": [{"task_key": "main", "outcome": "FAILURE"}],
      "email_notifications": {
        "on_failure": ["ops@example.com"]
      }
    }
  ]
}
```

## Value Passing Between Tasks

### Using Task Values

```json
{
  "tasks": [
    {
      "task_key": "get_config",
      "notebook_task": {
        "notebook_path": "/Users/user/get_config"
      }
    },
    {
      "task_key": "use_config",
      "depends_on": [{"task_key": "get_config"}],
      "notebook_task": {
        "notebook_path": "/Users/user/process",
        "base_parameters": {
          "config": "{{get_config.output.config}}"
        }
      }
    }
  ]
}
```

## Resource Management

### New Cluster per Task

```json
{
  "task_key": "task_with_cluster",
  "new_cluster": {
    "spark_version": "13.3.x-scala2.12",
    "node_type_id": "i3.xlarge",
    "num_workers": 4,
    "autoscale": {
      "min_workers": 2,
      "max_workers": 8
    }
  },
  "notebook_task": {"notebook_path": "/Users/user/task"}
}
```

### Shared Job Cluster

```json
{
  "name": "Workflow with Shared Cluster",
  "job_clusters": [
    {
      "job_cluster_key": "shared_cluster",
      "new_cluster": {
        "spark_version": "13.3.x-scala2.12",
        "node_type_id": "i3.xlarge",
        "num_workers": 4
      }
    }
  ],
  "tasks": [
    {
      "task_key": "task1",
      "job_cluster_key": "shared_cluster",
      "notebook_task": {"notebook_path": "/Users/user/task1"}
    },
    {
      "task_key": "task2",
      "depends_on": [{"task_key": "task1"}],
      "job_cluster_key": "shared_cluster",
      "notebook_task": {"notebook_path": "/Users/user/task2"}
    }
  ]
}
```

## Common Patterns

### ETL Pipeline

```json
{
  "name": "ETL Pipeline",
  "tasks": [
    {"task_key": "extract", "notebook_task": {"notebook_path": "/etl/extract"}},
    {
      "task_key": "transform",
      "depends_on": [{"task_key": "extract"}],
      "notebook_task": {"notebook_path": "/etl/transform"}
    },
    {
      "task_key": "load",
      "depends_on": [{"task_key": "transform"}],
      "notebook_task": {"notebook_path": "/etl/load"}
    },
    {
      "task_key": "verify",
      "depends_on": [{"task_key": "load"}],
      "notebook_task": {"notebook_path": "/etl/verify"}
    }
  ]
}
```

### Data Quality Check Pattern

```json
{
  "name": "Pipeline with Data Quality",
  "tasks": [
    {
      "task_key": "process_data",
      "notebook_task": {"notebook_path": "/process"}
    },
    {
      "task_key": "quality_check",
      "depends_on": [{"task_key": "process_data"}],
      "notebook_task": {"notebook_path": "/quality_check"}
    },
    {
      "task_key": "proceed",
      "depends_on": [{"task_key": "quality_check", "outcome": "SUCCESS"}],
      "notebook_task": {"notebook_path": "/downstream"}
    },
    {
      "task_key": "handle_failure",
      "depends_on": [{"task_key": "quality_check", "outcome": "FAILURE"}],
      "notebook_task": {"notebook_path": "/quarantine"}
    }
  ]
}
```

### Multi-Environment Deployment

```json
{
  "name": "Deploy Pipeline",
  "parameters": [
    {"name": "environment", "default": "dev"},
    {"name": "skip_tests", "default": "false"}
  ],
  "tasks": [
    {
      "task_key": "validate_env",
      "condition": "{{job.parameters.environment == 'prod'}}",
      "notebook_task": {"notebook_path": "/validate_prod"}
    },
    {
      "task_key": "run_tests",
      "depends_on": [{"task_key": "validate_env"}],
      "condition": "{{job.parameters.skip_tests == 'false'}}",
      "notebook_task": {"notebook_path": "/tests"}
    },
    {
      "task_key": "deploy",
      "depends_on": [{"task_key": "run_tests"}],
      "notebook_task": {
        "notebook_path": "/deploy",
        "base_parameters": {
          "target_env": "{{job.parameters.environment}}"
        }
      }
    }
  ]
}
```
