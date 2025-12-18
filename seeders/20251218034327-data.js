"use strict";

const fs = require("fs");
const path = require("path");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Baca data dari file data.json
    const dataPath = path.join(__dirname, "..", "data.json");
    const rawData = fs.readFileSync(dataPath, "utf8");
    const newsData = JSON.parse(rawData);

    // Tambahkan timestamps ke setiap data
    const newsWithTimestamps = newsData.map((news) => ({
      title: news.title,
      content: news.content,
      author: news.author,
      imgUrl: news.imgUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Insert data ke tabel News
    await queryInterface.bulkInsert("News", newsWithTimestamps, {});

    console.log(
      `✓ Berhasil seed ${newsWithTimestamps.length} berita ke database`
    );
  },

  async down(queryInterface, Sequelize) {
    // Hapus semua data dari tabel News
    await queryInterface.bulkDelete("News", null, {});

    console.log("✓ Berhasil menghapus semua data berita dari database");
  },
};
