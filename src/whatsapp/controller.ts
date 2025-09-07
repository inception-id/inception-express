import { Request, Response, Router } from "express";
import {
  createWhatsappSessionController,
  deleteWhatsappSessionController,
  findWhatsappSessionsController,
  updateWhatsappSessionController,
} from "../whatsapp-sessions/controller";
import {
  accessTokenMiddleware,
  publicApiKeyMiddleware,
} from "../middleware/request";
import {
  findWhatsappMessagesController,
  sendWhatsappMessageController,
} from "../whatsapp-messages/controller";
import {
  findWhatsappNotificationsController,
  sendWhatsappNotificationsController,
} from "../whatsapp-notifications/controller";
import { logger } from "../lib/logger";
import { responseJson } from "../middleware/response";
import { countAllTimeWhatsappNotifications } from "../whatsapp-notifications/services";
import { countAllTimeWhatsappMessages } from "../whatsapp-messages/services";
import { decode, JwtPayload } from "jsonwebtoken";
import { User } from "../users/services";
import { findManyWhatsappSessions } from "../whatsapp-sessions/services";

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
    const sessions = await findManyWhatsappSessions({ user_id: jwt.id });
    const sessionIds = sessions.map((session) => session.id);
    const messages = await countAllTimeWhatsappMessages(sessionIds);
    const notifications = await countAllTimeWhatsappNotifications(jwt.id);
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
  createWhatsappSessionController,
);

whatsappRouter.get(
  "/sessions",
  accessTokenMiddleware,
  findWhatsappSessionsController,
);

whatsappRouter.put(
  "/sessions/:sessionId",
  accessTokenMiddleware,
  updateWhatsappSessionController,
);

whatsappRouter.delete(
  "/sessions/:sessionId",
  accessTokenMiddleware,
  deleteWhatsappSessionController,
);

// MESSAGES
whatsappRouter.post(
  "/messages",
  publicApiKeyMiddleware,
  sendWhatsappMessageController,
);
whatsappRouter.get(
  "/messages",
  accessTokenMiddleware,
  findWhatsappMessagesController,
);

// NOTIFICATIONS
whatsappRouter.post(
  "/notifications",
  publicApiKeyMiddleware,
  sendWhatsappNotificationsController,
);

whatsappRouter.get(
  "/notifications",
  accessTokenMiddleware,
  findWhatsappNotificationsController,
);
