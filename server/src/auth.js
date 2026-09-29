const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secure-loan-secret-key-2026';

function generateToken(user) {
  let perms = [];
  if (Array.isArray(user.permissions)) {
    perms = user.permissions;
  } else if (typeof user.permissions === 'string') {
    try { perms = JSON.parse(user.permissions); } catch(e) { perms = []; }
  } else if (user.role === 'OWNER') {
    perms = ['COLLECT_PAYMENTS', 'ISSUE_LOANS', 'REGISTER_CLIENTS', 'VIEW_REPORTS', 'TOPUP_LOANS', 'MANAGE_USERS'];
  } else {
    perms = ['COLLECT_PAYMENTS', 'ISSUE_LOANS', 'REGISTER_CLIENTS', 'VIEW_REPORTS'];
  }

  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      status: user.status || 'ACTIVE',
      permissions: perms
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.status === 'SUSPENDED' || decoded.status === 'INACTIVE') {
      return res.status(403).json({ error: 'Your account has been deactivated or suspended by the business owner.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireOwner(req, res, next) {
  if (req.user && req.user.role === 'OWNER') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied: Owner privileges required' });
}

function requirePermission(permissionName) {
  return (req, res, next) => {
    if (req.user && req.user.role === 'OWNER') {
      return next();
    }
    const userPerms = req.user?.permissions || [];
    if (userPerms.includes(permissionName)) {
      return next();
    }
    return res.status(403).json({ error: `Access denied: Missing permission '${permissionName}'. Contact business owner.` });
  };
}

module.exports = {
  generateToken,
  verifyToken,
  requireOwner,
  requirePermission
};
