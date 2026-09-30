import Link from 'next/link'
import styles from '../../auth.module.css'

export default function RegisterSuccessPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.logoMark}>✓</div>

        <div className={styles.heading}>
          <span>REGISTRATION COMPLETE</span>
          <h1>Periksa Email Anda</h1>
          <p>
            Link verifikasi telah dikirim. Buka email Anda dan klik link
            verifikasi untuk mengaktifkan akun member.
          </p>
        </div>

        <Link className={styles.primaryLink} href="/auth/login">
          Kembali ke Login
        </Link>
      </section>
    </main>
  )
}
