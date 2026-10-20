import { z } from "zod";

const difficultyRequest = z.object({
  difficulty: z.enum(["peaceful", "easy", "normal", "hard"])
});

export default defineEventHandler(async (event) => {
  const body = difficultyRequest.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültige Schwierigkeit" });
  const { difficulty } = body.data;

  await bsm.sendCommand(`difficulty ${difficulty}`);
  await bsm.setProperties({ difficulty });
  await updateActiveWorld({ difficulty });

  return { ok: true };
});
