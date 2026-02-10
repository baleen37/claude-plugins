# Databricks Cluster Policies Reference

## Overview

Cluster policies enforce governance and control over cluster creation. They restrict available options, enforce best practices, and ensure cost control across your organization.

## Policy Definition Structure

```json
{
  "name": "Policy Name",
  "description": "Policy description",
  "policy_family_id": "family_id_or_null",
  "definitions": [
    {
      "name": "setting_name",
      "type": "fixed|allowlist|blocklist|regex|hidden",
      "value": "default_value",
      "isEnabled": true|false,
      "hidden": true|false
    }
  ]
}
```

## Policy Types

### 1. Fixed

Enforces a specific value that users cannot change.

```json
{
  "name": "autotermination_minutes",
  "type": "fixed",
  "value": 30,
  "isEnabled": true
}
```

**Use cases:**
- Enforce auto-termination
- Set specific Spark version
- Force enable security features

### 2. Allowlist

Restricts users to predefined options.

```json
{
  "name": "node_type_id",
  "type": "allowlist",
  "value": "r5d.4xlarge,r5d.8xlarge",
  "isEnabled": true
}
```

**Use cases:**
- Limit node type selection
- Restrict available regions
- Control Spark versions

### 3. Blocklist

Prevents specific options while allowing others.

```json
{
  "name": "spark_version",
  "type": "blocklist",
  "value": "9.0.*,9.1.*",
  "isEnabled": true
}
```

**Use cases:**
- Block deprecated versions
- Prevent expensive node types
- Disallow specific configurations

### 4. Regex

Validates input against a pattern.

```json
{
  "name": "cluster_name",
  "type": "regex",
  "value": "^[a-z0-9-]+$",
  "isEnabled": true
}
```

**Use cases:**
- Enforce naming conventions
- Validate tag formats
- Ensure specific patterns

### 5. Hidden

Shows a value but prevents modification.

```json
{
  "name": "enable_elastic_disk",
  "type": "hidden",
  "value": "true",
  "isEnabled": true,
  "hidden": true
}
```

**Use cases:**
- Enable features automatically
- Set required parameters
- Hide complex settings

## Common Policy Settings

### Cluster Name

```json
{
  "name": "cluster_name",
  "type": "regex",
  "value": "^[a-z0-9-]{5,50}$",
  "isEnabled": true
}
```

### Auto-termination

```json
{
  "name": "autotermination_minutes",
  "type": "fixed",
  "value": 20,
  "isEnabled": true
}
```

### Node Type Restriction

```json
{
  "name": "node_type_id",
  "type": "allowlist",
  "value": "r5d.xlarge,r5d.2xlarge,r5d.4xlarge",
  "isEnabled": true
}
```

### Max Workers

```json
{
  "name": "max_num_workers",
  "type": "fixed",
  "value": 10,
  "isEnabled": true
}
```

### Spark Version

```json
{
  "name": "spark_version",
  "type": "allowlist",
  "value": "17.3.x-scala2.13,17.3.x-photon-scala2.13",
  "isEnabled": true
}
```

### Runtime Engine

```json
{
  "name": "runtime_engine",
  "type": "fixed",
  "value": "PHOTON",
  "isEnabled": true
}
```

### Spot Instances

```json
{
  "name": "spot_bid_price_percent",
  "type": "fixed",
  "value": 100,
  "isEnabled": true
}
```

### Cluster Tags

```json
{
  "name": "custom_tags",
  "type": "hidden",
  "value": "{\"Owner\": \"${workspace.current_user.userName}\", \"Department\": \"Data Science\"}",
  "isEnabled": true,
  "hidden": true
}
```

## Policy Families

Policy families provide pre-built templates for common use cases.

### Personal Compute

```json
{
  "name": "Personal Compute",
  "policy_family_id": "61E8EA35F2780248"
}
```

### Data Engineering

```json
{
  "name": "Data Engineering",
  "policy_family_id": "6D226CD3F5A308CD"
}
```

### ML Small

```json
{
  "name": "ML Small",
  "policy_family_id": "7F31D872F5260893"
}
```

### GPU Policy

```json
{
  "name": "GPU Policy",
  "policy_family_id": "4E9388A3F5397353"
}
```

## Complete Policy Examples

### Development Cluster Policy

```json
{
  "name": "Development Cluster Policy",
  "description": "Policy for development clusters with cost controls",
  "policy_family_id": "61E8EA35F2780248",
  "definitions": [
    {
      "name": "autotermination_minutes",
      "type": "fixed",
      "value": 20,
      "isEnabled": true
    },
    {
      "name": "node_type_id",
      "type": "allowlist",
      "value": "r5d.xlarge,r5d.2xlarge",
      "isEnabled": true
    },
    {
      "name": "max_num_workers",
      "type": "fixed",
      "value": 4,
      "isEnabled": true
    },
    {
      "name": "enable_elastic_disk",
      "type": "fixed",
      "value": true,
      "isEnabled": true
    },
    {
      "name": "aws_attributes.availability",
      "type": "fixed",
      "value": "SPOT_WITH_FALLBACK",
      "isEnabled": true
    }
  ]
}
```

### Production Cluster Policy

```json
{
  "name": "Production Cluster Policy",
  "description": "Policy for production clusters with governance",
  "definitions": [
    {
      "name": "cluster_name",
      "type": "regex",
      "value": "^prod-[a-z0-9-]+$",
      "isEnabled": true
    },
    {
      "name": "autotermination_minutes",
      "type": "fixed",
      "value": -1,
      "isEnabled": true
    },
    {
      "name": "spark_version",
      "type": "allowlist",
      "value": "17.3.x-scala2.13,17.3.x-photon-scala2.13",
      "isEnabled": true
    },
    {
      "name": "node_type_id",
      "type": "blocklist",
      "value": "*.xlarge",
      "isEnabled": true
    },
    {
      "name": "enable_elastic_disk",
      "type": "hidden",
      "value": true,
      "isEnabled": true
    },
    {
      "name": "runtime_engine",
      "type": "fixed",
      "value": "PHOTON",
      "isEnabled": true
    },
    {
      "name": "custom_tags",
      "type": "hidden",
      "value": "{\"Environment\": \"production\", \"CostCenter\": \"engineering\"}",
      "isEnabled": true
    }
  ]
}
```

### Cost-Controlled Policy

```json
{
  "name": "Cost-Controlled Policy",
  "description": "Enforces cost optimization best practices",
  "definitions": [
    {
      "name": "autotermination_minutes",
      "type": "fixed",
      "value": 30,
      "isEnabled": true
    },
    {
      "name": "aws_attributes.availability",
      "type": "fixed",
      "value": "SPOT_WITH_FALLBACK",
      "isEnabled": true
    },
    {
      "name": "aws_attributes.zone_id",
      "type": "allowlist",
      "value": "us-west-2a,us-west-2b",
      "isEnabled": true
    },
    {
      "name": "max_num_workers",
      "type": "fixed",
      "value": 8,
      "isEnabled": true
    },
    {
      "name": "enable_local_disk_encryption",
      "type": "hidden",
      "value": true,
      "isEnabled": true
    }
  ]
}
```

## Policy Management Commands

### List Policies

```bash
databricks cluster-policies list
```

### Get Policy Details

```bash
databricks cluster-policies get --policy-id 12345
```

### Create Policy

```bash
databricks cluster-policies create --json policy-config.json
```

### Update Policy

```bash
databricks cluster-policies edit --json policy-config.json --policy-id 12345
```

### Delete Policy

```bash
databricks cluster-policies delete --policy-id 12345
```

## Best Practices

### 1. Layer Policies

Start with policy families, then customize:

```json
{
  "policy_family_id": "61E8EA35F2780248",
  "definitions": [
    // Custom overrides
  ]
}
```

### 2. Use Tags for Cost Attribution

```json
{
  "name": "custom_tags",
  "type": "hidden",
  "value": "{\"Owner\": \"${workspace.current_user.userName}\"}"
}
```

### 3. Enforce Auto-Termination

Always set a reasonable timeout:

```json
{
  "name": "autotermination_minutes",
  "type": "fixed",
  "value": 30
}
```

### 4. Use Spot Instances for Development

```json
{
  "name": "aws_attributes.availability",
  "type": "fixed",
  "value": "SPOT_WITH_FALLBACK"
}
```

### 5. Limit Maximum Workers

Control costs by limiting cluster size:

```json
{
  "name": "max_num_workers",
  "type": "fixed",
  "value": 10
}
```

## Troubleshooting

### Policy Not Applied

**Check:**
1. Policy is enabled
2. User has permission to use policy
3. Policy definitions are valid JSON
4. Required fields are included

### Users Can Bypass Policy

**Fix:**
1. Remove admin privileges for policy enforcement
2. Set policy as "default" for all users
3. Disable policy-free cluster creation at workspace level

### Policy Too Restrictive

**Solution:**
1. Use allowlist instead of fixed for flexibility
2. Create multiple policies for different use cases
3. Use blocklist to prevent specific options while allowing others
