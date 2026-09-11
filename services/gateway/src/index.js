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

// Mount reverse proxies for microservices
const { registerProxies } = require('./routes/proxy');
registerProxies(app);


app.listen(env.PORT, () => {
  console.log(`[${env.PORT}] ${'gateway'} started`);
});
