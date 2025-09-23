import { logger } from "../lib/logger";
import { responseJson } from "../middleware/response";
import { ENV } from "../env";
import { decode, JwtPayload } from "jsonwebtoken";
import { User } from "../users/services";
import { Pagination } from "../lib/types";
import { Request, Response } from "express";
import z from "zod";
import { errorHandler } from "../lib/error-handler";
import { WhatsappStatus, WhatsappEnvironment } from "../lib/types";
import { services, type WhatsappNotification } from "./services";
import whatsapp from "../whatsapp";
import apiKeys from "../api-keys";

const SendSchema = z.object({
  targetPhoneNumber: z
    .string()
    .min(1, "targetPhoneNumber can not be empty")
    .regex(/^[0-9]+$/, "targetPhoneNumber must be a set of numbers"),
  message: z.string().min(1, "message can not be empty"),
  countryCode: z
    .string()
    .regex(/^[0-9]+$/, "countryCode must be a set of numbers")
    .optional()
    .default("62"),
});

export const send = async (req: Request, res: Response) => {
  logger.info(`[wa-notif-controller-send]`);
  const { targetPhoneNumber, message, countryCode } =
    req.body satisfies z.infer<typeof SendSchema>;

  try {
    SendSchema.parse(req.body);

    const apiKeyId = req.header("x-client-id") as string;

    const dbApiKey = await apiKeys.services.find({ id: apiKeyId });
    if (!dbApiKey) {
      const json = responseJson(400, null, "Invalid API Key");
      return res.status(400).json(json);
    }

    const userId = dbApiKey.user_id;
    const notifCount = await services.countCurrentMonth(userId);
    const environment =
      Number(notifCount.count) > ENV.DEVELOPMENT_MONTHLY_LIMIT
        ? WhatsappEnvironment.Production
        : WhatsappEnvironment.Development;

    const pendingNotifs = await services.findMany(
      {
        status: WhatsappStatus.Pending,
      },
      0,
      1,
    );

    if (pendingNotifs.length > 1) {
      const whatsappNotif = await services.create({
        session_id: String(ENV.INCEPTION_WHATSAPP_SESSION_ID),
        user_id: userId,
        target_phone: targetPhoneNumber,
        text_message: message,
        environment,
        country_code: countryCode ? countryCode : "62",
        status: WhatsappStatus.Pending,
      });
      const response: Omit<WhatsappNotification, "user_id" | "session_id"> = {
        id: whatsappNotif[0].id,
        created_at: whatsappNotif[0].created_at,
        updated_at: whatsappNotif[0].updated_at,
        target_phone: whatsappNotif[0].target_phone,
        text_message: whatsappNotif[0].text_message,
        environment: whatsappNotif[0].environment,
        country_code: whatsappNotif[0].country_code,
        status: whatsappNotif[0].status,
      };
      const json = responseJson(201, response, WhatsappStatus.Pending);
      res.status(201).json(json);
    } else {
      const sentMessage = await whatsapp.services.sendMessage(
        String(ENV.INCEPTION_WHATSAPP_SESSION_ID),
        targetPhoneNumber,
        message,
        countryCode,
      );
      if (sentMessage?.id) {
        const whatsappNotif = await services.create({
          session_id: String(ENV.INCEPTION_WHATSAPP_SESSION_ID),
          user_id: userId,
          target_phone: targetPhoneNumber,
          text_message: message,
          environment,
          country_code: countryCode,
          status: WhatsappStatus.Delivered,
        });
        const response: Omit<WhatsappNotification, "user_id" | "session_id"> = {
          id: whatsappNotif[0].id,
          created_at: whatsappNotif[0].created_at,
          updated_at: whatsappNotif[0].updated_at,
          target_phone: whatsappNotif[0].target_phone,
          text_message: whatsappNotif[0].text_message,
          environment: whatsappNotif[0].environment,
          country_code: whatsappNotif[0].country_code,
          status: whatsappNotif[0].status,
        };
        const json = responseJson(200, response, WhatsappStatus.Delivered);
        return res.status(200).json(json);
      }
      const json = responseJson(500, null, "");
      return res.status(500).json(json);
    }
  } catch (err: any) {
    logger.error(`[wa-notif-controller-send]`, err);
    return errorHandler(err, res);
  }
};

const SendBatchSchema = z.array(SendSchema);

const sendBatch = async (req: Request, res: Response) => {
  logger.info(`[wa-notif-controller-sendBatch]`);
  const batchNotifications = req.body satisfies z.infer<typeof SendBatchSchema>;

  try {
    SendBatchSchema.parse(req.body);

    const apiKeyId = req.header("x-client-id") as string;
    const dbApiKey = await apiKeys.services.find({ id: apiKeyId });
    if (!dbApiKey) {
      const json = responseJson(400, null, "Invalid API Key");
      return res.status(400).json(json);
    }

    const userId = dbApiKey.user_id;
    const notifications = batchNotifications.map(
      (notif: z.infer<typeof SendSchema>) => ({
        session_id: ENV.INCEPTION_WHATSAPP_SESSION_ID,
        user_id: userId,
        target_phone: notif.targetPhoneNumber,
        text_message: notif.message,
        environment: WhatsappEnvironment.Production,
        country_code: notif.countryCode ? notif.countryCode : "62",
        status: WhatsappStatus.Pending,
      }),
    );
    const savedNotifications = await services.create(notifications);

    const json = responseJson(
      200,
      {
        count: savedNotifications.length,
      },
      "OK",
    );
    res.status(200).json(json);
  } catch (err: any) {
    logger.error(`[wa-notif-controller-sendBatch]`, err);
    return errorHandler(err, res);
  }
};

const findMany = async (req: Request, res: Response) => {
  logger.info(`[wa-notif-controller-findMany]`);
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
    const notifications = await services.findMany(
      {
        user_id: jwt.id,
        environment,
      },
      offset,
      limit,
    );
    const { count } = await services.count({
      user_id: jwt.id,
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
    logger.error(`[wa-notif-controller-findMany]`, err);
    return errorHandler(err, res);
  }
};

export const controller = { send, sendBatch, findMany };
