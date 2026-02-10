# Databricks CLI Command Reference

## Global Options

```bash
databricks [GLOBAL-OPTIONS] COMMAND [COMMAND-OPTIONS] [ARGUMENTS]
```

| Option | Description |
|--------|-------------|
| `--profile <name>` | Use specific profile from ~/.databrickscfg |
| `--debug` | Enable debug logging |
| `-h, --help` | Show help for command |
| `-v, --version` | Show CLI version |

## Workspace Commands

### workspace list

List workspace items.

```bash
databricks workspace list [--recursive] [--long] PATH
```

**Options:**
- `--recursive`: List all subdirectories
- `--long`: Show detailed information
- `--output json`: Output as JSON

**Examples:**
```bash
# List root directory
databricks workspace list /

# List with JSON output
databricks workspace list /Users/user@example.com --output json

# List recursively
databricks workspace list / --recursive
```

### workspace mkdirs

Create directories.

```bash
databricks workspace mkdirs PATH
```

**Example:**
```bash
databricks workspace mkdirs /Users/user@example.com/Project/Data
```

### workspace import

Import a notebook or file.

```bash
databricks workspace import SOURCE_PATH DEST_PATH [--language LANGUAGE] [--overwrite]
```

**Options:**
- `--language`: PYTHON, SCALA, R, SQL
- `--overwrite`: Overwrite existing file

**Examples:**
```bash
# Import Python notebook
databricks workspace import ./notebook.py /Users/user@example.com/Notebook

# Import with language specification
databricks workspace import ./script.scala /Users/user@example.com/Script --language SCALA

# Overwrite existing
databricks workspace import ./notebook.py /Users/user@example.com/Notebook --overwrite
```

### workspace export

Export a notebook or file.

```bash
databricks workspace export SOURCE_PATH DEST_PATH
```

**Example:**
```bash
databricks workspace export /Users/user@example.com/Notebook ./notebook.py
```

### workspace export-dir

Export directory recursively.

```bash
databricks workspace export-dir SOURCE_PATH DEST_PATH
```

**Example:**
```bash
# Backup entire user folder
databricks workspace export-dir /Users/user@example.com ./backup
```

### workspace delete

Delete workspace item.

```bash
databricks workspace delete PATH [--recursive]
```

**Example:**
```bash
# Delete directory
databricks workspace delete /Users/user@example.com/OldFolder --recursive
```

## Cluster Commands

### clusters list

List all clusters.

```bash
databricks clusters list [--output json]
```

**Example:**
```bash
# Filter running clusters
databricks clusters list --output json | jq '.[] | select(.state == "RUNNING")'
```

### clusters get

Get cluster details.

```bash
databricks clusters get --cluster-id CLUSTER_ID
```

**Example:**
```bash
databricks clusters get --cluster-id 1234-567890-abcde
```

### clusters create

Create a cluster.

```bash
databricks clusters create --json CONFIG_FILE
```

**Example:**
```bash
databricks clusters create --json cluster-config.json
```

### clusters start

Start a stopped cluster.

```bash
databricks clusters start --cluster-id CLUSTER_ID
```

### clusters stop

Stop a running cluster.

```bash
databricks clusters stop --cluster-id CLUSTER_ID
```

### clusters delete

Delete a cluster.

```bash
databricks clusters delete --cluster-id CLUSTER_ID
```

## Job Commands

### jobs list

List all jobs.

```bash
databricks jobs list [--output json]
```

### jobs get

Get job details.

```bash
databricks jobs get --job-id JOB_ID
```

### jobs create

Create a job.

```bash
databricks jobs create --json CONFIG_FILE
```

### jobs run-now

Run a job immediately.

```bash
databricks jobs run-now --job-id JOB_ID [--notebook-params JSON]
```

**Example:**
```bash
# Run with parameters
databricks jobs run-now --job-id 123 --notebook-params '{"date": "2024-01-15"}'
```

### jobs list-runs

List job runs.

```bash
databricks jobs list-runs --job-id JOB_ID [--limit N] [--active-only]
```

### jobs get-run

Get run details.

```bash
databricks jobs get-run --run-id RUN_ID
```

### jobs get-run-output

Get run output.

```bash
databricks jobs get-run-output --run-id RUN_ID
```

## Repo Commands

### repos list

List all repos.

```bash
databricks repos list [--output json]
```

### repos create

Create a repo from Git URL.

```bash
databricks repos create --url GIT_URL --path PATH
```

**Example:**
```bash
databricks repos create --url https://github.com/user/repo.git --path /Repos/my-repo
```

### repos update

Pull latest changes from Git.

```bash
databricks repos update --repo-id REPO_ID [--branch BRANCH]
```

## SQL Warehouse Commands

### warehouses list

List all SQL warehouses.

```bash
databricks warehouses list [--output json]
```

### warehouses get

Get warehouse details.

```bash
databricks warehouses get --warehouse-id WAREHOUSE_ID
```

### warehouses start

Start a warehouse.

```bash
databricks warehouses start --warehouse-id WAREHOUSE_ID
```

### warehouses stop

Stop a warehouse.

```bash
databricks warehouses stop --warehouse-id WAREHOUSE_ID
```

## Secret Commands

### secrets list-scopes

List secret scopes.

```bash
databricks secrets list-scopes
```

### secrets list

List secrets in a scope.

```bash
databricks secrets list --scope SCOPE_NAME
```

### secrets put

Create or update a secret.

```bash
databricks secrets put --scope SCOPE_NAME --key KEY_VALUE
```

**Example:**
```bash
echo "my-secret-value" | databricks secrets put --scope my-scope --key api-key
```

### secrets delete

Delete a secret.

```bash
databricks secrets delete --scope SCOPE_NAME --key KEY_VALUE
```

## Current User

### current-user me

Get current user information.

```bash
databricks current-user me
```

## Useful Patterns

### Get cluster ID by name

```bash
databricks clusters list --output json | jq -r '.[] | select(.cluster_name == "My Cluster") | .cluster_id'
```

### Get running clusters only

```bash
databricks clusters list --output json | jq '.[] | select(.state == "RUNNING")'
```

### Get job ID by name

```bash
databricks jobs list --output json | jq -r '.[] | select(.settings.name == "My Job") | .job_id'
```

### Wait for cluster to be running

```bash
databricks clusters start --cluster-id $CLUSTER_ID
while true; do
  STATE=$(databricks clusters get --cluster-id $CLUSTER_ID --output json | jq -r '.state')
  if [ "$STATE" = "RUNNING" ]; then
    break
  fi
  sleep 10
done
```
