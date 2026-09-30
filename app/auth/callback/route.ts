import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const requestedNext = searchParams.get('next') || '/'

  const next = requestedNext.startsWith('/') ? requestedNext : '/'

  if (!code) {
    return NextResponse.redirect(
      new URL('/auth/login?error=Link+verifikasi+tidak+valid.', request.url)
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL(
        '/auth/login?error=Link+verifikasi+sudah+kadaluwarsa+atau+tidak+valid.',
        request.url
      )
    )
  }

  return NextResponse.redirect(new URL(next, request.url))
}
