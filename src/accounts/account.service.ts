import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Op } from 'sequelize';
import sendEmail from '../_helpers/send-email';
import db from '../_helpers/db';
import role from '../_helpers/role';

export default {
    authenticate,
    refreshToken,
    revokeToken,
    register,
    verifyEmail,
    forgotPassword,
    validateResetToken,
    resetPassword,
    getAll,
    getById,
    create,
    update,
    delete: _delete
};

// ─── AUTHENTICATE ────────────────────────────────────────────────────────────

async function authenticate({ email, password, ipAddress }: any) {
    const account = await db.Account.scope('withHash').findOne({ where: { email } });

    if (!account || !account.isVerified || !bcrypt.compareSync(password, account.passwordHash)) {
        throw 'Email or password is incorrect';
    }

    const jwtToken = generateJwtToken(account);
    const refreshToken = generateRefreshToken(account, ipAddress);

    await refreshToken.save();

    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: refreshToken.token
    };
}

// ─── REFRESH TOKEN ───────────────────────────────────────────────────────────

async function refreshToken({ token, ipAddress }: any) {
    const refreshToken = await getRefreshToken(token);
    const account = await refreshToken.getAccount();

    const newRefreshToken = generateRefreshToken(account, ipAddress);
    refreshToken.revoked = new Date();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.replacedByToken = newRefreshToken.token;
    await refreshToken.save();
    await newRefreshToken.save();

    const jwtToken = generateJwtToken(account);

    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: newRefreshToken.token
    };
}

// ─── REVOKE TOKEN ────────────────────────────────────────────────────────────

async function revokeToken({ token, ipAddress }: any) {
    const refreshToken = await getRefreshToken(token);

    refreshToken.revoked = new Date();
    refreshToken.revokedByIp = ipAddress;
    await refreshToken.save();
}

// ─── REGISTER ────────────────────────────────────────────────────────────────

async function register(params: any, origin: any) {
    if (await db.Account.findOne({ where: { email: params.email } })) {
        return await sendAlreadyRegisteredEmail(params.email, origin);
    }

    const account = db.Account.build(params);

    const isFirstAccount = (await db.Account.count()) === 0;
    account.role = isFirstAccount ? role.Admin : role.User;
    account.verificationToken = randomTokenString();

    account.passwordHash = await hash(params.password);
    await account.save();

    await sendVerificationEmail(account, origin);
}

// ─── VERIFY EMAIL ────────────────────────────────────────────────────────────

async function verifyEmail({ token }: any) {
    const account = await db.Account.findOne({ where: { verificationToken: token } });
    if (!account) throw 'Verification failed';

    account.verified = new Date();
    account.verificationToken = null;
    await account.save();
}

// ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────

async function forgotPassword({ email }: any, origin: any) {
    const account = await db.Account.findOne({ where: { email } });
    if (!account) return;

    account.resetToken = randomTokenString();
    account.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await account.save();

    await sendPasswordResetEmail(account, origin);
}

// ─── VALIDATE RESET TOKEN ────────────────────────────────────────────────────

async function validateResetToken({ token }: any) {
    const account = await db.Account.findOne({
        where: {
            resetToken: token,
            resetTokenExpires: { [Op.gt]: Date.now() }
        }
    });

    if (!account) throw 'Invalid token';
    return account;
}

// ─── RESET PASSWORD ──────────────────────────────────────────────────────────

async function resetPassword({ token, password }: any) {
    const account = await validateResetToken({ token });

    account.passwordHash = await hash(password);
    account.passwordReset = new Date();
    account.resetToken = null;
    await account.save();
}

// ─── GET ALL ─────────────────────────────────────────────────────────────────

async function getAll() {
    const accounts = await db.Account.findAll();
    return accounts.map((x: any) => basicDetails(x));
}

// ─── GET BY ID ───────────────────────────────────────────────────────────────

async function getById(id: any) {
    const account = await getAccount(id);
    return basicDetails(account);
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

async function create(params: any) {
    if (await db.Account.findOne({ where: { email: params.email } })) {
        throw 'Email "' + params.email + '" is already registered';
    }

    const account = db.Account.build(params);
    account.verified = new Date();

    account.passwordHash = await hash(params.password);
    await account.save();

    return basicDetails(account);
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

async function update(id: any, params: any) {
    const account = await getAccount(id);

    if (params.email && account.email !== params.email && await db.Account.findOne({ where: { email: params.email } })) {
        throw 'Email "' + params.email + '" is already taken';
    }

    if (params.password) {
        params.passwordHash = await hash(params.password);
        delete params.password;
    }

    Object.assign(account, params);
    account.updated = new Date();
    await account.save();

    return basicDetails(account);
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

async function _delete(id: any) {
    const account = await getAccount(id);
    await account.destroy();
}

// ═════════════════════════════════════════════════════════════════════════════
// PRIVATE HELPERS
// ═════════════════════════════════════════════════════════════════════════════

async function getAccount(id: any) {
    const account = await db.Account.findByPk(id);
    if (!account) throw 'Account not found';
    return account;
}

async function getRefreshToken(token: any) {
    const refreshToken = await db.RefreshToken.findOne({ where: { token } });
    if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
    return refreshToken;
}

async function hash(password: string) {
    return await bcrypt.hash(password, 10);
}

function generateJwtToken(account: any) {
    return jwt.sign(
        { sub: account.id, id: account.id, role: account.role },
        process.env.JWT_SECRET as string,
        { expiresIn: '15m' }
    );
}

function generateRefreshToken(account: any, ipAddress: any) {
    return db.RefreshToken.build({
        accountId: account.id,
        token: randomTokenString(),
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdByIp: ipAddress
    });
}

function randomTokenString() {
    return crypto.randomBytes(40).toString('hex');
}

function basicDetails(account: any) {
    const { id, title, firstName, lastName, email, role, created, updated, isVerified } = account;
    return { id, title, firstName, lastName, email, role, created, updated, isVerified };
}

async function sendVerificationEmail(account: any, origin: any) {
    let message: string;

    if (origin) {
        const verifyUrl = `${origin}/account/verify-email?token=${account.verificationToken}`;
        message = `<p>Please click the below link to verify your email address:</p>
                   <p><a href="${verifyUrl}">${verifyUrl}</a></p>`;
    } else {
        message = `<p>Please use the below token to verify your email address with the <code>/accounts/verify-email</code> api route:</p>
                   <p><code>${account.verificationToken}</code></p>`;
    }

    await sendEmail({
        to: account.email,
        subject: 'Auth System — Verify Your Email',
        html: `<h4>Verify Email</h4>
               <p>Thanks for registering, ${account.firstName}!</p>
               ${message}`
    });
}

async function sendAlreadyRegisteredEmail(email: string, origin: any) {
    let message: string;

    if (origin) {
        message = `<p>If you don't know your password please visit the <a href="${origin}/account/forgot-password">forgot password</a> page.</p>`;
    } else {
        message = `<p>If you don't know your password you can reset it via the <code>/accounts/forgot-password</code> api route.</p>`;
    }

    await sendEmail({
        to: email,
        subject: 'Auth System — Email Already Registered',
        html: `<h4>Email Already Registered</h4>
               <p>Your email <strong>${email}</strong> is already registered.</p>
               ${message}`
    });
}

async function sendPasswordResetEmail(account: any, origin: any) {
    let message: string;

    if (origin) {
        const resetUrl = `${origin}/account/reset-password?token=${account.resetToken}`;
        message = `<p>Please click the below link to reset your password, the link will be valid for 1 day:</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>`;
    } else {
        message = `<p>Please use the below token to reset your password with the <code>/accounts/reset-password</code> api route:</p>
                   <p><code>${account.resetToken}</code></p>`;
    }

    await sendEmail({
        to: account.email,
        subject: 'Auth System — Reset Your Password',
        html: `<h4>Reset Password</h4>
               <p>Hi ${account.firstName},</p>
               ${message}`
    });
}
