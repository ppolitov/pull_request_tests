const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const token = core.getInput('token');
    const teamcityToken = core.getInput('teamcity');

    const { payload } = github.context;
    const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
    const pull_number = payload.pull_request.number;
    console.log(`Inputs: pull:${pull_number} owner:${owner} repo:${repo}`);

    const octokit = github.getOctokit(token);
    const { data: reviews } = await octokit.pulls.listReviews(
      {owner, repo, pull_number});
    console.log('reviews:', JSON.stringify(reviews));
    const approved = reviews.every((review) => review.state === 'APPROVED');

    if (!approved)
      return;




  } catch (error) {
    core.setFailed(error.message);
  }
}

run()
