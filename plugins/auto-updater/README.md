# Auto Updater Plugin

여러 marketplace에서 플러그인을 자동으로 설치하고 업데이트합니다.

## 동작

세션 시작 시 1시간 주기로 자동 실행:
- 새로운 플러그인이 있으면 자동 설치
- 설치된 플러그인의 업데이트가 있으면 자동 업데이트

## 설정

설정 파일: `~/.claude/auto-updater/config.json`

설정 파일이 없으면 자동으로 생성됩니다 (기본값: baleen-plugins 전체 플러그인).

### 설정 예시

```json
{
  "marketplaces": [
    {
      "name": "baleen-plugins",
      "source": "baleen37/claude-plugins"
    },
    {
      "name": "claude-plugins-official",
      "source": "anthropics/claude-plugins-official",
      "plugins": ["typescript-lsp", "pyright-lsp"]
    }
  ]
}
```

### 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | O | marketplace 고유 이름 |
| `source` | string | O | GitHub `owner/repo` 형식 |
| `include` | string/array | X | `"all"` 또는 플러그인 이름 배열 (생략 시 전체 설치) |

## 수동 실행

```bash
/update-all-plugins
```

또는:

```bash
"${CLAUDE_PLUGIN_ROOT}/plugins/auto-updater/scripts/update-checker.sh"
```

## 로그 확인

```bash
cat ~/.claude/auto-updater/update.log
```

## 초기화

```bash
rm -rf ~/.claude/auto-updater
```
