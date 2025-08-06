import { Router } from "express";
import { initWhatsappClient, sendWhatsapp, whatsappQrStore } from "./services";
import { responseJson } from "../middleware/response";
import { Client } from "whatsapp-web.js";
import { findUserById } from "../users/services";
import { createWhatsappSession } from "../whatsapp-sessions/services";
import { logger } from "../lib/logger";

export const whatsappRouter = Router();

const basePath = "/whatsapp";
whatsappRouter.post("/sessions", async (req, res) => {
  const path = req.path;
  // logger.info(`${basePath + path} Received request to create WhatsApp session`);
  if (!req.body) {
    const json = responseJson(400, null, "Missing userId and phone");
    res.status(400).json(json);
  }

  const { userId, phone } = req.body as {
    userId: string;
    phone: string;
  };

  if (!userId || !phone) {
    const json = responseJson(400, null, "Missing userId and phone");
    res.status(400).json(json);
    return;
  }

  if (!phone.match(/^8\d*$/)) {
    // should start with 8 and contain only digits
    const json = responseJson(400, null, "Invalid phone number");
    res.status(400).json(json);
    return;
  }

  try {
    const user = await findUserById(userId);
    if (!user) {
      const json = responseJson(400, null, "User not found");
      res.status(400).json(json);
      return;
    }
    const session = await createWhatsappSession(user.id, phone);
    if (session?.length === 0) {
      const json = responseJson(500, null, "Fail to create session");
      res.status(500).json(json);
      return;
    }
    const client = await initWhatsappClient(session[0].id);
    const qr = whatsappQrStore.get(session[0].id);
    const json = responseJson(201, { qr }, "");
    res.status(201).json(json);
  } catch (err: any) {
    logger.error(basePath + path, err);
    const json = responseJson(500, null, "Internal server error");
    res.status(500).json(json);
  }
});

whatsappRouter.post("/qr/:clientId", async (req, res) => {
  const { clientId } = req.params;

  try {
    const client = await initWhatsappClient(clientId);
    const qr = whatsappQrStore.get(clientId);
    const json = responseJson(201, { qr }, "");
    res.status(201).json(json);
  } catch (err: any) {
    const json = responseJson(500, null, err?.response.message);
    res.status(500).json(json);
  }
});

whatsappRouter.post("/message/:clientId", async (req, res) => {
  const { clientId } = req.params;
  try {
    // let client = whatsappClientStore.get(clientId);
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
