# Verify Components in a Pull Request for CI/CD Pipelines
Verify the pull request along with the modifications for the Bit components.

# GitHub Actions

This task creates a Bit lane and adds the component changes for you to verify any components inside a Pull request.

## Inputs

### `ws-dir`

**Optional** The workspace directory path from the root. Default `"Dir specified in Init Task or ./"`.

### `version-labels`

**Optional** When set to true, adds labels to the PR with component versions. Default `false`. Available in v2+.

The labels are automatically added in the format `component-id@inherit` for all new and modified components. You can then modify these labels in the PR to control version bumping:

- `org.scope/component@inherit` - Uses the default 'patch' bump or inherits the version bump specified through:
  - Pull Request Labels: Use the keyword directly (e.g., `major`) or enclosed within square brackets (e.g., `[major]`)
  - Pull Request or Commit Title: Include the version keyword in square brackets (e.g., `feat: new button [major]`)
- `org.scope/component@patch` - Forces a patch version bump
- `org.scope/component@minor` - Forces a minor version bump
- `org.scope/component@major` - Forces a major version bump

Supported version keywords are: `major`, `minor`, and `patch`.

Example:
- Initial auto-added label: `my-org.my-scope/ui/button@inherit`
- Modified to force minor bump: `my-org.my-scope/ui/button@minor`

## Example usage

**Note:** Use `bit-task/init@v1` as a prior step in your action before running `bit-tasks/pull-request@v2`.

```yaml
name: Test Bit Pull Request
on:
  pull_request:
    types:
      - opened
      - synchronize
permissions:
  pull-requests: write
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      GIT_USER_NAME: ${{ secrets.GIT_USER_NAME }}
      GIT_USER_EMAIL: ${{ secrets.GIT_USER_EMAIL }}
      BIT_CONFIG_ACCESS_TOKEN: ${{ secrets.BIT_CONFIG_ACCESS_TOKEN }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3
      - name: Initialize Bit
        uses: bit-tasks/init@v1
        with:
          ws-dir: '<WORKSPACE_DIR_PATH>'
      - name: Bit Pull Request
        uses: bit-tasks/pull-request@v2
        with:
          version-label: true  # Optional: Add version labels to PR
```

# Contributor Guide

Steps to create custom tasks in different CI/CD platforms.

## GitHub Actions

Go to the GithHub action task directory and build using NCC compiler. For example;

```
npm install
npm run build
git commit -m "Update task"
git tag -a -m "action release" v2 --force
git push --follow-tags
```

For more information, refer to [Create a javascript action](https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action)
