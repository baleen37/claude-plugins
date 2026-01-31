---
name: isolated-test-guide
description: Docker 컨테이너에서 Claude Code를 대화형으로 테스트
---

# Claude Isolated Test

격리된 Docker 환경에서 Claude Code를 실행합니다. tmux를 통한 세션 관리와 다양한 인증 방식을 지원합니다.

## 실행

```bash
"${CLAUDE_PLUGIN_ROOT}/plugins/me/skills/claude-isolated-test/shell.sh"
```

## 옵션

### 컨테이너 설정

- `-n, --name NAME` - 컨테이너 이름 (default: claude-dev)
- `-i, --image IMAGE` - Docker 이미지 이름 (default: claude-test:latest)
- `-w, --workspace DIR` - 워크스페이스 디렉토리 (default: 현재 디렉토리)

### tmux 세션 관리

- `-S, --session-name NAME` - tmux 세션 이름 (default: claude)
- `-l, --list-sessions` - 컨테이너 내 활성 tmux 세션 목록 출력
- `-k, --kill-session NAME` - 특정 tmux 세션 종료

### 컨테이너 제어

- `-s, --stop-only` - 컨테이너 정지 및 제거 (attach 없음)
- `-h, --help` - 도움말 표시

## 인증 방식

인증 토큰은 다음 우선순위로 검색됩니다:

1. **ANTHROPIC_API_KEY** - 표준 API 키 (CI/CD 권장)
2. **CLAUDE_CODE_OAUTH_TOKEN** - OAuth 토큰
3. **ANTHROPIC_AUTH_TOKEN** - OAuth 토큰 (대체)
4. **Keychain** - macOS Keychain의 `Claude Code-credentials`

인증 방식이 없으면 오류 메시지와 함께 설정 방법을 안내합니다.

## tmux 통합

### 세션 동작

- 컨테이너에 접속하면 tmux 세션이 자동으로 생성되거나 기존 세션에 연결됩니다
- 세션은 컨테이너 외부의 Docker 볼륨에 저장되어 컨테이너 재시작 후에도 유지됩니다
- 여러 tmux 세션을 동시에 실행할 수 있습니다

### tmux 단축키

- 떼어내기 (detach): `Ctrl+B` → `D`
- 세션 목록: `Ctrl+B` → `s`
- 새 창: `Ctrl+B` → `c`
- 창 전환: `Ctrl+B` → `0-9`

## 볼륨 마운트

- **/workspace** - 워크스페이스 디렉토리 (읽기/쓰기)
- **/tmux** - tmux 소켓 저장소 (Docker named volume)

tmux 소켓은 별도의 볼륨으로 저장되어 컨테이너 재시작 간 세션 상태가 유지됩니다.

## 사용 예시

### 기본 실행

```bash
./shell.sh
```

### 여러 세션 사용

```bash
# 첫 번째 세션
./shell.sh --session-name backend

# 두 번째 세션 (별도 터미널)
./shell.sh --session-name frontend

# 세션 목록 확인
./shell.sh --list-sessions

# 특정 세션 종료
./shell.sh --kill-session frontend
```

### 컨테이너 관리

```bash
# 컨테이너 정지
./shell.sh --stop-only

# API 키 사용
ANTHROPIC_API_KEY=sk-ant-xxx ./shell.sh
```
