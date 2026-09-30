import Link from 'next/link'
import { login } from '../actions'
import styles from '../auth.module.css'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
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
          <span>MEMBER ACCESS</span>
          <h1>Login Member</h1>
          <p>Masuk ke workspace produksi Anda.</p>
        </div>

        {params.error && (
          <div className={styles.error}>{params.error}</div>
        )}

        <form action={login} className={styles.form}>
          <input type="hidden" name="next" value={params.next || '/'} />

          <label>
            Email
            <input name="email" type="email" placeholder="nama@email.com" required />
          </label>

          <label>
            Password
            <input name="password" type="password" placeholder="Password" required />
          </label>

          <button className={styles.primary} type="submit">
            Masuk ke HR-NET
          </button>
        </form>

        <div className={styles.footer}>
          Belum punya akun? <Link href="/auth/register">Daftar Member</Link>
        </div>
      </section>
    </main>
  )
}
