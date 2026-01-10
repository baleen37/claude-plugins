export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'ralph-loop',
        'git-guard',
        'me',
        'example-plugin',
        'release',
        'ci',
      ],
    ],
    'subject-case': [0],
    // Disable max line length for release commits (they contain long URLs)
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
  parserPreset: {
    parserOpts: {
      breakHeaderPattern: /^(?:(?<wip>WIP)|\w+):(?:\s.*)?\n\n(?<broken>.*)/s,
    },
  },
};
