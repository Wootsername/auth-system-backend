import { DataTypes } from 'sequelize';

export default function model(sequelize: any) {
    const attributes = {
        email:             { type: DataTypes.STRING(255), allowNull: false, unique: true },
        passwordHash:      { type: DataTypes.STRING(255), allowNull: false },
        title:             { type: DataTypes.STRING(10) },
        firstName:         { type: DataTypes.STRING(100), allowNull: false },
        lastName:          { type: DataTypes.STRING(100), allowNull: false },
        role:              { type: DataTypes.ENUM('Admin', 'User'), allowNull: false, defaultValue: 'User' },
        verificationToken: { type: DataTypes.STRING(255) },
        verified:          { type: DataTypes.DATE },
        resetToken:        { type: DataTypes.STRING(255) },
        resetTokenExpires: { type: DataTypes.DATE },
        passwordReset:     { type: DataTypes.DATE },
        refreshToken:      { type: DataTypes.STRING(255) },
        refreshTokenExpires: { type: DataTypes.DATE },
        created:           { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated:           { type: DataTypes.DATE },
        isVerified: {
            type: DataTypes.VIRTUAL,
            get() {
                return !!(this.verified || this.passwordReset);
            }
        }
    };

    const options = {
        timestamps: false,
        defaultScope: {
            attributes: { exclude: ['passwordHash'] }
        },
        scopes: {
            withHash: { attributes: {} }
        }
    };

    return sequelize.define('account', attributes, options);
}
