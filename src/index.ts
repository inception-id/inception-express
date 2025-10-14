import express from "express";
import cors from "cors";
import { logger } from "./lib/logger";
import { whatsappRouter } from "./whatsapp/controller";
import waNotif from "./whatsapp-notifications";
import waMessage from "./whatsapp-messages";

export const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/whatsapp", whatsappRouter);
app.get("/", async (req, res) => {
  res.send("Hello World!");
});

const port = 5500;
app.listen(port, async () => {
  logger.info(`App listening on port ${port}`);

  setInterval(
    async () => {
      await waNotif.schedule.send();
      await waMessage.schedule.send();
      await waMessage.schedule.updateDisconnected();
    },
    1000 * 60 * 10,
  ); // Every 10 minutes
});
