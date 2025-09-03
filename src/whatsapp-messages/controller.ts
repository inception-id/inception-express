import { whatsappBasePath, whatsappRouter } from "../whatsapp/controller";
import { logger } from "../lib/logger";
import { responseJson } from "../middleware/response";
import { decode, JwtPayload } from "jsonwebtoken";
import {
  countCurrentMonthWhatsappMessage,
  countWhatsappMessages,
  createWhatsappMessage,
  findManyWhatsappMessages,
} from "./services";
import {
  findManyWhatsappSessions,
  findOneWhatsappSession,
} from "../whatsapp-sessions/services";
import { sendWhatsapp } from "../whatsapp/services";
import { Pagination } from "../lib/types";
import { User } from "../users/services";
import { Request, Response } from "express";
import z from "zod";
import { WhatsappEnvironment } from "../whatsapp-notifications/services";
import { ENV } from "../env";

const sendWhatsappMessageSchema = z.object({
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
  environment: z.enum(WhatsappEnvironment, "environment is missing or invalid"),
  countryCode: z
    .string()
    .regex(/^[0-9]+$/, "countryCode must be a set of numbers")
    .optional()
    .default("+62"),
});

export const sendWhatsappMessageController = async (
  req: Request,
  res: Response,
) => {
  logger.info("sendWhatsappMessageController");
  const {
    whatsappPhoneId,
    whatsappPhoneNumber,
    targetPhoneNumber,
    message,
    environment,
    countryCode,
  } = req.body satisfies z.infer<typeof sendWhatsappMessageSchema>;

  try {
    const whatsappSession = await findOneWhatsappSession({
      id: whatsappPhoneId,
      phone: whatsappPhoneNumber,
      is_ready: true,
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
    const messageCount = await countCurrentMonthWhatsappMessage(sessionIds);
    const messageEnvironment = messageCount.find(
      (msg) => msg.message_type === environment,
    );

    if (environment === WhatsappEnvironment.Development) {
      if (
        messageEnvironment &&
        Number(messageEnvironment?.count) > ENV.DEVELOPMENT_MONTHLY_LIMIT
      ) {
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
      whatsappSession.id,
      targetPhoneNumber,
      message,
      countryCode,
    );
    const whatsappMessage = await createWhatsappMessage({
      session_id: sentMessage.sessionId,
      target_phone: sentMessage.phoneNumber,
      text_message: sentMessage.message,
      message_type: environment,
      country_code: countryCode ? countryCode : "62",
    });
    const json = responseJson(
      201,
      {
        messageId: whatsappMessage[0].id,
        whatsappPhoneId,
        whatsappPhoneNumber,
        targetPhoneNumber,
        message,
        environment: environment,
        countryCode: countryCode ? countryCode : "62",
      },
      "",
    );
    res.status(201).json(json);
  } catch (err: any) {
    logger.error("sendWhatsappMessage:", err);
    const json = responseJson(500, null, "");
    res.status(500).json(json);
  }
};

export const findWhatsappMessagesController = async (
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
    const sessions = await findManyWhatsappSessions({ user_id: jwt.id });
    const sessionIds = sessions.map((session) => session.id);
    const limit = perPage ? Number(perPage) : 100;
    const offset = page && Number(page) > 1 ? (Number(page) - 1) * limit : 0;
    const messages = await findManyWhatsappMessages({
      sessionIds,
      offset,
      limit,
      environment,
    });
    const { count } = await countWhatsappMessages({
      sessionIds,
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
    const json = responseJson(500, null, "");
    res.status(500).json(json);
  }
};
