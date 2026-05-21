import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import errorHandler from './src/middleware/error-handler';
import accountsController from './src/accounts/accounts.controller';

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
    process.env.CORS_ORIGIN || 'http://localhost:4200',
    'http://localhost:4200'
];

app.use(cors({
    origin: (origin: any, callback: any) => {
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.trim().replace(/\/$/, '');
        if (allowedOrigins.map(o => o.trim().replace(/\/$/, '')).includes(cleanOrigin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️ Blocked by CORS: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/accounts', accountsController);

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
const app_start = app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
    console.log(`🌐 CORS origin:  ${process.env.CORS_ORIGIN || 'http://localhost:4200'}`);
    console.log('═══════════════════════════════════════════');
});

export default app_start;
