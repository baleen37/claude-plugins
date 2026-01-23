# Conflict Detection False Positive 버그 수정

## 문제 요약

**발견된 버그:** `conflict-check.sh`와 `pr-check.sh`가 `grep "CONFLICT"` 패턴을 사용하여 소스 코드에 "CONFLICT" 문자열이 포함된 경우에도 false positive를 발생시킴.

**영향:** 코드에 `CONFLICT`, `ERROR_MESSAGES.CONFLICT`, `handleConflict()` 같은 정상적인 코드가 있어도 merge conflict로 오인.

## 근본 원인

1. **잘못된 패턴:** `grep "CONFLICT"`는 너무 광범위
2. **git merge-tree 출력 이해 부족:**
   - `added in remote`: 한쪽에만 추가된 파일 (충돌 아님)
   - `changed in both`: 양쪽에서 수정 (**실제 충돌**)
   - `added in both` + conflict markers: 양쪽에서 추가, 내용 다름 (**실제 충돌**)
   - `+<<<<<<< .our`: diff에서의 conflict marker (**실제 충돌**)

## TDD 접근

### RED 단계

7개 테스트 작성, 그 중 3개 실패:
- ✗ "CONFLICT" 문자열 포함 코드에서 false positive
- ✗ "added in both" 파일을 충돌로 오인
- ✗ 문서의 conflict marker 예제를 충돌로 오인

### GREEN 단계

**conflict-check.sh 수정:**
```bash
# 기존 (잘못됨)
if echo "$CONFLICTS" | grep -q "CONFLICT"; then

# 수정 후 (올바름)
if echo "$CONFLICTS" | grep -q "^changed in both" || echo "$CONFLICTS" | grep -q "^+<<<<<<< "; then
```

**pr-check.sh 수정:**
```bash
# 기존 (잘못됨)
if git merge-tree "$MERGE_BASE" HEAD origin/"$BASE" 2>&1 | grep -q "CONFLICT"; then

# 수정 후 (올바름)
MERGE_OUTPUT=$(git merge-tree "$MERGE_BASE" HEAD origin/"$BASE" 2>&1)
HAS_CONFLICT=false
if echo "$MERGE_OUTPUT" | grep -q "^changed in both"; then
    HAS_CONFLICT=true
elif echo "$MERGE_OUTPUT" | grep -q "^added in both" && echo "$MERGE_OUTPUT" | grep -q "^+<<<<<<< "; then
    HAS_CONFLICT=true
fi
```

### 검증

- ✓ conflict-check.sh: 7/7 테스트 통과
- ✓ pr-check.sh: 4/4 테스트 통과
- ✓ 전체 테스트 스위트: 112/112 통과 (회귀 없음)

## 테스트 케이스

### 1. False Positive 방지
```javascript
// 이제 이런 코드가 충돌로 오인되지 않음
const ERROR_MESSAGES = {
    CONFLICT: "Resource conflict detected",
    NOT_FOUND: "Resource not found"
};
```

### 2. True Positive 감지
```
# 실제 충돌은 올바르게 감지됨
changed in both
  base   100644 hash file.txt
  our    100644 hash file.txt
  their  100644 hash file.txt
@@ -1 +1,5 @@
+<<<<<<< .our
 feature version
+=======
 main version
+>>>>>>> .their
```

### 3. Added in Both (No Conflict)
```
# 양쪽에 다른 파일 추가 - 충돌 아님
added in remote
  their  100644 hash other.js
```

### 4. Added in Both (With Conflict)
```
# 양쪽에 같은 파일을 다른 내용으로 추가 - 충돌
added in both
  our    100644 hash shared.txt
  their  100644 hash shared.txt
@@ -1,3 +1,7 @@
+<<<<<<< .our
 Feature change
+=======
 Main change
+>>>>>>> .their
```

## 파일 변경 사항

- `/plugins/me/skills/create-pr/scripts/conflict-check.sh`: 충돌 감지 로직 개선
- `/plugins/me/skills/create-pr/scripts/pr-check.sh`: 충돌 경고 로직 개선
- `/tests/conflict-check.bats`: 새로운 테스트 파일 (7개 테스트)
- `/tests/pr-check.bats`: 새로운 테스트 파일 (4개 테스트)

## 교훈

1. **TDD의 중요성:** 테스트 없이는 이 버그를 발견하기 어려웠을 것
2. **도구 출력 이해:** git merge-tree의 정확한 출력 형식 이해 필요
3. **Edge Cases:** "added in both"가 충돌일 수도, 아닐 수도 있음
4. **패턴 정확성:** `grep "CONFLICT"`보다 `grep "^changed in both"` 같은 구체적 패턴 필요

## 검증 방법

```bash
# 테스트 실행
bats tests/conflict-check.bats
bats tests/pr-check.bats

# 전체 테스트 스위트
bats tests/
```
