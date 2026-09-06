'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  'https://xyzcompanyabc123.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnlhYmMxMjMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDE1MzYwMDAwfQ.FAKE_KEY_DO_NOT_USE'
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      alert('Please enter email and password')
      return
    }

    setLoading(true)
    try {
      if (isSignUp) {
        if (!name.trim()) {
          alert('Please enter your name')
          setLoading(false)
          return
        }

        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } }
        })

        if (signUpErr) {
          alert('Sign up failed: ' + signUpErr.message)
          console.log('signup error:', signUpErr)
          return
        }

        // create profile
        if (data.user) {
          const { error: profileErr } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              email,
              name,
              created_at: new Date().toISOString()
            })

          if (profileErr) {
            console.log('profile creation error:', profileErr)
            // continue anyway
          }
        }

        alert('Account created! Please check your email to verify your account.')
        setIsSignUp(false)

      } else {
        const { data, error: loginErr } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (loginErr) {
          alert('Login failed: ' + loginErr.message)
          console.log('login error:', loginErr)
          return
        }

        console.log('logged in:', data.user?.id)
        window.location.href = '/'
      }

    } catch (e) {
      alert('Unexpected error: ' + e)
      console.log('auth error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      alert('Please enter your email address first')
      return
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) {
        alert('Error: ' + error.message)
        return
      }
      alert('Password reset email sent!')
    } catch (e) {
      alert('Error: ' + e)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
    >
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">TaskBoard</h1>
          <p className="text-gray-500 mt-2">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          {!isSignUp && (
            <div className="text-right">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
              }}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
