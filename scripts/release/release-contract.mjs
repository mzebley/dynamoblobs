const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const CANDIDATE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-rc\.([1-9]\d*)$/;
const RELEASE_BRANCH = /^release\/v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const RELEASE_TITLE = /^release: v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export const RELEASE_TYPES = /** @type {const} */ (['patch', 'minor', 'major']);

export function parseStableVersion(value) {
  const match = STABLE_VERSION.exec(value);
  if (!match) {
    throw new Error(
      `"${value}" is not a stable SemVer version. Use x.y.z with no leading zeroes or prerelease suffix.`,
    );
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function parseCandidateVersion(value) {
  const match = CANDIDATE_VERSION.exec(value);
  if (!match) {
    throw new Error(
      `"${value}" is not a release-candidate version. Use x.y.z-rc.n with n starting at 1.`,
    );
  }

  return {
    baseVersion: `${match[1]}.${match[2]}.${match[3]}`,
    candidateNumber: Number(match[4]),
  };
}

export function formatVersion(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

export function compareVersions(left, right) {
  const a = parseStableVersion(left);
  const b = parseStableVersion(right);

  return (
    Math.sign(a.major - b.major) ||
    Math.sign(a.minor - b.minor) ||
    Math.sign(a.patch - b.patch)
  );
}

export function bumpVersion(version, releaseType) {
  const parsed = parseStableVersion(version);

  switch (releaseType) {
    case 'patch':
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    case 'minor':
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case 'major':
      return `${parsed.major + 1}.0.0`;
    default:
      throw new Error(
        `Unknown release type "${releaseType}". Valid release types: ${RELEASE_TYPES.join(', ')}.`,
      );
  }
}

export function inferReleaseType(previousVersion, nextVersion) {
  return RELEASE_TYPES.find((releaseType) => {
    return bumpVersion(previousVersion, releaseType) === nextVersion;
  });
}

export function latestVersionFromTags(tags) {
  const versions = tags
    .filter((tag) => tag.startsWith('v'))
    .map((tag) => tag.slice(1))
    .filter((version) => STABLE_VERSION.test(version))
    .sort(compareVersions);

  return versions.at(-1);
}

export function isPrePublicMilestoneChange({ latestVersion, previousVersion, nextVersion }) {
  if (latestVersion) return false;

  try {
    const previous = parseStableVersion(previousVersion);
    const next = parseStableVersion(nextVersion);
    return previous.major === 0 && next.major === 0 && compareVersions(previousVersion, nextVersion) < 0;
  } catch {
    return false;
  }
}

export function parseReleaseBranch(branch) {
  const match = RELEASE_BRANCH.exec(branch);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : undefined;
}

export function parseReleaseTitle(title) {
  const match = RELEASE_TITLE.exec(title);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : undefined;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function releaseHeading(version) {
  return new RegExp(`^## \\[${escapeRegExp(version)}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'gm');
}

export function unreleasedBody(changelog) {
  const match = /^## \[Unreleased\]\s*\n([\s\S]*?)(?=^## \[|(?![\s\S]))/m.exec(changelog);
  return match?.[1].trim() ?? undefined;
}

export function collectReleaseStateErrors({
  latestVersion,
  packageVersion,
  lockVersion,
  lockRootVersion,
  changelog,
  branchVersion,
  titleVersion,
  requireEmptyUnreleased = true,
}) {
  const errors = [];

  for (const [label, version] of [
    ['package.json', packageVersion],
    ['package-lock.json', lockVersion],
    ['package-lock.json packages[""]', lockRootVersion],
  ]) {
    try {
      parseStableVersion(version);
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }

  if (latestVersion) {
    try {
      parseStableVersion(latestVersion);
    } catch (error) {
      errors.push(`latest release tag: ${error.message}`);
    }
  }

  if (errors.length > 0) return errors;

  if (packageVersion !== lockVersion || packageVersion !== lockRootVersion) {
    errors.push(
      `Version drift: package.json is ${packageVersion}, package-lock.json is ${lockVersion}, ` +
        `and package-lock.json packages[""] is ${lockRootVersion}. Run npm run release:prepare -- <version>.`,
    );
  }

  if (!latestVersion) {
    if (packageVersion !== '1.0.0') {
      errors.push(
        `The first public release must be 1.0.0; package.json is ${packageVersion}. ` +
          'The existing 0.x history is pre-public development history.',
      );
    }
  } else if (!inferReleaseType(latestVersion, packageVersion)) {
    errors.push(
      `${packageVersion} is not the next patch, minor, or major release after ${latestVersion}. ` +
        'Release exactly one SemVer increment at a time.',
    );
  }

  for (const [label, version] of [
    ['release branch', branchVersion],
    ['release PR title', titleVersion],
  ]) {
    if (version && version !== packageVersion) {
      errors.push(`${label} says v${version}, but package.json says ${packageVersion}.`);
    }
  }

  const heading = releaseHeading(packageVersion);
  const headings = changelog.match(heading) ?? [];
  if (headings.length !== 1) {
    errors.push(
      `CHANGELOG.md must contain exactly one "## [${packageVersion}] - YYYY-MM-DD" heading; ` +
        `found ${headings.length}.`,
    );
  }

  const unreleasedIndex = changelog.indexOf('## [Unreleased]');
  const releaseIndex = changelog.search(heading);
  if (unreleasedIndex === -1 || (releaseIndex !== -1 && unreleasedIndex > releaseIndex)) {
    errors.push('CHANGELOG.md must keep [Unreleased] before the new release heading.');
  }

  if (requireEmptyUnreleased && unreleasedBody(changelog)) {
    errors.push(
      'CHANGELOG.md [Unreleased] must be empty after its entries are promoted into the release heading.',
    );
  }

  return errors;
}

export function collectBranchPolicyErrors({ baseBranch, headBranch, title, versionChanged }) {
  if (baseBranch !== 'main') {
    return [`Unsupported PR base "${baseBranch}". All pull requests target main.`];
  }

  const branchVersion = parseReleaseBranch(headBranch);
  const titleVersion = parseReleaseTitle(title);

  if (branchVersion) {
    const errors = [];
    if (!titleVersion) {
      errors.push(`Release PR title "${title}" is invalid. Use release: v${branchVersion}.`);
    } else if (titleVersion !== branchVersion) {
      errors.push(
        `Release branch says v${branchVersion}, but the PR title says v${titleVersion}.`,
      );
    }
    return errors;
  }

  const errors = [];
  if (titleVersion || title.startsWith('release:')) {
    errors.push('Release PRs must come from a release/vx.y.z branch.');
  }
  if (versionChanged) {
    errors.push(
      'package.json version changes are allowed only on a release/vx.y.z branch prepared with release:prepare.',
    );
  }
  return errors;
}
