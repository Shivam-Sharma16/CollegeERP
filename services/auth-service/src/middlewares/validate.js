const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map(detail => detail.message);
      // Fallback to simple response if fail is not imported locally, 
      // but for consistency we should import fail from shared-utils
      const { fail } = require('@college-erp/shared-utils');
      return res.status(400).json(fail(messages.join(', ')));
    }
    next();
  };
};

module.exports = validate;
