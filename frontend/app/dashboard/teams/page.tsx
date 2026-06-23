'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface Team {
  id: string;
  name: string;
  description: string;
}

interface Member {
  id: string;
  role: string;
  user: {
    email: string;
    name: string | null;
  };
}

export default function TeamsPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    
    api.get('/workspaces').then(res => {
      setWorkspaces(res.data.workspaces);
      if (res.data.workspaces.length > 0) {
        setSelectedWorkspace(res.data.workspaces[0]);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!selectedWorkspace) return;
    api.get(`/workspaces/${selectedWorkspace.id}/teams`).then(res => {
      setTeams(res.data.teams);
      if (res.data.teams.length > 0) {
        setSelectedTeam(res.data.teams[0]);
      } else {
        setSelectedTeam(null);
        setMembers([]);
      }
    }).catch(() => setTeams([]));
  }, [selectedWorkspace]);

  useEffect(() => {
    if (!selectedTeam) return;
    api.get(`/teams/${selectedTeam.id}/members`).then(res => {
      setMembers(res.data.members);
    }).catch(() => setMembers([]));
  }, [selectedTeam]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/workspaces', { name: newWorkspaceName });
      setWorkspaces([...workspaces, res.data.workspace]);
      setSelectedWorkspace(res.data.workspace);
      setNewWorkspaceName('');
    } catch {
      alert('Failed to create workspace.');
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspace) return;
    try {
      const res = await api.post(`/workspaces/${selectedWorkspace.id}/teams`, {
        name: newTeamName,
        description: newTeamDesc
      });
      setTeams([...teams, res.data.team]);
      setSelectedTeam(res.data.team);
      setNewTeamName('');
      setNewTeamDesc('');
    } catch {
      alert('Failed to create team.');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    try {
      const res = await api.post(`/teams/${selectedTeam.id}/members`, {
        email: newMemberEmail,
        role: 'member'
      });
      // Refresh members
      const refreshed = await api.get(`/teams/${selectedTeam.id}/members`);
      setMembers(refreshed.data.members);
      setNewMemberEmail('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add team member.');
    }
  };

  if (loading) return <div className="p-8">Loading teams...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold">Callendly</Link>
          <div className="flex gap-2">
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-black">Dashboard</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 md:grid-cols-4">
          
          {/* Workspace management column */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold mb-4 text-sm uppercase text-gray-500">Workspaces</h2>
            
            <div className="space-y-2 mb-6">
              {workspaces.map(w => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWorkspace(w)}
                  className={`w-full text-left rounded-md px-3 py-2 text-sm ${selectedWorkspace?.id === w.id ? 'bg-black text-white' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  {w.name}
                </button>
              ))}
            </div>

            <form onSubmit={handleCreateWorkspace} className="border-t border-gray-100 pt-4">
              <input
                required
                type="text"
                placeholder="Workspace name"
                value={newWorkspaceName}
                onChange={e => setNewWorkspaceName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs mb-2 focus:border-black focus:outline-none"
              />
              <button type="submit" className="w-full rounded-md bg-black py-1.5 text-xs text-white hover:bg-gray-800">
                Create Workspace
              </button>
            </form>
          </div>

          {/* Teams column */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:col-span-1">
            <h2 className="font-semibold mb-4 text-sm uppercase text-gray-500">Teams</h2>
            
            {selectedWorkspace ? (
              <>
                <div className="space-y-2 mb-6">
                  {teams.length === 0 ? (
                    <p className="text-xs text-gray-400">No teams created yet.</p>
                  ) : (
                    teams.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTeam(t)}
                        className={`w-full text-left rounded-md px-3 py-2 text-sm ${selectedTeam?.id === t.id ? 'bg-black text-white' : 'hover:bg-gray-50 text-gray-700'}`}
                      >
                        {t.name}
                      </button>
                    ))
                  )}
                </div>

                <form onSubmit={handleCreateTeam} className="border-t border-gray-100 pt-4">
                  <input
                    required
                    type="text"
                    placeholder="Team name"
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs mb-2 focus:border-black focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={newTeamDesc}
                    onChange={e => setNewTeamDesc(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs mb-2 focus:border-black focus:outline-none"
                  />
                  <button type="submit" className="w-full rounded-md bg-black py-1.5 text-xs text-white hover:bg-gray-800">
                    Create Team
                  </button>
                </form>
              </>
            ) : (
              <p className="text-xs text-gray-400">Select a workspace first.</p>
            )}
          </div>

          {/* Team details and members column */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:col-span-2">
            {selectedTeam ? (
              <div>
                <h1 className="text-xl font-bold mb-1">{selectedTeam.name}</h1>
                <p className="text-sm text-gray-500 mb-6">{selectedTeam.description || 'No description provided.'}</p>

                <h3 className="font-semibold text-sm uppercase text-gray-500 mb-3">Team Members</h3>
                <div className="space-y-3 mb-8">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center justify-between border-b border-gray-50 pb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.user.name || 'Anonymous'}</p>
                        <p className="text-xs text-gray-500">{m.user.email}</p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddMember} className="border-t border-gray-100 pt-6">
                  <h4 className="font-medium text-sm mb-2">Invite Member</h4>
                  <div className="flex gap-2">
                    <input
                      required
                      type="email"
                      placeholder="user@example.com"
                      value={newMemberEmail}
                      onChange={e => setNewMemberEmail(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    />
                    <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 whitespace-nowrap">
                      Add Member
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <p>Select a team to manage members and workspace options.</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
