import { whatsappBasePath, whatsappRouter } from "../whatsapp/controller";
import { logger } from "../lib/logger";
import { responseJson } from "../middleware/response";
import { sendWhatsapp } from "../whatsapp/services";
import {
  countCurrentMonthWhatsappNotifications,
  countWhatsappNotifications,
  createWhatsappNotification,
  findManyWhatsappNotifications,
  WhatsappEnvironment,
} from "./services";
import { findApiKey } from "../api-keys/services";
import { ENV } from "../env";
import { decode, JwtPayload } from "jsonwebtoken";
import { User } from "../users/services";
import { Pagination } from "../lib/types";
import { Request, Response } from "express";

export const sendWhatsappNotificationsController = async (
  req: Request,
  res: Response,
) => {
  let { targetPhoneNumber, message, environment } = req.body as {
    targetPhoneNumber: string;
    message: string;
    environment: WhatsappEnvironment;
  };

  const path = req.path;
  const endpoint = whatsappBasePath + path;
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
};

export const findWhatsappNotificationsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const { page, perPage, environment } = req.query as {
      page?: string;
      perPage?: string;
      environment?: WhatsappEnvironment;
    };

    if (
      environment &&
      environment !== WhatsappEnvironment.Development.toString() &&
      environment !== WhatsappEnvironment.Production.toString()
    ) {
      const json = responseJson(400, null, "Invalid environment");
      return res.status(400).json(json);
    }

    const accessToken = req.header("x-access-token") as string;
    const jwt = decode(accessToken) as JwtPayload & User;
    const limit = perPage ? Number(perPage) : 100;
    const offset = page && Number(page) > 1 ? (Number(page) - 1) * limit : 0;
    const notifications = await findManyWhatsappNotifications({
      userId: jwt.id,
      offset,
      limit,
      environment,
    });
    const { count } = await countWhatsappNotifications({
      userId: jwt.id,
      environment,
    });
    const pagination: Pagination = {
      page: page ? Number(page) : 1,
      perPage: limit,
      total: Number(count),
      totalPages: Number(count) > limit ? Math.round(Number(count) / limit) : 1,
    };

    const json = responseJson(200, { notifications, pagination }, "");
    res.status(500).json(json);
  } catch (err: any) {
    const json = responseJson(500, null, "");
    res.status(500).json(json);
  }
};
