import { exec, getExecOutput } from "@actions/exec";
import { getOctokit } from "@actions/github";
import * as core from "@actions/core";
import semver from "semver";
import { scopeQuery } from "./graphql";
import { bitLaneRegex } from "./bit-lanes";

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

  if (clearLabels) {
    core.info("Clearing all Bit labels from the Pull Request");

    // Remove all Bit labels from the Pull Request
    for (const label of repoLabels) {
      if (
        label.name.endsWith("@patch") ||
        label.name.endsWith("@major") ||
        label.name.endsWith("@minor")
      ) {
        core.info(`Removing Bit label: ${label.name}`);
        await octokit.request("DELETE /repos/{owner}/{repo}/labels/{name}", {
          owner,
          repo,
          name: label.name,
        });
      }
    }
  }

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
  const newLabelsToCreate = clearLabels
    ? // if clearing labels, create all labels again
    versionLabels
    : versionLabels.filter(
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
      // Handle rate limit errors
      if (error.message.includes("rate limit")) {
        core.info(
          `Waiting 30 seconds before retrying to create label ${name}: ${error.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, 30000));
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

      // Handle unexpected errors
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
  wsDir: string,
  args: string[],
  build: boolean,
  strict: boolean,
  versionLabel: boolean,
  versionLabelsColors: { patch: string; minor: string; major: string },
) {
  const isBitLane = bitLaneRegex.test(laneName);
  const version = await getExecOutput("bit -v", [], { cwd: wsDir });

  // If the version is lower than 1.11.42, throw an error recommending to downgrade the action version to v2
  // or upgrade Bit to ^1.11.42
  if (semver.lt(version.stdout.trim(), "1.11.42")) {
    throw new Error(
      "Bit version is lower than 1.11.42. Please downgrade the action version to v2, or upgrade Bit to ^1.11.42"
    );
  }

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

  const snapMessageText = await createSnapMessageText(
    githubToken,
    repo,
    owner,
    prNumber
  );

  const lane = isBitLane ? laneName : `${org}.${scope}/${laneName}`;
  const cliArgs = [
    "ci",
    "pr",
    "--lane",
    lane,
    "--message",
    snapMessageText,
    ...args,
  ];

  if (build) {
    cliArgs.push("--build");
  }

  if (strict) {
    cliArgs.push("--strict");
  }

  await exec("bit", cliArgs, {
    cwd: wsDir,
    env: {
      ...process.env,
      BIT_DISABLE_SPINNER: "false",
    }
  });

  postOrUpdateComment(githubToken, repo, owner, prNumber, laneName);
}