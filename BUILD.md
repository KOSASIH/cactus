# Hyperledger Cactus Build Instructions

This is the place to start if you want to give Cactus a spin on your local
machine or if you are planning on contributing.

> This is not a guide for `using` Cactus for your projects that have business logic
> but rather a guide for people who want to make changes to the code of Cactus.
> If you are just planning on using Cactus as an npm dependency for your project,
> then you might not need this guide at all.

The project uses Typescript for both back-end and front-end components.

## Fast Developer Flow / Code Iterations

We put a lot of thought and effort into making sure that fast developer iterations can be
achieved (please file a bug if you feel otherwise) while working **on** the framework. 

If you find yourself waiting too much for builds to finish, most of the time 
that can be helped by using the `npm run watch` script which can automatically 
recompile packages as you modify them (and only the packages that you have 
modified, not everything).

It also supports re-running the OpenAPI generator when you update any 
`openapi.json` spec files that we use to describe our endpoints.

The `npm run watch` script in action:

![Fast Developer Flow / Code Iterations](./docs/hyperledger-cactus-watch-script-tutorial-2021-03-06.gif)

## Getting Started

* Install OS level dependencies:
  * Windows Only
    * WSL1 or WSL2 or any virtual machine running Ubuntu LTS
  * Git
  * NodeJS 12 or newer LTS (we recommend using nvm if available for your OS)
  * OpenJDK 11
  * Docker Engine
  * Docker Compose

* Clone the repository

```sh
git clone https://github.com/hyperledger/cactus.git
```


Windows specific gotcha: `File paths too long` error when cloning. To fix:
Open PowerShell with administrative rights and then run the following:

```sh
git config --system core.longpaths true
```

* Change directories to the project root

```sh
cd cactus
```

* Run the CI script (takes a long time, 10+ minutes on an average laptop)

```sh
./tools/ci.sh
```

At this point you should have all packages built and verified with the full
test suite including unit and integration tests that leverage docker containers
to run ledgers, contract deployments, etc.

You can start making your changes (use your own fork and a feature branch)
or just run existing tests and debug them to see how things fit together.

For example you can *run a ledger contract deployment test* via the
REST API with this command:

```sh
npx tap --timeout=600 packages/cactus-test-plugin-ledger-connector-quorum/src/test/typescript/integration/plugin-ledger-connector-quorum/deploy-contract/deploy-contract-via-web-service.ts
```

*You can also start the API server* and verify more complex scenarios with an
arbitrary list of plugins loaded into Cactus. This is useful for when you intend
to develop your plugin either as a Cactus maintained plugin or one on your own.

```sh
npm run generate-api-server-config
```

Notice how this task created a .config.json file in the project root with an
example configuration that can be used a good starting point for you to make
changes to it specific to your needs or wants.

The most interesting part of the `.config.json` file is the plugins array which
takes a list of plugin package names and their options (which can be anything
that you can fit into a generic JSON object).

Notice that to include a plugin, all you need is specify it's npm package name
(and ensure that said package is actually installed). This is important since
it allows you to have your own plugins in their respective, independent Github
repositories and npm packages where you do not have to seek explicit approval
from the Cactus maintainers to create/maintain your plugin at all.

Once you are satisfied with the `.config.json` file's contents you can just:

```sh
npm run start:api-server
```

After starting the API server, you will see in the logs that plugins were loaded
and that the API is reachable on the port you specified (4000 by default) and
the Web UI (Cockpit) is reachable through port on the port your config
specified (3000 by default).

> You may need to enable manually the CORS patterns in the configuration file.
This may be slightly inconvenient, but something we are unable to compromise on
despite valuing developer experience very much. We have decided that the
software should be `secure by default` above all else and allow for
customization/degradation of security as an opt-in feature rather than starting
from that state.

At this point, with the running API server, you can
* Test the REST API directly with tools like cURL or Postman
* Develop your own applications against it with the `Cactus SDK`
* Create and test your own plugins


#### Random Windows specific issues not covered here

We recommend you use WSL or WSL2 or any Linux VM. We test most frequently on
Ubuntu LTS which at the time of this writing means 18.04 and/or 20.04.

## Build Script Decision Tree

The `npm run watch` script should cover 99% of the cases when it comes to working
on Cactus code and having it recompile, but for that last 1% you'll need to
get your hands dirty with the rest of the build scripts. Usually this is only
needed when you are adding new dependencies (npm packages) as part of something
that you are implementing.

There are a lot of different build scripts in Cactus in order to provide contributors
fine(r) grained control over what parts of the framework they wish build.

> Q: Why the complexity of so many build scripts?
>
> A: We could just keep it simple with a single build script that builds everything
always, but that would be a nightmare to wait for after having changed a single
line of code for example.

To figure out which script could work for rebuilding Cactus, please follow
the following decision tree (and keep in mind that we have `npm run watch` too)

![Build Script Decision Tree](./docs/images/build-script-decision-tree-2021-03-06.png)
