const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";
const QUEUE_NAME = "news_indexing";

let connection = null;
let channel = null;

async function connect() {
  try {
    if (!connection) {
      connection = await amqp.connect(RABBITMQ_URL);
      console.log("✓ Connected to RabbitMQ");

      connection.on("error", (err) => {
        console.error("RabbitMQ connection error:", err.message);
        connection = null;
        channel = null;
      });

      connection.on("close", () => {
        console.warn("RabbitMQ connection closed. Reconnecting...");
        connection = null;
        channel = null;
        setTimeout(connect, 5000);
      });
    }

    if (!channel) {
      channel = await connection.createChannel();
      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
      });
      console.log(`✓ Queue "${QUEUE_NAME}" ready`);
    }

    return { connection, channel };
  } catch (error) {
    console.error("Failed to connect to RabbitMQ:", error.message);
    connection = null;
    channel = null;
    setTimeout(connect, 5000);
    throw error;
  }
}

async function publishToQueue(data) {
  try {
    const { channel } = await connect();

    const message = JSON.stringify(data);

    channel.sendToQueue(QUEUE_NAME, Buffer.from(message), {
      persistent: true,
    });

    console.log(`✓ Message published to queue: ${data.id || "unknown"}`);
    return true;
  } catch (error) {
    console.error("Failed to publish message:", error.message);
    throw error;
  }
}

async function getChannel() {
  const { channel } = await connect();
  return channel;
}

async function close() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log("✓ RabbitMQ connection closed");
  } catch (error) {
    console.error("Error closing RabbitMQ connection:", error.message);
  }
}

module.exports = {
  connect,
  publishToQueue,
  getChannel,
  close,
  QUEUE_NAME,
};
