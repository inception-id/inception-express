import { Request, Response, NextFunction } from "express";
import { ENV } from "../env";
import { responseJson } from "./response";

export const apiKeyMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const apiKey = req.header("x-api-key");

  if (!apiKey) {
    const jsonResponse = responseJson(401, null, "Unauthorized");
    return res.status(401).json(jsonResponse);
  }

  if (apiKey !== ENV.API_KEY) {
    const jsonResponse = responseJson(401, null, "Invalid API key");
    return res.status(401).json(jsonResponse);
  }

  // All good!
  next();
};
