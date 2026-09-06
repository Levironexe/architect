'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useParams } from 'next/navigation'

// FIXME: hardcoded keys again - will fix when we have time
const supabase = createClient(
  'https://xyzcompanyabc123.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlhYmMxMjMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDE1MzYwMDAwfQ.FAKE_KEY_DO_NOT_USE'
)

// copy of Task from types.ts with a small difference (added assignee_name)
type Task = {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  project_id: string
  assignee_id: string
  assignee_name?: string
  due_date: string
  created_at: string
  updated_at: string
  tags?: string[]
}

type Project = {
  id: string
  name: string
  description: string
  color: string
  owner_id: string
  created_at: string
}

type TeamMember = {
  id: string
  name: string
  email: string
  avatar_url: string
  role: string
}

const COLUMNS = ['todo', 'in_progress', 'review', 'done']
const COLUMN_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done'
}
const COLUMN_COLORS: Record<string, string> = {
  todo: '#6B7280',
  in_progress: '#3B82F6',
  review: '#F59E0B',
  done: '#10B981'
}

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [draggingTask, setDraggingTask] = useState<Task | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [showAddTask, setShowAddTask] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('medium')
  const [newTaskAssignee, setNewTaskAssignee] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPriority, setEditPriority] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editAssignee, setEditAssignee] = useState('')
  const [editDue, setEditDue] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [projectStats, setProjectStats] = useState({
    total: 0,
    todo: 0,
    in_progress: 0,
    review: 0,
    done: 0,
    overdue: 0
  })
  const dragStartRef = useRef<{ taskId: string; fromColumn: string } | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }
      setCurrentUser(user)
      console.log('user in project page:', user.id)
    }
    getUser()
  }, [])

  useEffect(() => {
    if (!projectId) return
    loadProjectData()
  }, [projectId])

  const loadProjectData = async () => {
    setLoading(true)
    try {
      console.log('loading project:', projectId)

      // Load project
      const { data: proj, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (projErr) {
        console.log('project load error:', projErr)
        alert('Could not load project!')
        return
      }
      setProject(proj)
      console.log('project loaded:', proj)

      // Load tasks for this project
      const tasksRes = await fetch(`/api/tasks?project_id=${projectId}`)
      if (!tasksRes.ok) {
        alert('Failed to load tasks for project')
        return
      }
      const tasksData = await tasksRes.json()
      console.log('loaded tasks:', tasksData.length)
      setTasks(tasksData)

      // calculate stats inline
      const stats = {
        total: tasksData.length,
        todo: tasksData.filter((t: Task) => t.status === 'todo').length,
        in_progress: tasksData.filter((t: Task) => t.status === 'in_progress').length,
        review: tasksData.filter((t: Task) => t.status === 'review').length,
        done: tasksData.filter((t: Task) => t.status === 'done').length,
        overdue: tasksData.filter((t: Task) => {
          if (!t.due_date || t.status === 'done') return false
          return new Date(t.due_date) < new Date()
        }).length
      }
      setProjectStats(stats)

      // Load team members
      const { data: members, error: membErr } = await supabase
        .from('project_members')
        .select('*, profiles(*)')
        .eq('project_id', projectId)

      if (!membErr && members) {
        const formatted = members.map((m: any) => ({
          id: m.profiles.id,
          name: m.profiles.name,
          email: m.profiles.email,
          avatar_url: m.profiles.avatar_url,
          role: m.role
        }))
        setTeamMembers(formatted)
        console.log('team members:', formatted.length)
      }

    } catch (err) {
      console.log('error loading project data:', err)
      alert('Something went wrong: ' + err)
    } finally {
      setLoading(false)
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggingTask(task)
    dragStartRef.current = { taskId: task.id, fromColumn: task.status }
    e.dataTransfer.effectAllowed = 'move'
    console.log('drag start:', task.title)
  }

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(column)
  }

  const handleDrop = async (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggingTask) return
    if (draggingTask.status === targetColumn) {
      setDraggingTask(null)
      return
    }

    console.log('dropping task', draggingTask.title, 'into', targetColumn)

    // optimistic update
    const oldStatus = draggingTask.status
    setTasks(prev => prev.map(t =>
      t.id === draggingTask.id ? { ...t, status: targetColumn as Task['status'] } : t
    ))

    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draggingTask.id, status: targetColumn })
      })

      if (!res.ok) {
        // rollback
        alert('Failed to update task status!')
        setTasks(prev => prev.map(t =>
          t.id === draggingTask.id ? { ...t, status: oldStatus } : t
        ))
      } else {
        // update stats
        setProjectStats(prev => ({
          ...prev,
          [oldStatus]: prev[oldStatus as keyof typeof prev] - 1,
          [targetColumn]: prev[targetColumn as keyof typeof prev] + 1
        }))
      }
    } catch (err) {
      alert('Network error moving task: ' + err)
      setTasks(prev => prev.map(t =>
        t.id === draggingTask.id ? { ...t, status: oldStatus } : t
      ))
    }

    setDraggingTask(null)
  }

  const handleDragEnd = () => {
    setDraggingTask(null)
    setDragOverColumn(null)
  }

  const handleAddTask = async (column: string) => {
    if (!newTaskTitle.trim()) {
      alert('Task title is required!')
      return
    }
    setAddingTask(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          status: column,
          priority: newTaskPriority,
          project_id: projectId,
          assignee_id: newTaskAssignee || null,
          due_date: newTaskDue || null,
          description: ''
        })
      })
      if (!res.ok) {
        alert('Failed to create task!')
        return
      }
      const task = await res.json()
      console.log('task created:', task)
      setTasks(prev => [...prev, task])
      setProjectStats(prev => ({
        ...prev,
        total: prev.total + 1,
        [column]: prev[column as keyof typeof prev] + 1
      }))
      setNewTaskTitle('')
      setNewTaskPriority('medium')
      setNewTaskAssignee('')
      setNewTaskDue('')
      setShowAddTask(null)
    } catch (e) {
      alert('Error creating task: ' + e)
    } finally {
      setAddingTask(false)
    }
  }

  const openEditModal = (task: Task) => {
    setEditingTask(task)
    setEditTitle(task.title)
    setEditDesc(task.description)
    setEditPriority(task.priority)
    setEditStatus(task.status)
    setEditAssignee(task.assignee_id || '')
    setEditDue(task.due_date || '')
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editingTask) return
    if (!editTitle.trim()) {
      alert('Task title cannot be empty!')
      return
    }
    setSavingEdit(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTask.id,
          title: editTitle,
          description: editDesc,
          priority: editPriority,
          status: editStatus,
          assignee_id: editAssignee || null,
          due_date: editDue || null
        })
      })
      if (!res.ok) {
        alert('Failed to save task!')
        return
      }
      const updated = await res.json()
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
      setShowEditModal(false)
      setEditingTask(null)
      console.log('task updated:', updated)
    } catch (e) {
      alert('Error saving task: ' + e)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return
    try {
      const res = await fetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' })
      if (!res.ok) {
        alert('Failed to delete task')
        return
      }
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        setProjectStats(prev => ({
          ...prev,
          total: prev.total - 1,
          [task.status]: prev[task.status as keyof typeof prev] - 1
        }))
      }
      setTasks(prev => prev.filter(t => t.id !== taskId))
      console.log('task deleted:', taskId)
    } catch (e) {
      alert('Could not delete: ' + e)
    }
  }

  // Filter tasks inline
  const getFilteredTasksForColumn = (column: string) => {
    return tasks.filter(t => {
      if (t.status !== column) return false
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false
      if (filterAssignee !== 'all' && t.assignee_id !== filterAssignee) return false
      if (searchTerm && !t.title.toLowerCase().includes(searchTerm.toLowerCase())) return false
      return true
    })
  }

  const getPriorityBadgeStyle = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    }
    return colors[priority] || 'bg-gray-100 text-gray-800'
  }

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'done') return false
    return new Date(task.due_date) < new Date()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div style={{ textAlign: 'center' }}>
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">Project not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAV - copy pasted again from dashboard */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">TaskBoard</Link>
              <div className="ml-10 flex space-x-4">
                <Link href="/" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Dashboard</Link>
                <Link href="/tasks/new" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">New Task</Link>
                <Link href="/settings" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Settings</Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
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

      {/* Project Header */}
      <div
        className="border-b bg-white px-8 py-6"
        style={{ borderTop: `4px solid ${project.color || '#3B82F6'}` }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
                <Link href="/" className="hover:text-blue-600">Dashboard</Link>
                <span>/</span>
                <span>{project.name}</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-gray-500 mt-1">{project.description}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex -space-x-2">
                {teamMembers.slice(0, 5).map((m, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium border-2 border-white"
                    title={m.name}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              <Link
                href="/tasks/new"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                + Add Task
              </Link>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex space-x-6 mt-4">
            {COLUMNS.map(col => (
              <div key={col} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLUMN_COLORS[col] }}
                />
                <span className="text-sm text-gray-600">
                  {COLUMN_LABELS[col]}: <span className="font-semibold">{projectStats[col as keyof typeof projectStats]}</span>
                </span>
              </div>
            ))}
            {projectStats.overdue > 0 && (
              <div className="flex items-center space-x-2 text-red-600">
                <span className="text-sm font-semibold">⚠ {projectStats.overdue} overdue</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center space-x-4">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ width: '200px' }}
          />
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none"
          >
            <option value="all">All Assignees</option>
            {teamMembers.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="max-w-full px-4 py-6 overflow-x-auto">
        <div className="flex space-x-4 min-w-max pb-4">
          {COLUMNS.map(column => {
            const columnTasks = getFilteredTasksForColumn(column)
            const isDragOver = dragOverColumn === column

            return (
              <div
                key={column}
                className={`w-72 flex-shrink-0 rounded-xl ${isDragOver ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-gray-100'}`}
                onDragOver={e => handleDragOver(e, column)}
                onDrop={e => handleDrop(e, column)}
              >
                {/* Column Header */}
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLUMN_COLORS[column] }}
                    />
                    <h3 className="font-semibold text-gray-700 text-sm">
                      {COLUMN_LABELS[column]}
                    </h3>
                    <span className="bg-white text-gray-600 text-xs px-1.5 py-0.5 rounded-full font-medium">
                      {columnTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowAddTask(column)
                      setNewTaskTitle('')
                    }}
                    className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                    title="Add task"
                  >
                    +
                  </button>
                </div>

                {/* Tasks */}
                <div className="px-2 pb-2 space-y-2 min-h-[200px]">
                  {columnTasks.map((task, idx) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={e => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${draggingTask?.id === task.id ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-gray-900 flex-1 pr-2">{task.title}</p>
                        <button
                          onClick={() => openEditModal(task)}
                          className="text-gray-400 hover:text-gray-600 text-xs flex-shrink-0"
                        >
                          ✏
                        </button>
                      </div>

                      {task.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityBadgeStyle(task.priority)}`}>
                          {task.priority}
                        </span>
                        {task.due_date && (
                          <span
                            className={`text-xs ${isOverdue(task) ? 'text-red-500 font-semibold' : 'text-gray-400'}`}
                          >
                            {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>

                      {task.assignee_name && (
                        <div className="flex items-center mt-2 space-x-1">
                          <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs">
                            {task.assignee_name.charAt(0)}
                          </div>
                          <span className="text-xs text-gray-500">{task.assignee_name}</span>
                        </div>
                      )}

                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-xs text-red-400 hover:text-red-600 mt-1 block"
                      >
                        delete
                      </button>
                    </div>
                  ))}

                  {/* Add Task Form inline */}
                  {showAddTask === column && (
                    <div className="bg-white rounded-lg p-3 shadow-sm border-2 border-blue-300">
                      <input
                        type="text"
                        placeholder="Task title..."
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddTask(column)
                          if (e.key === 'Escape') setShowAddTask(null)
                        }}
                        autoFocus
                        className="w-full text-sm border-none outline-none mb-2"
                      />
                      <div className="flex items-center space-x-2 mb-2">
                        <select
                          value={newTaskPriority}
                          onChange={e => setNewTaskPriority(e.target.value)}
                          className="text-xs border border-gray-200 rounded px-1 py-0.5 flex-1"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                        <input
                          type="date"
                          value={newTaskDue}
                          onChange={e => setNewTaskDue(e.target.value)}
                          className="text-xs border border-gray-200 rounded px-1 py-0.5 flex-1"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleAddTask(column)}
                          disabled={addingTask}
                          className="flex-1 bg-blue-600 text-white text-xs py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {addingTask ? '...' : 'Add'}
                        </button>
                        <button
                          onClick={() => setShowAddTask(null)}
                          className="flex-1 text-xs py-1 rounded border border-gray-200 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit Task Modal */}
      {showEditModal && editingTask && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-lg"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Edit Task</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                  >
                    {COLUMNS.map(c => (
                      <option key={c} value={c}>{COLUMN_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={editPriority}
                    onChange={e => setEditPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
                  <select
                    value={editAssignee}
                    onChange={e => setEditAssignee(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editDue}
                    onChange={e => setEditDue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
