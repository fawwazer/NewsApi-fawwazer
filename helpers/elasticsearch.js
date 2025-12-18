const { Client } = require("@elastic/elasticsearch");

const ELASTICSEARCH_URL =
  process.env.ELASTICSEARCH_URL || "http://localhost:9200";
const ELASTICSEARCH_USERNAME = process.env.ELASTICSEARCH_USERNAME || "elastic";
const ELASTICSEARCH_PASSWORD = process.env.ELASTICSEARCH_PASSWORD || "";
const INDEX_NAME = "news";

let client = null;

function getClient() {
  if (!client) {
    const config = {
      node: ELASTICSEARCH_URL,
    };

    if (ELASTICSEARCH_USERNAME && ELASTICSEARCH_PASSWORD) {
      config.auth = {
        username: ELASTICSEARCH_USERNAME,
        password: ELASTICSEARCH_PASSWORD,
      };
    }

    client = new Client(config);
  }
  return client;
}

async function createIndex() {
  try {
    const esClient = getClient();

    const indexExists = await esClient.indices.exists({ index: INDEX_NAME });

    if (!indexExists) {
      await esClient.indices.create({
        index: INDEX_NAME,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
            analysis: {
              analyzer: {
                news_analyzer: {
                  type: "standard",
                  stopwords: "_english_",
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: "integer" },
              title: {
                type: "text",
                analyzer: "news_analyzer",
                fields: {
                  keyword: { type: "keyword" },
                },
              },
              content: {
                type: "text",
                analyzer: "news_analyzer",
              },
              author: {
                type: "keyword",
              },
              imgUrl: { type: "keyword" },
              createdAt: { type: "date" },
            },
          },
        },
      });
      console.log(`✓ Elasticsearch index "${INDEX_NAME}" created`);
    } else {
      console.log(`✓ Elasticsearch index "${INDEX_NAME}" already exists`);
    }
  } catch (error) {
    console.error("Error creating index:", error.message);
    throw error;
  }
}

async function indexDocument(newsData) {
  try {
    const esClient = getClient();

    const response = await esClient.index({
      index: INDEX_NAME,
      id: newsData.id.toString(),
      document: {
        id: newsData.id,
        title: newsData.title,
        content: newsData.content,
        author: newsData.author,
        imgUrl: newsData.imgUrl,
        createdAt: newsData.createdAt,
      },
    });

    console.log(`✓ Document indexed to Elasticsearch: ID ${newsData.id}`);
    return response;
  } catch (error) {
    console.error("Error indexing document:", error.message);
    throw error;
  }
}

async function searchDocuments(query, options = {}) {
  try {
    const esClient = getClient();

    const {
      from = 0,
      size = 10,
      author = null,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    const mustClauses = [];

    if (query) {
      mustClauses.push({
        multi_match: {
          query: query,
          fields: ["title^3", "content", "author"],
          fuzziness: "AUTO",
        },
      });
    }

    if (author) {
      mustClauses.push({
        term: { author: author },
      });
    }

    const searchBody = {
      query:
        mustClauses.length > 0
          ? {
              bool: { must: mustClauses },
            }
          : {
              match_all: {},
            },
      from: from,
      size: size,
      sort: [{ [sortBy]: { order: sortOrder } }],
    };

    const response = await esClient.search({
      index: INDEX_NAME,
      body: searchBody,
    });

    return {
      total: response.hits.total.value,
      results: response.hits.hits.map((hit) => ({
        ...hit._source,
        score: hit._score,
      })),
    };
  } catch (error) {
    console.error("Error searching documents:", error.message);
    throw error;
  }
}

async function checkConnection() {
  try {
    const esClient = getClient();
    const health = await esClient.cluster.health();
    console.log("✓ Connected to Elasticsearch, status:", health.status);
    return true;
  } catch (error) {
    console.error("✗ Elasticsearch connection failed:", error.message);
    return false;
  }
}

module.exports = {
  getClient,
  createIndex,
  indexDocument,
  searchDocuments,
  checkConnection,
  INDEX_NAME,
};
