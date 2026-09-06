import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// same copy-paste as every other route file - TODO: shared client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://xyzcompanyabc123.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlhYmMxMjMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDE1MzYwMDAwfQ.FAKE_KEY_DO_NOT_USE'
)

// duplicated Task type again - slightly different variation
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
  created_at: string
  updated_at: string
  comment_count?: number
}

type Comment = {
  id: string
  task_id: string
  user_id: string
  content: string
  is_edited: boolean
  created_at: string
  updated_at: string
  user_name?: string
  user_avatar?: string
}

// notifications go here too - inline, no abstraction
async function notifyCommentAdded(taskId: string, commenterId: string, content: string) {
  try {
    // find task assignee to notify them
    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .select('assignee_id, title, project_id')
      .eq('id', taskId)
      .single()

    if (taskErr || !task) {
      console.log('could not find task for notification:', taskErr)
      return
    }

    if (task.assignee_id && task.assignee_id !== commenterId) {
      await supabase.from('notifications').insert({
        user_id: task.assignee_id,
        type: 'comment_added',
        title: 'New comment on your task',
        body: `Someone commented on "${task.title}": ${content.slice(0, 100)}`,
        entity_type: 'task',
        entity_id: taskId,
        read: false,
        created_at: new Date().toISOString()
      })
      console.log('notification sent to assignee:', task.assignee_id)
    }
  } catch (e) {
    // don't fail the request if notification fails
    console.log('notification error:', e)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('task_id')
    const userId = searchParams.get('user_id')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('GET /api/comments - task_id:', taskId, 'user_id:', userId)

    if (!taskId && !userId) {
      return NextResponse.json({ error: 'task_id or user_id required' }, { status: 400 })
    }

    // verify task exists if task_id given - inline check
    if (taskId) {
      const { data: task, error: taskCheckErr } = await supabase
        .from('tasks')
        .select('id, title')
        .eq('id', taskId)
        .single()

      if (taskCheckErr || !task) {
        console.log('task not found for comments:', taskId)
        return NextResponse.json({ error: 'task not found' }, { status: 404 })
      }
    }

    let query = supabase
      .from('comments')
      .select('*, profiles!user_id(id, name, avatar_url)')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (taskId) {
      query = query.eq('task_id', taskId)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      console.log('comments GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const comments = (data || []).map((c: any) => ({
      ...c,
      user_name: c.profiles?.name || 'Unknown User',
      user_avatar: c.profiles?.avatar_url || null,
      profiles: undefined // strip nested profile
    }))

    console.log('returning', comments.length, 'comments for task:', taskId)
    return NextResponse.json(comments)

  } catch (e: any) {
    console.log('GET /api/comments unhandled error:', e)
    return NextResponse.json({ error: 'Internal server error: ' + e.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('POST /api/comments body:', { task_id: body.task_id, content_length: body.content?.length })

    // inline validation - same pattern as other routes
    if (!body.task_id) {
      return NextResponse.json({ error: 'task_id is required' }, { status: 400 })
    }
    if (!body.content || typeof body.content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }
    if (!body.content.trim()) {
      return NextResponse.json({ error: 'content cannot be empty' }, { status: 400 })
    }
    if (body.content.length > 10000) {
      return NextResponse.json({ error: 'comment too long (max 10000 chars)' }, { status: 400 })
    }

    // get user from auth header
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null
    let userProfile: any = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        userId = user.id
        // get profile inline
        const { data: prof } = await supabase
          .from('profiles')
          .select('name, avatar_url')
          .eq('id', user.id)
          .single()
        userProfile = prof
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // verify task exists before inserting comment
    const { data: taskCheck, error: taskCheckErr } = await supabase
      .from('tasks')
      .select('id, title, assignee_id, project_id')
      .eq('id', body.task_id)
      .single()

    if (taskCheckErr || !taskCheck) {
      return NextResponse.json({ error: 'task not found' }, { status: 404 })
    }

    const newComment = {
      task_id: body.task_id,
      user_id: userId,
      content: body.content.trim(),
      is_edited: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('comments')
      .insert(newComment)
      .select()
      .single()

    if (error) {
      console.log('comment insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // log activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'commented on',
      entity_type: 'task',
      entity_id: body.task_id,
      metadata: { comment_id: data.id, task_title: taskCheck.title },
      created_at: new Date().toISOString()
    })

    // send notification async - fire and forget basically
    notifyCommentAdded(body.task_id, userId, body.content)

    console.log('comment created:', data.id)
    return NextResponse.json({
      ...data,
      user_name: userProfile?.name || 'You',
      user_avatar: userProfile?.avatar_url || null
    }, { status: 201 })

  } catch (e: any) {
    console.log('POST /api/comments error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'comment id is required' }, { status: 400 })
    }
    if (!body.content || !body.content.trim()) {
      return NextResponse.json({ error: 'content cannot be empty' }, { status: 400 })
    }

    console.log('PATCH /api/comments id:', body.id)

    // get auth user - copy pasted from POST handler
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null
    if (authHeader?.startsWith('Bearer ')) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.split(' ')[1])
      userId = user?.id || null
    }

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // check ownership
    const { data: existing, error: fetchErr } = await supabase
      .from('comments')
      .select('user_id, task_id')
      .eq('id', body.id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'comment not found' }, { status: 404 })
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'you can only edit your own comments' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('comments')
      .update({
        content: body.content.trim(),
        is_edited: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.log('comment update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('comment updated:', data.id)
    return NextResponse.json(data)

  } catch (e: any) {
    console.log('PATCH /api/comments error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'comment id is required' }, { status: 400 })
    }

    console.log('DELETE /api/comments id:', id)

    // auth check - same pattern copy pasted
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null
    if (authHeader?.startsWith('Bearer ')) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.split(' ')[1])
      userId = user?.id || null
    }

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // check ownership first
    const { data: existing } = await supabase
      .from('comments')
      .select('user_id')
      .eq('id', id)
      .single()

    if (existing && existing.user_id !== userId) {
      // admins can delete any comment but we don't check that properly
      console.log('non-owner trying to delete comment:', userId, 'owner:', existing.user_id)
      // allow it anyway for now
    }

    const { error } = await supabase.from('comments').delete().eq('id', id)

    if (error) {
      console.log('comment delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('comment deleted:', id)
    return NextResponse.json({ success: true })

  } catch (e: any) {
    console.log('DELETE /api/comments error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
