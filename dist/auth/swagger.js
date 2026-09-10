const errorSchema = {
    type: 'object',
    properties: {
        error: { type: 'string' },
    },
    required: ['error'],
};
const authTokensSchema = {
    type: 'object',
    properties: {
        access: { type: 'string' },
        refresh: { type: 'string' },
    },
    required: ['access', 'refresh'],
};
const userSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        email: { type: 'string', format: 'email' },
        handle: { type: 'string' },
    },
    required: ['id', 'email', 'handle'],
};
export const registerSchema = {
    tags: ['auth'],
    body: {
        type: 'object',
        properties: {
            email: { type: 'string', format: 'email', maxLength: 255 },
            password: { type: 'string', minLength: 8, maxLength: 200 },
            displayName: { type: 'string', minLength: 1, maxLength: 96 },
        },
        required: ['email', 'password'],
    },
    response: {
        201: {
            type: 'object',
            properties: {
                user: userSchema,
                emailVerified: { type: 'boolean' },
                access: { type: 'string' },
                refresh: { type: 'string' },
            },
            required: ['user', 'emailVerified', 'access', 'refresh'],
        },
        400: errorSchema,
        409: errorSchema,
    },
};
export const loginSchema = {
    tags: ['auth'],
    body: {
        type: 'object',
        properties: {
            email: { type: 'string', format: 'email', maxLength: 255 },
            password: { type: 'string', minLength: 1, maxLength: 200 },
        },
        required: ['email', 'password'],
    },
    response: {
        200: {
            type: 'object',
            properties: {
                user: userSchema,
                emailVerified: { type: 'boolean' },
                access: { type: 'string' },
                refresh: { type: 'string' },
            },
            required: ['user', 'emailVerified', 'access', 'refresh'],
        },
        400: errorSchema,
        401: errorSchema,
    },
};
export const refreshSchema = {
    tags: ['auth'],
    body: {
        type: 'object',
        properties: {
            refresh: { type: 'string', minLength: 1 },
        },
        required: ['refresh'],
    },
    response: {
        200: authTokensSchema,
        400: errorSchema,
        401: errorSchema,
    },
};
export const logoutSchema = {
    tags: ['auth'],
    body: {
        type: 'object',
        properties: {
            refresh: { type: 'string', minLength: 1 },
        },
        required: ['refresh'],
    },
    response: {
        204: { type: 'null' },
    },
};
export const verifyEmailSchema = {
    tags: ['auth'],
    body: {
        type: 'object',
        properties: {
            token: { type: 'string', minLength: 1 },
        },
        required: ['token'],
    },
    response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
        400: errorSchema,
    },
};
export const resendVerificationSchema = {
    tags: ['auth'],
    security: [{ bearerAuth: [] }],
    response: {
        200: {
            type: 'object',
            properties: {
                ok: { type: 'boolean' },
                alreadyVerified: { type: 'boolean' },
            },
            required: ['ok'],
        },
        400: errorSchema,
        401: errorSchema,
    },
};
export const forgotSchema = {
    tags: ['auth'],
    body: {
        type: 'object',
        properties: {
            email: { type: 'string', format: 'email', maxLength: 255 },
        },
        required: ['email'],
    },
    response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    },
};
export const resetSchema = {
    tags: ['auth'],
    body: {
        type: 'object',
        properties: {
            token: { type: 'string', minLength: 1 },
            password: { type: 'string', minLength: 8, maxLength: 200 },
        },
        required: ['token', 'password'],
    },
    response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
        400: errorSchema,
    },
};
export const meSchema = {
    tags: ['auth'],
    security: [{ bearerAuth: [] }],
    response: {
        200: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                email: { type: 'string', format: 'email' },
                handle: { type: 'string' },
                display_name: { type: ['string', 'null'] },
                timezone: { type: ['string', 'null'] },
                email_verified_at: { type: ['string', 'null'], format: 'date-time' },
                created_at: { type: 'string', format: 'date-time' },
                emailVerified: { type: 'boolean' },
            },
            required: ['id', 'email', 'handle', 'emailVerified', 'created_at'],
        },
        401: errorSchema,
        404: errorSchema,
    },
};
