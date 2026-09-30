'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'

function clean(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function errorMessage(message: string) {
  return encodeURIComponent(message)
}

export async function register(formData: FormData) {
  const name = clean(formData.get('name'))
  const email = clean(formData.get('email')).toLowerCase()
  const password = clean(formData.get('password'))
  const confirmPassword = clean(formData.get('confirmPassword'))

  if (name.length < 2) {
    redirect('/auth/register?error=' + errorMessage('Nama minimal 2 karakter.'))
  }

  if (!email) {
    redirect('/auth/register?error=' + errorMessage('Email wajib diisi.'))
  }

  if (password.length < 8) {
    redirect('/auth/register?error=' + errorMessage('Password minimal 8 karakter.'))
  }

  if (password !== confirmPassword) {
    redirect('/auth/register?error=' + errorMessage('Konfirmasi password tidak sama.'))
  }

  const supabase = await createClient()

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/`,
    },
  })

  if (error) {
    redirect(
      '/auth/register?error=' +
        errorMessage(error.message || 'Pendaftaran gagal.')
    )
  }

  if (data.session) {
    redirect('/')
  }

  redirect('/auth/register/success')
}

export async function login(formData: FormData) {
  const email = clean(formData.get('email')).toLowerCase()
  const password = clean(formData.get('password'))
  const nextValue = clean(formData.get('next'))

  const next = nextValue.startsWith('/') ? nextValue : '/'

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect(
      '/auth/login?error=' +
        errorMessage('Email atau password tidak benar. Pastikan email sudah diverifikasi.') +
        '&next=' +
        encodeURIComponent(next)
    )
  }

  redirect(next)
}
