import { Router } from "express";
import {
  destroyWhatsappClient,
  initWhatsappClient,
  sendWhatsapp,
  whatsappClientStore,
  whatsappQrStore,
} from "./services";
import { responseJson } from "../middleware/response";
import { findUserById, User } from "../users/services";
import {
  createWhatsappSession,
  deleteWhatsappSession,
  findManyWhatsappSessions,
  findOneWhatsappSession,
} from "../whatsapp-sessions/services";
import { logger } from "../lib/logger";
import {
  accessTokenMiddleware,
  publicApiKeyMiddleware,
} from "../middleware/request";
import { decode, JwtPayload } from "jsonwebtoken";
import {
  countAllTimeWhatsappMessages,
  countCurrentMonthWhatsappMessage,
  countWhatsappMessages,
  createWhatsappMessage,
  findManyWhatsappMessages,
  WhatsappMessageType,
} from "../whatsapp-messages/services";
import { Pagination } from "../lib/types";
import {
  countCurrentMonthWhatsappNotifications,
  createWhatsappNotification,
  WhatsappEnvironment,
} from "../whatsapp-notifications/services";
import { ENV } from "../env";
import { findApiKey } from "../api-keys/services";

export const whatsappRouter = Router();

const basePath = "/whatsapp";

whatsappRouter.post("/sessions", accessTokenMiddleware, async (req, res) => {
  const path = req.path;
  logger.info(`${basePath + path} Received request to create WhatsApp session`);

  if (!req.body) {
    const json = responseJson(400, null, "Missing userId and phone");
    return res.status(400).json(json);
  }

  let { phone } = req.body as {
    phone: string;
  };

  if (!phone) {
    const json = responseJson(400, null, "Missing userId and phone");
    return res.status(400).json(json);
  }

  if (!phone.match(/^8\d*$/) || phone.length < 9) {
    // should start with 8 and contain only digits
    const json = responseJson(
      400,
      null,
      "Phone should start with 8 and contain only digits",
    );
    return res.status(400).json(json);
  }

  if (phone.startsWith("0")) {
    phone = phone.slice(1, phone.length);
  }

  try {
    const accessToken = req.header("x-access-token") as string;
    const jwt = decode(accessToken) as JwtPayload & User;
    const user = await findUserById(jwt.id);
    if (!user) {
      const json = responseJson(400, null, "User not found");
      return res.status(400).json(json);
    }
    const session = await createWhatsappSession(user.id, phone);
    if (session?.length === 0) {
      const json = responseJson(500, null, "Fail to create session");
      return res.status(500).json(json);
      return;
    }
    const client = await initWhatsappClient(session[0].id);
    const qr = whatsappQrStore.get(session[0].id);
    const json = responseJson(201, { qr }, "");
    return res.status(201).json(json);
  } catch (err: any) {
    logger.error(basePath + path, err);
    const json = responseJson(500, null, "Internal server error");
    return res.status(500).json(json);
  }
});

whatsappRouter.get("/sessions", accessTokenMiddleware, async (req, res) => {
  const path = req.path;
  logger.info(`${basePath + path} Received request to find WhatsApp sessions`);

  try {
    const accessToken = req.header("x-access-token") as string;
    const jwt = decode(accessToken) as JwtPayload & User;
    const sessions = await findManyWhatsappSessions({
      user_id: jwt.id,
      is_ready: true,
      is_deleted: false,
    });
    const json = responseJson(200, sessions, "");
    return res.status(200).json(json);
  } catch (err: any) {
    logger.error(basePath + path, err);
    const json = responseJson(500, null, "Internal server error");
    return res.status(500).json(json);
  }
});

whatsappRouter.delete(
  "/sessions/:sessionId",
  accessTokenMiddleware,
  async (req, res) => {
    const path = req.path;
    const params = req.params;
    const endpoint = `${basePath}${path}/${params.sessionId}`;
    logger.info(`${endpoint} Received request to delete WhatsApp session`);

    try {
      const accessToken = req.header("x-access-token") as string;
      const jwt = decode(accessToken) as JwtPayload & User;
      const sessions = await deleteWhatsappSession(params.sessionId, jwt.id);
      if (sessions) await destroyWhatsappClient(params.sessionId);
      const json = responseJson(200, sessions, "");
      return res.status(200).json(json);
    } catch (err: any) {
      logger.error(endpoint, err);
      const json = responseJson(500, null, "Internal server error");
      return res.status(500).json(json);
    }
  },
);

whatsappRouter.post("/messages", publicApiKeyMiddleware, async (req, res) => {
  let {
    whatsappPhoneId,
    whatsappPhoneNumber,
    targetPhoneNumber,
    message,
    environment,
  } = req.body as {
    whatsappPhoneId: string;
    whatsappPhoneNumber: string;
    targetPhoneNumber: string;
    message: string;
    environment: WhatsappMessageType;
  };

  const path = req.path;
  const endpoint = basePath + path;
  logger.info(`${endpoint} Received request to send WhatsApp message`);

  if (
    !whatsappPhoneId ||
    !whatsappPhoneNumber ||
    !targetPhoneNumber ||
    !message ||
    !environment
  ) {
    const json = responseJson(400, null, "Missing required parameters");
    return res.status(400).json(json);
  }

  if (!whatsappPhoneNumber.match(/^8\d*$/) || whatsappPhoneNumber.length < 9) {
    // should start with 8 and contain only digits
    const json = responseJson(
      400,
      null,
      "Invalid whatsappPhoneNumber: Should start with 8 and contain only digits",
    );
    return res.status(400).json(json);
  }

  if (!targetPhoneNumber.match(/^8\d*$/) || targetPhoneNumber.length < 9) {
    // should start with 8 and contain only digits
    const json = responseJson(
      400,
      null,
      "Invalid targetPhoneNumber: Should start with 8, contain only digits, and be at least 9 characters long",
    );
    return res.status(400).json(json);
  }

  if (environment !== WhatsappMessageType.Production.toString()) {
    environment = WhatsappMessageType.Development;
  }

  try {
    const whatsappSession = await findOneWhatsappSession({
      id: whatsappPhoneId,
      phone: whatsappPhoneNumber,
      is_ready: true,
    });
    if (!whatsappSession) {
      const json = responseJson(404, null, "Whatsapp id and number not found");
      return res.status(404).json(json);
    }
    const userSessions = await findManyWhatsappSessions({
      user_id: whatsappSession.user_id,
      is_ready: true,
    });
    const sessionIds = userSessions.map((session) => session.id);
    const messageCount = await countCurrentMonthWhatsappMessage(sessionIds);
    const messageEnvironment = messageCount.find(
      (msg) => msg.message_type === environment,
    );
    if (environment === WhatsappMessageType.Development) {
      if (messageEnvironment && Number(messageEnvironment?.count) > 100) {
        const json = responseJson(
          429,
          null,
          `Rate limit exceeded for ${environment} Environment`,
        );
        return res.status(429).json(json);
      }
    } else {
      // handle production here
    }

    const sentMessage = await sendWhatsapp(
      whatsappSession.id,
      targetPhoneNumber,
      message,
    );
    const whatsappMessage = await createWhatsappMessage({
      session_id: sentMessage.sessionId,
      target_phone: sentMessage.phoneNumber,
      text_message: sentMessage.message,
      message_type: environment,
    });
    const json = responseJson(
      201,
      {
        messageId: whatsappMessage[0].id,
        whatsappPhoneId,
        whatsappPhoneNumber,
        targetPhoneNumber,
        message,
        environment: environment,
      },
      "",
    );
    res.status(201).json(json);
  } catch (err: any) {
    const json = responseJson(500, null, "");
    res.status(500).json(json);
  }
});

whatsappRouter.get("/messages", accessTokenMiddleware, async (req, res) => {
  try {
    const { page, perPage, environment } = req.query as {
      page?: string;
      perPage?: string;
      environment?: WhatsappMessageType;
    };

    if (
      environment &&
      environment !== WhatsappMessageType.Development.toString() &&
      environment !== WhatsappMessageType.Production.toString()
    ) {
      const json = responseJson(400, null, "Invalid environment");
      return res.status(400).json(json);
    }

    const accessToken = req.header("x-access-token") as string;
    const jwt = decode(accessToken) as JwtPayload & User;
    const sessions = await findManyWhatsappSessions({ user_id: jwt.id });
    const sessionIds = sessions.map((session) => session.id);
    const limit = perPage ? Number(perPage) : 100;
    const offset = page && Number(page) > 1 ? (Number(page) - 1) * limit : 0;
    const messages = await findManyWhatsappMessages({
      sessionIds,
      offset,
      limit,
      environment,
    });
    const { count } = await countWhatsappMessages({
      sessionIds,
      environment,
    });
    const pagination: Pagination = {
      page: page ? Number(page) : 1,
      perPage: limit,
      total: Number(count),
      totalPages: Number(count) > limit ? Math.round(Number(count) / limit) : 1,
    };

    const json = responseJson(200, { messages, pagination }, "");
    res.status(500).json(json);
  } catch (err: any) {
    const json = responseJson(500, null, "");
    res.status(500).json(json);
  }
});

whatsappRouter.get(
  "/messages/count",
  accessTokenMiddleware,
  async (req, res) => {
    try {
      const { environment } = req.query as {
        environment: WhatsappMessageType;
      };
      if (!environment) {
        const json = responseJson(400, null, "Missing environment query");
        return res.status(400).json(json);
      }

      if (
        environment !== WhatsappMessageType.Development.toString() &&
        environment !== WhatsappMessageType.Production.toString()
      ) {
        const json = responseJson(400, null, "Invalid environment");
        return res.status(400).json(json);
      }

      const accessToken = req.header("x-access-token") as string;
      const jwt = decode(accessToken) as JwtPayload & User;
      const sessions = await findManyWhatsappSessions({ user_id: jwt.id });
      const sessionIds = sessions.map((session) => session.id);
      const count = await countAllTimeWhatsappMessages(sessionIds, environment);

      const json = responseJson(200, count, "");
      res.status(500).json(json);
    } catch (err: any) {
      const json = responseJson(500, null, "");
      res.status(500).json(json);
    }
  },
);

whatsappRouter.post(
  "/notifications",
  publicApiKeyMiddleware,
  async (req, res) => {
    let { targetPhoneNumber, message, environment } = req.body as {
      targetPhoneNumber: string;
      message: string;
      environment: WhatsappEnvironment;
    };

    const path = req.path;
    const endpoint = basePath + path;
    logger.info(`${endpoint} Received request to send WhatsApp notification`);

    if (!targetPhoneNumber || !message || !environment) {
      const json = responseJson(400, null, "Missing required parameters");
      return res.status(400).json(json);
    }

    if (!targetPhoneNumber.match(/^8\d*$/) || targetPhoneNumber.length < 9) {
      // should start with 8 and contain only digits
      const json = responseJson(
        400,
        null,
        "Invalid targetPhoneNumber: Should start with 8, contain only digits, and be at least 9 characters long",
      );
      return res.status(400).json(json);
    }

    if (environment !== WhatsappEnvironment.Production.toString()) {
      environment = WhatsappEnvironment.Development;
    }

    try {
      const apiKeyId = req.header("x-client-id") as string;

      const dbApiKey = await findApiKey(apiKeyId);
      const userId = dbApiKey[0].user_id;

      const notificationCount =
        await countCurrentMonthWhatsappNotifications(userId);
      const notifEnvironment = notificationCount.find(
        (msg) => msg.environment === environment,
      );
      if (environment === WhatsappEnvironment.Development) {
        if (notifEnvironment && Number(notifEnvironment?.count) > 100) {
          const json = responseJson(
            429,
            null,
            `Rate limit exceeded for ${environment} Environment`,
          );
          return res.status(429).json(json);
        }
      } else {
        // handle production here
      }

      const sentMessage = await sendWhatsapp(
        String(ENV.INCEPTION_WHATSAPP_SESSION_ID),
        targetPhoneNumber,
        message,
      );

      const whatsappNotif = await createWhatsappNotification({
        session_id: sentMessage.sessionId,
        user_id: userId,
        target_phone: sentMessage.phoneNumber,
        text_message: sentMessage.message,
        environment,
      });
      const json = responseJson(
        201,
        {
          notificationId: whatsappNotif[0].id,
          targetPhoneNumber,
          message,
          environment,
        },
        "CREATED",
      );
      res.status(201).json(json);
    } catch (err: any) {
      const json = responseJson(500, null, "");
      res.status(500).json(json);
    }
  },
);
