import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// yes this is the third place we hardcode this
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://xyzcompanyabc123.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlhYmMxMjMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDE1MzYwMDAwfQ.FAKE_KEY_DO_NOT_USE'
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, action } = body

    console.log('POST /api/auth action:', action, 'email:', email)

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
    }

    if (action === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        console.log('signup error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      if (data.user) {
        // create profile
        await supabase.from('profiles').insert({
          id: data.user.id,
          email: data.user.email,
          name: body.name || email.split('@')[0],
          created_at: new Date().toISOString()
        })
        console.log('user signed up:', data.user.id)
      }
      return NextResponse.json({ user: data.user, session: data.session })
    }

    // default = login
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.log('login error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.log('user logged in:', data.user.id)
    return NextResponse.json({ user: data.user, session: data.session })

  } catch (e: any) {
    console.log('auth route error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.log('user signed out')
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Sign out failed' }, { status: 500 })
  }
}
