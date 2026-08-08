// ---------------------------------------------------------------------------
// The built-in project templates on this build of GitLab 15.7.5.
//
// Names and descriptions are verbatim from the source DOM
// (assets/html/new-project-template.html, transcribed in assets/README.md
// §19a). Exactly 30 rows, in this order — the "Built-in" tab counter reads 30
// and there is no Instance / Group / Sample tab.
//
// ANCHORS (webarena-748…756): creating from a template must
//   * set the project description to the template's own blurb, because the
//     evaluator reads `.home-panel-description-markdown`.outerText, and
//   * produce a first commit titled `Initialized from '<Name>' project template`.
// Only Pages/Jekyll and Pages/Plain HTML have anchored blurbs; the rest reuse
// the gallery description, which is what the row shows anyway.
// ---------------------------------------------------------------------------

/** Files every template ships, so a fresh repo is never empty. */
function baseFiles(name, extra = []) {
  return (projectName) => [
    { path: 'README.md', body: `# ${projectName}\n\n${name}\n` },
    ...extra.map(f => ({ path: f.path, body: f.body(projectName) })),
  ]
}

const CI_PAGES = () => `image: alpine:latest

pages:
  stage: deploy
  script:
    - echo 'Nothing to do...'
  artifacts:
    paths:
      - public
  only:
    - main
`

const TEMPLATES = [
  { key: 'rails', name: 'Ruby on Rails', description: 'Includes an MVC structure, Gemfile, Rakefile, along with many others, to help you get started' },
  { key: 'spring', name: 'Spring', description: 'Includes an MVC structure, mvnw and pom.xml to help you get started' },
  {
    key: 'express',
    name: 'NodeJS Express',
    description: 'Includes an MVC structure to help you get started',
    files: baseFiles('NodeJS Express', [
      { path: 'package.json', body: n => `{\n  "name": "${n}",\n  "version": "0.0.0",\n  "private": true,\n  "scripts": {\n    "start": "node ./bin/www"\n  },\n  "dependencies": {\n    "express": "~4.16.1"\n  }\n}\n` },
      { path: 'app.js', body: () => "const express = require('express');\n\nconst app = express();\n\napp.get('/', (req, res) => res.send('Hello World'));\n\nmodule.exports = app;\n" },
    ]),
  },
  { key: 'iosswift', name: 'iOS (Swift)', description: 'A ready-to-go template for use with iOS Swift apps' },
  { key: 'dotnetcore', name: '.NET Core', description: 'A .NET Core console application template, customizable for any .NET Core project' },
  {
    key: 'android',
    name: 'Android',
    description: 'A ready-to-go template for use with Android apps',
    files: baseFiles('Android', [
      { path: 'build.gradle', body: () => "apply plugin: 'com.android.application'\n\nandroid {\n    compileSdkVersion 33\n}\n" },
      { path: '.gitlab-ci.yml', body: () => 'image: openjdk:11-jdk\n\nbuild:\n  stage: build\n  script:\n    - ./gradlew assembleDebug\n' },
    ]),
  },
  { key: 'gomicro', name: 'Go Micro', description: 'Go Micro is a framework for micro service development' },
  { key: 'bridgetown', name: 'Pages/Bridgetown', description: 'Everything you need to create a GitLab Pages site using Bridgetown' },
  { key: 'gatsby', name: 'Pages/Gatsby', description: 'Everything you need to create a GitLab Pages site using Gatsby' },
  { key: 'hugo', name: 'Pages/Hugo', description: 'Everything you need to create a GitLab Pages site using Hugo' },
  { key: 'pelican', name: 'Pages/Pelican', description: 'Everything you need to create a GitLab Pages site using Pelican' },
  {
    key: 'jekyll',
    name: 'Pages/Jekyll',
    description: 'Everything you need to create a GitLab Pages site using Jekyll',
    // ANCHOR — webarena-751 / 756 read this off .home-panel-description-markdown
    blurb: 'Example Jekyll site using GitLab Pages: https://pages.gitlab.io/jekyll',
    files: baseFiles('Pages/Jekyll', [
      { path: '_config.yml', body: n => `title: ${n}\ndescription: Example Jekyll site using GitLab Pages\n` },
      { path: 'index.html', body: n => `---\nlayout: default\n---\n\n<h1>${n}</h1>\n` },
      { path: '.gitlab-ci.yml', body: CI_PAGES },
    ]),
  },
  {
    key: 'plainhtml',
    name: 'Pages/Plain HTML',
    description: 'Everything you need to create a GitLab Pages site using plain HTML',
    // ANCHOR — webarena-750 / 755
    blurb: 'Example plain HTML site using GitLab Pages: https://pages.gitlab.io/plain-html',
    files: baseFiles('Pages/Plain HTML', [
      { path: 'public/index.html', body: n => `<!DOCTYPE html>\n<html>\n<head>\n  <title>${n}</title>\n</head>\n<body>\n  <h1>${n}</h1>\n</body>\n</html>\n` },
      { path: '.gitlab-ci.yml', body: CI_PAGES },
    ]),
  },
  { key: 'gitbook', name: 'Pages/GitBook', description: 'Everything you need to create a GitLab Pages site using GitBook' },
  { key: 'hexo', name: 'Pages/Hexo', description: 'Everything you need to create a GitLab Pages site using Hexo' },
  { key: 'middleman', name: 'Pages/Middleman', description: 'Everything you need to create a GitLab Pages site using Middleman' },
  { key: 'gitpod_spring_petclinic', name: 'Gitpod/Spring Petclinic', description: 'A Gitpod configured Webapplication in Spring and Java' },
  { key: 'nfhugo', name: 'Netlify/Hugo', description: 'A Hugo site that uses Netlify for CI/CD instead of GitLab, but still with all the other great GitLab features' },
  { key: 'nfjekyll', name: 'Netlify/Jekyll', description: 'A Jekyll site that uses Netlify for CI/CD instead of GitLab, but still with all the other great GitLab features' },
  { key: 'nfplainhtml', name: 'Netlify/Plain HTML', description: 'A plain HTML site that uses Netlify for CI/CD instead of GitLab, but still with all the other great GitLab features' },
  { key: 'nfgitbook', name: 'Netlify/GitBook', description: 'A GitBook site that uses Netlify for CI/CD instead of GitLab, but still with all the other great GitLab features' },
  { key: 'nfhexo', name: 'Netlify/Hexo', description: 'A Hexo site that uses Netlify for CI/CD instead of GitLab, but still with all the other great GitLab features' },
  { key: 'salesforcedx', name: 'SalesforceDX', description: 'A project boilerplate for Salesforce App development with Salesforce Developer tools' },
  { key: 'serverless_framework', name: 'Serverless Framework/JS', description: 'A basic page and serverless function that uses AWS Lambda, AWS API Gateway, and GitLab Pages' },
  { key: 'tencent_serverless_framework', name: 'Tencent Serverless Framework/NextjsSSR', description: 'A project boilerplate for Tencent Serverless Framework that uses Next.js SSR' },
  { key: 'jsonnet', name: 'Jsonnet for Dynamic Child Pipelines', description: 'An example showing how to use Jsonnet with GitLab dynamic child pipelines' },
  { key: 'cluster_management', name: 'GitLab Cluster Management', description: 'An example project for managing Kubernetes clusters integrated with GitLab' },
  { key: 'kotlin_native_linux', name: 'Kotlin Native Linux', description: 'A basic template for developing Linux programs using Kotlin Native' },
  { key: 'typo3_distribution', name: 'TYPO3 Distribution', description: 'A template for starting a new TYPO3 project' },
  { key: 'sample', name: 'Sample GitLab Project', description: 'An example project that shows off the best practices for setting up GitLab for your own organization, including sample issues, merge requests, and milestones' },
].map(t => ({
  ...t,
  // The project description a create-from-template lands with.
  blurb: t.blurb || t.description,
  files: t.files || baseFiles(t.name, [{ path: '.gitlab-ci.yml', body: () => 'stages:\n  - build\n  - test\n' }]),
}))

export default TEMPLATES

export function templateByKey(key) {
  return TEMPLATES.find(t => t.key === key) || null
}

/** Shape `createProject()` consumes: `{ name, description, files(projectName) }`. */
export function templatePayload(template) {
  if (!template) return null
  return { name: template.name, description: template.blurb, files: template.files }
}
