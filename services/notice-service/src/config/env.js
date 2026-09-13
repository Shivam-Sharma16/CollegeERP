const { cleanEnv, port, str } = require('envalid');

const env = cleanEnv(process.env, {
  PORT:                   port(),
  MONGO_URI:              str(),
  // Optional — required only when Cloudinary upload is active
  CLOUDINARY_CLOUD_NAME:  str({ default: '' }),
  CLOUDINARY_API_KEY:     str({ default: '' }),
  CLOUDINARY_API_SECRET:  str({ default: '' }),
  // ImageKit Configuration
  IMAGEKIT_PUBLIC_KEY:    str({ default: '' }),
  IMAGEKIT_PRIVATE_KEY:   str({ default: '' }),
  IMAGEKIT_URL_ENDPOINT:  str({ default: '' }),
});

module.exports = env;
