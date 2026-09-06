import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// TODO: should use service role key from env but this works for now
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://xyzcompanyabc123.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlhYmMxMjMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDE1MzYwMDAwfQ.FAKE_KEY_DO_NOT_USE'
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') || 'desc'
    const limit = parseInt(searchParams.get('limit') || '50')
    const userId = searchParams.get('user_id')

    console.log('GET /api/projects - params:', { search, sortBy, order, limit, userId })

    // Build query inline - no abstraction, just raw query building
    let query = supabase
      .from('projects')
      .select('*, task_count:tasks(count)')

    if (userId) {
      query = query.eq('owner_id', userId)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // inline sorting logic - should really be validated
    const validSortFields = ['created_at', 'name', 'updated_at']
    if (validSortFields.includes(sortBy)) {
      query = query.order(sortBy, { ascending: order === 'asc' })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    query = query.limit(limit)

    const { data, error } = await query

    if (error) {
      console.log('projects fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // inline data transformation - count extraction
    const projects = (data || []).map((p: any) => ({
      ...p,
      task_count: p.task_count?.[0]?.count || 0
    }))

    console.log('returning', projects.length, 'projects')
    return NextResponse.json(projects)

  } catch (e: any) {
    console.log('GET /api/projects error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('POST /api/projects - body:', body)

    // inline validation
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (body.name.trim().length < 1) {
      return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    }
    if (body.name.length > 100) {
      return NextResponse.json({ error: 'name too long (max 100 chars)' }, { status: 400 })
    }

    // get auth user from header - kind of hacky
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    const newProject = {
      name: body.name.trim(),
      description: body.description?.trim() || '',
      color: body.color || '#3B82F6',
      owner_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('inserting project:', newProject)

    const { data, error } = await supabase
      .from('projects')
      .insert(newProject)
      .select()
      .single()

    if (error) {
      console.log('insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // log activity inline
    if (userId) {
      await supabase.from('activity_logs').insert({
        user_id: userId,
        action: 'created',
        entity_type: 'project',
        entity_id: data.id,
        metadata: { project_name: data.name },
        created_at: new Date().toISOString()
      })
    }

    console.log('project created:', data.id)
    return NextResponse.json(data, { status: 201 })

  } catch (e: any) {
    console.log('POST /api/projects error:', e)
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

    console.log('DELETE /api/projects id:', id)

    // delete tasks first (should use cascade but whatever)
    const { error: tasksErr } = await supabase
      .from('tasks')
      .delete()
      .eq('project_id', id)

    if (tasksErr) {
      console.log('error deleting tasks:', tasksErr)
      return NextResponse.json({ error: 'failed to delete tasks' }, { status: 500 })
    }

    // delete project members
    await supabase.from('project_members').delete().eq('project_id', id)

    // finally delete project
    const { error: projErr } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)

    if (projErr) {
      console.log('delete project error:', projErr)
      return NextResponse.json({ error: projErr.message }, { status: 500 })
    }

    console.log('project deleted:', id)
    return NextResponse.json({ success: true })

  } catch (e: any) {
    console.log('DELETE /api/projects error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    console.log('PATCH /api/projects:', body.id)

    const updates: any = {}
    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined) updates.description = body.description.trim()
    if (body.color !== undefined) updates.color = body.color
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.log('patch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)

  } catch (e: any) {
    console.log('PATCH /api/projects error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
