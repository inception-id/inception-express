import { Request, Response, Router } from "express";
import {
  accessTokenMiddleware,
  publicApiKeyMiddleware,
} from "../middleware/request";
import { logger } from "../lib/logger";
import { responseJson } from "../middleware/response";
import { decode, JwtPayload } from "jsonwebtoken";
import { User } from "../users/services";
import waNotif from "../whatsapp-notifications";
import waMessage from "../whatsapp-messages";
import waSessions from "../whatsapp-sessions";

export const whatsappRouter = Router();
export const whatsappBasePath = "/whatsapp";

// COUNTS
export const countAllTimeMessagesAndNotificationsController = async (
  req: Request,
  res: Response,
): Promise<any> => {
  logger.info(`countAllTimeMessagesAndNotificationsController`);
  try {
    const accessToken = req.header("x-access-token") as string;
    const jwt = decode(accessToken) as JwtPayload & User;
    const sessions = await waSessions.services.findMany({ user_id: jwt.id });
    const sessionIds = sessions.map((session) => session.id);
    const messages = await waMessage.services.countAllTime(sessionIds);
    const notifications = await waNotif.services.countAllTime(jwt.id);
    const json = responseJson(200, { messages, notifications }, "");
    res.status(500).json(json);
  } catch (err) {
    logger.error("Error counting all time messages and notifications", err);
    const json = responseJson(500, null, "");
    res.status(500).json(json);
  }
};

// SESSIONS
whatsappRouter.get(
  "/all-time-counts",
  accessTokenMiddleware,
  countAllTimeMessagesAndNotificationsController,
);

// SESSIONS
whatsappRouter.post(
  "/sessions",
  accessTokenMiddleware,
  waSessions.controller.create,
);

whatsappRouter.get(
  "/sessions",
  accessTokenMiddleware,
  waSessions.controller.findMany,
);

whatsappRouter.delete(
  "/sessions/:sessionId",
  accessTokenMiddleware,
  waSessions.controller.remove,
);

// MESSAGES
whatsappRouter.post(
  "/messages",
  publicApiKeyMiddleware,
  waMessage.controller.send,
);
whatsappRouter.post(
  "/messages/batch",
  publicApiKeyMiddleware,
  waMessage.controller.sendBatch,
);
whatsappRouter.get(
  "/messages",
  accessTokenMiddleware,
  waMessage.controller.findMany,
);

// NOTIFICATIONS
whatsappRouter.post(
  "/notifications",
  publicApiKeyMiddleware,
  waNotif.controller.send,
);

whatsappRouter.post(
  "/notifications/batch",
  publicApiKeyMiddleware,
  waNotif.controller.sendBatch,
);

whatsappRouter.get(
  "/notifications",
  accessTokenMiddleware,
  waNotif.controller.findMany,
);
