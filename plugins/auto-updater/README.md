# Auto Updater Plugin

Automatic plugin installation and updates from baleen-plugins marketplace based on version policies.

## What is Auto Updater?

Auto Updater는 marketplace.json에 정의된 플러그인들을 자동으로 설치하고, 버전 정책에 따라 업데이트를 관리하는 플러그인입니다.

세션 시작 시 6시간 주기로 자동 실행되며, 사용자 개입 없이 marketplace에서 새로운 플러그인을 설치하거나 기존 플러그인을 업데이트합니다.

## 주요 기능

### 1. marketplace.json 기반 자동 설치
- marketplace.json에 등록된 플러그인이 설치되지 않은 경우 자동 설치
- 새로운 플러그인이 marketplace에 추가되면 다음 세션 시작 시 자동 감지 및 설치

### 2. 버전 비교 후 자동 업데이트
- semantic versioning (major.minor.patch) 기반 버전 비교
- 설치된 버전과 marketplace 버전 비교
- 업데이트 정책에 따라 자동 업데이트 수행

### 3. 업데이트 정책 설정
- `patch`: 패치 버전 업데이트만 허용 (1.2.3 → 1.2.4)
- `minor`: 마이너 버전 업데이트까지 허용 (1.2.3 → 1.3.0)
- `major`: 모든 버전 업데이트 허용 (1.2.3 → 2.0.0)
- `none`: 자동 업데이트 비활성화 (신규 설치는 허용)

## 동작 방식

### SessionStart Hook
- 세션 시작 시 자동 실행 (`hooks/auto-update-hook.sh`)
- 마지막 체크 시간 확인 후 6시간이 경과했을 때만 실행
- 백그라운드에서 조용히 실행 (silent mode)

### 타임스탬프 관리
- 마지막 체크 시간: `~/.claude/auto-updater/last-check`
- Unix timestamp 형식으로 저장
- 6시간 (21600초) 간격으로 체크 실행

### 업데이트 프로세스
1. marketplace.json 파일 읽기
2. 설치된 플러그인 목록 조회 (`claude plugin list`)
3. 각 플러그인에 대해:
   - 미설치: 자동 설치
   - 설치됨: 버전 비교 후 정책에 따라 업데이트 또는 스킵
4. 타임스탬프 업데이트

## 설정

### 설정 파일 위치
```
~/.claude/auto-updater/config.json
```

### 설정 파일 구조
```json
{
  "auto_update_policy": "patch"
}
```

### 기본값
- **Policy**: `patch` (패치 버전만 자동 업데이트)
- **Check Interval**: 6시간 (21600초)

### 정책별 동작 설명

#### `patch` (기본값)
- 동일한 major.minor 버전 내에서만 업데이트
- 예시:
  - ✅ 1.2.3 → 1.2.4 (허용)
  - ✅ 1.2.3 → 1.2.10 (허용)
  - ❌ 1.2.3 → 1.3.0 (차단)
  - ❌ 1.2.3 → 2.0.0 (차단)

#### `minor`
- 동일한 major 버전 내에서만 업데이트
- 예시:
  - ✅ 1.2.3 → 1.2.4 (허용)
  - ✅ 1.2.3 → 1.3.0 (허용)
  - ✅ 1.2.3 → 1.99.0 (허용)
  - ❌ 1.2.3 → 2.0.0 (차단)

#### `major`
- 모든 버전 업데이트 허용
- 예시:
  - ✅ 1.2.3 → 1.2.4 (허용)
  - ✅ 1.2.3 → 1.3.0 (허용)
  - ✅ 1.2.3 → 2.0.0 (허용)
  - ✅ 1.2.3 → 99.0.0 (허용)

#### `none`
- 자동 업데이트 비활성화
- 신규 플러그인 설치는 계속 수행됨
- 예시:
  - ❌ 모든 업데이트 차단
  - ✅ 신규 플러그인은 설치

### 정책 변경 방법

설정 파일을 직접 편집:
```bash
# 설정 파일 생성/편집
mkdir -p ~/.claude/auto-updater
cat > ~/.claude/auto-updater/config.json << EOF
{
  "auto_update_policy": "minor"
}
EOF
```

또는 jq를 사용하여 수정:
```bash
# minor 정책으로 변경
jq '.auto_update_policy = "minor"' ~/.claude/auto-updater/config.json > tmp.json && mv tmp.json ~/.claude/auto-updater/config.json

# major 정책으로 변경
jq '.auto_update_policy = "major"' ~/.claude/auto-updater/config.json > tmp.json && mv tmp.json ~/.claude/auto-updater/config.json

# 자동 업데이트 비활성화
jq '.auto_update_policy = "none"' ~/.claude/auto-updater/config.json > tmp.json && mv tmp.json ~/.claude/auto-updater/config.json
```

## 수동 실행

자동 실행 외에도 수동으로 업데이트를 실행할 수 있습니다.

### `/update` 명령어 (권장)
```
/update
```
- Claude Code에서 `/update` 명령어를 실행하면 즉시 업데이트 체크를 수행합니다
- 6시간 간격 제한을 무시하고 즉시 실행됩니다
- 업데이트 결과를 자동으로 보고합니다

### 스크립트 직접 실행
```bash
# 업데이트 체크 및 실행
"${CLAUDE_PLUGIN_ROOT}/plugins/auto-updater/scripts/update-checker.sh"
```

### 체크만 수행 (실제 설치/업데이트는 하지 않음)
```bash
# dry-run 모드
"${CLAUDE_PLUGIN_ROOT}/plugins/auto-updater/scripts/update-checker.sh" --check-only
```

### 조용한 모드
```bash
# 로그 출력 억제
"${CLAUDE_PLUGIN_ROOT}/plugins/auto-updater/scripts/update-checker.sh" --silent
```

### 강제 실행 (6시간 간격 무시)
```bash
# 방법 1: /update 명령어 사용 (권장)
/update

# 방법 2: 타임스탬프를 삭제
rm ~/.claude/auto-updater/last-check
# 다음 세션 시작 시 즉시 체크 수행
```

## 문제 해결

### 로그 확인

Auto Updater는 기본적으로 silent 모드로 실행되므로 로그를 보려면:

```bash
# 수동 실행 시 로그 출력
"${CLAUDE_PLUGIN_ROOT}/plugins/auto-updater/scripts/update-checker.sh"
```

로그 메시지 예시:
```
[auto-updater] Using update policy: patch
[auto-updater] Installing new plugin: example-plugin@1.0.0
[auto-updater] Updating plugin: ralph-loop (1.2.3 → 1.2.4)
[auto-updater] Update available for git-guard (1.3.0 → 2.0.0) but blocked by patch policy
```

### 업데이트가 실행되지 않는 경우

1. **6시간이 경과했는지 확인**
   ```bash
   # 마지막 체크 시간 확인
   date -r ~/.claude/auto-updater/last-check
   ```

2. **즉시 실행 (권장)**
   ```
   /update
   ```

3. **타임스탬프 초기화**
   ```bash
   # 타임스탬프 삭제하여 다음 세션에서 즉시 실행되도록 설정
   rm ~/.claude/auto-updater/last-check
   ```

3. **CLAUDE_PLUGIN_ROOT 환경 변수 확인**
   ```bash
   echo "$CLAUDE_PLUGIN_ROOT"
   # 출력이 비어있으면 플러그인 환경이 제대로 설정되지 않은 것
   ```

4. **marketplace.json 파일 확인**
   ```bash
   # marketplace.json 존재 여부 확인
   cat "${CLAUDE_PLUGIN_ROOT}/../../.claude-plugin/marketplace.json"
   ```

### 특정 플러그인 업데이트가 차단되는 경우

정책에 의해 차단된 경우:
```bash
# 로그에서 차단 메시지 확인
[auto-updater] Update available for plugin-name (1.0.0 → 2.0.0) but blocked by patch policy

# 해결 방법 1: 정책 변경
jq '.auto_update_policy = "major"' ~/.claude/auto-updater/config.json > tmp.json && mv tmp.json ~/.claude/auto-updater/config.json

# 해결 방법 2: 수동 업데이트
claude plugin install plugin-name@baleen-plugins
```

### 자동 업데이트 완전 비활성화

```bash
# none 정책으로 변경
mkdir -p ~/.claude/auto-updater
cat > ~/.claude/auto-updater/config.json << EOF
{
  "auto_update_policy": "none"
}
EOF
```

### 초기화

모든 설정을 초기화하려면:
```bash
# 설정 디렉토리 전체 삭제
rm -rf ~/.claude/auto-updater

# 다음 세션 시작 시 기본 설정으로 재시작
```

## Architecture

### Hook 메커니즘
- `hooks/auto-update-hook.sh`: SessionStart 이벤트에 연결
- 24시간 간격 체크를 통해 불필요한 실행 방지
- 백그라운드 실행으로 세션 시작 속도에 영향 없음

### 버전 비교 라이브러리
- `scripts/lib/version-compare.sh`: semantic versioning 비교 로직
- `version_lt()`: 두 버전 비교
- `should_update()`: 정책에 따른 업데이트 허용 여부 판단

### 상태 관리
- 설정: `~/.claude/auto-updater/config.json`
- 타임스탬프: `~/.claude/auto-updater/last-check`
- 플러그인 목록: `claude plugin list` 명령 사용

## Security Considerations

- Marketplace URL은 `baleen-plugins`로 고정되어 신뢰할 수 있는 소스만 사용
- 업데이트 정책을 통해 의도하지 않은 breaking change 방지
- Silent 실패: 업데이트 실패 시 세션 시작을 방해하지 않음
- 타임스탬프 기반 실행으로 과도한 네트워크 요청 방지
