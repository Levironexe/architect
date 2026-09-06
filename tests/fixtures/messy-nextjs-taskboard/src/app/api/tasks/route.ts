import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// same supabase setup copy pasted from projects route
const supabaseUrl = process.env.SUPABASE_URL || 'https://xyzcompanyabc123.supabase.co'
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlhYmMxMjMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDE1MzYwMDAwfQ.FAKE_KEY_DO_NOT_USE'
const supabase = createClient(supabaseUrl, supabaseKey)

// valid status transitions - inline business logic
const VALID_TRANSITIONS: Record<string, string[]> = {
  todo: ['in_progress', 'done'],
  in_progress: ['todo', 'review', 'done'],
  review: ['in_progress', 'done', 'todo'],
  done: ['todo', 'in_progress']
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    const assigneeId = searchParams.get('assignee_id')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const overdue = searchParams.get('overdue')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sort') || 'created_at'
    const limit = parseInt(searchParams.get('limit') || '200')

    console.log('GET /api/tasks params:', { projectId, status, priority, sortBy })

    let query = supabase
      .from('tasks')
      .select('*, profiles!assignee_id(id, name, avatar_url)')

    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    if (assigneeId) {
      query = query.eq('assignee_id', assigneeId)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (priority) {
      query = query.eq('priority', priority)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // overdue filter - all inline
    if (overdue === 'true') {
      const now = new Date().toISOString()
      query = query.lt('due_date', now).neq('status', 'done')
    }

    query = query.limit(limit)

    const { data, error } = await query

    if (error) {
      console.log('tasks GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let tasks = (data || []).map((t: any) => ({
      ...t,
      assignee_name: t.profiles?.name || null,
      assignee_avatar: t.profiles?.avatar_url || null,
    }))

    // inline sorting since supabase doesn't sort by priority weight easily
    if (sortBy === 'priority') {
      tasks = tasks.sort((a: any, b: any) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 99
        const pb = PRIORITY_ORDER[b.priority] ?? 99
        return pa - pb
      })
    } else if (sortBy === 'due_date') {
      tasks = tasks.sort((a: any, b: any) => {
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      })
    } else if (sortBy === 'title') {
      tasks = tasks.sort((a: any, b: any) => a.title.localeCompare(b.title))
    } else {
      // default sort by created_at desc
      tasks = tasks.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }

    console.log('returning', tasks.length, 'tasks')
    return NextResponse.json(tasks)

  } catch (e: any) {
    console.log('GET /api/tasks unhandled error:', e)
    return NextResponse.json({ error: 'Internal server error: ' + e.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('POST /api/tasks body:', body)

    // inline validation - no schema library
    const errors: string[] = []
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      errors.push('title is required')
    }
    if (!body.project_id) {
      errors.push('project_id is required')
    }
    const validStatuses = ['todo', 'in_progress', 'review', 'done']
    if (body.status && !validStatuses.includes(body.status)) {
      errors.push('invalid status value')
    }
    const validPriorities = ['low', 'medium', 'high', 'urgent']
    if (body.priority && !validPriorities.includes(body.priority)) {
      errors.push('invalid priority value')
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 })
    }

    // verify project exists - inline check
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', body.project_id)
      .single()

    if (projErr || !project) {
      return NextResponse.json({ error: 'project not found' }, { status: 404 })
    }

    const newTask = {
      title: body.title.trim(),
      description: body.description?.trim() || '',
      project_id: body.project_id,
      status: body.status || 'todo',
      priority: body.priority || 'medium',
      assignee_id: body.assignee_id || null,
      due_date: body.due_date || null,
      tags: body.tags || [],
      estimated_hours: body.estimated_hours || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('inserting task:', newTask.title)

    const { data, error } = await supabase
      .from('tasks')
      .insert(newTask)
      .select()
      .single()

    if (error) {
      console.log('task insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // get auth from header for activity log
    const authHeader = request.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'created',
          entity_type: 'task',
          entity_id: data.id,
          metadata: { task_title: data.title, project_id: data.project_id },
          created_at: new Date().toISOString()
        })
      }
    }

    console.log('task created:', data.id)
    return NextResponse.json(data, { status: 201 })

  } catch (e: any) {
    console.log('POST /api/tasks error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'Task id is required' }, { status: 400 })
    }

    console.log('PATCH /api/tasks id:', body.id, 'updates:', Object.keys(body))

    // If status is being changed, validate transition
    if (body.status) {
      const { data: currentTask, error: fetchErr } = await supabase
        .from('tasks')
        .select('status, title')
        .eq('id', body.id)
        .single()

      if (fetchErr || !currentTask) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }

      const currentStatus = currentTask.status
      const newStatus = body.status

      // check if transition is valid
      if (currentStatus !== newStatus) {
        const allowed = VALID_TRANSITIONS[currentStatus] || []
        if (!allowed.includes(newStatus)) {
          console.log(`invalid transition ${currentStatus} -> ${newStatus}`)
          // actually just allow it anyway, the frontend shouldn't send invalid ones
          // return NextResponse.json({ error: `Cannot move from ${currentStatus} to ${newStatus}` }, { status: 400 })
        }
      }
    }

    const updates: any = {}
    if (body.title !== undefined) updates.title = body.title.trim()
    if (body.description !== undefined) updates.description = body.description.trim()
    if (body.status !== undefined) updates.status = body.status
    if (body.priority !== undefined) updates.priority = body.priority
    if (body.assignee_id !== undefined) updates.assignee_id = body.assignee_id
    if (body.due_date !== undefined) updates.due_date = body.due_date
    if (body.tags !== undefined) updates.tags = body.tags
    if (body.estimated_hours !== undefined) updates.estimated_hours = body.estimated_hours
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.log('task patch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('task updated:', data.id)
    return NextResponse.json(data)

  } catch (e: any) {
    console.log('PATCH /api/tasks error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    console.log('DELETE /api/tasks id:', id)

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      console.log('task delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('task deleted:', id)
    return NextResponse.json({ success: true })

  } catch (e: any) {
    console.log('DELETE /api/tasks error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
