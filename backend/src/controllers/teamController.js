const supabase = require('../config/database');

// Workspaces
exports.getWorkspaces = async (req, res) => {
  try {
    // Get workspaces owned by user
    const { data: owned, error: ownedError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('ownerId', req.user.id);

    if (ownedError) throw ownedError;
    res.json({ workspaces: owned || [] });
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createWorkspace = async (req, res) => {
  try {
    const { name, slug, description } = req.body;

    const { data: workspace, error } = await supabase
      .from('workspaces')
      .insert({
        id: require('crypto').randomUUID(),
        ownerId: req.user.id,
        name,
        slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description,
        plan: 'free',
        isActive: true,
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ workspace });
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Teams
exports.getTeams = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { data: teams, error } = await supabase
      .from('teams')
      .select('*')
      .eq('workspaceId', workspaceId);

    if (error) throw error;
    res.json({ teams: teams || [] });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createTeam = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, slug, description } = req.body;

    const { data: team, error } = await supabase
      .from('teams')
      .insert({
        id: require('crypto').randomUUID(),
        workspaceId,
        name,
        slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description,
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Automatically add creator as admin member
    await supabase
      .from('team_members')
      .insert({
        id: require('crypto').randomUUID(),
        teamId: team.id,
        userId: req.user.id,
        role: 'admin',
        isActive: true,
        updatedAt: new Date().toISOString()
      });

    res.status(201).json({ team });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Members
exports.getTeamMembers = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { data: members, error } = await supabase
      .from('team_members')
      .select('*, user:users(id, email, name, avatar)')
      .eq('teamId', teamId);

    if (error) throw error;
    res.json({ members: members || [] });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.addTeamMember = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { email, role } = req.body;

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (userError || !user) {
      return res.status(404).json({ error: 'User with this email not found' });
    }

    const { data: member, error } = await supabase
      .from('team_members')
      .insert({
        id: require('crypto').randomUUID(),
        teamId,
        userId: user.id,
        role: role || 'member',
        isActive: true,
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ member });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
