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
    ...(status.modifiedComponents || []),
  ].map((componentId: string) => {
    const label = `${componentId}@auto`;
    core.info(`Processing label: ${label}`);
    return label;
  });

  // Get existing labels on the PR
  const octokit = getOctokit(githubToken);
  const { data: prLabels } = await octokit.rest.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: prNumber,
  });

  // Define the version pattern
  const versionPattern = /@(major|minor|patch|auto)$/;

  // Identify labels to remove
  const labelsToRemove = prLabels
    .filter((prLabel) => {
      return (
        versionPattern.test(prLabel.name) &&
        !versionLabels.some(
          (versionLabel) =>
            versionLabel.split("@")[0] === prLabel.name.split("@")[0]
        )
      );
    })
    .map((prLabel) => prLabel.name);

  // Remove labels that match the version pattern and are not in versionLabels
  if (labelsToRemove.length > 0) {
    core.info(
      `Removing labels from PR #${prNumber}: ${labelsToRemove.join(", ")}`
    );
    for (const label of labelsToRemove) {
      await octokit.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: prNumber,
        name: label,
      });
    }
  }

  // Get all labels in the repository
  const { data: repoLabels } = await octokit.rest.issues.listLabelsForRepo({
    owner,
    repo,
  });

  const newLabelsToAdd = versionLabels.filter((label) => {
    return !prLabels.some(
      (existingLabel) =>
        existingLabel.name.split("@")[0] === label.split("@")[0]
    );
  });

  // Determine which labels need to be created in the repository
  const newLabelsToCreate = newLabelsToAdd.filter(
    (label) => !repoLabels.some((repoLabel) => repoLabel.name === label) // Labels not in the repository
  );

  // Check if adding new labels will exceed the limit
  const currentLabelCount = prLabels.length;
  const totalLabelCount = currentLabelCount + newLabelsToAdd.length;

  if (totalLabelCount > 100) {
    const availableSpace = 100 - currentLabelCount;
    core.warning(`
      Unable to create version labels: Adding ${
        newLabelsToAdd.length
      } labels would exceed the limit of 100.
      You can only add ${availableSpace} more component version labels to this pull request.
      New components: ${status.newComponents?.length || 0}
      Modified components: ${status.modifiedComponents?.length || 0}
      Please manage version bumps globally by adding [major], [minor] or [patch] label for this pull request.
    `);
    return;
  }

  core.info(
    `Creating ${newLabelsToCreate.length} new labels in the repository`
  );

  // Create GitHub labels if they do not exist
  for (const label of newLabelsToCreate) {
    try {
      core.info(`Creating GitHub label: ${label}`);
      await octokit.rest.issues.createLabel({
        owner,
        repo,
        name: label,
        color: "6f42c1",
      });
    } catch (error: any) {
      // Handle unexpected errors
      core.error(`Failed to create label ${label}: ${error.message}`);
    }
  }

  // Add all new labels to the PR in one call
  if (newLabelsToAdd.length > 0) {
    core.info(`Adding labels to PR #${prNumber}`);
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: prNumber,
      labels: newLabelsToAdd, // Pass the filtered array of labels
    });
  } else {
    core.info("No new labels to add to the PR.");
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

  await exec("bit", ["status", "--json"], {
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

  await exec("bit", ["lane", "create", laneName, ...args], { cwd: wsDir });
  const snapMessageText = await createSnapMessageText(
    githubToken,
    repo,
    owner,
    prNumber
  );

  const buildFlag = process.env.RIPPLE === "true" ? [] : ["--build"];
  await exec("bit", ["snap", "-m", snapMessageText, ...buildFlag, ...args], {
    cwd: wsDir,
  });

  try {
    await exec(
      "bit",
      [
        "lane",
        "remove",
        `${org}.${scope}/${laneName}`,
        "--remote",
        "--silent",
        "--force",
        ...args,
      ],
      { cwd: wsDir }
    );
  } catch (error) {
    console.log(`Cannot remove bit lane: ${error}. Lane may not exist`);
  }
  await exec("bit", ["export", ...args], { cwd: wsDir });

  postOrUpdateComment(githubToken, repo, owner, prNumber, laneName);
}
