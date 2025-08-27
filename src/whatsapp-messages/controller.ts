import { whatsappBasePath, whatsappRouter } from "../whatsapp/controller";
import { accessTokenMiddleware } from "../middleware/request";
import { logger } from "../lib/logger";
import { responseJson } from "../middleware/response";
import { decode, JwtPayload } from "jsonwebtoken";
import { publicApiKeyMiddleware } from "../middleware/request";
import {
  countAllTimeWhatsappMessages,
  countCurrentMonthWhatsappMessage,
  countWhatsappMessages,
  createWhatsappMessage,
  findManyWhatsappMessages,
  WhatsappMessageType,
} from "./services";
import {
  findManyWhatsappSessions,
  findOneWhatsappSession,
} from "../whatsapp-sessions/services";
import { sendWhatsapp } from "../whatsapp/services";
import { Pagination } from "../lib/types";
import { User } from "../users/services";

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
  const endpoint = whatsappBasePath + path;
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
