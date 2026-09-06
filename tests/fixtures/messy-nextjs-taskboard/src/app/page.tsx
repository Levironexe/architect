'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

// TODO: move this to env variables someday
const supabase = createClient(
  'https://xyzcompanyabc123.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlhYmMxMjMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDE1MzYwMDAwfQ.FAKE_KEY_DO_NOT_USE'
)

// duplicated from types.ts but whatever
type Task = {
  id: string
  title: string
  description: string
  status: string
  priority: string
  project_id: string
  assignee_id: string
  due_date: string
  created_at: string
}

type Project = {
  id: string
  name: string
  description: string
  owner_id: string
  color: string
  created_at: string
  task_count?: number
}

type ActivityItem = {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: any
  created_at: string
  user_name: string
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [totalTasks, setTotalTasks] = useState(0)
  const [completedTasks, setCompletedTasks] = useState(0)
  const [overdueTasks, setOverdueTasks] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [newProjectColor, setNewProjectColor] = useState('#3B82F6')
  const [creating, setCreating] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    // get current user
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)
        console.log('current user:', user)
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        if (profile) {
          setUserName(profile.name || user.email || 'User')
          console.log('profile loaded', profile)
        }
      } else {
        console.log('no user, redirecting to login')
        window.location.href = '/login'
      }
    }
    fetchUser()
  }, [])

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true)
      try {
        console.log('loading dashboard data...')

        // load projects
        const projectsRes = await fetch('/api/projects')
        if (!projectsRes.ok) {
          alert('Failed to load projects. Please refresh.')
          return
        }
        const projectsData = await projectsRes.json()
        console.log('projects loaded:', projectsData)
        setProjects(projectsData)
        setFilteredProjects(projectsData)

        // load all tasks
        const tasksRes = await fetch('/api/tasks')
        if (!tasksRes.ok) {
          alert('Failed to load tasks')
          return
        }
        const tasksData = await tasksRes.json()
        console.log('tasks loaded:', tasksData.length, 'tasks')
        setTasks(tasksData)
        setTotalTasks(tasksData.length)

        // count completed
        const done = tasksData.filter((t: Task) => t.status === 'done').length
        setCompletedTasks(done)

        // count overdue - inline date logic
        const now = new Date()
        const overdue = tasksData.filter((t: Task) => {
          if (!t.due_date) return false
          const due = new Date(t.due_date)
          return due < now && t.status !== 'done'
        }).length
        setOverdueTasks(overdue)

        // load activity
        const { data: activityData, error: actErr } = await supabase
          .from('activity_logs')
          .select('*, profiles(name)')
          .order('created_at', { ascending: false })
          .limit(20)

        if (actErr) {
          console.log('activity error:', actErr)
        } else {
          const formatted = (activityData || []).map((a: any) => ({
            ...a,
            user_name: a.profiles?.name || 'Unknown'
          }))
          setActivity(formatted)
        }

      } catch (err) {
        console.log('dashboard load error:', err)
        alert('Something went wrong loading the dashboard!')
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  useEffect(() => {
    // filter projects when search changes
    if (!searchQuery) {
      setFilteredProjects(projects)
    } else {
      const q = searchQuery.toLowerCase()
      const filtered = projects.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      )
      setFilteredProjects(filtered)
    }
  }, [searchQuery, projects])

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('Project name is required!')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDesc,
          color: newProjectColor,
        })
      })
      if (!res.ok) {
        alert('Failed to create project!')
        return
      }
      const newProject = await res.json()
      console.log('created project:', newProject)
      setProjects(prev => [newProject, ...prev])
      setFilteredProjects(prev => [newProject, ...prev])
      setShowNewProjectModal(false)
      setNewProjectName('')
      setNewProjectDesc('')
      setNewProjectColor('#3B82F6')
    } catch (e) {
      alert('Error creating project: ' + e)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? All tasks will be deleted too!')) {
      return
    }
    try {
      const res = await fetch(`/api/projects?id=${projectId}`, { method: 'DELETE' })
      if (!res.ok) {
        alert('Failed to delete project')
        return
      }
      setProjects(prev => prev.filter(p => p.id !== projectId))
      setFilteredProjects(prev => prev.filter(p => p.id !== projectId))
    } catch (e) {
      alert('Error: ' + e)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return '#EF4444'
    if (priority === 'medium') return '#F59E0B'
    if (priority === 'low') return '#10B981'
    return '#6B7280'
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAV - copy pasted in every page */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">TaskBoard</Link>
              <div className="ml-10 flex space-x-4">
                <Link href="/" className="text-gray-900 px-3 py-2 rounded-md text-sm font-medium bg-gray-100">Dashboard</Link>
                <Link href="/tasks/new" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">New Task</Link>
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
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6" style={{ borderLeft: '4px solid #3B82F6' }}>
            <p className="text-sm text-gray-500">Total Projects</p>
            <p className="text-3xl font-bold text-gray-900">{projects.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6" style={{ borderLeft: '4px solid #8B5CF6' }}>
            <p className="text-sm text-gray-500">Total Tasks</p>
            <p className="text-3xl font-bold text-gray-900">{totalTasks}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6" style={{ borderLeft: '4px solid #10B981' }}>
            <p className="text-sm text-gray-500">Completed</p>
            <p className="text-3xl font-bold text-gray-900">{completedTasks}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6" style={{ borderLeft: '4px solid #EF4444' }}>
            <p className="text-sm text-gray-500">Overdue</p>
            <p className="text-3xl font-bold text-gray-900">{overdueTasks}</p>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Projects Section */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Projects</h2>
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                + New Project
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-3">
              {filteredProjects.length === 0 && (
                <p className="text-gray-500 text-center py-8">No projects found. Create your first project!</p>
              )}
              {filteredProjects.map((project, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
                  style={{ borderLeft: `4px solid ${project.color || '#3B82F6'}` }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <Link href={`/projects/${project.id}`}>
                        <h3 className="font-semibold text-gray-900 hover:text-blue-600">{project.name}</h3>
                      </Link>
                      <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                      <div className="flex items-center mt-2 space-x-4">
                        <span className="text-xs text-gray-400">
                          Created {formatDate(project.created_at)}
                        </span>
                        {project.task_count !== undefined && (
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {project.task_count} tasks
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-200 rounded"
                      >
                        Open
                      </Link>
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="text-xs text-red-600 hover:text-red-800 px-2 py-1 border border-red-200 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="w-80">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
            <div className="bg-white rounded-lg shadow">
              {activity.length === 0 && (
                <p className="text-gray-500 text-center py-8 text-sm">No recent activity</p>
              )}
              {activity.map((item, index) => (
                <div key={index} className="p-3 border-b border-gray-100 last:border-0">
                  <p className="text-sm text-gray-800">
                    <span className="font-medium">{item.user_name}</span>{' '}
                    {item.action} {item.entity_type}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(item.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowNewProjectModal(false)}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Create New Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Awesome Project"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newProjectDesc}
                  onChange={e => setNewProjectDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="What is this project about?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <input
                  type="color"
                  value={newProjectColor}
                  onChange={e => setNewProjectColor(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-300 cursor-pointer"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
