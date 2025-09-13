import { logger } from "../lib/logger";

export const runWhatsappScheduler = () => {
  logger.info("[SCHEDULER] INITIATE");
  // setInterval(() => {
  const currentDate = new Date().toLocaleString("id-ID");
  logger.info(`[SCHEDULER] STARTING at ${currentDate}`);

  // Generate random timeout seconds from 1 to 9
  // Since one hour is 60 mins, we set 6 different timeouts, each between 1 and 9 mins
  const firstTimeOut = Math.floor(Math.random() * 10);
  const secondTimeOut = firstTimeOut + Math.floor(Math.random() * 10) + 1;
  const thirdTimeOut = secondTimeOut + Math.floor(Math.random() * 10) + 1;
  const fourthTimeOut = thirdTimeOut + Math.floor(Math.random() * 10) + 1;
  const fifthTimeOut = fourthTimeOut + Math.floor(Math.random() * 10) + 1;
  const sixthTimeOut = fifthTimeOut + Math.floor(Math.random() * 10) + 1;

  console.log(
    firstTimeOut,
    secondTimeOut,
    thirdTimeOut,
    fourthTimeOut,
    fifthTimeOut,
    sixthTimeOut,
  );
  // FIND ALL pending messages DISTINCT ON session_id
  // count messages per session id, sent max messages per timeout per firstTimeout count

  // }, 2000);
};
