require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const connectDB = require('./config/db');

const healthRoute = require('./routes/health.route');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Mount health route
app.use('/', healthRoute);

// Feature routes
app.use('/notice', require('./routes/notice.route'));
app.use('/notices', require('./routes/notice.route'));
app.use('/api/notice', require('./routes/notice.route'));
app.use('/api/notices', require('./routes/notice.route'));

connectDB();

app.listen(env.PORT, () => {
  console.log(`[${env.PORT}] ${'notice-service'} started`);
});
