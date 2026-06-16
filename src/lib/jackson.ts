import jackson, { type JacksonOption, type IOAuthController, type IConnectionAPIController } from "@boxyhq/saml-jackson";

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

const opts: JacksonOption = {
  externalUrl: APP_URL,
  samlAudience: APP_URL,
  samlPath: "/api/auth/saml/callback",
  db: {
    engine: "mem",
  },
  openid: {},
};

let oauthController: IOAuthController;
let connectionController: IConnectionAPIController;
let initialized = false;

async function init() {
  if (initialized) return;
  const ret = await jackson(opts);
  oauthController = ret.oauthController;
  connectionController = ret.connectionAPIController;
  initialized = true;
}

export async function getOAuthController(): Promise<IOAuthController> {
  await init();
  return oauthController;
}

export async function getConnectionController(): Promise<IConnectionAPIController> {
  await init();
  return connectionController;
}
