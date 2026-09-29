# HR-NET AI CINEMA — MVP

Web app Next.js untuk membuat scene video AI dengan Character Lock, Vehicle Lock, Location Lock, Position Lock, prompt builder, dan provider Runway.

## Jalankan

1. Install Node.js 18+.
2. Salin `.env.example` menjadi `.env.local`.
3. Isi `RUNWAYML_API_SECRET` dengan API key Runway.
4. Jalankan:

```bash
npm install
npm run dev
```

5. Buka `http://localhost:3000`.

## Catatan provider

MVP menggunakan Runway SDK. API key hanya dibaca server-side dari `.env.local`. Jangan memakai `NEXT_PUBLIC_RUNWAYML_API_SECRET`.

Hasil URL video provider dapat bersifat sementara; versi produksi sebaiknya segera mengunduh hasil ke object storage milik aplikasi.

## Roadmap v2

- Upload dan penyimpanan Character/Vehicle/Location Library ke database + object storage.
- Project dan Scene Timeline.
- Scene chaining otomatis: output scene sebelumnya menjadi reference scene berikutnya.
- Render queue dan progress polling.
- Provider adapter Runway + Luma.
- FFmpeg untuk menggabungkan scene 5/10/15/30 detik.
- Audio, subtitle, voice-over, BGM.
- Login dan project sharing.
