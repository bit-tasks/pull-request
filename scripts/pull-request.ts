import { exec, ExecOptions } from '@actions/exec'
import { getOctokit } from '@actions/github'
import * as core from '@actions/core'

/**
 *
 */
const createSnapMessageText = async (
  githubToken: string,
  repo: string,
  owner: string,
  prNumber: number
): Promise<string> => {
  const octokit = getOctokit(githubToken)

  let messageText = 'CI'

  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber
  })

  const prTitle = pr.title
  core.info(`PR title: ${prTitle}`)

  if (prTitle) {
    messageText = prTitle
  } else {
    const { data: commits } = await octokit.rest.pulls.listCommits({
      owner,
      repo,
      pull_number: prNumber
    })

    if (commits.length > 0) {
      messageText = commits[commits.length - 1].commit.message
      core.info(`Last commit message: ${messageText}`)
    }
  }

  core.info(`Snap message Text: ${messageText}`)
  return messageText
}

/**
 *
 */
const postOrUpdateComment = async (
  githubToken: string,
  repo: string,
  owner: string,
  prNumber: number,
  laneName: string
): Promise<void> => {
  const laneLink = `https://bit.cloud/${process.env.ORG}/${process.env.SCOPE}/~lane/${laneName}`
  const commentIntro = `⚠️ Please review the changes in the Bit lane: ${laneLink}`

  const octokit = getOctokit(githubToken)
  const comments = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber
  })

  const existingComment = comments.data.find(
    comment =>
      comment.body?.includes('https://bit.cloud') &&
      comment.user?.login === 'github-actions[bot]'
  )

  if (existingComment) {
    const updatedBody = `${commentIntro}\n\n_Lane updated: ${getHumanReadableTimestamp()}_`
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body: updatedBody
    })
  } else {
    const newBody = `${commentIntro}\n\n_Lane created: ${getHumanReadableTimestamp()}_`
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: newBody
    })
  }
}

/**
 *
 */
const getHumanReadableTimestamp = (): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC'
  }
  const date = new Date().toLocaleString('en-US', options)

  return `${date} UTC`
}

/**
 *
 */
const run = async (
  githubToken: string,
  repo: string,
  owner: string,
  prNumber: number,
  laneName: string,
  wsdir: string
): Promise<void> => {
  const org = process.env.ORG
  const scope = process.env.SCOPE

  let statusRaw = ''
  const options: ExecOptions = {
    cwd: wsdir,
    listeners: {
      stdout: (data: Buffer) => {
        statusRaw += data.toString()
      }
    }
  }

  await exec('bit status --json', [], options)
  const status = JSON.parse(statusRaw.trim())

  if (status.newComponents?.length || status.modifiedComponents?.length) {
    await exec('bit status --strict', [], { cwd: wsdir })
    await exec(`bit lane create ${laneName}`, [], { cwd: wsdir })
    const snapMessageText = await createSnapMessageText(
      githubToken,
      repo,
      owner,
      prNumber
    )
    await exec(`bit snap -m "${snapMessageText}" --build`, [], { cwd: wsdir })
    try {
      await exec(
        `bit lane remove ${org}.${scope}/${laneName} --remote --silent --force`,
        [],
        { cwd: wsdir }
      )
    } catch (error) {
      console.log(`Cannot remove bit lane: ${error}. Lane may not exist`)
    }
    await exec('bit export', [], { cwd: wsdir })

    postOrUpdateComment(githubToken, repo, owner, prNumber, laneName)
  }
}

export default run
