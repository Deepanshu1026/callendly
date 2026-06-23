const supabase = require('../config/database');
const { verifyToken } = require('../utils/jwt');

exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const { data: user, error } = await supabase
      .from('users')
      .select('*, user_profiles(*)')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    if (user.user_profiles && user.user_profiles.length > 0) {
      user.profile = user.user_profiles[0];
    } else {
      user.profile = null;
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

exports.optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      
      const { data: user, error } = await supabase
        .from('users')
        .select('*, user_profiles(*)')
        .eq('id', decoded.userId)
        .single();

      if (user) {
        if (user.user_profiles && user.user_profiles.length > 0) {
          user.profile = user.user_profiles[0];
        } else {
          user.profile = null;
        }
        req.user = user;
      } else {
        req.user = null;
      }
    } else {
      req.user = null;
    }
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};
