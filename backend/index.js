require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const recommendationsRoute = require('./routes/recommendations');
const recompute = require('./services/recommendationService');

const app = express();
app.use(cors());
app.use(express.json());

// mount recommendations route
app.use(recommendationsRoute);

const MONGO = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/moviesdb';
const PORT = process.env.PORT || 4000;

async function start() {
  try {
    // Mongoose 6+ uses sensible defaults; do not pass deprecated options.
    await mongoose.connect(MONGO);
    console.log('Connected to MongoDB');

    // schedule weekly recompute: every Sunday at 03:00
    cron.schedule('0 3 * * 0', async () => {
      try {
        console.log('Scheduled: computing similarities...');
        await recompute.computeAndStore({ topK: 20, persistTop: 50 });
        console.log('Scheduled compute completed');
      } catch (err) {
        console.error('Scheduled compute error:', err);
      }
    });

    // optionally run once at startup if env flag is set
    if (process.env.COMPUTE_ON_STARTUP === '1') {
      console.log('Compute on startup enabled — computing similarities now...');
      recompute.computeAndStore({ topK: 20, persistTop: 50 }).catch(err => console.error(err));
    }

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
