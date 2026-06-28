const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const routes = require('./routes');
const errorHandler = require('./middleware/error-handler');
const sanitizeResponse = require('./middleware/sanitize-response');
const { cors: corsUtils } = require('./utils')();
const { createCorsOptions } = corsUtils;

const app = express();

app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
const uploadsDir = path.join(process.env.TouDev_DATA_DIR || path.join(__dirname, '..'), 'uploads');
app.use('/api/uploads', express.static(uploadsDir));

app.use('/api', sanitizeResponse);
app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route introuvable.' });
});

app.use(errorHandler);

module.exports = app;
