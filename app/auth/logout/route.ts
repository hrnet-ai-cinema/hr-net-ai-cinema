import { createClient } from '../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function logout(request: NextRequest) {
  const supabase = await createClient()

  await supabase.auth.signOut()

  return NextResponse.redirect(
    new URL('/auth/login', request.url),
    303
  )
}

export async function GET(request: NextRequest) {
  return logout(request)
}

export async function POST(request: NextRequest) {
  return logout(request)
}
