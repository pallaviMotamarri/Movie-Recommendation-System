/* CLI script to compute similarities and exit
   Usage: npm run compute-similarities
*/
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const service = require('../services/recommendationService');

const MONGO = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/moviesdb';

async function main() {
  try {
    // Mongoose 6+ uses sensible defaults; do not pass deprecated options.
    await mongoose.connect(MONGO);
    console.log('Connected to MongoDB');

    const res = await service.computeAndStore({ topK: 20, persistTop: 50 });
    console.log('Compute result:', res);
  } catch (err) {
    console.error('Error computing similarities:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
