import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Health check endpoint
app.get('/health', (_req, res) => res.json({ ok: true }));

// Auth endpoints
app.post('/auth/login', (_req, res) => {
  // TODO: Implement actual authentication logic
  // This is a placeholder that generates a JWT token
  const token = jwt.sign(
    { sub: 'user-id', email: 'user@example.com' },
    process.env.JWT_SECRET ?? 'dev-secret',
    {
      expiresIn: '1h',
    }
  );
  res.json({ token });
});

// Protected route example
app.get('/api/protected', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret');
    res.json({ message: 'Protected route accessed', user: decoded });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

const port = process.env.PORT ?? 4000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
