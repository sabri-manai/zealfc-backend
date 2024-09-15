const Admin = require("../models/Admin");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.ADMIN_AWS_REGION}.amazonaws.com/${process.env.ADMIN_USER_POOL_ID}/.well-known/jwks.json`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error("Error getting signing key:", err);
      return callback(err);
    }

    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

exports.getAdminProfile = async (req, res) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token.split(' ')[1], getKey, {}, async (err, decoded) => {
    if (err) {
      console.error("Token verification failed:", err);
      return res.status(401).json({ error: "Token verification failed" });
    }

    const cognitoAdminSub = decoded.sub;

    try {
      // Fetch the user from the database based on cognitoAdminSub
      const admin = await Admin.findOne({ cognitoUserSub: cognitoAdminSub });
      if (!admin) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(200).json(admin);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ error: "Server error" });
    }
  });
};
