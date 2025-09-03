import express from "express";
import cors from "cors";
import { whatsappRouter } from "./whatsapp/controller";
import { logger } from "./lib/logger";

export const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/whatsapp", whatsappRouter);
app.get("/", async (req, res) => {
  res.send("Hello World!");
});

const port = 5500;
app.listen(port, () => {
  logger.info(`App listening on port ${port}`);
});
