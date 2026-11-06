// Copies the version in the game's package.json into its Xcode project, as
// Android's build.gradle does for itself: MARKETING_VERSION is the "1.2.3"
// players see, and CURRENT_PROJECT_VERSION, the build number that must go up
// with every upload, is the same number as Android's versionCode.
//
// Run it from the game's root folder. npm does that for the game's "version"
// script (so `npm version` runs it), and the iOS release workflow runs it there too.
import { readFileSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const [major, minor, patch] = version.split(/[.-]/).map(Number);
const build = major * 1000000 + minor * 1000 + patch;

const project = 'ios/App/App.xcodeproj/project.pbxproj';
writeFileSync(
  project,
  readFileSync(project, 'utf8')
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`),
);
console.log(`iOS version ${version} (build ${build}).`);
