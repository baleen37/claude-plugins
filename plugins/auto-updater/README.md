# Auto Updater Plugin

marketplace.json에 정의된 플러그인들을 자동으로 설치하고 업데이트합니다.

## 동작

세션 시작 시 1시간 주기로 자동 실행:
- 새로운 플러그인이 있으면 자동 설치
- 설치된 플러그인이 있으면 업데이트

## 수동 실행

```bash
/update-all-plugins
```

또는:

```bash
"${CLAUDE_PLUGIN_ROOT}/plugins/auto-updater/scripts/update.sh"
```

업데이트 가능한 플러그인만 확인하려면:

```bash
"${CLAUDE_PLUGIN_ROOT}/plugins/auto-updater/scripts/check.sh"
```

## 로그 확인

```bash
cat ~/.claude/auto-updater/update.log
```

## 초기화

```bash
rm -rf ~/.claude/auto-updater
```
