# Android release

Every game's Android release: it builds the game's release bundle (`.aab`),
signs it with the upload key and uploads it to Google Play. A game starts it by
hand, with **Android - Release** in its repository's Actions tab.

It works as open-app-builder's Android release
([android-build.yml](https://github.com/IDEMSInternational/open-app-builder-actions/blob/main/.github/workflows/android-build.yml)
and `android-release.yml` in open-app-builder-actions), with the same secret
names.

## How it works

Each game has a short `.github/workflows/android-release.yml` that calls the
shared workflow,
[.github/workflows/android-release.yml](../.github/workflows/android-release.yml),
on this repository's `main` branch. The shared workflow:

1. checks that the secrets are set
2. builds the game's web app and runs `npx cap sync android`
3. builds the release bundle with Gradle (`bundleRelease`)
4. signs it with the upload key, using the JDK's `jarsigner`
5. keeps the signed bundle on the run's page for two weeks (**release-bundle**,
   under Artifacts)
6. uploads it to the chosen Google Play track, with
   [r0adkll/upload-google-play](https://github.com/r0adkll/upload-google-play)

The package name (application ID) comes from the game's
`android/app/build.gradle`, and the version from its `package.json`, so nothing
here or in the workflows names a game. See
[A game's App ID](../README.md#a-games-app-id).

When it's started, it asks for:

- **track**: `internal` (internal testing), `alpha` (closed testing), `beta`
  (open testing), or `none` to only build the signed bundle. Releasing to
  production is done in the Play Console, by promoting a tested release.
- **status**: `completed`, so testers or users get it straight away, or `draft`,
  to check it and roll it out in the Play Console.

Unlike the rest of this repository, a change here or in the shared workflow
reaches every game at its next release, without the game being updated. So
[try changes from a branch first](#changing-the-release).

## Adding Android release to a game

Once per game:

1. Set the game's App ID (see [A game's App ID](../README.md#a-games-app-id)).

2. In the IDEMS Google Play Console, create the app. Its package name is set by
   the first bundle uploaded (step 6).

3. **The upload key.** Google Play only accepts bundles signed with the app's
   upload key. With Play App Signing (the default for new apps), Google keeps the
   key that signs the app on players' phones, and the upload key only proves that
   an upload comes from you. If it's lost or leaked, it can be reset from the
   Play Console. Every game can use the same upload key, or each its own.

   To make one (JDK's `keytool`; keep the file and passwords somewhere safe,
   such as the IDEMS password manager, never in a repository):

   ```sh
   keytool -genkeypair -v -keystore upload.jks -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

   Then base64-encode it for the `SIGNING_KEY` secret, with no line breaks:

   ```sh
   base64 -w 0 upload.jks          # Linux, Git Bash
   base64 -i upload.jks            # macOS
   ```

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("upload.jks"))   # PowerShell
   ```

4. **The service account**, which lets the workflow upload. In a Google Cloud
   project, enable the **Google Play Android Developer API**, create a service
   account and a JSON key for it. Then, in the Play Console's **Users and
   permissions**, invite the service account's email address and give it the
   release permissions for the app (or for all the IDEMS games). It can take a
   while before Google Play accepts it. An existing IDEMS service account can be
   used instead.

5. Give the game's repository these secrets. If every game uses the same
   upload key and service account, make them IDEMS organisation secrets, and an
   organisation admin adds each game's repository to their repository access
   (organisation settings, Secrets and variables, Actions). Otherwise add them
   to the game's repository (its Settings, Secrets and variables, Actions).

   | Secret                             | Value                                        |
   | ---------------------------------- | -------------------------------------------- |
   | `SIGNING_KEY`                      | The upload keystore, base64-encoded (step 3) |
   | `ALIAS`                            | The key's alias, e.g. `upload`               |
   | `KEY_STORE_PASSWORD`               | The keystore's password                      |
   | `KEY_PASSWORD`                     | The key's password                           |
   | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | The service account's JSON key (step 4)     |

6. **The first release, by hand.** Google Play only accepts an app's first
   bundle in the Play Console, and only allows `draft` releases through the API
   until the app's first release has been rolled out. Add the game's workflow
   (step 7), run **Android - Release** with **track** `none`, and download the
   signed bundle from the run's page (**release-bundle**, under Artifacts; it's a
   zip with the `.aab` inside). Upload it to a release in the Play Console, for
   example under Internal testing, and roll it out. From then on, releases can
   go through the workflow.

7. Add `.github/workflows/android-release.yml` to the game:

   ```yaml
   # Builds the app and uploads it to Google Play, with the Android release shared
   # by every IDEMS game (games-common-core/android-release/README.md). Start it by
   # hand from the Actions tab, after `npm version` and `git push --follow-tags`.
   name: Android - Release

   on:
     workflow_dispatch:
       inputs:
         track:
           description: 'Where to release (none: only build the signed bundle, to download)'
           required: true
           default: internal
           type: choice
           options:
             - internal
             - alpha
             - beta
             - none
         status:
           description: 'completed: released straight away; draft: finish it in the Play Console'
           required: true
           default: completed
           type: choice
           options:
             - completed
             - draft

   permissions:
     contents: read

   jobs:
     release:
       uses: IDEMSInternational/games-common-core/.github/workflows/android-release.yml@main
       with:
         track: ${{ inputs.track }}
         status: ${{ inputs.status }}
       secrets: inherit
   ```

## Releasing

Bump the version, push it with its tag, then run **Android - Release** from the
game's Actions tab:

```sh
npm version patch      # or minor / major
git push --follow-tags
```

Each upload needs a new version, because Google Play refuses a version code it
already has (the game's `versionCode` comes from its version: 1.2.3 is
1002003).

## Changing the release

A change on `main` reaches every game's next release, so try it with one game
first:

1. Push the change to a branch of this repository, for example `my-change`.
2. In a branch of the game, point its `.github/workflows/android-release.yml`
   at that branch: change `@main` to `@my-change`.
3. Run **Android - Release** on the game's branch (Run workflow lets you choose
   the branch), with **track** `none` to only check that the build and signing
   work, or bump the game's version first to try an upload.
4. Once it works, merge the change here. Then switch the game's branch back to
   `@main` and merge it too.

When Google Play starts requiring a newer Android SDK (target API level),
update the game's Android project and the `packages` in the shared workflow, as
[open-app-builder-actions](https://github.com/IDEMSInternational/open-app-builder-actions)
does.
