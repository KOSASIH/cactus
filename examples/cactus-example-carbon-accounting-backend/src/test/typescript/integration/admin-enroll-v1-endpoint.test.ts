import { AddressInfo } from "net";

import test, { Test } from "tape-promise/tape";
import expressJwt from "express-jwt";
import { v4 as uuidv4 } from "uuid";
import { JWK, JWT } from "jose";
import { StatusCodes } from "http-status-codes";

import {
  AuthorizationProtocol,
  ConfigService,
  IAuthorizationConfig,
} from "@hyperledger/cactus-cmd-api-server";

import {
  LoggerProvider,
  LogLevelDesc,
  Servers,
} from "@hyperledger/cactus-common";

import { pruneDockerAllIfGithubAction } from "@hyperledger/cactus-test-tooling";

import {
  AuthzScope,
  DefaultApi as CarbonAccountingApi,
} from "@hyperledger/cactus-example-carbon-accounting-business-logic-plugin";

import {
  CarbonAccountingApp,
  ICarbonAccountingAppOptions,
} from "../../../main/typescript/carbon-accounting-app";

const testCase = "can enroll new admin users onto the Fabric org";
const logLevel: LogLevelDesc = "TRACE";
const log = LoggerProvider.getOrCreate({
  label: testCase,
  level: logLevel,
});

test("BEFORE " + testCase, async (t: Test) => {
  const pruning = pruneDockerAllIfGithubAction({ logLevel });
  await t.doesNotReject(pruning, "Pruning didnt throw OK");
  t.end();
});

test(testCase, async (t: Test) => {
  const jwtKeyPair = await JWK.generate("RSA", 4096);
  const jwtPublicKey = jwtKeyPair.toPEM(false);
  const middlewareOptions: expressJwt.Options = {
    algorithms: ["RS256"],
    secret: jwtPublicKey,
    audience: "carbon-accounting-tool-servers-hostname-here",
    issuer: uuidv4(),
  };
  t.ok(middlewareOptions, "Express JWT config truthy OK");

  const httpGui = await Servers.startOnPreferredPort(3000);
  t.true(httpGui.listening, `httpGui.listening === true`);
  const httpApi = await Servers.startOnPreferredPort(4000);
  t.true(httpApi.listening, `httpApi.listening === true`);
  const addressInfo = httpApi.address() as AddressInfo;
  t.ok(addressInfo, "httpApi.address() truthy OK");
  t.ok(addressInfo.address, "httpApi.address().address truthy OK");
  t.ok(addressInfo.port, "httpApi.address().port truthy OK");
  const { address, port } = addressInfo;
  const apiBaseUrl = `http://${address}:${port}`;

  const authorizationConfig: IAuthorizationConfig = {
    unprotectedEndpointExemptions: [],
    middlewareOptions,
  };

  const configService = new ConfigService();
  const apiSrvOpts = configService.newExampleConfig();
  apiSrvOpts.authorizationProtocol = AuthorizationProtocol.JSON_WEB_TOKEN;
  apiSrvOpts.authorizationConfigJson = authorizationConfig;
  apiSrvOpts.configFile = "";
  apiSrvOpts.apiCorsDomainCsv = "*";
  apiSrvOpts.apiPort = 0;
  apiSrvOpts.cockpitPort = 0;
  apiSrvOpts.apiTlsEnabled = false;
  apiSrvOpts.plugins = [];
  const convictConfig = configService.newExampleConfigConvict(apiSrvOpts);
  const apiServerOptions = convictConfig.getProperties();

  const appOptions: ICarbonAccountingAppOptions = {
    logLevel: apiSrvOpts.logLevel,
    apiServerOptions,
    httpGui,
    httpApi,
    disableSignalHandlers: true,
  };

  const carbonAccountingApp = new CarbonAccountingApp(appOptions);
  test.onFinish(async () => {
    await carbonAccountingApp.stop();
  });

  try {
    await carbonAccountingApp.start();
  } catch (ex) {
    log.error(`CarbonAccountingApp crashed. failing test...`, ex);
    throw ex;
  }

  const jwtPayload = {
    name: "Peter",
    scope: [AuthzScope.GroupAdmin],
  };
  const jwtSignOptions: JWT.SignOptions = {
    algorithm: "RS256",
    issuer: middlewareOptions.issuer,
    audience: middlewareOptions.audience,
  };
  const tokenWithScope = JWT.sign(jwtPayload, jwtKeyPair, jwtSignOptions);
  const verification = JWT.verify(tokenWithScope, jwtKeyPair, jwtSignOptions);
  t.ok(verification, "JWT with scope verification truthy OK");

  const apiClient = new CarbonAccountingApi({
    basePath: apiBaseUrl,
    baseOptions: {
      headers: {
        Authorization: `Bearer ${tokenWithScope}`,
      },
    },
  });

  const res = await apiClient.enrollAdminV1({
    orgName: "Org1MSP",
  });
  t.ok(res, "enrollAdminV1 response truthy OK");
  t.true(res.status >= 200, "enrollAdminV1 status >= 200 OK");
  t.true(res.status < 300, "enrollAdminV1 status < 300 200 OK");

  const tokenNoScope = JWT.sign({ scope: [] }, jwtKeyPair, jwtSignOptions);

  const apiClientBad = new CarbonAccountingApi({
    basePath: apiBaseUrl,
    baseOptions: {
      headers: {
        Authorization: `Bearer ${tokenNoScope}`,
      },
    },
  });

  try {
    await apiClientBad.enrollAdminV1({ orgName: "does-not-matter" });
    t.fail("enroll admin response status === 403 FAIL");
  } catch (out) {
    t.ok(out, "error thrown for forbidden endpoint truthy OK");
    t.ok(out.response, "enroll admin response truthy OK");
    t.equal(
      out.response.status,
      StatusCodes.FORBIDDEN,
      "enroll admin response status === 403 OK",
    );
    t.notok(out.response.data.data, "out.response.data.data falsy OK");
    t.notok(out.response.data.success, "out.response.data.success falsy OK");
  }

  t.end();
});

test("AFTER " + testCase, async (t: Test) => {
  const pruning = pruneDockerAllIfGithubAction({ logLevel });
  await t.doesNotReject(pruning, "Pruning didnt throw OK");
  t.end();
});
