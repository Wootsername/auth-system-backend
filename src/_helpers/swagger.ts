import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

export default function setupSwagger(app: any) {
    const swaggerDocument = YAML.load(path.join(__dirname, '../../swagger.yaml'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log('📚 Swagger docs loaded');
}
