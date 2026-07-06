const { checkForceLabel } = require('../src/force-label');

function mockFetchOk(pulls) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(pulls),
  });
}

const BASE_ARGS = {
  token: 'test-token',
  owner: 'rorycaraher',
  repo: 'no-deploy-fridays',
  sha: 'abc123',
  label: 'force-deploy',
};

describe('checkForceLabel', () => {
  afterEach(() => {
    delete global.fetch;
  });

  test('returns forced=true with the PR number when a matching label is present', async () => {
    mockFetchOk([{ number: 42, labels: [{ name: 'force-deploy' }, { name: 'bug' }] }]);

    const result = await checkForceLabel(BASE_ARGS);

    expect(result).toEqual({ forced: true, pullNumber: 42 });
  });

  test('returns forced=false when no associated PR has the label', async () => {
    mockFetchOk([{ number: 42, labels: [{ name: 'bug' }] }]);

    const result = await checkForceLabel(BASE_ARGS);

    expect(result).toEqual({ forced: false, pullNumber: null });
  });

  test('returns forced=false when no PRs are associated with the commit', async () => {
    mockFetchOk([]);

    const result = await checkForceLabel(BASE_ARGS);

    expect(result).toEqual({ forced: false, pullNumber: null });
  });

  test('checks all associated PRs, not just the first', async () => {
    mockFetchOk([
      { number: 1, labels: [{ name: 'bug' }] },
      { number: 2, labels: [{ name: 'force-deploy' }] },
    ]);

    const result = await checkForceLabel(BASE_ARGS);

    expect(result).toEqual({ forced: true, pullNumber: 2 });
  });

  test('sends the token as a Bearer auth header', async () => {
    mockFetchOk([]);

    await checkForceLabel(BASE_ARGS);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/rorycaraher/no-deploy-fridays/commits/abc123/pulls',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
  });

  test('throws with the HTTP status when the lookup responds non-OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(checkForceLabel(BASE_ARGS)).rejects.toThrow('HTTP 404');
  });
});
