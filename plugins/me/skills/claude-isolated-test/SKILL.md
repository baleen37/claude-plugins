---
name: claude-isolated-test
description: Docker 컨테이너에서 Claude Code를 대화형으로 테스트
---

# Claude Isolated Test

격리된 Docker 환경에서 Claude Code를 실행합니다.

## 실행

```bash
./plugins/me/skills/claude-isolated-test/shell.sh
```

## 옵션

- `-n NAME` - 컨테이너 이름 (default: claude-dev)
- `-w DIR` - 워크스페이스 디렉토리 (default: 현재 디렉토리)
- `-s` - 컨테이너 정지

## tmux 단축키

- 떼어내기: `Ctrl+B` → `D`
