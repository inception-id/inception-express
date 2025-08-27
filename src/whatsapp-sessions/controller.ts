import { whatsappBasePath, whatsappRouter } from "../whatsapp/controller";
import { accessTokenMiddleware } from "../middleware/request";
import { logger } from "../lib/logger";
import { responseJson } from "../middleware/response";
import { decode, JwtPayload } from "jsonwebtoken";
import { findUserById, User } from "../users/services";
import {
  createWhatsappSession,
  deleteWhatsappSession,
  findManyWhatsappSessions,
} from "./services";
import {
  destroyWhatsappClient,
  initWhatsappClient,
  whatsappQrStore,
} from "../whatsapp/services";

whatsappRouter.post("/sessions", accessTokenMiddleware, async (req, res) => {
  const path = req.path;
  logger.info(
    `${whatsappBasePath + path} Received request to create WhatsApp session`,
  );

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
    logger.error(whatsappBasePath + path, err);
    const json = responseJson(500, null, "Internal server error");
    return res.status(500).json(json);
  }
});

whatsappRouter.get("/sessions", accessTokenMiddleware, async (req, res) => {
  const path = req.path;
  logger.info(
    `${whatsappBasePath + path} Received request to find WhatsApp sessions`,
  );

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
    logger.error(whatsappBasePath + path, err);
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
    const endpoint = `${whatsappBasePath}${path}/${params.sessionId}`;
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
