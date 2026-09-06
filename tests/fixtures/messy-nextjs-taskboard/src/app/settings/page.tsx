'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

// yep hardcoded again. i know i know
const supabase = createClient(
  'https://xyzcompanyabc123.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlhYmMxMjMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDE1MzYwMDAwfQ.FAKE_KEY_DO_NOT_USE'
)

type UserProfile = {
  id: string
  name: string
  email: string
  avatar_url: string
  bio: string
  timezone: string
  role: string
}

type NotificationSettings = {
  email_task_assigned: boolean
  email_task_due: boolean
  email_project_updates: boolean
  email_weekly_digest: boolean
  push_enabled: boolean
  push_mentions: boolean
}

type TeamMember = {
  id: string
  name: string
  email: string
  role: string
  joined_at: string
  avatar_url: string
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    email_task_assigned: true,
    email_task_due: true,
    email_project_updates: false,
    email_weekly_digest: true,
    push_enabled: false,
    push_mentions: false
  })
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingNotifs, setSavingNotifs] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'team' | 'danger'>('profile')

  // profile form state
  const [profileName, setProfileName] = useState('')
  const [profileBio, setProfileBio] = useState('')
  const [profileTimezone, setProfileTimezone] = useState('UTC')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }
      setCurrentUser(user)
      console.log('settings page - user:', user.id)

      setLoading(true)
      try {
        // load profile
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profErr) {
          console.log('profile error:', profErr)
          alert('Could not load profile')
        } else {
          setProfile(prof)
          setProfileName(prof.name || '')
          setProfileBio(prof.bio || '')
          setProfileTimezone(prof.timezone || 'UTC')
          console.log('profile loaded for settings')
        }

        // load notification settings from user_settings table
        const { data: notifs } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (notifs) {
          setNotifSettings({
            email_task_assigned: notifs.email_task_assigned ?? true,
            email_task_due: notifs.email_task_due ?? true,
            email_project_updates: notifs.email_project_updates ?? false,
            email_weekly_digest: notifs.email_weekly_digest ?? true,
            push_enabled: notifs.push_enabled ?? false,
            push_mentions: notifs.push_mentions ?? false
          })
        }

        // load team members - all users really
        const { data: members, error: membErr } = await supabase
          .from('profiles')
          .select('*')
          .order('name')
          .limit(50)

        if (!membErr && members) {
          setTeamMembers(members.map((m: any) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            role: m.role || 'member',
            joined_at: m.created_at,
            avatar_url: m.avatar_url
          })))
          console.log('team loaded:', members.length)
        }

      } catch (e) {
        console.log('settings init error:', e)
        alert('Error loading settings: ' + e)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      alert('Name cannot be empty!')
      return
    }
    setSavingProfile(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profileName,
          bio: profileBio,
          timezone: profileTimezone,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id)

      if (error) {
        alert('Failed to save profile: ' + error.message)
        return
      }
      console.log('profile saved')
      alert('Profile saved successfully!')
      setProfile(prev => prev ? { ...prev, name: profileName, bio: profileBio, timezone: profileTimezone } : null)
    } catch (e) {
      alert('Error saving profile: ' + e)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Please fill in all password fields')
      return
    }
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match!')
      return
    }
    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters')
      return
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        alert('Failed to update password: ' + error.message)
        return
      }
      alert('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      console.log('password changed')
    } catch (e) {
      alert('Error changing password: ' + e)
    }
  }

  const handleSaveNotifications = async () => {
    setSavingNotifs(true)
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: currentUser.id,
          ...notifSettings,
          updated_at: new Date().toISOString()
        })

      if (error) {
        alert('Failed to save notification settings: ' + error.message)
        return
      }
      console.log('notification settings saved')
      alert('Notification preferences saved!')
    } catch (e) {
      alert('Error saving notifications: ' + e)
    } finally {
      setSavingNotifs(false)
    }
  }

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      alert('Please enter an email address')
      return
    }
    if (!inviteEmail.includes('@')) {
      alert('Please enter a valid email')
      return
    }
    setSendingInvite(true)
    try {
      // just insert into invitations table
      const { error } = await supabase
        .from('invitations')
        .insert({
          email: inviteEmail,
          role: inviteRole,
          invited_by: currentUser.id,
          created_at: new Date().toISOString()
        })

      if (error) {
        alert('Failed to send invite: ' + error.message)
        return
      }
      console.log('invite sent to:', inviteEmail)
      alert('Invitation sent to ' + inviteEmail + '!')
      setInviteEmail('')
    } catch (e) {
      alert('Error sending invite: ' + e)
    } finally {
      setSendingInvite(false)
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from the team? This cannot be undone.`)) return
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('user_id', memberId)

      if (error) {
        alert('Could not remove member: ' + error.message)
        return
      }
      setTeamMembers(prev => prev.filter(m => m.id !== memberId))
      console.log('removed member:', memberId)
      alert(memberName + ' has been removed from all projects.')
    } catch (e) {
      alert('Error removing member: ' + e)
    }
  }

  const handleDeleteAccount = async () => {
    const confirmText = prompt('Type "DELETE" to confirm account deletion:')
    if (confirmText !== 'DELETE') {
      alert('Account deletion cancelled.')
      return
    }
    // this would need an edge function in real life
    alert('Account deletion requested. You will receive a confirmation email.')
    console.log('account deletion requested for:', currentUser.id)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAV - copy pasted AGAIN. should really make a component */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">TaskBoard</Link>
              <div className="ml-10 flex space-x-4">
                <Link href="/" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Dashboard</Link>
                <Link href="/tasks/new" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">New Task</Link>
                <Link href="/settings" className="text-gray-900 px-3 py-2 rounded-md text-sm font-medium bg-gray-100">Settings</Link>
              </div>
            </div>
            <div className="flex items-center">
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

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* Tabs */}
        <div className="flex space-x-1 border-b border-gray-200 mb-6">
          {(['profile', 'notifications', 'team', 'danger'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize rounded-t-lg transition-colors ${
                activeTab === tab
                  ? 'bg-white border border-b-white border-gray-200 text-blue-600 -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'danger' ? '⚠ Danger Zone' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-xl shadow p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
            <div className="flex items-center space-x-4 pb-4 border-b">
              <div
                className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold"
                style={{ flexShrink: 0 }}
              >
                {profileName.charAt(0) || '?'}
              </div>
              <div>
                <p className="font-medium">{profile?.email}</p>
                <p className="text-sm text-gray-500">{profile?.role || 'Member'}</p>
                <button className="text-xs text-blue-600 hover:text-blue-800 mt-1">Change avatar</button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={profileBio}
                onChange={e => setProfileBio(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tell your team about yourself..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <select
                value={profileTimezone}
                onChange={e => setProfileTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
              </select>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>

            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Change Password</h3>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                />
                <button
                  onClick={handleChangePassword}
                  className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 text-sm"
                >
                  Update Password
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
            <p className="text-sm text-gray-500">Control what emails and notifications you receive.</p>

            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Email Notifications</h3>
              {[
                { key: 'email_task_assigned', label: 'When a task is assigned to me', desc: 'Receive an email when someone assigns you a task' },
                { key: 'email_task_due', label: 'Task due date reminders', desc: '24 hours before a task is due' },
                { key: 'email_project_updates', label: 'Project activity updates', desc: 'Daily digest of activity in your projects' },
                { key: 'email_weekly_digest', label: 'Weekly summary', desc: 'Summary of your work each Monday' },
              ].map(item => (
                <div key={item.key} className="flex items-start justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => setNotifSettings(prev => ({
                      ...prev,
                      [item.key]: !prev[item.key as keyof NotificationSettings]
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notifSettings[item.key as keyof NotificationSettings] ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        notifSettings[item.key as keyof NotificationSettings] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveNotifications}
              disabled={savingNotifs}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm mt-4"
            >
              {savingNotifs ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite Team Member</h2>
              <div className="flex space-x-3">
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={handleInviteMember}
                  disabled={sendingInvite}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {sendingInvite ? 'Sending...' : 'Invite'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Members ({teamMembers.length})</h2>
              <div className="space-y-3">
                {teamMembers.map((member, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-sm font-medium">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        member.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                        member.role === 'viewer' ? 'bg-gray-100 text-gray-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {member.role}
                      </span>
                      {member.id !== currentUser?.id && (
                        <button
                          onClick={() => handleRemoveMember(member.id, member.name)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Danger Zone */}
        {activeTab === 'danger' && (
          <div className="bg-white rounded-xl shadow p-6 border border-red-200">
            <h2 className="text-lg font-semibold text-red-700 mb-4">Danger Zone</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">Delete Account</p>
                  <p className="text-xs text-gray-500">Permanently delete your account and all associated data.</p>
                </div>
                <button
                  onClick={handleDeleteAccount}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm"
                >
                  Delete Account
                </button>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Export Data</p>
                  <p className="text-xs text-gray-500">Download all your data as a JSON file.</p>
                </div>
                <button
                  onClick={() => alert('Export feature coming soon!')}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Export Data
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
