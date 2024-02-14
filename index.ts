import * as core from '@actions/core'
import { context } from '@actions/github'
import run from './scripts/pull-request'

try {
  const githubToken = process.env.GITHUB_TOKEN
  const wsDir: string = process.env.WSDIR!
  const prNumber = context?.payload?.pull_request?.number
  const { owner, repo } = context.repo

  if (!githubToken) {
    throw new Error('GitHub token not found')
  }

  if (!prNumber) {
    throw new Error('Pull Request number is not found')
  }

  const laneName = `pr-${prNumber?.toString()}`
  run(githubToken, repo, owner, prNumber, laneName, wsDir)
} catch (error) {
  core.setFailed((error as Error).message)
}
