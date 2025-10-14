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
import whatsappMessages from "../whatsapp-messages";
import whatsappSessions from "../whatsapp-sessions";

const SendSchema = z.object({
  targetPhoneNumber: z
    .string()
    .min(1, "can not be empty")
    .regex(
      /^[1-9][0-9]*$/,
      "must be a set of numbers and must not start with 0",
    ),
  message: z.string().min(1, "can not be empty"),
  environment: z
    .enum(WhatsappEnvironment, "invalid value")
    .optional()
    .default(WhatsappEnvironment.Development),
  countryCode: z
    .string()
    .regex(/^[0-9]+$/, "must be a set of numbers")
    .optional()
    .default("62"),
  mediaUrl: z.string().url().optional(),
  sendNow: z.boolean().optional().default(true),
});

export const send = async (req: Request, res: Response) => {
  logger.info(`[wa-notif-controller-send]`);
  const {
    targetPhoneNumber,
    message,
    environment,
    countryCode = "62",
    mediaUrl,
    sendNow = true,
  } = req.body satisfies z.infer<typeof SendSchema>;

  try {
    SendSchema.parse(req.body);

    const apiKeyId = req.header("x-client-id") as string;

    const dbApiKey = await apiKeys.services.find({ id: apiKeyId });
    if (!dbApiKey) {
      const json = responseJson(400, null, "Invalid API Key");
      return res.status(400).json(json);
    }

    const userId = dbApiKey.user_id;
    const totalCount =
      await whatsapp.services.countCurrentMonthWhatsapp(userId);

    const notifEnvironment =
      Number(totalCount) > ENV.DEVELOPMENT_MONTHLY_LIMIT
        ? WhatsappEnvironment.Production
        : environment;

    if (sendNow) {
      const sendMessageParam = {
        sessionId: String(ENV.INCEPTION_WHATSAPP_SESSION_ID),
        phoneNumber: targetPhoneNumber,
        message,
        countryCode,
        mediaUrl,
      };

      const sentMessage = await whatsapp.services.sendMessage(sendMessageParam);

      if (sentMessage?.id) {
        const whatsappNotif = await services.create({
          session_id: String(ENV.INCEPTION_WHATSAPP_SESSION_ID),
          user_id: userId,
          target_phone: targetPhoneNumber,
          text_message: message,
          environment: notifEnvironment,
          country_code: countryCode,
          status: WhatsappStatus.Delivered,
          media_url: mediaUrl,
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
          media_url: whatsappNotif[0].media_url,
        };
        const json = responseJson(200, response, WhatsappStatus.Delivered);
        return res.status(200).json(json);
      }
    } else {
      const whatsappNotif = await services.create({
        session_id: String(ENV.INCEPTION_WHATSAPP_SESSION_ID),
        user_id: userId,
        target_phone: targetPhoneNumber,
        text_message: message,
        environment: notifEnvironment,
        country_code: countryCode ? countryCode : "62",
        status: WhatsappStatus.Pending,
        media_url: mediaUrl,
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
        media_url: whatsappNotif[0].media_url,
      };
      const json = responseJson(201, response, WhatsappStatus.Pending);
      return res.status(201).json(json);
    }
    const json = responseJson(500, null, "Internal Server Error");
    return res.status(500).json(json);
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
        media_url: notif.mediaUrl,
      }),
    );
    const savedNotifications = await services.create(notifications);

    const json = responseJson(
      200,
      {
        count: savedNotifications.length,
      },
      WhatsappStatus.Pending,
    );
    res.status(200).json(json);
  } catch (err: any) {
    logger.error(`[wa-notif-controller-sendBatch]`, err);
    return errorHandler(err, res);
  }
};

type FindManyQuery = Partial<
  Pick<WhatsappNotification, "environment" | "status">
> & {
  page?: number;
  perPage?: number;
};

const findMany = async (req: Request, res: Response) => {
  logger.info(`[wa-notif-controller-findMany]`);
  try {
    const { page, perPage, environment, status } = req.query as FindManyQuery;

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
        ...(environment && { environment }),
        ...(status && { status }),
      },
      offset,
      limit,
    );
    const { count } = await services.count({
      user_id: jwt.id,
      ...(environment && { environment }),
      ...(status && { status }),
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
