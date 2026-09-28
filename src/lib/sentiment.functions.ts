import { createServerFn } from "@tanstack/react-start";

import { getCommunitySentiment, verifyMyfxbook } from "./sentiment.server";

interface Creds {
  email: string;
  password: string;
  symbol?: string;
}

function validate(input: Creds): Creds {
  const email = (input?.email ?? "").trim();
  const password = input?.password ?? "";
  if (!email || !password) throw new Error("Add your Myfxbook email and password in Settings");
  return { email, password, symbol: input.symbol?.trim() || "XAUUSD" };
}

/** Myfxbook Community Outlook for one symbol; 15-minute server cache, stale fallback. */
export const fetchCommunitySentiment = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(({ data }) => getCommunitySentiment(data.email, data.password, data.symbol));

/** Confirms the Myfxbook credentials work. */
export const testMyfxbookLogin = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(({ data }) => verifyMyfxbook(data.email, data.password));
