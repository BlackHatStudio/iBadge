import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import path from 'path';

const configuredEnvPath = process.env.IBADGE_ENV_FILE?.trim();
if (configuredEnvPath) {
  dotenv.config({ path: configuredEnvPath });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

const trustProxy = process.env.TRUST_PROXY?.trim();
if (trustProxy === '1' || trustProxy?.toLowerCase() === 'true') {
  app.set('trust proxy', true);
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'iBadge API',
    version: process.env.IBADGE_VERSION ?? '1.0.0',
    nowUtc: new Date().toISOString(),
  });
});

app.post('/auth/login', (_req, res) => {
  const token = jwt.sign(
    { sub: 'user-id', email: 'user@example.com' },
    process.env.JWT_SECRET ?? 'dev-secret',
    {
      expiresIn: '1h',
    }
  );
  res.json({ token });
});

app.get('/api/protected', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret');
    return res.json({ message: 'Protected route accessed', user: decoded });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

const port = process.env.PORT ?? 4000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
