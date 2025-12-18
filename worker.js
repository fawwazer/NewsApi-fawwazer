require("dotenv").config();

const { getChannel, QUEUE_NAME } = require("./helpers/rabbitmq");
const {
  indexDocument,
  createIndex,
  checkConnection,
} = require("./helpers/elasticsearch");

let isProcessing = false;

async function startWorker() {
  try {
    console.log("Starting RabbitMQ Worker...");

    const esConnected = await checkConnection();
    if (esConnected) {
      await createIndex();
    } else {
      console.warn(
        "⚠️  Elasticsearch not available, worker will retry on each message"
      );
    }

    const channel = await getChannel();
    await channel.prefetch(1);

    console.log(
      `✓ Worker started. Waiting for messages in queue: ${QUEUE_NAME}`
    );

    channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (msg === null) {
          console.warn("Consumer cancelled by server");
          return;
        }

        const messageContent = msg.content.toString();
        console.log(`\n📨 Received message: ${messageContent}`);

        try {
          const newsData = JSON.parse(messageContent);

          console.log("🔄 Processing news:", newsData.id);

          await indexDocument(newsData);

          console.log(
            `✓ Successfully processed and indexed news ID: ${newsData.id}`
          );

          channel.ack(msg);
        } catch (error) {
          console.error("❌ Error processing message:", error.message);

          const retryCount =
            (msg.properties.headers?.["x-retry-count"] || 0) + 1;
          const maxRetries = 3;

          if (retryCount < maxRetries) {
            console.log(`⚠️  Retry attempt ${retryCount}/${maxRetries}`);

            channel.nack(msg, false, false);

            setTimeout(() => {
              channel.sendToQueue(QUEUE_NAME, msg.content, {
                persistent: true,
                headers: {
                  "x-retry-count": retryCount,
                },
              });
            }, 5000 * retryCount);
          } else {
            console.error(
              `❌ Max retries (${maxRetries}) reached. Moving to dead letter queue or logging.`
            );

            channel.ack(msg);
          }
        }
      },
      {
        noAck: false,
      }
    );
  } catch (error) {
    console.error("❌ Worker error:", error.message);
    console.log("Retrying in 5 seconds...");
    setTimeout(startWorker, 5000);
  }
}

process.on("SIGINT", async () => {
  console.log("\n⚠️  Shutting down worker...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n⚠️  Shutting down worker...");
  process.exit(0);
});
startWorker();
