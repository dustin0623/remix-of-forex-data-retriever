export interface CommunitySentiment {
  symbol: string;
  longPercentage: number;
  shortPercentage: number;
  longVolume: number;
  shortVolume: number;
  longPositions: number;
  shortPositions: number;
  totalPositions: number;
  avgLongPrice: number;
  avgShortPrice: number;
  fetchedAt: string;
  stale: boolean;
}

const BASE = "https://www.myfxbook.com/api";
/** 15 min => at most 96 calls/day, inside Myfxbook's free 100/day limit. */
const TTL = 15 * 60_000;

let sessionCache: { key: string; session: string; at: number } | null = null;
let dataCache: { key: string; at: number; data: CommunitySentiment } | null = null;

type MyfxbookSymbol = {
  name?: string;
  longPercentage?: number;
  shortPercentage?: number;
  longVolume?: number;
  shortVolume?: number;
  longPositions?: number;
  shortPositions?: number;
  totalPositions?: number;
  avgLongPrice?: number;
  avgShortPrice?: number;
};

async function getJson(url: string): Promise<{ error?: boolean; message?: string; session?: string; symbols?: MyfxbookSymbol[] }> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Myfxbook returned HTTP ${res.status}`);
  return (await res.json()) as never;
}

async function login(email: string, password: string, key: string): Promise<string> {
  if (sessionCache && sessionCache.key === key && Date.now() - sessionCache.at < 6 * 60 * 60_000) {
    return sessionCache.session;
  }
  const body = await getJson(
    `${BASE}/login.json?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
  );
  if (body.error || !body.session) {
    throw new Error(body.message || "Myfxbook rejected those credentials");
  }
  sessionCache = { key, session: body.session, at: Date.now() };
  return body.session;
}

function credKey(email: string, password: string) {
  return `${email}::${password.length}:${password.slice(0, 2)}`;
}

/** Verifies credentials by logging in; returns the account email on success. */
export async function verifyMyfxbook(email: string, password: string): Promise<{ ok: true }> {
  sessionCache = null;
  await login(email, password, credKey(email, password));
  return { ok: true };
}

export async function getCommunitySentiment(
  email: string,
  password: string,
  symbol = "XAUUSD",
): Promise<CommunitySentiment> {
  const key = `${credKey(email, password)}::${symbol}`;
  if (dataCache && dataCache.key === key && Date.now() - dataCache.at < TTL) return dataCache.data;

  try {
    let session = await login(email, password, credKey(email, password));
    let body = await getJson(`${BASE}/get-community-outlook.json?session=${encodeURIComponent(session)}`);
    if (body.error) {
      // Session likely expired — log in once more.
      sessionCache = null;
      session = await login(email, password, credKey(email, password));
      body = await getJson(`${BASE}/get-community-outlook.json?session=${encodeURIComponent(session)}`);
    }
    if (body.error) throw new Error(body.message || "Myfxbook returned an error");

    const row = (body.symbols ?? []).find((s) => (s.name ?? "").toUpperCase() === symbol.toUpperCase());
    if (!row) throw new Error(`${symbol} is not in the Myfxbook community outlook right now`);

    const data: CommunitySentiment = {
      symbol: row.name ?? symbol,
      longPercentage: Number(row.longPercentage ?? 0),
      shortPercentage: Number(row.shortPercentage ?? 0),
      longVolume: Number(row.longVolume ?? 0),
      shortVolume: Number(row.shortVolume ?? 0),
      longPositions: Number(row.longPositions ?? 0),
      shortPositions: Number(row.shortPositions ?? 0),
      totalPositions: Number(row.totalPositions ?? 0),
      avgLongPrice: Number(row.avgLongPrice ?? 0),
      avgShortPrice: Number(row.avgShortPrice ?? 0),
      fetchedAt: new Date().toISOString(),
      stale: false,
    };
    dataCache = { key, at: Date.now(), data };
    return data;
  } catch (err) {
    if (dataCache && dataCache.key === key) return { ...dataCache.data, stale: true };
    throw new Error((err as Error).message || "Myfxbook is unreachable");
  }
}
