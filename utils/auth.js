// utils/auth.js

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Configure JWKS clients for both user pools
const userPoolClients = {
  user: jwksClient({
    jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}/.well-known/jwks.json`,
  }),
  admin: jwksClient({
    jwksUri: `https://cognito-idp.${process.env.ADMIN_AWS_REGION}.amazonaws.com/${process.env.ADMIN_USER_POOL_ID}/.well-known/jwks.json`,
  }),
};

// Helper function to get the appropriate JWKS client based on the issuer
function getJwksClient(iss) {
  if (iss === `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}`) {
    return userPoolClients.user;
  } else if (iss === `https://cognito-idp.${process.env.ADMIN_AWS_REGION}.amazonaws.com/${process.env.ADMIN_USER_POOL_ID}`) {
    return userPoolClients.admin;
  }
  throw new Error('Unknown token issuer');
}

// Middleware to authenticate requests
exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.error('No token provided');
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  // Decode the token without verifying to get the issuer
  const decodedToken = jwt.decode(token, { complete: true });

  if (!decodedToken) {
    console.error('Invalid token');
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { header, payload } = decodedToken;
  const iss = payload.iss;

  let client;
  try {
    client = getJwksClient(iss);
  } catch (err) {
    console.error(err.message);
    return res.status(401).json({ error: 'Token verification failed: Unknown issuer' });
  }

  // Function to retrieve the signing key
  function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
      if (err) {
        console.error('Error getting signing key:', err);
        return callback(err);
      }

      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    });
  }

  // Verify the token using the correct JWKS client
  jwt.verify(token, getKey, {}, (err, decoded) => {
    if (err) {
      console.error('Token verification failed:', err);
      return res.status(401).json({ error: 'Token verification failed' });
    }

    // Attach the decoded token to the request object
    req.user = decoded;
    next();
  });
};
