'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

// same hardcoded key - will fix later
const supabase = createClient(
  'https://xyzcompanyabc123.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlhYmMxMjMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDE1MzYwMDAwfQ.FAKE_KEY_DO_NOT_USE'
)

// hardcoded for the "export to external tool" feature - TODO: move to env
const password = "admin123"
const API_KEY = "sk-fake-key-12345678"
const EXPORT_WEBHOOK_URL = "https://hooks.external-tool.com/ingest/abc123xyz"
const EXPORT_SECRET = "export-webhook-secret-do-not-commit"

// another copy of Task
type Task = {
  id: string
  title: string
  status: string
  priority: string
  project_id: string
  project_name?: string
  assignee_id: string
  assignee_name?: string
  due_date: string
  estimated_hours?: number
  actual_hours?: number
  created_at: string
  updated_at: string
}

type ProjectHealth = {
  id: string
  name: string
  color: string
  total_tasks: number
  done_tasks: number
  overdue_tasks: number
  health_score: number
}

type TeamProductivity = {
  user_id: string
  user_name: string
  tasks_completed: number
  tasks_in_progress: number
  avg_completion_time: number
  overdue_count: number
}

type WeeklyTrend = {
  week: string
  created: number
  completed: number
  carry_over: number
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userName, setUserName] = useState('')
  const [dateRange, setDateRange] = useState('30d')
  const [activeReport, setActiveReport] = useState<'completion' | 'productivity' | 'health' | 'overdue' | 'time'>('completion')
  const [exporting, setExporting] = useState(false)

  // All fake data - hardcoded directly in component (no service layer)
  const [weeklyTrends] = useState<WeeklyTrend[]>([
    { week: 'Apr 28', created: 14, completed: 9, carry_over: 22 },
    { week: 'May 5', created: 18, completed: 12, carry_over: 28 },
    { week: 'May 12', created: 11, completed: 16, carry_over: 23 },
    { week: 'May 19', created: 22, completed: 14, carry_over: 31 },
    { week: 'May 26', created: 9, completed: 19, carry_over: 21 },
    { week: 'Jun 2', created: 16, completed: 21, carry_over: 16 },
    { week: 'Jun 9', created: 13, completed: 15, carry_over: 14 },
    { week: 'Jun 16', created: 20, completed: 11, carry_over: 23 },
  ])

  const [teamProductivity] = useState<TeamProductivity[]>([
    { user_id: 'u1', user_name: 'Alice Johnson', tasks_completed: 34, tasks_in_progress: 4, avg_completion_time: 2.3, overdue_count: 1 },
    { user_id: 'u2', user_name: 'Bob Smith', tasks_completed: 28, tasks_in_progress: 6, avg_completion_time: 3.1, overdue_count: 3 },
    { user_id: 'u3', user_name: 'Carol White', tasks_completed: 41, tasks_in_progress: 2, avg_completion_time: 1.8, overdue_count: 0 },
    { user_id: 'u4', user_name: 'David Lee', tasks_completed: 19, tasks_in_progress: 8, avg_completion_time: 4.2, overdue_count: 5 },
    { user_id: 'u5', user_name: 'Emma Davis', tasks_completed: 37, tasks_in_progress: 3, avg_completion_time: 2.6, overdue_count: 2 },
  ])

  const [projectHealth] = useState<ProjectHealth[]>([
    { id: 'p1', name: 'Website Redesign', color: '#3B82F6', total_tasks: 45, done_tasks: 38, overdue_tasks: 2, health_score: 87 },
    { id: 'p2', name: 'Mobile App v2', color: '#8B5CF6', total_tasks: 67, done_tasks: 29, overdue_tasks: 8, health_score: 52 },
    { id: 'p3', name: 'API Integration', color: '#10B981', total_tasks: 23, done_tasks: 21, overdue_tasks: 0, health_score: 95 },
    { id: 'p4', name: 'Marketing Campaign', color: '#F59E0B', total_tasks: 31, done_tasks: 11, overdue_tasks: 6, health_score: 41 },
    { id: 'p5', name: 'Data Pipeline', color: '#EF4444', total_tasks: 18, done_tasks: 14, overdue_tasks: 1, health_score: 79 },
  ])

  const [overdueTasks] = useState<Task[]>([
    { id: 't1', title: 'Fix login bug on mobile', status: 'in_progress', priority: 'urgent', project_id: 'p2', project_name: 'Mobile App v2', assignee_id: 'u4', assignee_name: 'David Lee', due_date: '2025-05-10', created_at: '2025-04-28', updated_at: '2025-05-08' },
    { id: 't2', title: 'Update API documentation', status: 'todo', priority: 'medium', project_id: 'p3', project_name: 'API Integration', assignee_id: 'u2', assignee_name: 'Bob Smith', due_date: '2025-05-14', created_at: '2025-05-01', updated_at: '2025-05-12' },
    { id: 't3', title: 'Review campaign analytics', status: 'todo', priority: 'high', project_id: 'p4', project_name: 'Marketing Campaign', assignee_id: 'u4', assignee_name: 'David Lee', due_date: '2025-05-08', created_at: '2025-04-30', updated_at: '2025-05-07' },
    { id: 't4', title: 'Design new landing page', status: 'review', priority: 'high', project_id: 'p1', project_name: 'Website Redesign', assignee_id: 'u2', assignee_name: 'Bob Smith', due_date: '2025-05-15', created_at: '2025-05-03', updated_at: '2025-05-14' },
    { id: 't5', title: 'Set up CI/CD pipeline', status: 'in_progress', priority: 'medium', project_id: 'p5', project_name: 'Data Pipeline', assignee_id: 'u1', assignee_name: 'Alice Johnson', due_date: '2025-05-20', created_at: '2025-05-10', updated_at: '2025-05-18' },
    { id: 't6', title: 'User acceptance testing', status: 'todo', priority: 'urgent', project_id: 'p2', project_name: 'Mobile App v2', assignee_id: 'u3', assignee_name: 'Carol White', due_date: '2025-05-12', created_at: '2025-05-05', updated_at: '2025-05-11' },
    { id: 't7', title: 'Fix payment gateway integration', status: 'in_progress', priority: 'urgent', project_id: 'p4', project_name: 'Marketing Campaign', assignee_id: 'u4', assignee_name: 'David Lee', due_date: '2025-05-09', created_at: '2025-04-25', updated_at: '2025-05-08' },
  ])

  // time tracking fake data
  const timeTrackingData = [
    { project: 'Website Redesign', estimated: 120, actual: 134, variance: 14 },
    { project: 'Mobile App v2', estimated: 200, actual: 167, variance: -33 },
    { project: 'API Integration', estimated: 80, actual: 76, variance: -4 },
    { project: 'Marketing Campaign', estimated: 60, actual: 89, variance: 29 },
    { project: 'Data Pipeline', estimated: 50, actual: 48, variance: -2 },
  ]

  // summary stats - all computed inline from fake data
  const totalTasksCompleted = teamProductivity.reduce((sum, u) => sum + u.tasks_completed, 0)
  const totalOverdue = overdueTasks.length
  const avgHealthScore = Math.round(projectHealth.reduce((sum, p) => sum + p.health_score, 0) / projectHealth.length)
  const avgCompletionRate = Math.round(projectHealth.reduce((sum, p) => sum + (p.done_tasks / p.total_tasks) * 100, 0) / projectHealth.length)

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
      setLoading(false)
    }
    fetchUser()
  }, [])

  const handleExportReport = async (format: 'csv' | 'json' | 'pdf') => {
    setExporting(true)
    try {
      console.log('exporting report as:', format)
      console.log('using API_KEY:', API_KEY)
      console.log('webhook URL:', EXPORT_WEBHOOK_URL)

      // call export endpoint
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'Authorization': `Basic ${btoa(`admin:${password}`)}`
        },
        body: JSON.stringify({
          format,
          date_range: dateRange,
          secret: EXPORT_SECRET,
          report_type: activeReport
        })
      })

      if (!res.ok) {
        alert('Export failed! Server returned error.')
        return
      }

      const data = await res.json()
      console.log('export result:', data)
      alert(`Report exported successfully as ${format.toUpperCase()}!`)

    } catch (e) {
      alert('Export error: ' + e)
    } finally {
      setExporting(false)
    }
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const getPriorityBadge = (priority: string) => {
    const map: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    }
    return map[priority] || 'bg-gray-100 text-gray-800'
  }

  const formatDaysOverdue = (dueDateStr: string) => {
    const dueDate = new Date(dueDateStr)
    const today = new Date()
    const diffTime = today.getTime() - dueDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // inline bar chart renderer - no charting library
  const maxWeeklyValue = Math.max(...weeklyTrends.map(w => Math.max(w.created, w.completed, w.carry_over)))

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading reports...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAV - copy pasted AGAIN, 6th time now */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">TaskBoard</Link>
              <div className="ml-10 flex space-x-4">
                <Link href="/" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Dashboard</Link>
                <Link href="/projects" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Projects</Link>
                <Link href="/tasks/new" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">New Task</Link>
                <Link href="/reports" className="text-gray-900 px-3 py-2 rounded-md text-sm font-medium bg-gray-100">Reports</Link>
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
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">All data is approximate. Some numbers may be made up.</p>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <div className="relative group">
              <button
                onClick={() => handleExportReport('csv')}
                disabled={exporting}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {exporting ? 'Exporting...' : 'Export Report'}
              </button>
            </div>
            <button
              onClick={() => handleExportReport('json')}
              disabled={exporting}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              Export JSON
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-5" style={{ borderLeft: '4px solid #10B981' }}>
            <p className="text-sm text-gray-500">Tasks Completed</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{totalTasksCompleted}</p>
            <p className="text-xs text-green-600 mt-1">+12% from last period</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5" style={{ borderLeft: '4px solid #EF4444' }}>
            <p className="text-sm text-gray-500">Overdue Tasks</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{totalOverdue}</p>
            <p className="text-xs text-red-600 mt-1">-3 from last period</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5" style={{ borderLeft: '4px solid #3B82F6' }}>
            <p className="text-sm text-gray-500">Avg Health Score</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{avgHealthScore}</p>
            <p className="text-xs text-blue-600 mt-1">across {projectHealth.length} projects</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5" style={{ borderLeft: '4px solid #8B5CF6' }}>
            <p className="text-sm text-gray-500">Completion Rate</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{avgCompletionRate}%</p>
            <p className="text-xs text-purple-600 mt-1">+5% from last period</p>
          </div>
        </div>

        {/* Report Tabs */}
        <div className="flex space-x-1 border-b border-gray-200 mb-6 bg-white rounded-t-lg px-4">
          {[
            { key: 'completion', label: 'Completion Trends' },
            { key: 'productivity', label: 'Team Productivity' },
            { key: 'health', label: 'Project Health' },
            { key: 'overdue', label: 'Overdue Tasks' },
            { key: 'time', label: 'Time Tracking' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveReport(tab.key as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeReport === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Completion Trends */}
        {activeReport === 'completion' && (
          <div className="bg-white rounded-b-lg rounded-tr-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Task Completion Trends</h2>
            <p className="text-sm text-gray-500 mb-6">Weekly breakdown of tasks created, completed, and carried over</p>

            {/* Poor man's bar chart - all inline divs */}
            <div className="flex items-end space-x-6 overflow-x-auto pb-4">
              {weeklyTrends.map((week, index) => (
                <div key={index} className="flex-shrink-0 flex flex-col items-center" style={{ minWidth: '80px' }}>
                  <div className="flex items-end space-x-1 mb-2" style={{ height: '120px' }}>
                    <div
                      className="w-4 bg-blue-400 rounded-t"
                      style={{ height: `${(week.created / maxWeeklyValue) * 100}px` }}
                      title={`Created: ${week.created}`}
                    />
                    <div
                      className="w-4 bg-green-400 rounded-t"
                      style={{ height: `${(week.completed / maxWeeklyValue) * 100}px` }}
                      title={`Completed: ${week.completed}`}
                    />
                    <div
                      className="w-4 bg-gray-300 rounded-t"
                      style={{ height: `${(week.carry_over / maxWeeklyValue) * 100}px` }}
                      title={`Carry over: ${week.carry_over}`}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{week.week}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-6 mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-400 rounded" />
                <span className="text-xs text-gray-600">Created</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-400 rounded" />
                <span className="text-xs text-gray-600">Completed</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-300 rounded" />
                <span className="text-xs text-gray-600">Carry Over</span>
              </div>
            </div>

            {/* Summary table */}
            <div className="mt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Week</th>
                    <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Completed</th>
                    <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Carry Over</th>
                    <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {weeklyTrends.map((week, index) => (
                    <tr key={index}>
                      <td className="py-2 text-gray-700">{week.week}</td>
                      <td className="py-2 text-right text-gray-700">{week.created}</td>
                      <td className="py-2 text-right text-green-600 font-medium">{week.completed}</td>
                      <td className="py-2 text-right text-gray-500">{week.carry_over}</td>
                      <td className="py-2 text-right">
                        <span className={week.completed >= week.created ? 'text-green-600' : 'text-red-500'}>
                          {Math.round((week.completed / week.created) * 100)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Team Productivity */}
        {activeReport === 'productivity' && (
          <div className="bg-white rounded-b-lg rounded-tr-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Team Productivity</h2>
            <p className="text-sm text-gray-500 mb-6">Individual performance metrics for the selected period</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase">Team Member</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-gray-500 uppercase">Completed</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-gray-500 uppercase">In Progress</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-gray-500 uppercase">Avg Days</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-gray-500 uppercase">Overdue</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-gray-500 uppercase">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {teamProductivity.map((member, index) => {
                    // compute score inline - no utility function
                    const score = Math.round(
                      (member.tasks_completed * 10) -
                      (member.overdue_count * 5) -
                      (member.avg_completion_time * 2) +
                      ((member.tasks_completed / (member.tasks_completed + member.tasks_in_progress || 1)) * 20)
                    )
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-medium">
                              {member.user_name.charAt(0)}
                            </div>
                            <span className="text-sm font-medium text-gray-900">{member.user_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="text-sm font-semibold text-green-600">{member.tasks_completed}</span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="text-sm text-blue-600">{member.tasks_in_progress}</span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="text-sm text-gray-700">{member.avg_completion_time.toFixed(1)}d</span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={`text-sm ${member.overdue_count > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                            {member.overdue_count}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={`text-sm font-bold ${score >= 300 ? 'text-green-600' : score >= 200 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {score}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-4">Score = (completed × 10) - (overdue × 5) - (avg_days × 2) + completion_rate_bonus</p>
          </div>
        )}

        {/* Project Health */}
        {activeReport === 'health' && (
          <div className="bg-white rounded-b-lg rounded-tr-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Project Health Overview</h2>
            <p className="text-sm text-gray-500 mb-6">Health scores based on completion rate, overdue tasks, and activity</p>
            <div className="space-y-4">
              {projectHealth.map((project, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <Link href={`/projects/${project.id}`} className="font-semibold text-gray-900 hover:text-blue-600">
                        {project.name}
                      </Link>
                    </div>
                    <div className={`text-2xl font-bold ${getHealthColor(project.health_score)}`}>
                      {project.health_score}
                      <span className="text-sm font-normal text-gray-400">/100</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 text-sm text-gray-600 mb-3">
                    <span>{project.total_tasks} total tasks</span>
                    <span className="text-green-600">{project.done_tasks} done</span>
                    {project.overdue_tasks > 0 && (
                      <span className="text-red-500">{project.overdue_tasks} overdue</span>
                    )}
                    <span>{Math.round((project.done_tasks / project.total_tasks) * 100)}% complete</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${project.health_score >= 80 ? 'bg-green-500' : project.health_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${project.health_score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overdue Tasks */}
        {activeReport === 'overdue' && (
          <div className="bg-white rounded-b-lg rounded-tr-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Overdue Tasks</h2>
                <p className="text-sm text-gray-500">{overdueTasks.length} tasks past their due date</p>
              </div>
              <button
                onClick={() => {
                  alert(`Found ${overdueTasks.length} overdue tasks. Sending reminders to assignees...`)
                }}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600"
              >
                Send Reminders
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">Task</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">Project</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">Assignee</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 uppercase">Days Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {overdueTasks.map((task, index) => (
                    <tr key={index} className="hover:bg-red-50">
                      <td className="py-3 px-2">
                        <Link href={`/tasks/${task.id}`} className="text-sm text-blue-600 hover:underline font-medium">
                          {task.title}
                        </Link>
                        <p className="text-xs text-gray-400 mt-0.5">{task.status.replace('_', ' ')}</p>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-sm text-gray-600">{task.project_name}</span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-sm text-gray-700">{task.assignee_name || 'Unassigned'}</span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityBadge(task.priority)}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-sm text-red-500">{new Date(task.due_date).toLocaleDateString()}</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-sm font-bold text-red-600">{formatDaysOverdue(task.due_date)}d</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Time Tracking */}
        {activeReport === 'time' && (
          <div className="bg-white rounded-b-lg rounded-tr-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Time Tracking Summary</h2>
            <p className="text-sm text-gray-500 mb-6">Estimated vs actual hours by project</p>
            <div className="space-y-4">
              {timeTrackingData.map((row, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-900 text-sm">{row.project}</span>
                    <span className={`text-sm font-semibold ${row.variance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {row.variance > 0 ? '+' : ''}{row.variance}h variance
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Estimated</p>
                      <p className="text-lg font-bold text-gray-700">{row.estimated}h</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Actual</p>
                      <p className={`text-lg font-bold ${row.actual > row.estimated ? 'text-red-500' : 'text-green-600'}`}>{row.actual}h</p>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2 relative">
                    <div
                      className="bg-blue-400 h-2 rounded-full"
                      style={{ width: `${Math.min((row.estimated / Math.max(row.estimated, row.actual)) * 100, 100)}%` }}
                    />
                    <div
                      className={`h-2 rounded-full absolute top-0 ${row.actual > row.estimated ? 'bg-red-400' : 'bg-green-400'}`}
                      style={{
                        width: `${Math.min((row.actual / Math.max(row.estimated, row.actual)) * 100, 100)}%`,
                        opacity: 0.6,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Total Summary</p>
              <div className="flex space-x-8 mt-2">
                <div>
                  <p className="text-xs text-gray-500">Total Estimated</p>
                  <p className="text-xl font-bold text-gray-900">{timeTrackingData.reduce((s, r) => s + r.estimated, 0)}h</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Actual</p>
                  <p className="text-xl font-bold text-gray-900">{timeTrackingData.reduce((s, r) => s + r.actual, 0)}h</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Overall Variance</p>
                  <p className={`text-xl font-bold ${timeTrackingData.reduce((s, r) => s + r.variance, 0) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {timeTrackingData.reduce((s, r) => s + r.variance, 0) > 0 ? '+' : ''}{timeTrackingData.reduce((s, r) => s + r.variance, 0)}h
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
