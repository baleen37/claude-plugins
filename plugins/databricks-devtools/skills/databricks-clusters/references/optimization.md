# Databricks Cluster Performance Optimization Guide

## Overview

This guide covers performance optimization techniques for Databricks clusters, from configuration tuning to query optimization.

## Core Optimization Areas

1. **Cluster Configuration** - Right-sizing and feature selection
2. **Spark Settings** - Tuning Spark parameters for workload
3. **Data Organization** - Partitioning and format optimization
4. **Query Optimization** - Efficient query patterns
5. **Caching Strategies** - Effective use of caching
6. **Monitoring** - Identifying bottlenecks

## Cluster Configuration

### Right-Size Your Cluster

**Too small:** OOM errors, slow queries, excessive spills
**Too large:** Wasted cost, diminishing returns

**Guidelines:**

| Workload Type | Worker Count | Node Type | Reason |
|---------------|--------------|-----------|---------|
| Development | 2-4 | Memory optimized | Fast iteration, cost effective |
| ETL | 4-8 | Compute optimized | CPU intensive |
| Analytics | 2-4 | Memory optimized | Large datasets in memory |
| ML Training | 4-16 | GPU nodes | Parallel training |
| Streaming | 6-12 | Memory optimized | Low latency processing |

### Enable Photon

Photon provides vectorized query execution (2-4x faster for SQL):

```json
{
  "runtime_engine": "PHOTON"
}
```

**Best for:**
- SQL workloads
- DataFrame operations
- ETL pipelines
- BI queries

**Not ideal for:**
- UDF-heavy workloads
- Custom Python operations

### Enable Elastic Disk

Automatically scales disk when needed:

```json
{
  "enable_elastic_disk": true
}
```

**Benefits:**
- Prevents out-of-disk errors
- No manual sizing needed
- Cost-effective (pay for what you use)

### Use Autoscaling

Dynamically adjusts workers based on load:

```json
{
  "autoscale": {
    "min_workers": 2,
    "max_workers": 8
  }
}
```

**When to use:**
- Variable workload patterns
- Batch processing with fluctuating data sizes
- Cost optimization

**When NOT to use:**
- Consistent, predictable workloads
- Jobs requiring exact resource allocation

## Spark Configuration

### Memory Management

**Key settings:**

```json
{
  "spark.databricks.executor.memory": "8g",
  "spark.databricks.executor.memoryOverhead": "2g",
  "spark.databricks.memory.overheadFactor": "0.2",
  "spark.memory.fraction": "0.8",
  "spark.memory.storageFraction": "0.3"
}
```

**Guidelines:**
- Executor memory: 30-60% of node memory
- Overhead: 10-20% of executor memory
- Leave room for OS and other processes

### Shuffle Optimization

Reduce shuffle overhead:

```json
{
  "spark.sql.shuffle.partitions": "200",
  "spark.sql.autoBroadcastJoinThreshold": "10mb",
  "spark.sql.broadcastTimeout": "1200"
}
```

**Tuning tips:**
- Shuffle partitions: 2-3x number of executor cores
- Broadcast joins for small tables (< 10GB)
- Increase timeout for large broadcasts

### Adaptive Query Execution (AQE)

Enable AQE for automatic optimization:

```json
{
  "spark.sql.adaptive.enabled": true,
  "spark.sql.adaptive.coalescePartitions.enabled": true,
  "spark.sql.adaptive.skewJoin.enabled": true
}
```

**Benefits:**
- Automatic coalesce of small partitions
- Skew join handling
- Dynamic switch join strategies

## Data Organization

### File Format

**Best: Delta Lake**
- ACID transactions
- Time travel
- Schema enforcement
- Optimizations (Z-ORDER, vacuum)

**Avoid:** CSV, JSON for large datasets

### Partitioning

**Good partitioning:**
- Even distribution across partitions
- 100MB-1GB per partition
- Filter on partition columns frequently

```python
# Write with partitioning
df.write.partitionBy("date", "region").format("delta").save("/path/to/data")
```

**Bad partitioning:**
- Too many small partitions
- Skewed data distribution
- High cardinality columns

### Z-ORDER Optimization

Improve query performance on filtered columns:

```python
# Optimize for frequent queries on date column
deltaTable = DeltaTable.forPath(spark, "/path/to/data")
deltaTable.optimize().executeZOrderBy("date")
```

**Best for:**
- Frequently filtered columns
- Join keys
- Range queries

### Vacuum Regularly

Remove old files to reduce metadata overhead:

```python
deltaTable = DeltaTable.forPath(spark, "/path/to/data")
deltaTable.vacuum(240)  # Retain 7 days
```

## Query Optimization

### Predicate Pushdown

Filter data as early as possible:

```python
# Good: Early filtering
df.filter(col("date") > "2024-01-01").join(other_df, "id")

# Bad: Late filtering
df.join(other_df, "id").filter(col("date") > "2024-01-01")
```

### Column Pruning

Select only needed columns:

```python
# Good: Select specific columns
df.select("id", "name", "value").filter(col("value") > 100)

# Bad: Load all columns
df.filter(col("value") > 100).select("id", "name", "value")
```

### Caching Strategy

Cache when data is reused multiple times:

```python
# Cache frequently used data
df_cached = df.filter(col("status") == "active").cache()

# Use cached data multiple times
df_cached.count()
df_cached.groupBy("category").count()
df_cached.join(other_df, "id")
```

**When to cache:**
- Data reused 3+ times
- Fits in available memory
- Expensive to recompute

**When NOT to cache:**
- Single use
- Larger than available memory
- Fast to recompute

### Join Optimization

**Broadcast join for small tables:**

```python
from pyspark.sql.functions import broadcast

# Force broadcast for small table
df_large.join(broadcast(df_small), "id")
```

**Sort-merge join for large tables:**

```python
# Ensure join keys are sorted
df1.sortWithinPartitions("id").join(
    df2.sortWithinPartitions("id"),
    "id"
)
```

**Avoid cross joins:**

```python
# Bad: Cross join (Cartesian product)
df1.crossJoin(df2)

# Good: Explicit join condition
df1.join(df2, df1.key == df2.key)
```

## Advanced Optimization

### Delta Engine Features

**OPTIMIZE command:**

```sql
OPTIMIZE table_name
```

Compacts small files into larger ones (100-1GB each).

**Z-ORDER:**

```sql
OPTIMIZE table_name ZORDER BY (date, region)
```

Improves data skipping for filtered queries.

**VACUUM:**

```sql
VACUUM table_name RETAIN 240 HOURS
```

Removes old files not referenced by table version.

### Cluster Configuration for Workloads

**ETL Workloads:**
- Higher worker count (8+)
- Compute optimized nodes
- Photon enabled
- Aggressive autoscaling

**Interactive/Analytics:**
- Fewer workers (2-4)
- Memory optimized nodes
- Photon enabled
- Auto-termination enabled

**ML Training:**
- GPU nodes for deep learning
- Memory optimized for traditional ML
- Larger instances for model training
- Spot instances for experimentation

### Monitoring and Debugging

**Spark UI:**
- Check for skewed stages
- Identify slow tasks
- Review GC time
- Monitor shuffle read/write

**Cluster Metrics:**
```bash
# View cluster metrics
databricks clusters get --cluster-id <id> --output json
```

**Query Profile:**
```sql
EXPLAIN
SELECT * FROM table WHERE date > '2024-01-01'
```

**Logging:**
```python
# Enable logging
spark.sparkContext.setLogLevel("INFO")
```

## Common Performance Issues

### Issue: Out of Memory

**Symptoms:**
- OOM errors
- Excessive GC
- Slow performance

**Solutions:**
- Increase executor memory
- Enable elastic disk
- Reduce data per partition
- Cache less data
- Use larger node types

### Issue: Skewed Data

**Symptoms:**
- One task takes much longer
- Uneven resource utilization
- OOM on single task

**Solutions:**
- Enable AQE skew join optimization
- Repartition on different key
- Add salt to skewed key
- Use broadcast join for small table

### Issue: Slow Queries

**Symptoms:**
- Long execution times
- High shuffle time
- Many small files

**Solutions:**
- Run OPTIMIZE command
- Increase shuffle partitions
- Enable Photon
- Use appropriate file format
- Partition data properly

### Issue: Excessive Shuffle

**Symptoms:**
- High network I/O
- Long shuffle phases
- Disk spills

**Solutions:**
- Reduce shuffle partitions
- Use broadcast joins
- Filter before joins
- Repartition strategically

## Performance Checklist

### Configuration
- [ ] Appropriate node type selected
- [ ] Right-sized worker count
- [ ] Photon enabled for SQL workloads
- [ ] Elastic disk enabled
- [ ] Autoscaling configured (if needed)
- [ ] Auto-termination enabled

### Data
- [ ] Using Delta Lake format
- [ ] Appropriate partitioning
- [ ] Regular OPTIMIZE jobs scheduled
- [ ] VACUUM scheduled
- [ ] Z-ORDER on filter columns

### Queries
- [ ] Early filtering (predicate pushdown)
- [ ] Column pruning enabled
- [ ] Appropriate join strategies
- [ ] Caching used effectively
- [ ] AQE enabled

### Monitoring
- [ ] Spark UI reviewed regularly
- [ ] Query profiles analyzed
- [ ] Cluster metrics monitored
- [ ] Cost tracking in place

## Tools and Commands

```bash
# Check cluster status
databricks clusters get --cluster-id <id>

# View cluster metrics
databricks clusters events --cluster-id <id>

# List running clusters
databricks clusters list | grep RUNNING

# Get cluster event logs
databricks clusters events --cluster-id <id> --output json
```

## Further Reading

- [Databricks Performance Tuning Guide](https://docs.databricks.com/en/performance/index.html)
- [Delta Lake Performance](https://docs.databricks.com/en/delta/optimizations/index.html)
- [Photon Documentation](https://docs.databricks.com/en/compute/photon.html)
- [Best Practices](https://docs.databricks.com/en/best-practices/index.html)
