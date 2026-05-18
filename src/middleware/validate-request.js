/**
 * validate-request.js — Joi Schema Validation Middleware
 *
 * Validates the request body against a Joi schema.
 * Returns 400 with details if validation fails.
 * Strips unknown properties from the body on success.
 */
module.exports = validateRequest;

function validateRequest(req, next, schema) {
    // Validate with options:
    //   abortEarly: false  → collect ALL errors (not just the first one)
    //   allowUnknown: true → don't reject extra properties
    //   stripUnknown: true → remove extra properties from the output
    const options = {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true
    };

    const { error, value } = schema.validate(req.body, options);

    if (error) {
        // Build a user-friendly error message from all validation errors
        const message = error.details.map(d => d.message).join(', ');

        // Throw with name 'ValidationError' so the error handler returns 400
        const validationError = new Error(message);
        validationError.name = 'ValidationError';
        return next(validationError);
    }

    // Replace req.body with the validated + stripped value
    req.body = value;
    next();
}
