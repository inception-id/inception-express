import { Router } from "express";
import {
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
  findWhatsappSessions,
} from "../whatsapp-sessions/services";
import { logger } from "../lib/logger";
import { accessTokenMiddleware } from "../middleware/request";
import { decode, JwtPayload } from "jsonwebtoken";

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
    const sessions = await findWhatsappSessions({
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

whatsappRouter.post("/message/:clientId", async (req, res) => {
  const { phoneId, targetPhoneNumber, message } = req.body as {
    phoneId: string;
    targetPhoneNumber: string;
    message: string;
  };

  try {
    let client = whatsappClientStore.get(phoneId);
    // if (!client) {
    //   console.log(`CLIENT ID: ${clientId} does not exist!`);
    //   const newClient = await initWhatsappClient(clientId);
    //   whatsappClientStore.set(clientId, newClient);
    //   client = newClient;
    // } else {
    //   console.log(`CLIENT ID: ${clientId} already exists!`);
    // }
    // const msg = await sendWhatsapp(clientId, client);
    // const qr = whatsappQrStore.get(clientId);
    const json = responseJson(
      201,
      { message: "Message sent successfully" },
      "",
    );
    res.status(201).json(json);
  } catch (err: any) {
    const json = responseJson(500, null, err?.response.message);
    res.status(500).json(json);
  }
});
