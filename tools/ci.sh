#!/usr/bin/env bash

###
### Continous Integration Shell Script
###
### Designed to be re-entrant on a local dev machine as well, not just on a
### newly pulled up VM.
###
echo $BASH_VERSION

STARTED_AT=`date +%s`
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PROJECT_ROOT_DIR="$SCRIPT_DIR/.."
CHANGED_FILES="$(git diff-index --name-only HEAD --)"

function checkWorkTreeStatus()
{
  git update-index -q --refresh
  new_changed_files="$(git diff-index --name-only HEAD --)"
  if [ "${CHANGED_FILES}" != "${new_changed_files}" ]; then
    echo >&2 "Changes in the git index have been detected!"
    exit 1
  fi
}

function mainTask()
{
  set -euxo pipefail

  if ! [ -x "$(command -v lscpu)" ]; then
    echo 'lscpu is not installed, skipping...'
  else
    lscpu || true
  fi

  if ! [ -x "$(command -v lsmem)" ]; then
    echo 'lsmem is not installed, skipping...'
  else
    lsmem || true
  fi

  if ! [ -x "$(command -v smem)" ]; then
    echo 'smem is not installed, skipping...'
  else
    smem --abbreviate --totals --system || true
  fi

  docker --version
  docker-compose --version
  node --version
  npm --version
  java -version

  ### COMMON
  cd $PROJECT_ROOT_DIR

  # https://stackoverflow.com/a/61789467
  npm config list
  npm config delete proxy
  npm config delete http-proxy
  npm config delete https-proxy

  # https://stackoverflow.com/a/15483897
  npm cache verify
  npm cache clean --force
  npm cache verify

  npm ci
  ./node_modules/.bin/lerna bootstrap

  # The "quick" build that is enough for the tests to be runnable
  npm run build:dev:backend

  # Tests are still flaky (on weak hardware such as the CI env) despite our best
  # efforts so here comes the mighty hammer of brute force. 3 times the charm...
  {
    npm run test:all -- --bail && echo "$(date +%FT%T%z) [CI] First (#1) try of tests succeeded OK."
  } ||
  {
    echo "$(date +%FT%T%z) [CI] First (#1) try of tests failed starting second try now..."
    npm run test:all -- --bail && echo "$(date +%FT%T%z) [CI] Second (#2) try of tests succeeded OK."
  } ||
  {
    # If the third try fails then the execution will reach the last echo and the exit 1 statement
    # ensuring that the script crashes if 3 out of 3 test runs have failed.
    echo "$(date +%FT%T%z) [CI] Second (#2) try of tests failed starting third and last try now..."
    npm run test:all -- --bail && echo "$(date +%FT%T%z) [CI] Third (#3) try of tests succeeded OK." || \
      echo "$(date +%FT%T%z) [CI] Third (#3) try of tests failed so giving up at this point" ; exit 1
  }

  # The webpack production build needs more memory than the default allocation
  export NODE_OPTIONS=--max_old_space_size=4096

  # We run the full build last because the tests don't need it so in the interest
  # of providing feedback about failing tests as early as possible we run the
  # dev:backend build first and then the tests which is the fastest way to get
  # to a failed test if there was one.
  npm run build

  ENDED_AT=`date +%s`
  runtime=$((ENDED_AT-STARTED_AT))
  echo "$(date +%FT%T%z) [CI] SUCCESS - runtime=$runtime seconds."
  checkWorkTreeStatus
  exit 0
}

function onTaskFailure()
{
  set +eu # do not crash process upon individual command failures

  ENDED_AT=`date +%s`
  runtime=$((ENDED_AT-STARTED_AT))
  echo "$(date +%FT%T%z) [CI] FAILURE - runtime=$runtime seconds."
  exit 1
}

(
  mainTask
)
if [ $? -ne 0 ]; then
  onTaskFailure
fi
