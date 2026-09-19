import { z } from "zod";

export const createBrokerAccountSchema = z.object({
  brokerCode: z.string().min(1, "Select a broker"),
  nickname: z.string().min(2, "Give this account a short nickname"),
  startingCapital: z.coerce.number().min(0).optional(),
});
export type CreateBrokerAccountInput = z.infer<typeof createBrokerAccountSchema>;
