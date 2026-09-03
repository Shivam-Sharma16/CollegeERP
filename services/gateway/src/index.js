require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');

const healthRoute = require('./routes/health.route');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Mount health route
app.use('/', healthRoute);

// Placeholder for feature routes
// app.use('/api/gateway', require('./routes/gateway.route'));


app.listen(env.PORT, () => {
  console.log(`[${env.PORT}] ${'gateway'} started`);
});
