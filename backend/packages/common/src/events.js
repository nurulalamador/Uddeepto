import amqp from "amqplib";
let connection;
let channel;
let connecting = null;
async function getChannel() {
    const url = process.env.RABBITMQ_URL;
    if (!url)
        return null;
    if (channel)
        return channel;
    if (!connecting) {
        connecting = (async () => {
            connection = await amqp.connect(url);
            connection.on("close", () => {
                connection = undefined;
                channel = undefined;
                connecting = null;
            });
            connection.on("error", (err) => console.error("RabbitMQ connection error", err));
            channel = await connection.createChannel();
            await channel.assertExchange("app.events", "topic", { durable: true });
            return channel;
        })().finally(() => {
            connecting = null;
        });
    }
    return connecting;
}
export async function publishEvent(routingKey, payload) {
    try {
        const ch = await getChannel();
        if (!ch)
            return;
        ch.publish("app.events", routingKey, Buffer.from(JSON.stringify({
            event: routingKey,
            occurredAt: new Date().toISOString(),
            payload,
        })), { persistent: true, contentType: "application/json" });
    }
    catch (error) {
        // Domain writes must not fail just because the broker is temporarily unavailable.
        console.error(`RabbitMQ publish failed for ${routingKey}`, error);
    }
}
export async function closeBroker() {
    try {
        if (channel)
            await channel.close();
    }
    catch { }
    try {
        if (connection)
            await connection.close();
    }
    catch { }
    channel = undefined;
    connection = undefined;
}
