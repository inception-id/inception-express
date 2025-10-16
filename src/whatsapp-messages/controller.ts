import { logger } from "../lib/logger";
import { responseJson } from "../middleware/response";
import { decode, JwtPayload } from "jsonwebtoken";
import { services, WhatsappMessage } from "./services";
import { Pagination } from "../lib/types";
import { User } from "../users/services";
import { Request, Response } from "express";
import z from "zod";
import { ENV } from "../env";
import { errorHandler } from "../lib/error-handler";
import { WhatsappStatus, WhatsappEnvironment } from "../lib/types";
import whatsappSessions from "../whatsapp-sessions";
import whatsapp from "../whatsapp";
import whatsappNotifications from "../whatsapp-notifications";
import { no } from "zod/v4/locales/index.cjs";

const SendWhatsappMessageSchema = z.object({
  whatsappPhoneId: z.uuidv4("invalid format").min(1, "can not be empty"),
  whatsappPhoneNumber: z
    .string()
    .min(1, "can not be empty")
    .regex(/^8\d*$/, "must start with 8 followed with numbers"),
  targetPhoneNumber: z
    .string()
    .min(1, "can not be empty")
    .regex(
      /^[1-9][0-9]*$/,
      "must be a set of numbers and must not start with 0",
    )
    .transform((val) => val.replace(/^0+/, "")),
  message: z.string().min(1, "message can not be empty"),
  environment: z
    .enum(WhatsappEnvironment, "invalid")
    .optional()
    .default(WhatsappEnvironment.Development),
  countryCode: z
    .string()
    .regex(/^[0-9]+$/, "must be a set of numbers")
    .optional()
    .default("62"),
  sendNow: z.boolean().optional().default(true),
  mediaUrl: z.string().url().optional(),
});

export const send = async (req: Request, res: Response) => {
  logger.info("[wa-message-controller-send]");
  const {
    whatsappPhoneId,
    whatsappPhoneNumber,
    targetPhoneNumber,
    message,
    environment,
    countryCode = "62",
    sendNow = true,
    mediaUrl,
  } = req.body satisfies z.infer<typeof SendWhatsappMessageSchema>;

  try {
    SendWhatsappMessageSchema.parse(req.body);

    const whatsappSession = await whatsappSessions.services.find({
      id: whatsappPhoneId,
      phone: whatsappPhoneNumber,
      is_ready: true,
      is_deleted: false,
    });

    if (!whatsappSession) {
      const json = responseJson(
        404,
        null,
        "whatsappPhoneId or whatsappPhoneNumber not found",
      );
      return res.status(404).json(json);
    }

    const totalCount = await whatsapp.services.countCurrentMonthWhatsapp(
      whatsappSession.user_id,
    );

    const messageEnvironment =
      Number(totalCount) > ENV.DEVELOPMENT_MONTHLY_LIMIT
        ? WhatsappEnvironment.Production
        : environment;

    if (sendNow) {
      const sendMessageParam = {
        sessionId: whatsappSession.id,
        phoneNumber: targetPhoneNumber,
        message,
        countryCode,
        mediaUrl,
      };
      const sentMessage = await whatsapp.services.sendMessage(sendMessageParam);

      if (sentMessage?.id) {
        const whatsappMessage = await services.create({
          session_id: whatsappSession.id,
          target_phone: targetPhoneNumber,
          text_message: message,
          environment: messageEnvironment,
          country_code: countryCode ? countryCode : "62",
          status: WhatsappStatus.Delivered,
          media_url: mediaUrl ? mediaUrl : null,
        });
        const json = responseJson(
          200,
          whatsappMessage[0],
          WhatsappStatus.Delivered,
        );
        return res.status(200).json(json);
      }
    } else {
      const whatsappMessage = await services.create({
        session_id: whatsappSession.id,
        target_phone: targetPhoneNumber,
        text_message: message,
        environment: messageEnvironment,
        country_code: countryCode ? countryCode : "62",
        status: WhatsappStatus.Pending,
        media_url: mediaUrl ? mediaUrl : null,
      });
      const json = responseJson(
        201,
        whatsappMessage[0],
        WhatsappStatus.Pending,
      );
      return res.status(201).json(json);
    }
    const json = responseJson(500, null, "");
    return res.status(500).json(json);
  } catch (err: any) {
    logger.error("[wa-message-controller-send]", err);
    return errorHandler(err, res);
  }
};

type FindManyQuery = Partial<
  Pick<WhatsappMessage, "environment" | "status">
> & {
  page?: number;
  perPage?: number;
};

const findMany = async (req: Request, res: Response) => {
  logger.info("[wa-message-controller-findMany]");
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
    const sessions = await whatsappSessions.services.findMany({
      user_id: jwt.id,
    });
    const sessionIds = sessions.map((session) => session.id);
    const limit = perPage ? Number(perPage) : 100;
    const offset = page && Number(page) > 1 ? (Number(page) - 1) * limit : 0;
    const messages = await services.findManyBySessionIds(
      sessionIds,
      {
        ...(environment && { environment }),
        ...(status && { status }),
      },
      offset,
      limit,
    );
    const { count } = await services.count(sessionIds, {
      ...(environment && { environment }),
      ...(status && { status }),
    });
    const pagination: Pagination = {
      page: page ? Number(page) : 1,
      perPage: limit,
      total: Number(count),
      totalPages: Number(count) > limit ? Math.round(Number(count) / limit) : 1,
    };

    const json = responseJson(200, { messages, pagination }, "");
    res.status(200).json(json);
  } catch (err: any) {
    logger.error("[wa-message-controller-findMany]", err);
    const json = responseJson(500, null, "");
    res.status(500).json(json);
  }
};

const SendBatchWhatsappMessageSchema = z.array(SendWhatsappMessageSchema);

export const sendBatch = async (req: Request, res: Response) => {
  logger.info("[wa-message-controller-sendBatch]");
  const batchMessages = req.body satisfies z.infer<
    typeof SendBatchWhatsappMessageSchema
  >;

  try {
    SendBatchWhatsappMessageSchema.parse(req.body);
    const phoneIds: string[] = [];
    for (const message of batchMessages) {
      if (!phoneIds.includes(message.whatsappPhoneId)) {
        phoneIds.push(message.whatsappPhoneId);
      }
    }
    const sessions = await whatsappSessions.services.findManyBySessionIds(
      phoneIds,
      {},
    );
    if (phoneIds.length !== sessions.length) {
      const json = responseJson(
        400,
        {
          receivedPhoneIds: phoneIds,
          availablePhoneIds: sessions.map((session) => session.id),
        },
        "Invalid whatsappPhoneId",
      );
      return res.status(400).json(json);
    }

    const messages = batchMessages.map(
      (message: z.infer<typeof SendWhatsappMessageSchema>) => ({
        session_id: message.whatsappPhoneId,
        target_phone: message.whatsappPhoneNumber,
        text_message: message.message,
        environment: WhatsappEnvironment.Production,
        country_code: message.countryCode ? message.countryCode : "62",
        status: WhatsappStatus.Pending,
        media_url: message.mediaUrl,
      }),
    );

    const whatsappMessage = await services.create(messages);
    const json = responseJson(
      200,
      {
        count: whatsappMessage.length,
      },
      "OK",
    );
    return res.status(200).json(json);
  } catch (err: any) {
    logger.error("[wa-message-controller-sendBatch]", err);
    return errorHandler(err, res);
  }
};

export const controller = { send, sendBatch, findMany };
