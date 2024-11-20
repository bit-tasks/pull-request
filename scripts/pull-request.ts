import { exec } from "@actions/exec";
import { getOctokit } from "@actions/github";
import * as core from "@actions/core";

const createSnapMessageText = async (
  githubToken: string,
  repo: string,
  owner: string,
  prNumber: number
) => {
  const octokit = getOctokit(githubToken);

  let messageText = "CI";

  const { data: pr } = await octokit.rest.pulls.get({
    owner: owner,
    repo: repo,
    pull_number: prNumber,
  });

  const prTitle = pr.title;
  core.info("PR title: " + prTitle);

  if (prTitle) {
    messageText = prTitle;
  } else {
    const { data: commits } = await octokit.rest.pulls.listCommits({
      owner: owner,
      repo: repo,
      pull_number: prNumber,
    });

    if (commits.length > 0) {
      messageText = commits[commits.length - 1].commit.message;
      core.info("Last commit message: " + messageText);
    }
  }

  core.info("Snap message Text: " + messageText);
  return messageText;
};

const postOrUpdateComment = async (
  githubToken: string,
  repo: string,
  owner: string,
  prNumber: number,
  laneName: string
) => {
  const laneLink = `https://bit.cloud/${process.env.ORG}/${process.env.SCOPE}/~lane/${laneName}`;
  let commentIntro = `⚠️ Please review the changes in the Bit lane: ${laneLink}`;

  const octokit = getOctokit(githubToken);
  const comments = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
  });

  const existingComment = comments.data.find(
    (comment) =>
      comment.body?.includes("https://bit.cloud") &&
      comment.user?.login === "github-actions[bot]"
  );

  if (existingComment) {
    const updatedBody = `${commentIntro}\n\n_Lane updated: ${getHumanReadableTimestamp()}_`;
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body: updatedBody,
    });
  } else {
    const newBody = `${commentIntro}\n\n_Lane created: ${getHumanReadableTimestamp()}_`;
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: newBody,
    });
  }
};

const getHumanReadableTimestamp = () => {
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  };

  return new Date().toLocaleString("en-US", options as any) + " UTC";
};

const createVersionLabels = async (
  githubToken: string,
  repo: string,
  owner: string,
  prNumber: number,
  status: any
) => {
  core.info("Creating version labels for new and modified components");
  
  // Create version labels array from new and modified components
  const versionLabels = [
    ...(status.newComponents || []),
    ...(status.modifiedComponents || [])
  ].map((componentId: string) => {
    const label = `${componentId}@auto`;
    core.info(`Creating label: ${label}`);
    return label;
  });

  // Check if number of labels exceeds GitHub's limit, keeping a buffer of 10 labels for administration
  if (versionLabels.length > 90) {
    core.warning(`
      Unable to create version labels: Too many components affected (${versionLabels.length}).
      New components: ${status.newComponents?.length || 0}
      Modified components: ${status.modifiedComponents?.length || 0}
      Please manage version bumps globally by adding [major], [minor] or [patch] label for this pull request.
    `);
    return;
  }

  core.info(`Creating ${versionLabels.length} version labels`);
  
  // Create GitHub labels
  const octokit = getOctokit(githubToken);
  
  for (const label of versionLabels) {
    try {
      core.info(`Creating GitHub label: ${label}`);
      await octokit.rest.issues.createLabel({
        owner,
        repo,
        name: label,
        color: "6f42c1",
      });
    } catch (error: any) {
      if (error.status !== 422) {
        throw error;
      }
      core.info(`Label ${label} already exists`);
    }
  }

  // Add all labels to the PR in one call
  core.info(`Adding labels to PR #${prNumber}`);
  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: prNumber,
    labels: versionLabels
  });
};

export default async function run(
  githubToken: string,
  repo: string,
  owner: string,
  prNumber: number,
  laneName: string,
  versionLabel: boolean,
  wsDir: string,
  args: string[]
) {
  const org = process.env.ORG;
  const scope = process.env.SCOPE;

  let statusRaw = "";

  await exec("bit", ['status', '--json'], {
    cwd: wsDir,
    listeners: {
      stdout: (data: Buffer) => {
        statusRaw += data.toString();
      },
    },
  }); // Avoid log param, since output is parsed for next steps

  const status = JSON.parse(statusRaw.trim());

  if (versionLabel) {
    await createVersionLabels(githubToken, repo, owner, prNumber, status);
  }

  await exec('bit', ['lane', 'create', laneName, ...args], { cwd: wsDir });
  const snapMessageText = await createSnapMessageText(githubToken, repo, owner, prNumber);

  const buildFlag = process.env.RIPPLE === "true" ? [] : ["--build"]
  await exec('bit', ['snap', '-m', snapMessageText, ...buildFlag, ...args], { cwd: wsDir });
  
  try {
    await exec('bit', ['lane', 'remove', `${org}.${scope}/${laneName}`, '--remote', '--silent', '--force', ...args], { cwd: wsDir });
  } catch (error) {
    console.log(`Cannot remove bit lane: ${error}. Lane may not exist`);
  }
  await exec('bit', ['export', ...args], { cwd: wsDir });

  postOrUpdateComment(githubToken, repo, owner, prNumber, laneName);
};
