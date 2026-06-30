export default {
  // Use the standard Conventional Commits rules as the base.
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Restrict commits to the types used by this project.
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'doc',
        'style',
        'refactor',
        'perf',
        'test',
        'chore',
        'remove',
      ],
    ],
    // Keep the scope and summary lowercase.
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'always', 'lower-case'],
    // Commit summaries should not end with a period.
    'subject-full-stop': [2, 'never', '.'],
  },
};
