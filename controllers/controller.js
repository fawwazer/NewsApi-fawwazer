const { News } = require("../models");
const { publishToQueue } = require("../helpers/rabbitmq");
const { searchDocuments } = require("../helpers/elasticsearch");

class Controller {
  static async getNews(req, res, next) {
    try {
      const { page = 1, limit = 10, author } = req.query;
      const offset = (page - 1) * limit;

      // Build where clause for filtering
      const where = {};
      if (author) {
        where.author = author;
      }

      // Get total count
      const total = await News.count({ where });

      // Get paginated data
      const news = await News.findAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["createdAt", "DESC"]],
      });

      res.status(200).json({
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        data: news,
      });
    } catch (error) {
      next(error);
    }
  }

  // post to news
  static async postNews(req, res, next) {
    try {
      const { title, content, author, imgUrl } = req.body;

      // Validasi input
      if (!title || !content || !author) {
        return res.status(400).json({
          status: "error",
          message: "Validation error: title, content, and author are required",
        });
      }

      // Simpan ke database
      const newNews = await News.create({ title, content, author, imgUrl });

      // Publish ke RabbitMQ queue untuk indexing ke Elasticsearch
      try {
        await publishToQueue({
          id: newNews.id,
          title: newNews.title,
          content: newNews.content,
          author: newNews.author,
          imgUrl: newNews.imgUrl,
          createdAt: newNews.createdAt,
        });
      } catch (queueError) {
        console.error("Failed to publish to queue:", queueError.message);
        // Tetap return success karena data sudah masuk DB
        // Queue akan di-retry oleh worker
      }

      res.status(201).json({
        status: "ok",
        message: "News stored and queued",
        id: newNews.id,
      });
    } catch (error) {
      next(error);
    }
  }

  // Search news dari Elasticsearch
  static async searchNews(req, res, next) {
    try {
      const { q, author, page = 1, limit = 10 } = req.query;

      if (!q) {
        return res.status(400).json({
          status: "error",
          message: "Query parameter 'q' is required",
        });
      }

      const from = (page - 1) * limit;

      const result = await searchDocuments(q, {
        from: parseInt(from),
        size: parseInt(limit),
        author: author || null,
      });

      res.status(200).json({
        query: q,
        total: result.total,
        page: parseInt(page),
        limit: parseInt(limit),
        results: result.results,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = Controller;
