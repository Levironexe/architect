'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

// TODO: move this to env variables someday - copy pasted from dashboard
const supabase = createClient(
  'https://xyzcompanyabc123.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlhYmMxMjMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDE1MzYwMDAwfQ.FAKE_KEY_DO_NOT_USE'
)

// duplicated from types.ts again lol
type Project = {
  id: string
  name: string
  description: string
  owner_id: string
  color: string
  status: string
  priority: string
  created_at: string
  updated_at: string
  task_count?: number
  member_count?: number
}

type Task = {
  id: string
  title: string
  status: string
  priority: string
  project_id: string
  due_date: string
  created_at: string
}

type ProjectStats = {
  total: number
  active: number
  completed: number
  on_hold: number
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newColor, setNewColor] = useState('#3B82F6')
  const [newStatus, setNewStatus] = useState('active')
  const [newPriority, setNewPriority] = useState('medium')
  const [creating, setCreating] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [stats, setStats] = useState<ProjectStats>({ total: 0, active: 0, completed: 0, on_hold: 0 })
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userName, setUserName] = useState('')
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        if (profile) {
          setUserName(profile.name || user.email || 'User')
        }
      } else {
        window.location.href = '/login'
      }
    }
    fetchUser()
  }, [])

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true)
      try {
        console.log('loading all projects...')
        const res = await fetch('/api/projects')
        if (!res.ok) {
          alert('Failed to load projects!')
          return
        }
        const data = await res.json()
        console.log('projects loaded:', data.length)
        setProjects(data)
        setFilteredProjects(data)

        // calculate stats inline
        const s: ProjectStats = {
          total: data.length,
          active: data.filter((p: Project) => p.status === 'active' || !p.status).length,
          completed: data.filter((p: Project) => p.status === 'completed').length,
          on_hold: data.filter((p: Project) => p.status === 'on_hold').length
        }
        setStats(s)
      } catch (e) {
        console.log('projects load error:', e)
        alert('Error loading projects: ' + e)
      } finally {
        setLoading(false)
      }
    }
    loadProjects()
  }, [])

  // Filter and sort whenever filters change - all inline, no useMemo
  useEffect(() => {
    let result = [...projects]

    // search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      )
    }

    // status filter
    if (filterStatus !== 'all') {
      result = result.filter(p => {
        if (filterStatus === 'active') return !p.status || p.status === 'active'
        return p.status === filterStatus
      })
    }

    // priority filter
    if (filterPriority !== 'all') {
      result = result.filter(p => p.priority === filterPriority)
    }

    // date range filter
    if (dateFrom) {
      const from = new Date(dateFrom)
      result = result.filter(p => new Date(p.created_at) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59)
      result = result.filter(p => new Date(p.created_at) <= to)
    }

    // sorting - inline
    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'updated_at') {
      result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    } else if (sortBy === 'task_count') {
      result.sort((a, b) => (b.task_count || 0) - (a.task_count || 0))
    } else {
      // default: created_at desc
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    setFilteredProjects(result)
  }, [searchQuery, filterStatus, filterPriority, sortBy, dateFrom, dateTo, projects])

  const handleCreateProject = async () => {
    if (!newName.trim()) {
      alert('Project name is required!')
      return
    }
    if (newName.length > 100) {
      alert('Project name too long (max 100 characters)')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          color: newColor,
          status: newStatus,
          priority: newPriority,
        })
      })
      if (!res.ok) {
        const err = await res.json()
        alert('Failed to create project: ' + (err.error || 'unknown error'))
        return
      }
      const created = await res.json()
      console.log('project created:', created)
      setProjects(prev => [created, ...prev])
      setStats(prev => ({ ...prev, total: prev.total + 1, active: prev.active + 1 }))
      setShowCreateModal(false)
      setNewName('')
      setNewDesc('')
      setNewColor('#3B82F6')
      setNewStatus('active')
      setNewPriority('medium')
      alert('Project created successfully!')
    } catch (e) {
      console.log('create error:', e)
      alert('Error creating project: ' + e)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Delete project "${projectName}"? All tasks will be permanently deleted!`)) {
      return
    }
    try {
      const res = await fetch(`/api/projects?id=${projectId}`, { method: 'DELETE' })
      if (!res.ok) {
        alert('Failed to delete project')
        return
      }
      console.log('deleted project:', projectId)
      setProjects(prev => prev.filter(p => p.id !== projectId))
      setStats(prev => ({ ...prev, total: prev.total - 1 }))
    } catch (e) {
      alert('Delete failed: ' + e)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedProjects.length === 0) {
      alert('No projects selected')
      return
    }
    if (!confirm(`Delete ${selectedProjects.length} selected projects? This cannot be undone!`)) return
    try {
      let failCount = 0
      for (const id of selectedProjects) {
        const res = await fetch(`/api/projects?id=${id}`, { method: 'DELETE' })
        if (!res.ok) failCount++
      }
      if (failCount > 0) {
        alert(`${failCount} projects failed to delete`)
      } else {
        alert(`${selectedProjects.length} projects deleted`)
      }
      setProjects(prev => prev.filter(p => !selectedProjects.includes(p.id)))
      setSelectedProjects([])
    } catch (e) {
      alert('Bulk delete error: ' + e)
    }
  }

  const toggleSelectProject = (id: string) => {
    setSelectedProjects(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
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

  const getStatusBadge = (status: string) => {
    if (!status || status === 'active') return 'bg-green-100 text-green-800'
    if (status === 'completed') return 'bg-blue-100 text-blue-800'
    if (status === 'on_hold') return 'bg-yellow-100 text-yellow-800'
    if (status === 'archived') return 'bg-gray-100 text-gray-800'
    return 'bg-gray-100 text-gray-600'
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilterStatus('all')
    setFilterPriority('all')
    setDateFrom('')
    setDateTo('')
    setSortBy('created_at')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading projects...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAV - copy pasted again, should really be a component but no time */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">TaskBoard</Link>
              <div className="ml-10 flex space-x-4">
                <Link href="/" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Dashboard</Link>
                <Link href="/projects" className="text-gray-900 px-3 py-2 rounded-md text-sm font-medium bg-gray-100">Projects</Link>
                <Link href="/tasks/new" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">New Task</Link>
                <Link href="/reports" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Reports</Link>
                <Link href="/team" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Team</Link>
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
            <h1 className="text-2xl font-bold text-gray-900">All Projects</h1>
            <p className="text-sm text-gray-500 mt-1">{filteredProjects.length} of {projects.length} projects</p>
          </div>
          <div className="flex items-center space-x-3">
            {selectedProjects.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-700"
              >
                Delete Selected ({selectedProjects.length})
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              + New Project
            </button>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Main Content */}
          <div className="flex-1">
            {/* Search and Filters Bar */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="archived">Archived</option>
                </select>
                <select
                  value={filterPriority}
                  onChange={e => setFilterPriority(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                >
                  <option value="all">All Priority</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">From:</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="px-2 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">To:</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="px-2 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                >
                  <option value="created_at">Newest First</option>
                  <option value="updated_at">Recently Updated</option>
                  <option value="name">Name A-Z</option>
                  <option value="task_count">Most Tasks</option>
                </select>
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Clear Filters
                </button>
                <div className="flex border border-gray-300 rounded-lg overflow-hidden ml-auto">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-2 text-sm ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    List
                  </button>
                </div>
              </div>
            </div>

            {/* Projects Display */}
            {filteredProjects.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500 text-lg">No projects found</p>
                <p className="text-gray-400 text-sm mt-1">Try changing your filters or create a new project</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
                >
                  Create Project
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProjects.map((project, index) => (
                  <div
                    key={project.id || index}
                    className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                    style={{ borderTop: `4px solid ${project.color || '#3B82F6'}` }}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={selectedProjects.includes(project.id)}
                            onChange={() => toggleSelectProject(project.id)}
                            className="rounded"
                          />
                          <Link href={`/projects/${project.id}`}>
                            <h3 className="font-semibold text-gray-900 hover:text-blue-600 text-sm">{project.name}</h3>
                          </Link>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(project.status)}`}>
                          {project.status || 'active'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{project.description || 'No description'}</p>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{project.task_count || 0} tasks</span>
                        <span>{formatDate(project.created_at)}</span>
                      </div>
                      {project.priority && (
                        <div className="mt-2">
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ backgroundColor: getPriorityColor(project.priority) + '20', color: getPriorityColor(project.priority) }}
                          >
                            {project.priority} priority
                          </span>
                        </div>
                      )}
                      <div className="flex space-x-2 mt-3 pt-3 border-t border-gray-100">
                        <Link
                          href={`/projects/${project.id}`}
                          className="flex-1 text-center text-xs text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-200 rounded"
                        >
                          Open
                        </Link>
                        <button
                          onClick={() => handleDeleteProject(project.id, project.name)}
                          className="flex-1 text-xs text-red-600 hover:text-red-800 px-2 py-1 border border-red-200 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // List view
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProjects(filteredProjects.map(p => p.id))
                            } else {
                              setSelectedProjects([])
                            }
                          }}
                          checked={selectedProjects.length === filteredProjects.length && filteredProjects.length > 0}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tasks</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProjects.map((project, index) => (
                      <tr key={project.id || index} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedProjects.includes(project.id)}
                            onChange={() => toggleSelectProject(project.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: project.color || '#3B82F6' }}
                            />
                            <div>
                              <Link href={`/projects/${project.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                                {project.name}
                              </Link>
                              <p className="text-xs text-gray-500 truncate max-w-[200px]">{project.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(project.status)}`}>
                            {project.status || 'active'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600">{project.priority || '-'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{project.task_count || 0}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500">{formatDate(project.created_at)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex space-x-2">
                            <Link href={`/projects/${project.id}`} className="text-xs text-blue-600 hover:text-blue-800">Open</Link>
                            <button
                              onClick={() => handleDeleteProject(project.id, project.name)}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Stats Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Project Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Projects</span>
                  <span className="font-bold text-gray-900">{stats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Active</span>
                  <span className="font-bold text-green-600">{stats.active}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Completed</span>
                  <span className="font-bold text-blue-600">{stats.completed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">On Hold</span>
                  <span className="font-bold text-yellow-600">{stats.on_hold}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full text-left text-sm text-blue-600 hover:text-blue-800 py-1"
                >
                  + Create new project
                </button>
                <button
                  onClick={() => {
                    setFilterStatus('active')
                    alert('Showing active projects')
                  }}
                  className="w-full text-left text-sm text-gray-600 hover:text-gray-800 py-1"
                >
                  View active projects
                </button>
                <button
                  onClick={() => {
                    setFilterStatus('on_hold')
                    alert('Showing on-hold projects')
                  }}
                  className="w-full text-left text-sm text-gray-600 hover:text-gray-800 py-1"
                >
                  View on-hold projects
                </button>
                <button
                  onClick={() => {
                    const csv = filteredProjects.map(p => `${p.name},${p.status},${p.created_at}`).join('\n')
                    console.log('export csv:', csv)
                    alert('Export feature: CSV would download here')
                  }}
                  className="w-full text-left text-sm text-gray-600 hover:text-gray-800 py-1"
                >
                  Export to CSV
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Completion Rate</h3>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">projects completed</p>
              </div>
              <div className="mt-3 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: stats.total > 0 ? `${(stats.completed / stats.total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowCreateModal(false)}
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
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateProject() }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Awesome Project"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="What is this project about?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-300 cursor-pointer"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
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
