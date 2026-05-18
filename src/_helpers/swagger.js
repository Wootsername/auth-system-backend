/**
 * swagger.js — Swagger/OpenAPI Documentation Setup
 *
 * Serves interactive API docs at /api-docs using swagger-ui-express.
 */
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

module.exports = function setupSwagger(app) {
    const swaggerDocument = YAML.load(path.join(__dirname, '../../swagger.yaml'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log('📚 Swagger docs loaded');
};
