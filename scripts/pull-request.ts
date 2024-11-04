import { exec, ExecOptions } from "@actions/exec";
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
) => {
  console.log("Tagging to get the sem version bumps. Note: This task won't export these tags to bit.cloud");
  
  // Run bit tag command
  await exec('bit', ['tag', '-m', 'tagging to get version bumps']);
  
  // Get status after tagging
  let statusRaw = "";
  await exec("bit", ['status', '--json'], {
    listeners: {
      stdout: (data: Buffer) => {
        statusRaw += data.toString();
      },
    },
  });

  const status = JSON.parse(statusRaw.trim());
  
  // Create version labels array
  const versionLabels = status.stagedComponents?.map((component: any) => {
    const versions = component.versions;
    const latestVersion = versions[versions.length - 1];
    return `${component.id}@${latestVersion}`;
  }) || [];

  // Create GitHub labels
  const octokit = getOctokit(githubToken);
  
  for (const label of versionLabels) {
    try {
      await octokit.rest.issues.createLabel({
        owner,
        repo,
        name: label,
        color: "0366d6", // GitHub blue color
      });
    } catch (error: any) {
      // If label already exists, ignore the error
      if (error.status !== 422) {
        throw error;
      }
    }

    // Add label to PR
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: prNumber,
      labels: [label],
    });
  }
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

  if (status.newComponents?.length || status.modifiedComponents?.length) {
    await exec('bit', ['status', '--strict', ...args], { cwd: wsDir });
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
    if (versionLabel) {
      await createVersionLabels(githubToken, repo, owner, prNumber);
    }
  }
};
