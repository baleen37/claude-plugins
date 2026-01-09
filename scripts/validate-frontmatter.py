#!/usr/bin/env python3
import re
import sys
from pathlib import Path

def extract_frontmatter(content):
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    return match.group(1) if match else None

def validate_skill_file(skill_file):
    with open(skill_file) as f:
        content = f.read()

    frontmatter = extract_frontmatter(content)
    if not frontmatter:
        print(f"❌ No frontmatter: {skill_file}")
        return False

    required = ['name', 'description']
    for field in required:
        if f'{field}:' not in frontmatter:
            print(f"❌ Missing field '{field}': {skill_file}")
            return False

    return True

def validate_md_file(md_file):
    """Command/Agent 파일의 frontmatter 구분자 검증"""
    with open(md_file) as f:
        content = f.read()

    frontmatter = extract_frontmatter(content)
    if not frontmatter:
        print(f"❌ No frontmatter: {md_file}")
        return False

    return True

def main():
    # SKILL.md 파일 검증
    skill_files = list(Path('.').rglob('SKILL.md'))
    for skill_file in skill_files:
        if not validate_skill_file(skill_file):
            return 1

    # Command 파일 검증
    command_files = list(Path('plugins').rglob('commands/**/*.md'))
    for command_file in command_files:
        if not validate_md_file(command_file):
            return 1

    # Agent 파일 검증
    agent_files = list(Path('plugins').rglob('agents/**/*.md'))
    for agent_file in agent_files:
        if not validate_md_file(agent_file):
            return 1

    total = len(skill_files) + len(command_files) + len(agent_files)
    print(f"✓ All {total} markdown files with frontmatter valid")
    return 0

if __name__ == '__main__':
    sys.exit(main())
