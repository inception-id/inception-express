import { Router } from "express";
import {
  createWhatsappSessionController,
  deleteWhatsappSessionController,
  findWhatsappSessionsController,
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

export const whatsappRouter = Router();
export const whatsappBasePath = "/whatsapp";

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
