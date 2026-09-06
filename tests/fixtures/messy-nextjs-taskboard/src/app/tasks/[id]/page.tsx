'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useParams } from 'next/navigation'

// copy pasted from other pages - TODO: env vars
const supabase = createClient(
  'https://xyzcompanyabc123.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlhYmMxMjMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDE1MzYwMDAwfQ.FAKE_KEY_DO_NOT_USE'
)

// yet another copy of Task - slightly different fields again
type Task = {
  id: string
  title: string
  description: string
  status: string
  priority: string
  project_id: string
  project_name?: string
  assignee_id: string
  assignee_name?: string
  assignee_email?: string
  due_date: string
  estimated_hours?: number
  actual_hours?: number
  tags?: string[]
  created_at: string
  updated_at: string
}

type Comment = {
  id: string
  task_id: string
  user_id: string
  user_name: string
  user_avatar?: string
  content: string
  created_at: string
  updated_at: string
}

type Subtask = {
  id: string
  task_id: string
  title: string
  completed: boolean
  created_at: string
}

type Attachment = {
  id: string
  task_id: string
  file_name: string
  file_size: number
  file_type: string
  url: string
  uploaded_by: string
  uploaded_at: string
}

type ActivityEvent = {
  id: string
  user_id: string
  user_name: string
  action: string
  field?: string
  old_value?: string
  new_value?: string
  created_at: string
}

type TeamMember = {
  id: string
  name: string
  email: string
  avatar_url: string
}

export default function TaskDetailPage() {
  const params = useParams()
  const taskId = params.id as string

  const [task, setTask] = useState<Task | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userName, setUserName] = useState('')

  // comment form
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentText, setEditCommentText] = useState('')

  // subtask form
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [showSubtaskInput, setShowSubtaskInput] = useState(false)

  // task editing
  const [editingStatus, setEditingStatus] = useState(false)
  const [editingAssignee, setEditingAssignee] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPriority, setEditPriority] = useState('')
  const [editDue, setEditDue] = useState('')
  const [editEstimated, setEditEstimated] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [activeTab, setActiveTab] = useState<'comments' | 'subtasks' | 'attachments' | 'activity'>('comments')

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }
      setCurrentUser(user)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (profile) {
        setUserName(profile.name || user.email || 'User')
      }
    }
    fetchUser()
  }, [])

  useEffect(() => {
    if (!taskId) return
    loadTask()
  }, [taskId])

  const loadTask = async () => {
    setLoading(true)
    try {
      console.log('loading task:', taskId)

      // load task details
      const tasksRes = await fetch(`/api/tasks?id=${taskId}`)
      if (!tasksRes.ok) {
        alert('Failed to load task!')
        return
      }
      // we get all tasks and find the one we want - not ideal but it works
      const allTasks = await tasksRes.json()
      const found = Array.isArray(allTasks) ? allTasks.find((t: Task) => t.id === taskId) : allTasks
      if (!found) {
        alert('Task not found!')
        return
      }
      setTask(found)
      setEditTitle(found.title)
      setEditDesc(found.description || '')
      setEditPriority(found.priority)
      setEditDue(found.due_date || '')
      setEditEstimated(String(found.estimated_hours || ''))
      console.log('task loaded:', found.title)

      // load comments from our new endpoint
      const commentsRes = await fetch(`/api/comments?task_id=${taskId}`)
      if (commentsRes.ok) {
        const commentsData = await commentsRes.json()
        setComments(commentsData)
        console.log('comments loaded:', commentsData.length)
      } else {
        console.log('comments load failed, ignoring')
      }

      // load subtasks from supabase directly
      const { data: subtasksData, error: subErr } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

      if (!subErr && subtasksData) {
        setSubtasks(subtasksData)
        console.log('subtasks loaded:', subtasksData.length)
      }

      // load attachments
      const { data: attachData, error: attachErr } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('uploaded_at', { ascending: false })

      if (!attachErr && attachData) {
        setAttachments(attachData)
      }

      // load activity logs
      const { data: actData, error: actErr } = await supabase
        .from('activity_logs')
        .select('*, profiles(name)')
        .eq('entity_id', taskId)
        .eq('entity_type', 'task')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!actErr && actData) {
        const formatted = actData.map((a: any) => ({
          ...a,
          user_name: a.profiles?.name || 'Unknown',
        }))
        setActivity(formatted)
      }

      // load team members for assignee picker
      const { data: members } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .order('name')
        .limit(100)

      if (members) {
        setTeamMembers(members)
      }

    } catch (e) {
      console.log('error loading task:', e)
      alert('Something went wrong: ' + e)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return
    setSavingStatus(true)
    const oldStatus = task.status
    // optimistic update
    setTask(prev => prev ? { ...prev, status: newStatus } : null)
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus })
      })
      if (!res.ok) {
        alert('Failed to update status!')
        setTask(prev => prev ? { ...prev, status: oldStatus } : null)
        return
      }
      const updated = await res.json()
      setTask(updated)
      setEditingStatus(false)
      console.log('status updated to:', newStatus)
    } catch (e) {
      alert('Error updating status: ' + e)
      setTask(prev => prev ? { ...prev, status: oldStatus } : null)
    } finally {
      setSavingStatus(false)
    }
  }

  const handleAssigneeChange = async (newAssigneeId: string) => {
    if (!task) return
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, assignee_id: newAssigneeId || null })
      })
      if (!res.ok) {
        alert('Failed to update assignee!')
        return
      }
      const updated = await res.json()
      const assignee = teamMembers.find(m => m.id === newAssigneeId)
      setTask({ ...updated, assignee_name: assignee?.name || null })
      setEditingAssignee(false)
      console.log('assignee updated')
    } catch (e) {
      alert('Error updating assignee: ' + e)
    }
  }

  const handleSaveEdit = async () => {
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
          id: taskId,
          title: editTitle,
          description: editDesc,
          priority: editPriority,
          due_date: editDue || null,
          estimated_hours: editEstimated ? parseFloat(editEstimated) : null,
        })
      })
      if (!res.ok) {
        alert('Failed to save task!')
        return
      }
      const updated = await res.json()
      setTask(prev => prev ? { ...prev, ...updated } : updated)
      setIsEditing(false)
      console.log('task saved')
    } catch (e) {
      alert('Error saving task: ' + e)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      alert('Comment cannot be empty!')
      return
    }
    setSubmittingComment(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          content: newComment,
        })
      })
      if (!res.ok) {
        alert('Failed to post comment!')
        return
      }
      const comment = await res.json()
      setComments(prev => [...prev, { ...comment, user_name: userName }])
      setNewComment('')
      console.log('comment posted')
    } catch (e) {
      alert('Error posting comment: ' + e)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return
    try {
      const res = await fetch(`/api/comments?id=${commentId}`, { method: 'DELETE' })
      if (!res.ok) {
        alert('Failed to delete comment')
        return
      }
      setComments(prev => prev.filter(c => c.id !== commentId))
      console.log('comment deleted:', commentId)
    } catch (e) {
      alert('Error deleting comment: ' + e)
    }
  }

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) {
      alert('Subtask title is required!')
      return
    }
    setAddingSubtask(true)
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .insert({
          task_id: taskId,
          title: newSubtaskTitle,
          completed: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        alert('Failed to create subtask: ' + error.message)
        return
      }
      setSubtasks(prev => [...prev, data])
      setNewSubtaskTitle('')
      setShowSubtaskInput(false)
      console.log('subtask created:', data.id)
    } catch (e) {
      alert('Error adding subtask: ' + e)
    } finally {
      setAddingSubtask(false)
    }
  }

  const handleToggleSubtask = async (subtask: Subtask) => {
    // optimistic toggle
    setSubtasks(prev => prev.map(s =>
      s.id === subtask.id ? { ...s, completed: !s.completed } : s
    ))
    try {
      const { error } = await supabase
        .from('subtasks')
        .update({ completed: !subtask.completed })
        .eq('id', subtask.id)

      if (error) {
        // rollback
        setSubtasks(prev => prev.map(s =>
          s.id === subtask.id ? { ...s, completed: subtask.completed } : s
        ))
        alert('Failed to update subtask')
      }
    } catch (e) {
      alert('Error: ' + e)
    }
  }

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!confirm('Delete this subtask?')) return
    try {
      const { error } = await supabase.from('subtasks').delete().eq('id', subtaskId)
      if (error) {
        alert('Failed to delete subtask: ' + error.message)
        return
      }
      setSubtasks(prev => prev.filter(s => s.id !== subtaskId))
    } catch (e) {
      alert('Error deleting subtask: ' + e)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'No date'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      todo: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      review: 'bg-yellow-100 text-yellow-800',
      done: 'bg-green-100 text-green-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    }
    return colors[priority] || 'bg-gray-100 text-gray-800'
  }

  const isOverdue = () => {
    if (!task?.due_date || task.status === 'done') return false
    return new Date(task.due_date) < new Date()
  }

  const completedSubtasks = subtasks.filter(s => s.completed).length

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading task...</p>
      </div>
    )
  }

  if (!task) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="text-center">
          <p className="text-red-500 text-lg">Task not found</p>
          <Link href="/" className="text-blue-600 text-sm hover:underline mt-2 block">Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAV - copy pasted from every other page, still not a component */}
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
          <Link href="/" className="hover:text-blue-600">Dashboard</Link>
          <span>/</span>
          {task.project_id && (
            <>
              <Link href={`/projects/${task.project_id}`} className="hover:text-blue-600">{task.project_name || 'Project'}</Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-700">Task Details</span>
        </div>

        <div className="flex gap-6">
          {/* Main Task Content */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow p-6 mb-4">
              {isEditing ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full text-2xl font-bold border-b-2 border-blue-500 focus:outline-none pb-1"
                  />
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={5}
                    placeholder="Task description..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                      <select
                        value={editPriority}
                        onChange={e => setEditPriority(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
                      <input
                        type="date"
                        value={editDue}
                        onChange={e => setEditDue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Estimated Hours</label>
                      <input
                        type="number"
                        value={editEstimated}
                        onChange={e => setEditEstimated(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                        min="0"
                        step="0.5"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingEdit ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <h1 className="text-2xl font-bold text-gray-900 flex-1 pr-4">{task.title}</h1>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-gray-400 hover:text-gray-600 text-sm border border-gray-200 px-3 py-1 rounded"
                    >
                      Edit
                    </button>
                  </div>
                  {task.description ? (
                    <p className="text-gray-600 mt-3 text-sm leading-relaxed">{task.description}</p>
                  ) : (
                    <p className="text-gray-400 mt-3 text-sm italic">No description added yet. Click Edit to add one.</p>
                  )}

                  {task.tags && task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {task.tags.map((tag, i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow">
              <div className="flex border-b border-gray-200 px-4">
                {(['comments', 'subtasks', 'attachments', 'activity'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab}
                    {tab === 'comments' && comments.length > 0 && (
                      <span className="ml-1 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{comments.length}</span>
                    )}
                    {tab === 'subtasks' && subtasks.length > 0 && (
                      <span className="ml-1 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{completedSubtasks}/{subtasks.length}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {/* Comments Tab */}
                {activeTab === 'comments' && (
                  <div className="space-y-4">
                    {comments.length === 0 && (
                      <p className="text-gray-400 text-sm text-center py-4">No comments yet. Be the first!</p>
                    )}
                    {comments.map((comment, index) => (
                      <div key={comment.id || index} className="flex space-x-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                          {comment.user_name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                          {editingCommentId === comment.id ? (
                            <div>
                              <textarea
                                value={editCommentText}
                                onChange={e => setEditCommentText(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none"
                                rows={3}
                              />
                              <div className="flex space-x-2 mt-2">
                                <button
                                  onClick={async () => {
                                    if (!editCommentText.trim()) {
                                      alert('Comment cannot be empty!')
                                      return
                                    }
                                    try {
                                      const res = await fetch('/api/comments', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ id: comment.id, content: editCommentText })
                                      })
                                      if (!res.ok) {
                                        alert('Failed to update comment')
                                        return
                                      }
                                      setComments(prev => prev.map(c =>
                                        c.id === comment.id ? { ...c, content: editCommentText } : c
                                      ))
                                      setEditingCommentId(null)
                                    } catch (e) {
                                      alert('Error: ' + e)
                                    }
                                  }}
                                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingCommentId(null)}
                                  className="text-xs border border-gray-300 px-3 py-1 rounded"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-gray-900">{comment.user_name}</span>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-400">{formatDateTime(comment.created_at)}</span>
                                  {comment.user_id === currentUser?.id && (
                                    <div className="flex space-x-1">
                                      <button
                                        onClick={() => {
                                          setEditingCommentId(comment.id)
                                          setEditCommentText(comment.content)
                                        }}
                                        className="text-xs text-gray-400 hover:text-gray-600"
                                      >
                                        edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="text-xs text-red-400 hover:text-red-600"
                                      >
                                        delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-gray-700">{comment.content}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Add Comment Form */}
                    <div className="flex space-x-3 pt-3 border-t border-gray-100">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                        {userName.charAt(0) || '?'}
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          placeholder="Write a comment..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onKeyDown={e => {
                            if (e.key === 'Enter' && e.metaKey) handleAddComment()
                          }}
                        />
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-gray-400">Cmd+Enter to submit</span>
                          <button
                            onClick={handleAddComment}
                            disabled={submittingComment || !newComment.trim()}
                            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                          >
                            {submittingComment ? 'Posting...' : 'Post Comment'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtasks Tab */}
                {activeTab === 'subtasks' && (
                  <div className="space-y-2">
                    {subtasks.length > 0 && (
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-500">{completedSubtasks} of {subtasks.length} completed</span>
                        <div className="flex-1 mx-4 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-green-500 h-1.5 rounded-full"
                            style={{ width: `${(completedSubtasks / subtasks.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {subtasks.length === 0 && !showSubtaskInput && (
                      <p className="text-gray-400 text-sm text-center py-4">No subtasks yet</p>
                    )}
                    {subtasks.map((subtask, index) => (
                      <div key={subtask.id || index} className="flex items-center space-x-3 py-2 border-b border-gray-100 last:border-0">
                        <input
                          type="checkbox"
                          checked={subtask.completed}
                          onChange={() => handleToggleSubtask(subtask)}
                          className="rounded"
                        />
                        <span className={`flex-1 text-sm ${subtask.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {subtask.title}
                        </span>
                        <button
                          onClick={() => handleDeleteSubtask(subtask.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          x
                        </button>
                      </div>
                    ))}
                    {showSubtaskInput ? (
                      <div className="flex items-center space-x-2 pt-2">
                        <input
                          type="text"
                          value={newSubtaskTitle}
                          onChange={e => setNewSubtaskTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddSubtask()
                            if (e.key === 'Escape') setShowSubtaskInput(false)
                          }}
                          placeholder="Subtask title..."
                          autoFocus
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none"
                        />
                        <button
                          onClick={handleAddSubtask}
                          disabled={addingSubtask}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setShowSubtaskInput(false)}
                          className="text-gray-500 px-2 py-1.5 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowSubtaskInput(true)}
                        className="text-sm text-blue-600 hover:text-blue-800 mt-2"
                      >
                        + Add subtask
                      </button>
                    )}
                  </div>
                )}

                {/* Attachments Tab */}
                {activeTab === 'attachments' && (
                  <div>
                    {attachments.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-400 text-sm">No attachments yet</p>
                        <button
                          onClick={() => alert('File upload not implemented yet - would open file picker')}
                          className="mt-3 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
                        >
                          Upload File
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {attachments.map((att, index) => (
                          <div key={att.id || index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">
                                {att.file_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{att.file_name}</p>
                                <p className="text-xs text-gray-400">
                                  {Math.round((att.file_size || 0) / 1024)}KB · Uploaded {formatDate(att.uploaded_at)}
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800"
                              >
                                Download
                              </a>
                              <button
                                onClick={() => alert('Delete attachment: ' + att.file_name)}
                                className="text-xs text-red-400 hover:text-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => alert('File upload not implemented yet')}
                          className="mt-2 border border-dashed border-gray-300 text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 w-full"
                        >
                          + Upload another file
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Activity Tab */}
                {activeTab === 'activity' && (
                  <div className="space-y-3">
                    {activity.length === 0 && (
                      <p className="text-gray-400 text-sm text-center py-4">No activity recorded yet</p>
                    )}
                    {activity.map((event, index) => (
                      <div key={event.id || index} className="flex space-x-3">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                          {event.user_name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">{event.user_name}</span>{' '}
                            {event.action}
                            {event.field && (
                              <span> the <span className="font-medium">{event.field}</span></span>
                            )}
                            {event.old_value && event.new_value && (
                              <span className="text-gray-500"> from &ldquo;{event.old_value}&rdquo; to &ldquo;{event.new_value}&rdquo;</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(event.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Task Metadata */}
          <div className="w-72 flex-shrink-0 space-y-4">
            {/* Status */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Status</h3>
              {editingStatus ? (
                <div className="space-y-2">
                  {['todo', 'in_progress', 'review', 'done'].map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={savingStatus}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                        task.status === s ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {s === 'todo' ? 'To Do' : s === 'in_progress' ? 'In Progress' : s === 'review' ? 'Review' : 'Done'}
                    </button>
                  ))}
                  <button onClick={() => setEditingStatus(false)} className="text-xs text-gray-400 hover:text-gray-600 w-full text-center">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${getStatusColor(task.status)}`}>
                    {task.status === 'todo' ? 'To Do' : task.status === 'in_progress' ? 'In Progress' : task.status === 'review' ? 'Review' : task.status}
                  </span>
                  <button onClick={() => setEditingStatus(true)} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
                </div>
              )}
            </div>

            {/* Priority */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Priority</h3>
              <span className={`text-sm px-3 py-1 rounded-full font-medium ${getPriorityBadge(task.priority)}`}>
                {task.priority}
              </span>
            </div>

            {/* Assignee */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Assignee</h3>
              {editingAssignee ? (
                <div className="space-y-1">
                  <button
                    onClick={() => handleAssigneeChange('')}
                    className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-500 hover:bg-gray-50"
                  >
                    Unassigned
                  </button>
                  {teamMembers.map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleAssigneeChange(m.id)}
                      className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs">
                        {m.name.charAt(0)}
                      </div>
                      <span>{m.name}</span>
                    </button>
                  ))}
                  <button onClick={() => setEditingAssignee(false)} className="text-xs text-gray-400 w-full text-center mt-1">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  {task.assignee_name ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs">
                        {task.assignee_name.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-700">{task.assignee_name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Unassigned</span>
                  )}
                  <button onClick={() => setEditingAssignee(true)} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="bg-white rounded-xl shadow p-4 space-y-3">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Due Date</h3>
                <p className={`text-sm ${isOverdue() ? 'text-red-500 font-semibold' : 'text-gray-700'}`}>
                  {task.due_date ? formatDate(task.due_date) : 'No due date'}
                  {isOverdue() && <span className="ml-1 text-xs">(Overdue!)</span>}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Created</h3>
                <p className="text-sm text-gray-700">{formatDate(task.created_at)}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Last Updated</h3>
                <p className="text-sm text-gray-700">{formatDate(task.updated_at)}</p>
              </div>
              {task.estimated_hours && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Estimated</h3>
                  <p className="text-sm text-gray-700">{task.estimated_hours}h</p>
                </div>
              )}
            </div>

            {/* Danger */}
            <div className="bg-white rounded-xl shadow p-4">
              <button
                onClick={async () => {
                  if (!confirm('Delete this task permanently?')) return
                  try {
                    const res = await fetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' })
                    if (!res.ok) {
                      alert('Failed to delete task')
                      return
                    }
                    alert('Task deleted!')
                    window.location.href = task.project_id ? `/projects/${task.project_id}` : '/'
                  } catch (e) {
                    alert('Error deleting task: ' + e)
                  }
                }}
                className="w-full text-sm text-red-600 hover:text-red-800 text-left"
              >
                Delete this task
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
