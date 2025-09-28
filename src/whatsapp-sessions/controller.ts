import { Request, Response } from "express";
import { logger } from "../lib/logger";
import { responseJson } from "../middleware/response";
import { decode, JwtPayload } from "jsonwebtoken";
import { services } from "./services";
import z from "zod";
import whatsapp from "../whatsapp";
import users from "../users";
import { User } from "../users/services";

const create = async (req: Request, res: Response) => {
  logger.info("wa-session-controller-create");

  if (!req.body) {
    const json = responseJson(400, null, "Missing userId and phone");
    return res.status(400).json(json);
  }

  let { phone } = req.body as {
    phone: string;
  };

  if (!phone) {
    const json = responseJson(400, null, "Missing phone");
    return res.status(400).json(json);
  }

  if (!phone.match(/^8\d*$/)) {
    // should start with 8 and contain only digits
    const json = responseJson(
      400,
      null,
      "Phone should start with 8 and contain only digits",
    );
    return res.status(400).json(json);
  }
  if (phone.length < 9) {
    const json = responseJson(
      400,
      null,
      "Phone should be at least 9 digits long",
    );
    return res.status(400).json(json);
  }

  if (phone.startsWith("0")) {
    phone = phone.slice(1, phone.length);
  }

  try {
    const accessToken = req.header("x-access-token") as string;
    const jwt = decode(accessToken) as JwtPayload & User;
    const user = await users.services.find({ id: jwt.id });
    if (!user) {
      const json = responseJson(400, null, "User not found");
      return res.status(400).json(json);
    }
    const session = await services.create({ user_id: user.id, phone });
    if (session?.length === 0) {
      const json = responseJson(500, null, "Fail to create session");
      return res.status(500).json(json);
      return;
    }
    const client = await whatsapp.services.initClient(session[0].id);
    if (client) {
      const qr = whatsapp.services.getClientQr(session[0].id);
      const json = responseJson(201, { qr }, "");
      return res.status(201).json(json);
    } else {
      const json = responseJson(500, null, "Internal server error");
      return res.status(500).json(json);
    }
  } catch (err: any) {
    logger.error("[wa-session-controller-create]", err);
    const json = responseJson(500, null, "Internal server error");
    return res.status(500).json(json);
  }
};

const findMany = async (req: Request, res: Response) => {
  logger.info("[wa-session-controller-find]");

  try {
    const accessToken = req.header("x-access-token") as string;
    const jwt = decode(accessToken) as JwtPayload & User;
    const sessions = await services.findMany({
      user_id: jwt.id,
      is_ready: true,
      is_deleted: false,
    });
    const json = responseJson(200, sessions, "");
    return res.status(200).json(json);
  } catch (err: any) {
    logger.error("[wa-session-controller-find]", err);
    const json = responseJson(500, null, "Internal server error");
    return res.status(500).json(json);
  }
};

const remove = async (req: Request, res: Response) => {
  const params = req.params;
  logger.info("[wa-session-controller-remove]");

  try {
    const accessToken = req.header("x-access-token") as string;
    const jwt = decode(accessToken) as JwtPayload & User;
    const sessions = await services.update(
      {
        id: params.sessionId,
        user_id: jwt.id,
      },
      { is_deleted: true },
    );
    if (sessions) await whatsapp.services.destroyClient(params.sessionId);
    const json = responseJson(200, sessions, "");
    return res.status(200).json(json);
  } catch (err: any) {
    logger.error("[wa-session-controller-remove]", err);
    const json = responseJson(500, null, "Internal server error");
    return res.status(500).json(json);
  }
};

export const controller = { create, findMany, remove };
