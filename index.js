const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');

const TEAMCITY_API = 'https://tc.dev.meetsidekick.com';

const BUILD_TYPES = [
  'Chromekick_TestBranchWin',
  'Chromekick_TestBranchMac',
  'Chromekick_TestBranchLinux',
  'Chromekick_PerftestsWin',
  'Chromekick_PerftestsMac',
  'Chromekick_PerftestsLinux',
];

async function getCsrf(token) {
  const headers = {'Authorization': `Bearer ${token}`};
  const response = await axios.get(
    `${TEAMCITY_API}/authenticationTest.html?csrf`,
    {headers});
  if (response.status === 200) {
    return response.data;
  }
  return null;
}

async function run() {
  try {
    const token = core.getInput('token');
    const teamcityToken = core.getInput('teamcity');
    const predefinedPullNumber = core.getInput('pull_number');
    if (!token || !teamcityToken) {
      console.error('No token found.');
      return;
    }

    const { payload } = github.context;
    const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
    let pull_number = predefinedPullNumber;
    if (!pull_number)
      pull_number = payload.pull_request.number;
    console.log(`Inputs: pull:${pull_number} owner:${owner} repo:${repo}`);

    const octokit = github.getOctokit(token);
    // const { data: reviews } = await octokit.pulls.listReviews(
    //  {owner, repo, pull_number});
    //console.log('reviews:', JSON.stringify(reviews));

    const { data: reviewers } = await octokit.pulls.listRequestedReviewers(
      {owner, repo, pull_number});
    console.log('reviewers:', JSON.stringify(reviewers));

    // Not all reviewers approved
    if (reviewers.users.length !== 0)
      return;

    const csrf = getCsrf(teamcityToken);
    if (csrf === null) {
      console.error('Error getting CSRF token.');
      return;
    }

    const branch = `pull/${pull_number}`;
    const headers = {
      'Authorization': `Bearer ${teamcityToken}`,
      'X-TC-CSRF-Token': csrf,
    };

    // Checking if there are successful builds
    const locator = `branch:${branch},state:any,count:9`;
    const headers1 = Object.assign(headers, {
      'Accept': 'application/json',
    });
    let res = await axios({
      url: `${TEAMCITY_API}/app/rest/builds/?locator=${locator}`,
      method: 'GET',
      headers: headers1,
    });
    if (res.status === 200) {
      console.log('Builds:', res.data.build);
      const builds = res.data.build.filter((b) => b.status === 'SUCCESS');
      if (builds.length > 0) {
        console.log('Already exist successful builds. Skipping...');
        return;
      }
    } else {
      console.error('Error fetching pull request builds:', res.status, res.statusText);
      return;
    }

    // Starting builds
    const url = `${TEAMCITY_API}/app/rest/buildQueue`;
    const headers2 = Object.assign(headers, {
      'Content-Type': 'application/json',
    });
    for (let buildType in BUILD_TYPES) {
      let body = JSON.stringify({
        branchName: branch,
        buildType: {id: buildType},
        comment: {text: 'Build started from Pull Request page'},
      });
      let res = await axios({method: 'POST', url, headers: headers2, data: body});
      if (res.status === 200) {
        console.log(`Build started: ${buildType}`);
      } else {
        console.warn(`Failed to start build ${buildType}:`, res.statusText);
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run()
