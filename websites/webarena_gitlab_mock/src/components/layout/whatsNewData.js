// ---------------------------------------------------------------------------
// The 10 release-post items GitLab 15.7's "What's new" drawer shows on this
// instance, captured verbatim off the SOURCE container's own
// `GET /-/whats_new` response. The navbar's `10` badge is this array's length.
//
// `image_url` is deliberately NOT carried over: every item's image lives on
// `about.gitlab.com`, and rendering it would be a runtime network call the
// migration contract forbids. The source paints it as a CSS background on
// `.whats-new-item-image`; the mock keeps the element and leaves it unpainted.
// `description` is the source's own rendered HTML.
// ---------------------------------------------------------------------------

const WHATS_NEW_ITEMS = [
 {
  "name": "Introducing the GitLab CLI",
  "description": "<p data-sourcepos=\"1:1-1:384\" dir=\"auto\">The command line is one of the most important tools in a software engineer's toolkit and the majority of their process and work revolve around tools available there. They customize their CLI with styles and extend it through applications to ensure maximum efficiency while performing tasks. The CLI is the backbone of scripts and workflows developers depend on to complete their work.</p>\n<p data-sourcepos=\"3:1-3:278\" dir=\"auto\">To support more developers where they're already working, we've adopted the open source project <code>glab</code>, which will form the foundation of GitLab's native CLI experience. The GitLab CLI brings GitLab together with Git and your code, with no application or tab switching required.</p>\n<p data-sourcepos=\"5:1-5:177\" dir=\"auto\">You can read about our adoption of <code>glab</code>, our partnership with 1Password, and how to contribute to the project in our <a href=\"/blog/2022/12/07/introducing-the-gitlab-cli/\">blog post</a>.</p>\n<p data-sourcepos=\"7:1-7:119\" dir=\"auto\">A special thank you to <a href=\"https://gitlab.com/profclems\" rel=\"nofollow noreferrer noopener\" target=\"_blank\">Clement Sam</a> for creating <code>glab</code> and trusting us with its future.</p>",
  "available_in": [
   "Free",
   "Premium",
   "Ultimate"
  ],
  "documentation_link": "https://docs.gitlab.com/ee/integration/glab/",
  "published_at": "2022-12-22",
  "release": 15.7
 },
 {
  "name": "Browser-based DAST general availability",
  "description": "<p data-sourcepos=\"1:1-1:155\" dir=\"auto\">After being available in Beta since GitLab 13.2, our proprietary browser-based DAST analyzer is now being released for general availability in GitLab 15.7.</p>\n<p data-sourcepos=\"3:1-3:833\" dir=\"auto\">This new analyzer has been developed completely in-house and makes use of a browser to authenticate, crawl, and scan web applications for vulnerabilities. Traditional DAST analyzers scan using a proxy-based approach to intercept requests and analyze them for vulnerabilities. Because of this, running DAST scans on applications that utilize modern JavaScript frameworks or are single page applications has been extremely difficult. Often, you do not get the full coverage of the application that you would expect. With the browser-based approach, we are able to execute JavaScript directly in the browser, as a user would, to ensure that your entire application is scanned for vulnerabilities. Using the new analyzer, we are able to cover more of the pages in an application, as well as reduce the number of false positives reported.</p>\n<p data-sourcepos=\"5:1-5:889\" dir=\"auto\">At this time, we will not be switching the default analyzer used in the <a href=\"https://gitlab.com/gitlab-org/gitlab/-/blob/master/lib/gitlab/ci/templates/Security/DAST.gitlab-ci.yml\" rel=\"nofollow noreferrer noopener\" target=\"_blank\">DAST.gitlab-ci.yml</a> template to the browser-based analyzer, to allow users to make the switch manually and evaluate it for themselves. However, we plan to make the analyzer the default for all DAST scans at some point in the future. We encourage everyone to start to migrate to the new analyzer, so that when the default switch happens, it will not break any of your DAST scans. You can enable the browser-based analyzer by setting the <code>DAST_BROWSER_SCAN</code> to <code>true</code> in your <code>gitlab-ci.yml</code> configuration. Please note that not all legacy DAST analyzer variables will be used with this new analyzer. Any unsupported legacy DAST variables configured in your <code>gitlab-ci.yml</code> file will be ignored during the scan run.</p>\n<p data-sourcepos=\"7:1-7:384\" dir=\"auto\">We will continue to improve on this analyzer and have plans for many new features that the browser-based approach opens up to us. You can see our plans by looking at our <a href=\"https://gitlab.com/groups/gitlab-org/-/epics/4248\" rel=\"nofollow noreferrer noopener\" target=\"_blank\">browser-based DAST epic</a> and its issues. We would love to get feedback on this epic (or any child issues) about what is most important for you in your DAST scans.</p>",
  "available_in": [
   "Ultimate"
  ],
  "documentation_link": "https://docs.gitlab.com/ee/user/application_security/dast/browser_based.html",
  "published_at": "2022-12-22",
  "release": 15.7
 },
 {
  "name": "Support GitOps deployments from outside the default branch",
  "description": "<p data-sourcepos=\"1:1-1:278\" dir=\"auto\">In previous releases, the GitLab agent for Kubernetes was restricted to manifest files stored on your main branch. This model had known limitations. For example, you couldn't store the manifests of your next release on a release branch and test them in an ephemeral environment.</p>\n<p data-sourcepos=\"3:1-3:195\" dir=\"auto\">Now, you can specify a Git reference along with the manifest project configuration. Besides the main branch, you can sync your manifest files from another branch, a git tag, or a specific commit.</p>",
  "available_in": [
   "Free",
   "Premium",
   "Ultimate"
  ],
  "documentation_link": "https://docs.gitlab.com/ee/user/clusters/agent/gitops.html#gitops-configuration-reference",
  "published_at": "2022-12-22",
  "release": 15.7
 },
 {
  "name": "Experience the Web IDE Beta and Remote Development",
  "description": "<p data-sourcepos=\"1:1-1:437\" dir=\"auto\">We are thrilled to announce the availability of the Web IDE Beta, our next-generation web editor based on Visual Studio Code that delivers powerful new features, a more flexible and familiar interface, and the ability to connect directly to a Remote Development environment. Paired with a cloud runtime, the Web IDE Beta enables more advanced real-time development workflows. Take a look at just some of the new features available today!</p>\n<p data-sourcepos=\"3:1-3:370\" dir=\"auto\">The Web IDE Beta is so powerful we're making it the default Web IDE experience for GitLab.com, and we're eager for your feedback. The Web IDE will continue to be available while we iterate on the Beta. To stop using the Web IDE Beta, go to your <a href=\"https://gitlab.com/-/profile/preferences#web-ide\" rel=\"nofollow noreferrer noopener\" target=\"_blank\">user preferences</a> and select the <strong>Opt out of the Web IDE Beta</strong> checkbox.</p>\n<p data-sourcepos=\"5:1-5:181\" dir=\"auto\">Self-managed instances have access to the Web IDE Beta where it is behind a <a href=\"https://docs.gitlab.com/ee/user/project/web_ide_beta/\" rel=\"nofollow noreferrer noopener\" target=\"_blank\">feature flag</a> disabled by default in GitLab 15.7.</p>\n<p data-sourcepos=\"7:1-7:135\" dir=\"auto\">Learn more about the Web IDE Beta and what's coming next in our <a href=\"/blog/2022/12/15/get-ready-for-new-gitlab-web-ide/\">recent blog post</a>.</p>",
  "available_in": [
   "Free",
   "Premium",
   "Ultimate"
  ],
  "documentation_link": "https://docs.gitlab.com/ee/user/project/web_ide_beta/",
  "published_at": "2022-12-22",
  "release": 15.7
 },
 {
  "name": "Sign commits with your SSH key",
  "description": "<p data-sourcepos=\"1:1-1:226\" dir=\"auto\">Signing commits just got a lot simpler. Use SSH keys <a href=\"https://docs.gitlab.com/ee/user/project/repository/ssh_signed_commits/\" rel=\"nofollow noreferrer noopener\" target=\"_blank\">to sign commits</a>, and provide others with confidence that a <strong>Verified</strong> commit was authored by you.</p>\n<p data-sourcepos=\"3:1-3:423\" dir=\"auto\">Previous methods for signing commits required a GPG key or an X.509 certificate, neither of which can be used to sign in to GitLab. Adding support for commit signing with SSH keys now makes it possible to reuse your authentication key pair to also sign your commits. If you already authenticate into GitLab with an SSH key, add three lines of code to your local Git configuration and all your future commits will be signed.</p>\n<p data-sourcepos=\"5:1-5:168\" dir=\"auto\">By default, all SSH keys currently in your profile can be used for both authentication and signing commits. To use a key for only one of the purposes, upload a new key.</p>",
  "available_in": [
   "Free",
   "Premium",
   "Ultimate"
  ],
  "documentation_link": "https://docs.gitlab.com/ee/user/project/repository/ssh_signed_commits/",
  "published_at": "2022-12-22",
  "release": 15.7
 },
 {
  "name": "Share CI/CD access to the agent within a personal namespace",
  "description": "<p data-sourcepos=\"1:1-1:109\" dir=\"auto\">The GitLab agent for Kubernetes provides a more secure solution for managing your clusters with GitLab CI/CD.</p>\n<p data-sourcepos=\"3:1-3:344\" dir=\"auto\">You can use a single agent with multiple projects and groups by sharing access to the agent connection. In previous releases, you could not share access with personal namespaces. This release adds support for CI/CD connection sharing to personal namespaces. You can now use a single agent from any of the projects under your personal namespace.</p>",
  "available_in": [
   "Free",
   "Premium",
   "Ultimate"
  ],
  "documentation_link": "https://docs.gitlab.com/ee/user/clusters/agent/ci_cd_workflow.html#authorize-the-agent",
  "published_at": "2022-12-22",
  "release": 15.7
 },
 {
  "name": "Select predefined CI/CD variables values from a dropdown list",
  "description": "<p data-sourcepos=\"1:1-1:414\" dir=\"auto\">Previously, you could <a href=\"https://docs.gitlab.com/ee/ci/pipelines/index.html#prefill-variables-in-manual-pipelines\" rel=\"nofollow noreferrer noopener\" target=\"_blank\">pre-fill CI/CD variables in the \"Run pipeline\" page</a>, with a specific value. Unfortunately, if you had multiple options for the variable's value, you still had to manually input the option you wanted. This was an error-prone process because you could easily input an invalid value, or just mistype it.</p>\n<p data-sourcepos=\"3:1-3:323\" dir=\"auto\">In this release, we've added the ability to set a list of values which are surfaced in a drop-down list in the \"Run pipeline\" page. Now you can define the exact list of values that are valid for each CI/CD variable when running a pipeline manually, greatly simplifying your workflow when using manually-triggered pipelines.</p>",
  "available_in": [
   "Free",
   "Premium",
   "Ultimate"
  ],
  "documentation_link": "https://docs.gitlab.com/ee/ci/pipelines/index.html#prefill-variables-in-manual-pipelines",
  "published_at": "2022-12-22",
  "release": 15.7
 },
 {
  "name": "Self-managed support for the GitLab for Jira Cloud app",
  "description": "<p data-sourcepos=\"1:1-1:196\" dir=\"auto\">For self-managed GitLab, we're excited to announce support for the <a href=\"https://marketplace.atlassian.com/apps/1221011/gitlab-com-for-jira-cloud?tab=overview&amp;hosting=cloud\" rel=\"nofollow noreferrer noopener\" target=\"_blank\">GitLab for Jira Cloud app</a>!</p>",
  "available_in": [
   "Free",
   "Premium",
   "Ultimate"
  ],
  "documentation_link": "https://docs.gitlab.com/ee/integration/jira/connect-app.html#connect-the-gitlabcom-for-jira-cloud-app-for-self-managed-instances",
  "published_at": "2022-12-22",
  "release": 15.7
 },
 {
  "name": "Retry a manual job with updated variables",
  "description": "<p data-sourcepos=\"1:1-1:280\" dir=\"auto\">When running manual jobs, users can specify the extra CI/CD variables to use in the job. However, if you wanted to retry the same job, you always had to use the same variables as the first time. If you wanted to run the job with different variables, you had to run a new pipeline.</p>\n<p data-sourcepos=\"3:1-3:280\" dir=\"auto\">In this release, we have added the ability to specify variables every time you run a manual job, including when retrying the job. This allows for greater flexibility and convenience as you can retry a manual job as often as you like with a different set of variables in every run.</p>",
  "available_in": [
   "Free",
   "Premium",
   "Ultimate"
  ],
  "documentation_link": "https://docs.gitlab.com/ee/ci/jobs/index.html#specifying-variables-when-running-manual-jobs",
  "published_at": "2022-12-22",
  "release": 15.7
 },
 {
  "name": "Support the `$` character in CI/CD variables",
  "description": "<p data-sourcepos=\"1:1-1:346\" dir=\"auto\">Previously, using the <code>$</code> character in a CI/CD variable always indicated the start of a reference another variable, which GitLab then tried to expand. As a result, you could not have a value with a <code>$</code> as part of the string unless it was <a href=\"https://docs.gitlab.com/ee/ci/variables/#use-the--character-in-variables\" rel=\"nofollow noreferrer noopener\" target=\"_blank\">escaped</a>, which can be confusing.</p>\n<p data-sourcepos=\"3:1-3:261\" dir=\"auto\">In this release, we are introducing a new setting for project, group, and instance CI/CD variables. You can now toggle whether or not GitLab interprets the CI/CD variable as a raw string, or treats a <code>$</code> as the start of another variable that should be expanded.</p>",
  "available_in": [
   "Free",
   "Premium",
   "Ultimate"
  ],
  "documentation_link": "https://docs.gitlab.com/ee/ci/variables/#expand-cicd-variables",
  "published_at": "2022-12-22",
  "release": 15.7
 }
]

export default WHATS_NEW_ITEMS
