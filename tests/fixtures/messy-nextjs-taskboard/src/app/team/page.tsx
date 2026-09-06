'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

// yes still hardcoded. yes i know. will fix next sprint (been saying this for 6 months)
const supabase = createClient(
  'https://xyzcompanyabc123.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlhYmMxMjMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDE1MzYwMDAwfQ.FAKE_KEY_DO_NOT_USE'
)

// duplicated User type - again. we have like 4 of these now
type User = {
  id: string
  name: string
  email: string
  avatar_url: string
  bio: string
  timezone: string
  role: string
  created_at: string
}

// also duplicating TeamMember separately even though it's basically the same
type TeamMember = {
  id: string
  name: string
  email: string
  avatar_url: string
  role: 'admin' | 'member' | 'viewer'
  status: 'active' | 'invited' | 'inactive'
  joined_at: string
  last_active?: string
  task_count?: number
  completed_count?: number
  bio?: string
  timezone?: string
}

type PendingInvite = {
  id: string
  email: string
  role: string
  invited_by: string
  created_at: string
  expires_at: string
}

// fake activity data for heatmap - 52 weeks * 7 days
function generateHeatmapData(userId: string) {
  // seed based on userId so it's consistent per user
  const data: number[][] = []
  for (let week = 0; week < 52; week++) {
    const weekData: number[] = []
    for (let day = 0; day < 7; day++) {
      // fake activity level 0-4
      const seed = (userId.charCodeAt(0) + week * 7 + day) % 5
      weekData.push(Math.max(0, seed - 1 + Math.floor(Math.random() * 2)))
    }
    data.push(weekData)
  }
  return data
}

const HEATMAP_COLORS = ['#f3f4f6', '#bbf7d0', '#4ade80', '#16a34a', '#14532d']

export default function TeamPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userName, setUserName] = useState('')
  const [currentUserRole, setCurrentUserRole] = useState('member')
  const [activeTab, setActiveTab] = useState<'members' | 'invites' | 'activity'>('members')
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)

  // invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteMessage, setInviteMessage] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)

  // role change
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null)
  const [newRole, setNewRole] = useState('member')

  // search
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [sortBy, setSortBy] = useState('name')

  // heatmap data - generated per selected member
  const [heatmapData, setHeatmapData] = useState<number[][]>([])

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }
      setCurrentUser(user)
      console.log('team page - current user:', user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserName(profile.name || user.email || 'User')
        setCurrentUserRole(profile.role || 'member')
      }
    }
    fetchUser()
  }, [])

  useEffect(() => {
    const loadTeam = async () => {
      setLoading(true)
      try {
        console.log('loading team members...')

        // load all users from profiles
        const { data: profiles, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .order('name')
          .limit(200)

        if (profErr) {
          console.log('profiles load error:', profErr)
          alert('Failed to load team members: ' + profErr.message)
          return
        }

        // get task counts per user - two separate queries because no join
        const { data: taskData } = await supabase
          .from('tasks')
          .select('assignee_id, status')
          .not('assignee_id', 'is', null)

        // aggregate task counts inline
        const taskCounts: Record<string, { total: number; done: number }> = {}
        ;(taskData || []).forEach((task: any) => {
          if (!taskCounts[task.assignee_id]) {
            taskCounts[task.assignee_id] = { total: 0, done: 0 }
          }
          taskCounts[task.assignee_id].total++
          if (task.status === 'done') taskCounts[task.assignee_id].done++
        })

        const members: TeamMember[] = (profiles || []).map((p: any) => ({
          id: p.id,
          name: p.name || 'Unknown',
          email: p.email || '',
          avatar_url: p.avatar_url || '',
          role: p.role || 'member',
          status: p.status || 'active',
          joined_at: p.created_at,
          last_active: p.last_active_at,
          bio: p.bio || '',
          timezone: p.timezone || 'UTC',
          task_count: taskCounts[p.id]?.total || 0,
          completed_count: taskCounts[p.id]?.done || 0
        }))

        setTeamMembers(members)
        console.log('team loaded:', members.length, 'members')

        // load pending invites
        const { data: invites, error: invErr } = await supabase
          .from('invitations')
          .select('*')
          .eq('accepted', false)
          .order('created_at', { ascending: false })

        if (!invErr && invites) {
          setPendingInvites(invites)
          console.log('pending invites:', invites.length)
        }

      } catch (e) {
        console.log('team load error:', e)
        alert('Something went wrong loading team: ' + e)
      } finally {
        setLoading(false)
      }
    }
    loadTeam()
  }, [])

  const filteredMembers = teamMembers.filter(m => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!m.name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) {
        return false
      }
    }
    if (filterRole !== 'all' && m.role !== filterRole) return false
    return true
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'tasks') return (b.task_count || 0) - (a.task_count || 0)
    if (sortBy === 'completed') return (b.completed_count || 0) - (a.completed_count || 0)
    if (sortBy === 'joined') return new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
    return 0
  })

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) {
      alert('Please enter an email address!')
      return
    }
    if (!inviteEmail.includes('@') || !inviteEmail.includes('.')) {
      alert('Please enter a valid email address')
      return
    }
    // check if already a member
    const existing = teamMembers.find(m => m.email.toLowerCase() === inviteEmail.toLowerCase())
    if (existing) {
      alert(`${inviteEmail} is already a team member!`)
      return
    }

    setSendingInvite(true)
    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // invite expires in 7 days

      const { data, error } = await supabase
        .from('invitations')
        .insert({
          email: inviteEmail.trim(),
          role: inviteRole,
          message: inviteMessage.trim() || null,
          invited_by: currentUser.id,
          accepted: false,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        alert('Failed to send invite: ' + error.message)
        return
      }

      console.log('invite sent:', data.id)
      setPendingInvites(prev => [data, ...prev])
      setInviteEmail('')
      setInviteMessage('')
      setInviteRole('member')
      setShowInviteModal(false)
      alert(`Invitation sent to ${inviteEmail}! They have 7 days to accept.`)

    } catch (e) {
      alert('Error sending invite: ' + e)
    } finally {
      setSendingInvite(false)
    }
  }

  const handleRevokeInvite = async (inviteId: string, email: string) => {
    if (!confirm(`Revoke invitation for ${email}?`)) return
    try {
      const { error } = await supabase.from('invitations').delete().eq('id', inviteId)
      if (error) {
        alert('Failed to revoke invite: ' + error.message)
        return
      }
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId))
      console.log('invite revoked:', inviteId)
      alert('Invitation revoked.')
    } catch (e) {
      alert('Error: ' + e)
    }
  }

  const handleChangeRole = async (memberId: string, memberName: string, roleValue: string) => {
    if (!confirm(`Change ${memberName}'s role to ${roleValue}?`)) return
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: roleValue, updated_at: new Date().toISOString() })
        .eq('id', memberId)

      if (error) {
        alert('Failed to change role: ' + error.message)
        return
      }
      setTeamMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, role: roleValue as TeamMember['role'] } : m
      ))
      setChangingRoleFor(null)
      console.log('role changed:', memberId, roleValue)
      alert(`${memberName}'s role updated to ${roleValue}`)
    } catch (e) {
      alert('Error changing role: ' + e)
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (memberId === currentUser?.id) {
      alert("You can't remove yourself from the team!")
      return
    }
    if (!confirm(`Remove ${memberName} from the team? They will lose access to all projects!`)) return
    try {
      // delete from project_members
      await supabase.from('project_members').delete().eq('user_id', memberId)
      // we can't really delete auth users from client side - would need edge function
      console.log('removed member from projects:', memberId)
      setTeamMembers(prev => prev.filter(m => m.id !== memberId))
      alert(`${memberName} has been removed from all projects.`)
    } catch (e) {
      alert('Error removing member: ' + e)
    }
  }

  const openMemberModal = (member: TeamMember) => {
    setSelectedMember(member)
    setHeatmapData(generateHeatmapData(member.id))
    setShowMemberModal(true)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Unknown'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getRoleBadgeClass = (role: string) => {
    if (role === 'admin') return 'bg-blue-100 text-blue-800'
    if (role === 'viewer') return 'bg-gray-100 text-gray-600'
    return 'bg-green-100 text-green-800'
  }

  const getStatusDot = (status: string) => {
    if (status === 'active') return 'bg-green-400'
    if (status === 'invited') return 'bg-yellow-400'
    return 'bg-gray-300'
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading team...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAV - SEVENTH TIME copy pasting this. kill me */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">TaskBoard</Link>
              <div className="ml-10 flex space-x-4">
                <Link href="/" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Dashboard</Link>
                <Link href="/projects" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Projects</Link>
                <Link href="/tasks/new" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">New Task</Link>
                <Link href="/reports" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Reports</Link>
                <Link href="/team" className="text-gray-900 px-3 py-2 rounded-md text-sm font-medium bg-gray-100">Team</Link>
                <Link href="/settings" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Settings</Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {userName}</span>
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  window.location.href = '/login'
                }}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team</h1>
            <p className="text-sm text-gray-500 mt-1">{teamMembers.length} members · {pendingInvites.length} pending invites</p>
          </div>
          {currentUserRole === 'admin' && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              + Invite Member
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 border-b border-gray-200 mb-6">
          {[
            { key: 'members', label: `Members (${teamMembers.length})` },
            { key: 'invites', label: `Pending Invites (${pendingInvites.length})` },
            { key: 'activity', label: 'Activity' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div>
            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-center gap-3">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
              >
                <option value="name">Sort by Name</option>
                <option value="tasks">Sort by Tasks</option>
                <option value="completed">Sort by Completed</option>
                <option value="joined">Sort by Join Date</option>
              </select>
            </div>

            {/* Members Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMembers.length === 0 && (
                <div className="col-span-3 text-center py-12">
                  <p className="text-gray-500">No members found matching your search</p>
                </div>
              )}
              {filteredMembers.map((member, index) => (
                <div
                  key={member.id || index}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getStatusDot(member.status)}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeClass(member.role)}`}>
                      {member.role}
                    </span>
                  </div>

                  {member.bio && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{member.bio}</p>
                  )}

                  <div className="flex items-center space-x-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    <span>{member.task_count || 0} tasks</span>
                    <span className="text-green-600">{member.completed_count || 0} done</span>
                    <span>Joined {formatDate(member.joined_at)}</span>
                  </div>

                  <div className="flex space-x-2 mt-3">
                    <button
                      onClick={() => openMemberModal(member)}
                      className="flex-1 text-center text-xs text-blue-600 hover:text-blue-800 px-2 py-1.5 border border-blue-200 rounded"
                    >
                      View Profile
                    </button>
                    {currentUserRole === 'admin' && member.id !== currentUser?.id && (
                      <>
                        {changingRoleFor === member.id ? (
                          <div className="flex space-x-1">
                            <select
                              value={newRole}
                              onChange={e => setNewRole(e.target.value)}
                              className="text-xs border border-gray-300 rounded px-1"
                            >
                              <option value="member">member</option>
                              <option value="admin">admin</option>
                              <option value="viewer">viewer</option>
                            </select>
                            <button
                              onClick={() => handleChangeRole(member.id, member.name, newRole)}
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setChangingRoleFor(null)}
                              className="text-xs border border-gray-300 px-2 py-1 rounded"
                            >
                              x
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setChangingRoleFor(member.id)
                              setNewRole(member.role)
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 border border-gray-200 rounded"
                          >
                            Role
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveMember(member.id, member.name)}
                          className="text-xs text-red-600 hover:text-red-800 px-2 py-1.5 border border-red-200 rounded"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Invites Tab */}
        {activeTab === 'invites' && (
          <div>
            {pendingInvites.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500">No pending invitations</p>
                {currentUserRole === 'admin' && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
                  >
                    Send an Invite
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingInvites.map((invite, index) => {
                      const isExpired = new Date(invite.expires_at) < new Date()
                      return (
                        <tr key={invite.id || index} className={isExpired ? 'bg-red-50' : 'hover:bg-gray-50'}>
                          <td className="px-4 py-3 text-sm text-gray-900">{invite.email}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeClass(invite.role)}`}>
                              {invite.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{formatDate(invite.created_at)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs ${isExpired ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                              {isExpired ? 'Expired' : formatDate(invite.expires_at)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`${window.location.origin}/invite/${invite.id}`)
                                  alert('Invite link copied to clipboard!')
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800"
                              >
                                Copy Link
                              </button>
                              <button
                                onClick={() => handleRevokeInvite(invite.id, invite.email)}
                                className="text-xs text-red-600 hover:text-red-800"
                              >
                                Revoke
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Activity Heatmap</h2>
            <p className="text-sm text-gray-500 mb-6">Click on a team member to see their activity heatmap</p>

            <div className="flex space-x-4 mb-6 overflow-x-auto pb-2">
              {teamMembers.slice(0, 10).map((member, index) => (
                <button
                  key={member.id || index}
                  onClick={() => openMemberModal(member)}
                  className={`flex-shrink-0 flex flex-col items-center space-y-1 p-3 rounded-lg hover:bg-gray-50 transition-colors ${
                    selectedMember?.id === member.id ? 'bg-blue-50 ring-2 ring-blue-300' : ''
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                    {member.name.charAt(0)}
                  </div>
                  <span className="text-xs text-gray-600 max-w-[60px] truncate">{member.name.split(' ')[0]}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${getRoleBadgeClass(member.role)}`}>{member.role}</span>
                </button>
              ))}
            </div>

            {selectedMember ? (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">{selectedMember.name}'s Activity (Last 52 Weeks)</h3>
                {/* activity heatmap - github style, all inline divs */}
                <div className="flex gap-1 overflow-x-auto">
                  {heatmapData.map((week, wIndex) => (
                    <div key={wIndex} className="flex flex-col gap-1">
                      {week.map((level, dIndex) => (
                        <div
                          key={dIndex}
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: HEATMAP_COLORS[level] || HEATMAP_COLORS[0] }}
                          title={`Week ${wIndex + 1}, Day ${dIndex + 1}: ${level > 0 ? level * 3 + ' tasks' : 'No activity'}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex items-center space-x-2 mt-3">
                  <span className="text-xs text-gray-500">Less</span>
                  {HEATMAP_COLORS.map((color, i) => (
                    <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  ))}
                  <span className="text-xs text-gray-500">More</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">Select a team member to view their activity</p>
            )}
          </div>
        )}
      </div>

      {/* Member Profile Modal */}
      {showMemberModal && selectedMember && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowMemberModal(false)}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                  {selectedMember.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedMember.name}</h2>
                  <p className="text-sm text-gray-500">{selectedMember.email}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${getRoleBadgeClass(selectedMember.role)}`}>
                    {selectedMember.role}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowMemberModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="space-y-4">
              {selectedMember.bio && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Bio</h3>
                  <p className="text-sm text-gray-700">{selectedMember.bio}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Timezone</h3>
                  <p className="text-sm text-gray-700">{selectedMember.timezone || 'UTC'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Joined</h3>
                  <p className="text-sm text-gray-700">{formatDate(selectedMember.joined_at)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedMember.task_count || 0}</p>
                  <p className="text-xs text-gray-500">Total Tasks</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{selectedMember.completed_count || 0}</p>
                  <p className="text-xs text-gray-500">Completed</p>
                </div>
              </div>

              {/* mini activity heatmap in modal */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Activity (Last Year)</h3>
                <div className="flex gap-0.5 overflow-hidden">
                  {heatmapData.slice(-26).map((week, wIndex) => (
                    <div key={wIndex} className="flex flex-col gap-0.5">
                      {week.map((level, dIndex) => (
                        <div
                          key={dIndex}
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{ backgroundColor: HEATMAP_COLORS[level] || HEATMAP_COLORS[0] }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {currentUserRole === 'admin' && selectedMember.id !== currentUser?.id && (
                <div className="pt-4 border-t border-gray-100 flex space-x-3">
                  <button
                    onClick={() => {
                      handleRemoveMember(selectedMember.id, selectedMember.name)
                      setShowMemberModal(false)
                    }}
                    className="flex-1 bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-100"
                  >
                    Remove from Team
                  </button>
                  <button
                    onClick={() => {
                      alert('Message feature not implemented yet')
                    }}
                    className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Send Message
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Invite Team Member</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                >
                  <option value="member">Member - Can create and manage tasks</option>
                  <option value="admin">Admin - Full access including team management</option>
                  <option value="viewer">Viewer - Read only access</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Personal Message (optional)</label>
                <textarea
                  value={inviteMessage}
                  onChange={e => setInviteMessage(e.target.value)}
                  rows={3}
                  placeholder="Add a personal note to your invitation..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvite}
                disabled={sendingInvite}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {sendingInvite ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
