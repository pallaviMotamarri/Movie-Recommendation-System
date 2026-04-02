const mongoose = require('mongoose');

const MovieSchema = new mongoose.Schema({
  tmdb_id: { type: Number, unique: true, index: true },
  title: String,
  overview: String,
  genres: [String], // store genre names
  release_date: String,
  poster_path: String,
  backdrop_path: String,
  vote_average: Number,
  popularity: Number,
  original_language: String,
  // optional: store enriched TMDB data if available
  credits: {
    cast: [{ id: Number, name: String, character: String }],
    crew: [{ id: Number, name: String, job: String }]
  },
  keywords: [{ id: Number, name: String }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Movie', MovieSchema);
