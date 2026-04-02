const mongoose = require('mongoose');

const RecommendationSchema = new mongoose.Schema({
  movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', index: true },
  recommendations: [
    {
      movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie' },
      score: Number,
      sharedFeatures: [String]
    }
  ],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Similarity', RecommendationSchema);
