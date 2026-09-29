import { NextResponse } from 'next/server';
import RunwayML from '@runwayml/sdk';

export const runtime = 'nodejs';

const RATIO_MAP: Record<string, Record<string, string>> = {
  '480p': { '9:16': '480:854', '16:9': '854:480', '1:1': '480:480', '3:4': '480:640', '4:3': '640:480', '21:9': '1120:480' },
  '720p': { '9:16': '720:1280', '16:9': '1280:720', '1:1': '720:720', '3:4': '720:960', '4:3': '960:720', '21:9': '1680:720' },
  '1080p': { '9:16': '1080:1920', '16:9': '1920:1080', '1:1': '1080:1080', '3:4': '1080:1440', '4:3': '1440:1080', '21:9': '2520:1080' },
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      provider = 'runway', prompt, duration = 5, ratio = '9:16',
      resolution = '720p', model = 'seedance2_5', reference = null,
    } = body;

    if (provider === 'dola') {
      return NextResponse.json({ error: 'Dola AI digunakan melalui web di HR-NET AI CINEMA. Salin prompt lalu buka Dola.' }, { status: 400 });
    }
    if (!prompt || !String(prompt).trim()) return NextResponse.json({ error: 'Prompt kosong.' }, { status: 400 });
    if (!process.env.RUNWAYML_API_SECRET) return NextResponse.json({ error: 'RUNWAYML_API_SECRET belum diatur di .env.local.' }, { status: 500 });

    const requestedDuration = Number(duration);
    const safeResolution = String(resolution);
    if (!['seedance2_5', 'wan3'].includes(model)) {
      return NextResponse.json({ error: 'Model yang tersedia saat ini hanya Seedance 2.5 dan WAN 3.0.' }, { status: 400 });
    }
    const allowedDurations = [5, 10, 15, 30];
    const safeDuration = allowedDurations.includes(requestedDuration) ? requestedDuration : 5;

    if (safeResolution === '4K') {
      return NextResponse.json({ error: 'Output 4K belum diaktifkan pada provider API. Opsi 4K sudah disiapkan di UI dan akan diaktifkan setelah workflow upscaling/provider 4K ditetapkan.' }, { status: 400 });
    }
    if (!['480p', '720p', '1080p'].includes(safeResolution)) {
      return NextResponse.json({ error: 'Resolusi tidak valid.' }, { status: 400 });
    }

    const client = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET });
    const ratioMap = RATIO_MAP[safeResolution] || RATIO_MAP['720p'];

    const createInput: any = {
      model,
      promptText: String(prompt).slice(0, 10000),
      ratio: ratioMap[ratio] || ratioMap['9:16'],
      duration: safeDuration,
    };

    createInput.resolution = safeResolution;

    if (reference) {
      if (!String(reference).startsWith('data:image/')) {
        return NextResponse.json({ error: 'Referensi harus berupa data URI gambar.' }, { status: 400 });
      }
      if (String(reference).length > 7_000_000) {
        return NextResponse.json({ error: 'Referensi gambar terlalu besar. Gunakan gambar di bawah 5 MB.' }, { status: 400 });
      }
      createInput.promptImage = reference;
    }

    const task = await client.imageToVideo.create(createInput).waitForTaskOutput();
    const output = (task as any).output?.[0] || null;
    return NextResponse.json({ status: 'Video selesai', videoUrl: output, taskId: (task as any).id });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message || 'Provider video gagal.' }, { status: 500 });
  }
}
