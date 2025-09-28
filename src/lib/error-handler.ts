import { Response } from "express";
import z from "zod";
import { responseJson } from "../middleware/response";

export const errorHandler = (err: any, res: Response) => {
  if (err instanceof z.ZodError) {
    const json = responseJson(
      400,
      null,
      `${err.issues[0].path}: ${err.issues[0].message}`,
    );
    return res.status(400).json(json);
  }
  const json = responseJson(500, null, "");
  return res.status(500).json(json);
};
