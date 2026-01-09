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

def main():
    skill_files = list(Path('.').rglob('SKILL.md'))
    if not skill_files:
        print("No SKILL.md files found")
        return 0

    for skill_file in skill_files:
        if not validate_skill_file(skill_file):
            return 1

    print(f"✓ All {len(skill_files)} SKILL.md files valid")
    return 0

if __name__ == '__main__':
    sys.exit(main())
