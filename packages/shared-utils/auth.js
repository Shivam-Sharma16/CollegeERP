const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken; // If stored in cookie
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'ny+cq<I;(UL.LR#vzDM2j4>*Xc8^|4l^woMWm#|.iD0';
    const decoded = jwt.verify(token, secret);
    
    req.user = {
      ...decoded,
      roles: decoded.roles || []
    };
    req.institutionId = decoded.institutionId ? decoded.institutionId.toString() : null;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
