import { createClient } from "redis";
let client = null;
let connecting = null;
export async function getRedisClient() {
    if (client?.isReady)
        return client;
    const url = process.env.REDIS_URL;
    if (!url)
        return null;
    if (!connecting) {
        connecting = (async () => {
            try {
                const nextClient = createClient({
                    url,
                    socket: { connectTimeout: 1_500 },
                });
                nextClient.on("error", (error) => console.error("Redis error", error));
                await nextClient.connect();
                client = nextClient;
                return client;
            }
            catch (error) {
                console.error("Redis unavailable; using local fallback where supported.", error);
                return null;
            }
        })().finally(() => {
            connecting = null;
        });
    }
    return connecting;
}
export async function closeRedis() {
    if (client?.isOpen) {
        await client.quit().catch(() => undefined);
    }
    client = null;
}
