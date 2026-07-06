const GITHUB_API = 'https://api.github.com';

async function checkForceLabel({ token, owner, repo, sha, label }) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/commits/${sha}/pulls`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'no-deploy-fridays-action',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to look up pull requests for commit ${sha}: HTTP ${response.status}`);
  }

  const pulls = await response.json();

  for (const pull of pulls) {
    const labels = pull.labels || [];
    if (labels.some((l) => l.name === label)) {
      return { forced: true, pullNumber: pull.number };
    }
  }

  return { forced: false, pullNumber: null };
}

module.exports = { checkForceLabel };
