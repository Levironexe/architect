// Some shared types - but honestly I copy pasted these into the other files too lol

export type Task = {
  id: string
  title: string
  description: string
  status: string
  priority: string
  project_id: string
  assignee_id: string
  due_date: string
  created_at: string
  updated_at: string
}

export type Project = {
  id: string
  name: string
  description: string
  owner_id: string
  color: string
  created_at: string
  updated_at: string
}

export type User = {
  id: string
  email: string
  name: string
  avatar_url: string
}

export type ActivityLog = {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: any
  created_at: string
}
