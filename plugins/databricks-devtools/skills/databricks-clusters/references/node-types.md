# Databricks Node Types Reference

## Overview

Node types determine the compute resources (CPU, memory, storage) available to your Databricks cluster. Choosing the right node type is critical for performance and cost optimization.

## AWS Node Types

### Memory Optimized

For workloads requiring large memory footprint.

| Node Type | vCPUs | Memory | Storage | Best For |
|-----------|-------|--------|---------|----------|
| `r5d.large` | 2 | 16 GB | 1 x 120 GB SSD | Small development |
| `r5d.xlarge` | 4 | 32 GB | 1 x 120 GB SSD | Medium development |
| `r5d.2xlarge` | 8 | 64 GB | 1 x 120 GB SSD | Large development |
| `r5d.4xlarge` | 16 | 128 GB | 1 x 120 GB SSD | Production ETL |
| `r5d.8xlarge` | 32 | 256 GB | 1 x 120 GB SSD | Large datasets |
| `r5d.12xlarge` | 48 | 384 GB | 2 x 120 GB SSD | ML training |
| `r5d.16xlarge` | 64 | 512 GB | 4 x 120 GB SSD | Big data |

### Compute Optimized

For CPU-intensive workloads.

| Node Type | vCPUs | Memory | Storage | Best For |
|-----------|-------|--------|---------|----------|
| `c5d.large` | 2 | 4 GB | 1 x 120 GB SSD | Light compute |
| `c5d.xlarge` | 4 | 8 GB | 1 x 120 GB SSD | ETL pipelines |
| `c5d.2xlarge` | 8 | 16 GB | 1 x 120 GB SSD | Data processing |
| `c5d.4xlarge` | 16 | 32 GB | 1 x 120 GB SSD | High-throughput |
| `c5d.9xlarge` | 36 | 72 GB | 1 x 120 GB SSD | Intensive compute |
| `c5d.12xlarge` | 48 | 96 GB | 2 x 120 GB SSD | Maximum CPU |

### Storage Optimized

For workloads with high I/O requirements.

| Node Type | vCPUs | Memory | Storage | Best For |
|-----------|-------|--------|---------|----------|
| `i3.xlarge` | 4 | 30.5 GB | 1 x 950 GB NVMe | High I/O |
| `i3.2xlarge` | 8 | 61 GB | 1 x 1.9 TB NVMe | Very high I/O |
| `i3.4xlarge` | 16 | 122 GB | 2 x 1.9 TB NVMe | Extreme I/O |
| `i3.8xlarge` | 32 | 244 GB | 4 x 1.9 TB NVMe | Maximum I/O |

### General Purpose

Balanced compute and memory.

| Node Type | vCPUs | Memory | Storage | Best For |
|-----------|-------|--------|---------|----------|
| `m5d.large` | 2 | 8 GB | 1 x 120 GB SSD | General use |
| `m5d.xlarge` | 4 | 16 GB | 1 x 120 GB SSD | Standard workload |
| `m5d.2xlarge` | 8 | 32 GB | 1 x 120 GB SSD | Moderate scale |
| `m5d.4xlarge` | 16 | 64 GB | 1 x 120 GB SSD | Production general |
| `m5d.8xlarge` | 32 | 128 GB | 2 x 120 GB SSD | Large general |

## GPU Node Types

For machine learning and deep learning.

| Node Type | GPUs | GPU Type | vCPUs | Memory | Best For |
|-----------|------|----------|-------|--------|----------|
| `g4dn.xlarge` | 1 | T4 GPU | 4 | 16 GB | Small ML |
| `g4dn.2xlarge` | 1 | T4 GPU | 8 | 32 GB | Medium ML |
| `g4dn.4xlarge` | 1 | T4 GPU | 16 | 64 GB | Large ML |
| `g4dn.8xlarge` | 1 | T4 GPU | 32 | 128 GB | Very large ML |
| `g4dn.12xlarge` | 4 | T4 GPU | 48 | 192 GB | Distributed ML |
| `p3.2xlarge` | 1 | V100 | 8 | 61 GB | Deep learning |
| `p3.8xlarge` | 4 | V100 | 32 | 244 GB | Multi-GPU training |
| `p3.16xlarge` | 8 | V100 | 64 | 488 GB | Large DL training |

## Availability by Region

Not all node types are available in all regions. Check availability:

```bash
databricks clusters list-node-types --output json | jq '.[] | select(.node_type_id | contains("r5d"))'
```

## Selection Guidelines

### Use Memory Optimized When:
- Processing large datasets that fit in memory
- Running Spark operations with many shuffles
- Using caching extensively
- ML model training with large feature sets

### Use Compute Optimized When:
- ETL with minimal memory requirements
- Data transformation pipelines
- CPU-intensive transformations
- High-throughput streaming

### Use Storage Optimized When:
- High I/O operations
- Frequent disk reads/writes
- Large intermediate datasets
- Delta Lake operations with many small files

### Use GPU When:
- Deep learning training
- GPU-accelerated ML libraries
- Large neural networks
- Computer vision workloads

## Cost Considerations

### DBU (Databricks Unit) Pricing

DBUs vary by:
- **Instance type** (higher resources = more DBUs/hr)
- **Usage type** (all-purpose vs job clusters)
- **Region** (different regions have different rates)

### Cost Optimization Tips

1. **Use job clusters** for automated workloads (~50% cheaper)
2. **Enable auto-termination** to prevent idle costs
3. **Use spot instances** with fallback for development
4. **Right-size nodes** based on actual workload requirements
5. **Consider autoscaling** to handle variable workloads

## Checking Available Types

```bash
# List all available node types
databricks clusters list-node-types

# Get specific node type details
databricks clusters list-node-types --output json | jq '.[] | select(.node_type_id == "r5d.4xlarge")'
```
