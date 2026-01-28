# Databricks MCP Plugin

Databricks를 Claude Code와 통합하는 플러그인입니다. 공식 Databricks MCP 서버를 통해 SQL 쿼리 실행, 벡터 검색, 클러스터 관리, Unity Catalog 함수 실행을 할 수 있습니다.

## Installation instructions

### 1. 플러그인 설치

Claude Code에서 플러그인을 설치합니다:

```bash
# Claude Code CLI를 사용하는 경우
claude-code plugin install baleen-plugins/databricks

# 또는 marketplace에서 직접 설치
```

### 2. Claude Code 설정 구성

Claude Code의 MCP 서버 설정에서 Databricks 서버를 구성해야 합니다.

**환경 변수 설정 (.zshrc 또는 .bashrc):**

```bash
# OAuth 2.0 사용 시
export DATABRICKS_WORKSPACE_HOSTNAME="your-workspace.cloud.databricks.com"

# PAT 사용 시
export DATABRICKS_WORKSPACE_HOSTNAME="your-workspace.cloud.databricks.com"
export DATABRICKS_TOKEN="dapi1234567890abcdef..."
```

**MCP 서버 구성 (Claude Code 설정):**

`.mcp.json` 파일에 다음을 추가합니다:

```json
{
  "mcpServers": {
    "databricks-sql": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://your-workspace.cloud.databricks.com/api/2.0/mcp/sql"],
      "env": {
        "DATABRICKS_TOKEN": "${DATABRICKS_TOKEN}"
      }
    },
    "databricks-vector": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://your-workspace.cloud.databricks.com/api/2.0/mcp/vector-search/catalog_name/schema_name"],
      "env": {
        "DATABRICKS_TOKEN": "${DATABRICKS_TOKEN}"
      }
    },
    "databricks-uc": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://your-workspace.cloud.databricks.com/api/2.0/mcp/uc-functions"],
      "env": {
        "DATABRICKS_TOKEN": "${DATABRICKS_TOKEN}"
      }
    }
  }
}
```

참고: `<workspace-hostname>`, `<catalog>`, `<schema>`를 실제 값으로 교체해야 합니다.

## Authentication setup

플러그인은 `mcp-remote` 프록시를 통해 Databricks MCP 서버에 연결합니다. 인증 방법은 OAuth 2.0 또는 Personal Access Token (PAT) 중 선택할 수 있습니다.

### OAuth 2.0 (권장)

OAuth 2.0은 더 안전하고 토큰 관리가 자동화됩니다.

1. Databricks 작업공간에서 OAuth 앱 등록이 필요합니다
2. Claude Code 설정에서 MCP 서버 URL을 구성합니다
3. 처음 실행 시 브라우저가 열리고 OAuth 인증이 진행됩니다
4. 토큰이 자동으로 캐시되어 재인증 불필요

### Personal Access Token (PAT)

PAT을 사용하여 직접 인증할 수 있습니다.

1. Databricks 작업공간에서 PAT 생성: `User Settings -> Developer -> Generate new token`
2. Claude Code 설정에서 토큰을 환경 변수로 구성합니다

## Available tools list

이 플러그인은 3개의 Databricks MCP 서버와 통신합니다.

### SQL Server (databricks-sql)

SQL 쿼리 실행과 Warehouse 관리를 담당합니다.

- `mcp__databricks__execute_sql`: SQL 쿼리 실행
- `mcp__databricks__list_warehouses`: SQL Warehouse 목록 조회
- `mcp__databricks__get_warehouse_info`: 특정 Warehouse 상세 정보 조회

엔드포인트: `https://<workspace-hostname>/api/2.0/mcp/sql`

### Vector Search Server (databricks-vector)

Mosaic AI Vector Search를 위한 서버입니다.

- `mcp__databricks__vector_search`: 벡터 유사도 검색
- `mcp__databricks__list_indexes`: 벡터 인덱스 목록 조회

엔드포인트: `https://<workspace-hostname>/api/2.0/mcp/vector-search/{catalog}/{schema}`

### Unity Catalog Server (databricks-uc)

Unity Catalog 함수 관리를 위한 서버입니다.

- `mcp__databricks__list_functions`: UC 함수 목록 조회
- `mcp__databricks__execute_function`: UC 함수 실행

엔드포인트: `https://<workspace-hostname>/api/2.0/mcp/uc-functions`

## Usage examples

### SQL 쿼리 실행

```text
"sales 테이블에서 지난달 총 매출을 조회해줘"
```

```text
"SELECT customer_id, SUM(amount) as total FROM orders WHERE date >= '2024-01-01' GROUP BY customer_id ORDER BY total DESC LIMIT 10 쿼리를 실행해줘"
```

### 벡터 검색

```text
"'고객 서비스 개선'과 관련된 티켓들을 벡터 검색으로 찾아줘"
```

```text
"embeddings 테이블에서 이 텍스트와 가장 유사한 상위 5개 항목을 찾아줘"
```

### 클러스터 상태 확인

```text
"사용 가능한 SQL Warehouse 목록을 보여줘"
```

```text
"warehouse_id가 12345인 웨어하우스의 상태와 크기를 확인해줘"
```

### Unity Catalog 함수 실행

```text
"Unity Catalog에 등록된 함수 목록을 보여줘"
```

```text
"catalog.schema.calculate_revenue 함수를 실행해서 2024년 1월 데이터를 가져와줘"
```
