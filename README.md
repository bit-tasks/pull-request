# Verify Components in a Pull Request for CI/CD Pipelines
Verify the pull request along with the modifications for the Bit components.

# GitHub Actions

This task creates a Bit lane and adds the component changes for you to verify any components inside a Pull request.

## Inputs

### `ws-dir`

**Optional** The workspace directory path from the root. Default `"Dir specified in Init Task or ./"`.

### `version-labels`

**Optional** When set to true, adds labels to the PR with component versions. Default `false`. Available in `v2` and later versions.

The labels are automatically added in the format `component-name@auto` for all new and modified components. The complete component id including org and scope (e.g `bit-tasks.test-scope/ui/hello-world`) is added to the label description. You can then modify these labels in the PR to control version bumping:

- `component-name@auto` - Uses the default 'patch' bump or automatically uses the version bump specified through:
  - Pull Request Labels: Use the keyword directly (e.g., `major`) or enclosed within square brackets (e.g., `[major]`)
  - Pull Request or Commit Title: Include the version keyword in square brackets (e.g., `feature: new button [major]`)
- `component-name@patch` - Forces a patch version bump
- `component-name@minor` - Forces a minor version bump
- `component-name@major` - Forces a major version bump

Supported version keywords are: `major`, `minor`, and `patch`.

Example:
- Initial auto-added label: `ui/button@auto`
- Modified to force minor bump: `ui/button@minor`

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
          version-labels: true  # Optional: Add version labels to PR
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
