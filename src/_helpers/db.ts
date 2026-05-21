import { Sequelize } from 'sequelize';
import accountModel from '../accounts/account.model';
import refreshTokenModel from '../accounts/refresh-token.model';

const db: any = {};
export default db;

initialize();

async function initialize() {
    const host     = process.env.MYSQLHOST     || process.env.DB_HOST     || 'localhost';
    const port     = parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306');
    const user     = process.env.MYSQLUSER     || process.env.DB_USER     || 'root';
    const password = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '';
    const database = process.env.MYSQLDATABASE || process.env.DB_NAME     || 'auth_db';

    const sequelize = new Sequelize(database, user, password, {
        host,
        port,
        dialect: 'mysql',
        dialectOptions: {
            ssl: { rejectUnauthorized: false }
        },
        logging: false
    });

    await sequelize.authenticate();
    console.log(`✅ Connected to MySQL: ${host}:${port}/${database}`);

    db.Account      = accountModel(sequelize);
    db.RefreshToken = refreshTokenModel(sequelize);

    db.Account.hasMany(db.RefreshToken, { onDelete: 'CASCADE' });
    db.RefreshToken.belongsTo(db.Account);

    await sequelize.sync();
    console.log('✅ Accounts table ready');
}
