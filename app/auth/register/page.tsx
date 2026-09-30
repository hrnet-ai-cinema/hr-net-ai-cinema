import Link from 'next/link'
import { register } from '../actions'
import styles from '../auth.module.css'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.logoMark}>HR</div>
          <div>
            <div className={styles.brandTitle}>HR-NET AI CINEMA</div>
            <div className={styles.brandSub}>COMMERCIAL BETA</div>
          </div>
        </div>

        <div className={styles.heading}>
          <span>MEMBER</span>
          <h1>Buat Akun Member</h1>
          <p>Daftar untuk menggunakan workspace HR-NET AI CINEMA.</p>
        </div>

        {params.error && (
          <div className={styles.error}>{params.error}</div>
        )}

        <form action={register} className={styles.form}>
          <label>
            Nama
            <input name="name" type="text" placeholder="Nama lengkap" required minLength={2} />
          </label>

          <label>
            Email
            <input name="email" type="email" placeholder="nama@email.com" required />
          </label>

          <label>
            Password
            <input name="password" type="password" placeholder="Minimal 8 karakter" required minLength={8} />
          </label>

          <label>
            Konfirmasi Password
            <input name="confirmPassword" type="password" placeholder="Ulangi password" required minLength={8} />
          </label>

          <button className={styles.primary} type="submit">
            Daftar Member
          </button>
        </form>

        <div className={styles.footer}>
          Sudah punya akun? <Link href="/auth/login">Login Member</Link>
        </div>
      </section>
    </main>
  )
}
