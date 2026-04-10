const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const Joi = require('joi');

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  fullName: Joi.string().required(),
  orgName: Joi.string().optional().allow(''),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email, orgId: user.organization_id },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );
};

const register = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) throw error;

    const { email, password, fullName, orgName } = value;

    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    await client.query('BEGIN');

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const orgId = uuidv4();
    const orgNameToUse = orgName || "My Company";

    await client.query(
      'INSERT INTO organizations (id, name) VALUES ($1, $2)',
      [orgId, orgNameToUse]
    );

    const userResult = await client.query(
      'INSERT INTO users (id, organization_id, org_id, email, password_hash, full_name, role) VALUES ($1, $2, $2, $3, $4, $5, $6) RETURNING id, email, full_name, organization_id',
      [userId, orgId, email, hashedPassword, fullName, 'admin']
    );

    const user = userResult.rows[0];

    await client.query('COMMIT');

    const token = generateToken(user);

    res.status(201).json({
      user: { id: user.id, email: user.email, fullName: user.full_name, orgId: user.organization_id },
      token,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    next(err);
  } finally {
    client.release();
  }
};

const login = async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) throw error;

    const { email, password } = value;

    const userResult = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.organization_id, u.avatar_url, u.role
       FROM users u 
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        orgId: user.organization_id,
        avatarUrl: user.avatar_url,
        role: user.role
      },
      token,
    });
  } catch (err) {
    next(err);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const userResult = await db.query(
      `SELECT u.id, u.email, u.full_name, u.organization_id, u.org_id, u.avatar_url, u.role, u.phone, u.position, u.department, u.bio, u.timezone, u.language
       FROM users u 
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userResult.rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { fullName, phone, position, department, bio, timezone, language } = req.body;
    
    const result = await db.query(
      `UPDATE users 
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           position = COALESCE($3, position),
           department = COALESCE($4, department),
           bio = COALESCE($5, bio),
           timezone = COALESCE($6, timezone),
           language = COALESCE($7, language),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING id, email, full_name, phone, position, department, bio, timezone, language`,
      [fullName, phone, position, department, bio, timezone, language, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const userResult = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    const isMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
    res.status(501).json({ message: 'Not implemented' });
};

const resetPassword = async (req, res, next) => {
  res.status(501).json({ message: 'Not implemented' });
};

const logout = async (req, res, next) => {
  res.json({ message: 'Logged out successfully' });
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  resetPassword,
  forgotPassword,
  logout,
  changePassword,
};
