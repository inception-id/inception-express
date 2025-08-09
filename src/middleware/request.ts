import { Request, Response, NextFunction } from "express";
import { ENV } from "../env";
import { responseJson } from "./response";
import { logger } from "../lib/logger";

const verifyAccessToken = async (
  accessToken: string,
): Promise<{ status: string }> => {
  try {
    logger.info("Verifying access token");
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
    logger.error("Error verifying access token", error);
    throw error;
  }
};

export const accessTokenMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  logger.info("Access token middleware");
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
