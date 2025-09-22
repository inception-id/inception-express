import { whatsappBasePath, whatsappRouter } from "../whatsapp/controller";
import { logger } from "../lib/logger";
import { responseJson } from "../middleware/response";
import { decode, JwtPayload } from "jsonwebtoken";
import { services } from "./services";
import {
  findManyWhatsappSessions,
  findManyWhatsappSessionsBySessionIds,
  findOneWhatsappSession,
} from "../whatsapp-sessions/services";
import { sendWhatsapp } from "../whatsapp/services";
import { Pagination } from "../lib/types";
import { User } from "../users/services";
import { Request, Response } from "express";
import z from "zod";
import { ENV } from "../env";
import { errorHandler } from "../lib/error-handler";
import { WhatsappStatus, WhatsappEnvironment } from "../lib/types";

const SendWhatsappMessageSchema = z.object({
  whatsappPhoneId: z
    .uuidv4("Invalid whatsappPhoneId")
    .min(1, "whatsappPhoneId can not be empty"),
  whatsappPhoneNumber: z
    .string()
    .min(1, "whatsappPhoneNumber can not be empty")
    .regex(
      /^8\d*$/,
      "whatsappPhoneNumber must start with 8 followed with numbers",
    ),
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
  logger.info("[wa-message-controller-send]");
  const {
    whatsappPhoneId,
    whatsappPhoneNumber,
    targetPhoneNumber,
    message,
    countryCode,
  } = req.body satisfies z.infer<typeof SendWhatsappMessageSchema>;

  try {
    SendWhatsappMessageSchema.parse(req.body);

    const whatsappSession = await findOneWhatsappSession({
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

    const userSessions = await findManyWhatsappSessions({
      user_id: whatsappSession.user_id,
      is_ready: true,
    });
    const sessionIds = userSessions.map((session) => session.id);

    const messageCount = await services.countCurrentMonth(sessionIds);
    const environment =
      Number(messageCount.count) > ENV.DEVELOPMENT_MONTHLY_LIMIT
        ? WhatsappEnvironment.Production
        : WhatsappEnvironment.Development;

    // TODO: Handle whether user want to send now or later

    const sentMessage = await sendWhatsapp(
      whatsappSession.id,
      targetPhoneNumber,
      message,
      countryCode,
    );

    if (sentMessage?.id) {
      const whatsappMessage = await services.create({
        session_id: whatsappSession.id,
        target_phone: targetPhoneNumber,
        text_message: message,
        environment,
        country_code: countryCode ? countryCode : "62",
        status: WhatsappStatus.Delivered,
      });
      const json = responseJson(201, whatsappMessage[0], "Created");
      res.status(201).json(json);
    } else {
      const json = responseJson(500, null, "");
      res.status(500).json(json);
    }
  } catch (err: any) {
    logger.error("[wa-message-controller-send]", err);
    return errorHandler(err, res);
  }
};

export const findMany = async (req: Request, res: Response) => {
  logger.info("[wa-message-controller-findMany]");
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
    const sessions = await findManyWhatsappSessions({ user_id: jwt.id });
    const sessionIds = sessions.map((session) => session.id);
    const limit = perPage ? Number(perPage) : 100;
    const offset = page && Number(page) > 1 ? (Number(page) - 1) * limit : 0;
    const messages = await services.findMany(
      sessionIds,
      {
        environment,
      },
      offset,
      limit,
    );
    const { count } = await services.count(sessionIds, {
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
    const sessions = await findManyWhatsappSessionsBySessionIds(phoneIds);
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
