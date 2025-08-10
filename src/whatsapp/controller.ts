import { Router } from "express";
import {
  destroyWhatsappClient,
  initWhatsappClient,
  sendWhatsapp,
  whatsappClientStore,
  whatsappQrStore,
} from "./services";
import { responseJson } from "../middleware/response";
import { Client } from "whatsapp-web.js";
import { findUserById, User } from "../users/services";
import {
  createWhatsappSession,
  deleteWhatsappSession,
  findManyWhatsappSessions,
  findOneWhatsappSession,
} from "../whatsapp-sessions/services";
import { logger } from "../lib/logger";
import { accessTokenMiddleware } from "../middleware/request";
import { decode, JwtPayload } from "jsonwebtoken";
import { createWhatsappMessage } from "../whatsapp-messages/services";

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

whatsappRouter.post("/message", async (req, res) => {
  const { whatsappPhoneId, whatsappPhoneNumber, targetPhoneNumber, message } =
    req.body as {
      whatsappPhoneId: string;
      whatsappPhoneNumber: string;
      targetPhoneNumber: string;
      message: string;
    };

  const path = req.path;
  const endpoint = basePath + path;
  logger.info(`${endpoint} Received request to send WhatsApp message`);

  if (
    !whatsappPhoneId ||
    !whatsappPhoneNumber ||
    !targetPhoneNumber ||
    !message
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
    const sentMessage = await sendWhatsapp(
      whatsappSession.id,
      targetPhoneNumber,
      message,
    );
    const whatsappMessage = await createWhatsappMessage({
      session_id: sentMessage.sessionId,
      target_phone: sentMessage.phoneNumber,
      text_message: sentMessage.message,
    });
    const json = responseJson(201, whatsappMessage, "");
    res.status(201).json(json);
  } catch (err: any) {
    const json = responseJson(500, null, err?.response.message);
    res.status(500).json(json);
  }
});
