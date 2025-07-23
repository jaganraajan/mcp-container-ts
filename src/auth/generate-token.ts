console.warn("WARNING: This file is for demonstration purposes only.");
console.warn("WARNING: It generates a JWT token and writes it to a .env file.");
console.warn(
  "WARNING: In a real application, you should securely manage your secrets and tokens."
);
console.warn(
  "WARNING: Do not use this in production without proper security measures."
);

import { writeFileSync } from "fs";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";

// define dummy values for JWT_SECRET, JWT_EXPIRY, and PAYLOAD
const JWT_SECRET = randomBytes(32).toString('base64');
const JWT_EXPIRY = "1h";
const JWT_AUDIENCE = "mcp-client";
const JWT_ISSUER = "mcp-server";
const PAYLOAD = {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
};

const token = jwt.sign(PAYLOAD, JWT_SECRET, {
  algorithm: "HS256",
  expiresIn: JWT_EXPIRY,
});

// write the token to a file .env
writeFileSync(
  ".env",
`JWT_AUDIENCE="${JWT_AUDIENCE}"
JWT_ISSUER="${JWT_ISSUER}"
JWT_EXPIRY="${JWT_EXPIRY}"
JWT_SECRET="${JWT_SECRET}"
JWT_TOKEN="${token}"`,
  { flag: "w" }
);
