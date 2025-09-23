import { Request, Response, NextFunction } from "express";
import { ENV } from "../env";
import { responseJson } from "./response";
import { logger } from "../lib/logger";
import bcrypt from "bcrypt";
import apiKeys from "../api-keys";

const verifyAccessToken = async (
  accessToken: string,
): Promise<{ status: string }> => {
  try {
    logger.info("[verifyAccessToken]");
    if (!ENV.SUPERTOKENS_CONNECTION_URI || !ENV.SUPERTOKENS_API_KEY) {
      throw new Error("SUPERTOKENS ENV are not set");
    }
    const res = await fetch(
      `${ENV.SUPERTOKENS_CONNECTION_URI}/recipe/session/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": ENV.SUPERTOKENS_API_KEY,
        },
        body: JSON.stringify({
          accessToken,
          enableAntiCsrf: false,
          doAntiCsrfCheck: false,
          checkDatabase: true,
        }),
      },
    );
    return await res.json();
  } catch (error) {
    logger.error("[verifyAccessToken]", error);
    throw error;
  }
};

export const accessTokenMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  logger.info("[accessTokenMiddleware]");
  const accessToken = req.header("x-access-token");

  if (!accessToken) {
    const jsonResponse = responseJson(401, null, "Unauthorized");
    return res.status(401).json(jsonResponse);
  }
  const tokenVerification = await verifyAccessToken(accessToken);

  if (tokenVerification.status !== "OK") {
    const jsonResponse = responseJson(
      403,
      tokenVerification,
      tokenVerification.status,
    );
    return res.status(403).json(jsonResponse);
  }

  // All good!
  next();
};

export const publicApiKeyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  logger.info("[publicApiKeyMiddleware]");
  const apiKeyId = req.header("x-client-id");
  const apiKey = req.header("x-api-key");

  if (!apiKeyId || !apiKey) {
    const jsonResponse = responseJson(401, null, "Unauthorized");
    return res.status(401).json(jsonResponse);
  }

  const dbApiKey = await apiKeys.services.find({ id: apiKeyId });
  if (!dbApiKey) {
    const jsonResponse = responseJson(400, null, "Invalid API Key");
    return res.status(400).json(jsonResponse);
  }

  const isValid = await bcrypt.compare(apiKey, dbApiKey.api_key);
  if (!isValid) {
    const jsonResponse = responseJson(403, null, "Forbidden");
    return res.status(403).json(jsonResponse);
  }

  // All good!
  next();
};
