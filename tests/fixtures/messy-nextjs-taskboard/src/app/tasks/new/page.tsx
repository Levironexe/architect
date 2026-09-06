'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// same hardcoded key, copy pasted
const supabase = createClient(
  'https://xyzcompanyabc123.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlhYmMxMjMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDE1MzYwMDAwfQ.FAKE_KEY_DO_NOT_USE'
)

// Task type again, slightly different from the other files
type Task = {
  id: string
  title: string
  description: string
  status: string
  priority: string
  project_id: string
  assignee_id: string | null
  due_date: string | null
  tags: string[]
  estimated_hours: number | null
  created_at: string
}

type Project = {
  id: string
  name: string
  color: string
}

type Member = {
  id: string
  name: string
  email: string
}

export default function NewTaskPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const [status, setStatus] = useState('todo')
  const [priority, setPriority] = useState('medium')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [tags, setTags] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
      }
    }
    checkAuth()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        console.log('fetching projects for new task form')

        // load projects
        const projRes = await fetch('/api/projects')
        if (!projRes.ok) {
          alert('Could not load projects!')
          return
        }
        const projData = await projRes.json()
        setProjects(projData)
        console.log('projects for form:', projData.length)

        if (projData.length > 0) {
          setProjectId(projData[0].id)
          // load members for first project
          await loadMembersForProject(projData[0].id)
        }
      } catch (e) {
        console.log('error fetching form data:', e)
        alert('Error loading form data: ' + e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const loadMembersForProject = async (pid: string) => {
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select('*, profiles(id, name, email)')
        .eq('project_id', pid)

      if (error) {
        console.log('members load error:', error)
        return
      }

      const formatted = (data || []).map((m: any) => ({
        id: m.profiles.id,
        name: m.profiles.name,
        email: m.profiles.email
      }))
      setMembers(formatted)
      console.log('members loaded:', formatted.length)
    } catch (e) {
      console.log('error loading members:', e)
    }
  }

  const handleProjectChange = async (pid: string) => {
    setProjectId(pid)
    setAssigneeId('')
    await loadMembersForProject(pid)
  }

  const validateForm = () => {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Title is required'
    if (title.trim().length < 3) errs.title = 'Title must be at least 3 characters'
    if (!projectId) errs.project = 'Please select a project'
    if (dueDate) {
      const due = new Date(dueDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (due < today) {
        errs.dueDate = 'Due date cannot be in the past'
      }
    }
    if (estimatedHours && isNaN(Number(estimatedHours))) {
      errs.estimatedHours = 'Must be a number'
    }
    if (estimatedHours && Number(estimatedHours) < 0) {
      errs.estimatedHours = 'Cannot be negative'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      alert('Please fix the form errors before submitting!')
      return
    }

    setSubmitting(true)
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)

      const payload = {
        title: title.trim(),
        description: description.trim(),
        project_id: projectId,
        status,
        priority,
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
        tags: tagList,
        estimated_hours: estimatedHours ? Number(estimatedHours) : null
      }

      console.log('creating task with payload:', payload)

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errData = await res.json()
        alert('Failed to create task: ' + (errData.error || 'Unknown error'))
        return
      }

      const task = await res.json()
      console.log('task created successfully:', task.id)

      // redirect to project board
      router.push(`/projects/${projectId}`)

    } catch (e) {
      console.log('submit error:', e)
      alert('Error creating task: ' + e)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      alert('Add a title before saving draft')
      return
    }
    // just save to localStorage, good enough
    const draft = { title, description, projectId, status, priority, assigneeId, dueDate, tags, estimatedHours }
    localStorage.setItem('task_draft', JSON.stringify(draft))
    alert('Draft saved!')
  }

  const handleLoadDraft = () => {
    const saved = localStorage.getItem('task_draft')
    if (!saved) {
      alert('No draft found')
      return
    }
    const draft = JSON.parse(saved)
    setTitle(draft.title || '')
    setDescription(draft.description || '')
    setProjectId(draft.projectId || '')
    setStatus(draft.status || 'todo')
    setPriority(draft.priority || 'medium')
    setAssigneeId(draft.assigneeId || '')
    setDueDate(draft.dueDate || '')
    setTags(draft.tags || '')
    setEstimatedHours(draft.estimatedHours || '')
    alert('Draft loaded!')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAV - yes copy pasted again */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">TaskBoard</Link>
              <div className="ml-10 flex space-x-4">
                <Link href="/" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Dashboard</Link>
                <Link href="/tasks/new" className="text-gray-900 px-3 py-2 rounded-md text-sm font-medium bg-gray-100">New Task</Link>
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

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Create New Task</h1>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={handleLoadDraft}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Load Draft
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Save Draft
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.title ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="What needs to be done?"
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add more details about this task..."
            />
          </div>

          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project <span className="text-red-500">*</span>
            </label>
            <select
              value={projectId}
              onChange={e => handleProjectChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.project ? 'border-red-400' : 'border-gray-300'}`}
            >
              <option value="">Select a project...</option>
              {projects.map((p, i) => (
                <option key={i} value={p.id}>{p.name}</option>
              ))}
            </select>
            {errors.project && <p className="text-red-500 text-xs mt-1">{errors.project}</p>}
          </div>

          {/* Status and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                style={{ borderColor: priority === 'urgent' ? '#EF4444' : priority === 'high' ? '#F97316' : '#D1D5DB' }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Assignee and Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
              <select
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                disabled={!projectId}
              >
                <option value="">Unassigned</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {!projectId && <p className="text-xs text-gray-400 mt-1">Select a project first</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none ${errors.dueDate ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.dueDate && <p className="text-red-500 text-xs mt-1">{errors.dueDate}</p>}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="bug, frontend, urgent (comma separated)"
            />
            <p className="text-xs text-gray-400 mt-1">Separate tags with commas</p>
          </div>

          {/* Estimated Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Hours</label>
            <input
              type="number"
              value={estimatedHours}
              onChange={e => setEstimatedHours(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none ${errors.estimatedHours ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="4"
              min="0"
              step="0.5"
            />
            {errors.estimatedHours && <p className="text-red-500 text-xs mt-1">{errors.estimatedHours}</p>}
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-3 pt-2">
            <Link
              href="/"
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
