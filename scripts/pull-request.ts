import { exec } from "@actions/exec";
import { getOctokit } from "@actions/github";
import * as core from "@actions/core";
import { scopeQuery } from "./graphql";

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

interface PaginatedRequestOptions {
  octokit: any;
  method: string;
  owner: string;
  repo: string;
  params: { [key: string]: any };
}

async function paginatedRequest<T>(
  opts: PaginatedRequestOptions
): Promise<T[]> {
  const { octokit, method, owner, repo, params } = opts;
  let page = 1;
  const perPage = 100;
  const results: T[] = [];
  let moreResultsExist = true;

  while (moreResultsExist) {
    const response = await octokit.request(method, {
      owner,
      repo,
      ...params,
      page,
      per_page: perPage,
    });

    const data = response.data;

    // Check if more results exist
    if (data.length === 0) {
      moreResultsExist = false;
    } else {
      results.push(...data);
      page++;
    }
  }

  return results;
}

interface Label {
  id: number;
  node_id: string;
  url: string;
  name: string;
  description: string | null;
  color: string;
  default: boolean;
}

const createVersionLabels = async (
  githubToken: string,
  repo: string,
  owner: string,
  prNumber: number,
  status: any,
  versionLabelsColors: { patch: string; minor: string; major: string },
  clearLabels: boolean
) => {
  if (clearLabels) {
    const versionLabels = ["patch", "minor", "major"];

    core.info("Clearing all Bit labels from the Pull Request");

    const octokit = getOctokit(githubToken);
    const prLabels = await paginatedRequest<Label>({
      octokit,
      method: "GET /repos/{owner}/{repo}/issues/{issue_number}/labels",
      owner,
      repo,
      params: { issue_number: prNumber },
    });

    // Remove all Bit labels from the Pull Request
    for (const label of prLabels) {
      if (
        label.name.endsWith("@patch") ||
        label.name.endsWith("@major") ||
        label.name.endsWith("@minor")
      ) {
        core.info(`Removing Bit label: ${label.name}`);
        await octokit.rest.issues.removeLabel({
          owner,
          repo,
          issue_number: prNumber,
          name: label.name,
        });
      }
    }
  }

  core.info("Creating version labels for new and modified components");

  const versionLabels = [
    ...(status.newComponents || []),
    ...(status.modifiedComponents || []),
  ].flatMap((componentId: string) => {
    const baseName = componentId.substring(componentId.indexOf("/") + 1);

    // Generate labels for @patch, @major, and @minor
    return (["patch", "major", "minor"] as const).map((version) => {
      const componentName = `${baseName}@${version}`;
      const name =
        componentName.length > 50 ? componentName.slice(-50) : componentName;
      const description = componentId;
      const color = versionLabelsColors[version];

      core.info(
        `Processing label: ${name} with description: ${description} and color: #${color}`
      );
      return { name, description, color };
    });
  });

  const octokit = getOctokit(githubToken);

  // Get existing labels on the PR
  const prLabels = await paginatedRequest<Label>({
    octokit,
    method: "GET /repos/{owner}/{repo}/issues/{issue_number}/labels",
    owner,
    repo,
    params: { issue_number: prNumber },
  });

  // Get all repository labels with pagination
  const repoLabels = await paginatedRequest<Label>({
    octokit,
    method: "GET /repos/{owner}/{repo}/labels",
    owner,
    repo,
    params: {},
  });

  // Define the version pattern
  const componentVersionPattern = /@(major|minor|patch)$/;
  // Identify labels to remove
  const labelsToRemove = prLabels.filter((prLabel) => {
    return (
      componentVersionPattern.test(prLabel.name) &&
      !versionLabels.some(
        (versionLabel) =>
          versionLabel.name.split("@")[0] === prLabel.name.split("@")[0]
      )
    );
  });

  // Remove labels that match the version pattern and are not in versionLabels from the pull request
  if (labelsToRemove.length > 0) {
    core.info(
      `Removing labels from PR #${prNumber}: ${labelsToRemove
        .map((prLabel) => prLabel.name)
        .join(", ")}`
    );
    for (const label of labelsToRemove) {
      await octokit.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: prNumber,
        name: label.name,
      });
    }
  }

  // Determine which labels need to be created in the repository
  const newLabelsToCreate = versionLabels.filter(
    ({ name }) => !repoLabels.some((label) => label.name === name) // Labels not in the repository
  );

  core.info(
    `Creating ${newLabelsToCreate.length} new labels in the repository`
  );

  // Create GitHub labels if they do not exist
  for await (const { name, description, color } of newLabelsToCreate) {
    try {
      core.info(
        `Creating GitHub repository label: ${name} with description: ${description} and color: #${color}`
      );
      await octokit.request("POST /repos/{owner}/{repo}/labels", {
        owner,
        repo,
        name: name,
        color: color,
        description: description,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
    } catch (error: any) {
      // Handle unexpected errors
      // core.info(`Skipped creating label ${name}: ${error.message}`);
      if (error.message.includes("rate limit")) {
        core.info(
          `Waiting 2 minutes before retrying to create label ${name}: ${error.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, 120000));
        await octokit.request("POST /repos/{owner}/{repo}/labels", {
          owner,
          repo,
          name: name,
          color: color,
          description: description,
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });
        continue;
      }

      core.info(`Skipped creating label ${name}: ${error.message}`);
    }
  }
};

export default async function run(
  githubToken: string,
  repo: string,
  owner: string,
  prNumber: number,
  laneName: string,
  versionLabel: boolean,
  versionLabelsColors: { patch: string; minor: string; major: string },
  wsDir: string,
  args: string[]
) {
  const org = process.env.ORG;
  const scope = process.env.SCOPE;
  const token = process.env.BIT_CONFIG_USER_TOKEN || "";

  let statusRaw = "";
  const scopeErrorMessage = `Scope: ${org}.${scope} does not exist or you don't have access to it`;

  try {
    const jsonData = await scopeQuery(`${org}.${scope}`, token);
    if (!jsonData?.data?.getScope?.id) {
      throw new Error(scopeErrorMessage);
    }
  } catch (error) {
    throw new Error(scopeErrorMessage);
  }

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
    await createVersionLabels(
      githubToken,
      repo,
      owner,
      prNumber,
      status,
      versionLabelsColors,
      core.getBooleanInput("clear-labels")
    );
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
    const lane = `${org}.${scope}/${laneName}`;
    core.info(`Attempting to remove Bit lane if it exists: ${lane}`);
    await exec(
      "bit",
      ["lane", "remove", lane, "--remote", "--silent", "--force", ...args],
      { cwd: wsDir }
    );
  } catch (error) {
    core.info(
      "Cannot remove Bit lane. The lane may not exist, or the Bit token may not have sufficient permissions to remove it."
    );
  }
  await exec("bit", ["export", ...args], { cwd: wsDir });

  postOrUpdateComment(githubToken, repo, owner, prNumber, laneName);
}
