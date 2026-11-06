# iOS release

Every game's iOS release: it builds the game, signs it and uploads it to
TestFlight. A game starts it by hand, with **iOS - Release** in its
repository's Actions tab.

Signing works as for the open-app-builder apps:
[fastlane match](https://docs.fastlane.tools/actions/match/), with the IDEMS
distribution certificate and each app's provisioning profile kept encrypted in
a Google Cloud Storage bucket. The open-app-builder
[iOS release guide](https://github.com/IDEMSInternational/open-app-builder-actions/blob/main/.github/workflows/ios-release.md)
explains the bucket, the service account and the App Store Connect API key.

## How it works

Each game has a short `.github/workflows/ios-release.yml` that calls the shared
workflow, [.github/workflows/ios-release.yml](../.github/workflows/ios-release.yml),
on this repository's `main` branch. The shared workflow builds the game's web
app, runs `npx cap sync ios` and copies the version into the Xcode project. It
then copies the files in this folder into the game's `ios/App` folder, on the
build machine only, and runs fastlane, which:

1. fetches the certificate and the game's provisioning profile from the bucket
2. sets the Xcode project to sign with them
3. builds the app
4. uploads it to TestFlight, where Apple processes it for a while before
   testers get it

The App ID comes from the game's Xcode project, so nothing here or in the
workflows names a game. See [A game's App ID](../README.md#a-games-app-id).

The files here:

- `Fastfile`: the fastlane steps above
- `Gemfile`, `Gemfile.lock`: the fastlane version
- `ios-version.mjs`: copies the version in the game's `package.json` into its
  Xcode project. The game's `npm version` runs it too.

Unlike the rest of this repository, a change here or in the shared workflow
reaches every game at its next release, without the game being updated. So
[try changes from a branch first](#changing-the-release).

## Adding iOS release to a game

Once per game:

1. Set the game's App ID (see [A game's App ID](../README.md#a-games-app-id)),
   then add the iOS project, with `@capacitor/ios` at the same version as the
   game's other `@capacitor` packages. Commit the new `ios/` folder.

   ```sh
   npm install @capacitor/ios
   npx cap add ios
   ```

2. Add a `version` script to the game's `package.json`, so that `npm version`
   updates the Xcode project too:

   ```json
   "version": "node games-common-core/ios-release/ios-version.mjs && git add ios/App/App.xcodeproj/project.pbxproj"
   ```

3. In the IDEMS Apple Developer account, register the App ID (no extra
   capabilities). Then create the app in App Store Connect with that bundle ID,
   and add an internal TestFlight group.

4. Give the game's repository the variables and secrets below. They are IDEMS
   organisation variables and secrets, so an organisation admin adds the
   repository to each one's repository access (organisation settings, Secrets
   and variables, Actions). The variables point at the bucket; the secrets must
   match it, above all the encryption password: given a bucket it can't read,
   match would try to create a new certificate, and Apple allows only a few.

   | Type     | Name                                | Value                                   |
   | -------- | ----------------------------------- | --------------------------------------- |
   | Variable | `APP_STORE_TEAM_ID`                 | Apple Developer Team ID                 |
   | Variable | `GCP_IOS_CERTS_PROJECT_ID`          | Google Cloud project holding the bucket |
   | Variable | `GCP_IOS_CERTS_BUCKET_ID`           | The bucket's name                       |
   | Secret   | `APP_STORE_CONNECT_API_KEY_ID`      | App Store Connect API key ID            |
   | Secret   | `APP_STORE_CONNECT_API_ISSUER_ID`   | Its issuer ID                           |
   | Secret   | `APP_STORE_CONNECT_API_KEY`         | The contents of its `.p8` file          |
   | Secret   | `GCP_IOS_CERTS_SERVICE_ACCOUNT_KEY` | Service account JSON key for the bucket |
   | Secret   | `GCP_IOS_CERTS_ENCRYPTION_PASSWORD` | match's encryption password             |

5. Add `.github/workflows/ios-release.yml` to the game:

   ```yaml
   # Builds the app and uploads it to TestFlight, with the iOS release shared by
   # every IDEMS game (games-common-core/ios-release/README.md). Start it by hand
   # from the Actions tab, after `npm version` and `git push --follow-tags`.
   name: iOS - Release

   on:
     workflow_dispatch:
       inputs:
         target:
           description: 'Where to deploy'
           required: true
           default: testflight
           type: choice
           options:
             - testflight
         allow_provisioning_changes:
           description: 'Let fastlane match create or renew the provisioning profile (needed on the first run)'
           required: true
           default: false
           type: boolean

   permissions:
     contents: read

   jobs:
     release:
       uses: IDEMSInternational/games-common-core/.github/workflows/ios-release.yml@main
       with:
         target: ${{ inputs.target }}
         allow_provisioning_changes: ${{ inputs.allow_provisioning_changes }}
       secrets: inherit
   ```

6. Run **iOS - Release** once with **allow_provisioning_changes** ticked, so
   that match creates the game's provisioning profile and stores it in the
   bucket. Leave it unticked after that, so that a release can't change the
   signing by accident.

## Releasing

Bump the version, push it with its tag, then run **iOS - Release** from the
game's Actions tab:

```sh
npm version patch      # or minor / major
git push --follow-tags
```

Each upload needs a new version, because TestFlight refuses a build number it
already has.

## Changing the release

A change on `main` reaches every game's next release, so try it with one game
first:

1. Push the change to a branch of this repository, for example `my-change`.
2. In a branch of the game, point its `.github/workflows/ios-release.yml` at
   that branch: change `@main` to `@my-change`, and add
   `games_common_core_ref: my-change` under `with:`.
3. Bump the game's version on its branch, then run **iOS - Release** on that
   branch (Run workflow lets you choose the branch).
4. Once it works, merge the change here. Then switch the game's branch back
   to `@main`, without `games_common_core_ref`, and merge it too, so that the
   game keeps the version the test uploaded and its next release goes above it.

When Apple starts requiring a newer Xcode, change `runs-on` and `xcode-version`
in the shared workflow, as
[open-app-builder-actions](https://github.com/IDEMSInternational/open-app-builder-actions)
does.
