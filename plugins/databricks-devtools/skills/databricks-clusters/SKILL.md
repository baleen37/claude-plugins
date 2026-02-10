---
name: databricks-clusters
description: |
  This skill should be used when the user asks to "create databricks cluster",
  "start databricks cluster", "stop databricks cluster", "list databricks
  clusters", "databricks cluster policy", or needs guidance on Databricks
  clusters, SQL warehouses, cluster management, or compute optimization.
version: 1.0.0
---

# Databricks Clusters and Compute

## Overview

Databricks clusters provide compute resources for running notebooks, jobs, and SQL queries. This skill covers cluster creation, management, policies, and cost optimization.

## Cluster Types

### All-Purpose Clusters

- **Use case**: Interactive development, data science, ad-hoc analysis
- **Behavior**: Manually started/stopped, auto-termination available
- **Cost**: Higher (interactive pricing)

### Job Clusters

- **Use case**: Automated workloads, production jobs
- **Behavior**: Automatically created/destroyed with jobs
- **Cost**: Lower (job-optimized pricing)

### SQL Warehouses

- **Use case**: BI tools, SQL queries, dashboards
- **Behavior**: Serverless compute, auto-scaling
- **Cost**: Based on warehouse size and usage

## Listing Clusters

### List All Clusters

```bash
databricks clusters list
```

### List Running Clusters

```bash
databricks clusters list | grep RUNNING
```

### Get Cluster Details

```bash
databricks clusters get --cluster-id 1234-567890-abcde
```

## Creating Clusters

### Using CLI

```bash
databricks clusters create --json cluster-config.json
```

**Sample cluster-config.json:**

```json
{
  "cluster_name": "Interactive Cluster",
  "spark_version": "17.3.x-scala2.13",
  "node_type_id": "r5d.4xlarge",
  "num_workers": 3,
  "autotermination_minutes": 30,
  "enable_elastic_disk": true,
  "runtime_engine": "PHOTON"
}
```

### Cluster Configuration Options

**Spark Version:**
- Use latest LTS for production
- Current version: `17.3.x-scala2.13`
- Check available versions: `databricks clusters spark-versions`

**Node Types:**
- **Memory Optimized**: `r5d.4xlarge` (16 cores, 128 GB RAM)
- **Compute Optimized**: `c5d.4xlarge` (16 cores, 32 GB RAM)
- **Storage Optimized**: `i3.xlarge` (4 cores, 30 GB RAM, 1.9 TB SSD)

**Worker Configuration:**
- `num_workers`: Fixed worker count
- `autoscale`: Min/max worker range for auto-scaling

**Auto-termination:**
- `autotermination_minutes`: Stop cluster after inactivity
- Recommended: 10-30 minutes for development

**Runtime Engine:**
- `PHOTON`: Vectorized query engine (recommended)
- `STANDARD`: Standard Spark engine

## Managing Clusters

### Start Cluster

```bash
databricks clusters start --cluster-id 1234-567890-abcde
```

### Stop Cluster

```bash
databricks clusters stop --cluster-id 1234-567890-abcde
```

### Delete Cluster

```bash
databricks clusters delete --cluster-id 1234-567890-abcde
```

### Edit Cluster

```bash
databricks clusters edit --json updated-config.json --cluster-id 1234-567890-abcde
```

## SQL Warehouses

### List Warehouses

```bash
databricks warehouses list
```

### Create SQL Warehouse

```bash
databricks warehouses create --json warehouse-config.json
```

**Sample warehouse-config.json:**

```json
{
  "name": "Analytics Warehouse",
  "size": "Medium",
  "enable_serverless_compute": true,
  "max_num_clusters": 10,
  "auto_stop_mins": 30
}
```

**Warehouse Sizes:**
- **X-Small**: 4 DBU (development)
- **Small**: 8 DBU (light analytics)
- **Medium**: 16 DBU (moderate workloads)
- **Large**: 32 DBU (heavy analytics)
- **X-Large**: 64 DBU (production workloads)

### Start/Stop Warehouse

```bash
# Start
databricks warehouses start --warehouse-id 1234567890abcdef

# Stop
databricks warehouses stop --warehouse-id 1234567890abcdef
```

## Cluster Policies

### Purpose

Cluster policies enforce governance and control over cluster creation.

### List Policies

```bash
databricks cluster-policies list
```

### Create Policy

```bash
databricks cluster-policies create --json policy-config.json
```

**Sample policy (restricted node types):**

```json
{
  "name": "Restricted Policy",
  "policy_family_id": "61E8EA35F2780248",
  "definitions": [
    {
      "name": "node_type_id",
      "type": "fixed",
      "value": "r5d.4xlarge"
    }
  ]
}
```

**Policy Types:**
- **fixed**: Enforce specific value
- **allowlist**: Restrict to predefined options
- **blocklist**: Prevent certain options
- **regex**: Validate with pattern

## Cost Optimization

### Auto-Termination

Configure auto-termination for all-purpose clusters:

```json
{
  "autotermination_minutes": 20
}
```

### Spot Instances

Use spot instances for cost savings:

```json
{
  "aws_attributes": {
    "spot_bid_price_percent": 100,
    "availability": "SPOT_WITH_FALLBACK"
  }
}
```

### Cluster Sizing

**Development:**
- 2-4 workers
- Memory-optimized nodes
- Auto-termination enabled

**Production:**
- 8+ workers with auto-scaling
- Appropriate node type for workload
- Consider job clusters for automated workloads

**Analytics (SQL Warehouse):**
- Start with Small/Medium
- Scale based on concurrent users
- Enable auto-scaling

### Monitoring Cluster Costs

**View cluster usage:**
```bash
databricks clusters list --output json | jq '.[] | {name: cluster_name, state: state, workers: num_workers}'
```

**Set up cluster tags:**
```json
{
  "custom_tags": {
    "Owner": "data-team",
    "CostCenter": "engineering",
    "Environment": "production"
  }
}
```

## Troubleshooting

### Cluster Not Starting

**Check cluster status:**
```bash
databricks clusters get --cluster-id 1234-567890-abcde
```

**Common issues:**
- Insufficient quota: Contact Databricks support
- Invalid node type: Verify availability in region
- VPC/network issues: Check security group rules

### Cluster Performance Issues

**Symptoms and solutions:**
- Slow queries: Consider upgrading to Photon
- Memory errors: Increase node size or worker count
- Disk issues: Enable elastic disk for large datasets

### Cluster Timeout

**Increase timeout:**
```json
{
  "autotermination_minutes": 120
}
```

**Disable auto-termination for long-running jobs:**
```json
{
  "autotermination_minutes": -1
}
```

## Best Practices

### Development

- Use auto-termination (10-30 minutes)
- Start with smaller cluster sizes
- Enable spot instances with fallback

### Production

- Use job clusters for automated workloads
- Implement cluster policies for governance
- Tag clusters for cost tracking
- Monitor cluster usage patterns

### Security

- Use token-based authentication
- Implement cluster policies
- Restrict node types and instance types
- Enable credential passthrough for data access

## Additional Resources

### Reference Files

- **`references/node-types.md`** - Available node types and specifications
- **`references/policies.md`** - Cluster policy examples
- **`references/optimization.md`** - Performance tuning guide

### Example Files

- **`examples/dev-cluster.json`** - Development cluster configuration
- **`examples/production-cluster.json`** - Production cluster configuration
- **`examples/warehouse.json`** - SQL warehouse configuration

### Scripts

- **`scripts/start-cluster.sh`** - Start cluster and wait for ready state
- **`scripts/cleanup-clusters.sh`** - Stop idle clusters
