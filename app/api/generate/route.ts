import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const RUNWAY_TEXT_URL = 'https://api.dev.runwayml.com/v1/text_to_video';
const RUNWAY_IMAGE_URL = 'https://api.dev.runwayml.com/v1/image_to_video';

const RATIO_MAP: Record<string, Record<string, string>> = {
  '480p': {
    '9:16': '480:854',
    '16:9': '854:480',
    '1:1': '480:480',
    '3:4': '480:640',
    '4:3': '640:480',
    '21:9': '1120:480',
  },
  '720p': {
    '9:16': '720:1280',
    '16:9': '1280:720',
    '1:1': '720:720',
    '3:4': '720:960',
    '4:3': '960:720',
    '21:9': '1680:720',
  },
  '1080p': {
    '9:16': '1080:1920',
    '16:9': '1920:1080',
    '1:1': '1080:1080',
    '3:4': '1080:1440',
    '4:3': '1440:1080',
    '21:9': '2520:1080',
  },
};

const MODEL_LIMITS: Record<string, { min: number; max: number }> = {
  seedance2_5: { min: 4, max: 30 },
  wan3: { min: 2, max: 30 },
};

function runwayHeaders(secret: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secret}`,
    'X-Runway-Version': '2024-11-06',
  };
}

async function runwayJson(url: string, init: RequestInit, secret: string) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...runwayHeaders(secret),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      (typeof data?.error === 'string' ? data.error : null) ||
      `Runway API error (${res.status})`;
    const detail = data?.issues ? ` — ${JSON.stringify(data.issues)}` : '';
    throw new Error(`${message}${detail}`);
  }

  return data;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      provider = 'runway',
      prompt,
      duration = 5,
      ratio = '9:16',
      resolution = '720p',
      model = 'seedance2_5',
      reference = null,
    } = body;

    if (provider === 'dola') {
      return NextResponse.json(
        { error: 'Dola AI digunakan melalui web di HR-NET AI CINEMA. Salin prompt lalu buka Dola.' },
        { status: 400 },
      );
    }

    if (!process.env.RUNWAYML_API_SECRET) {
      return NextResponse.json(
        { error: 'RUNWAYML_API_SECRET belum diatur di Vercel Environment Variables.' },
        { status: 500 },
      );
    }

    if (!prompt || !String(prompt).trim()) {
      return NextResponse.json({ error: 'Prompt kosong.' }, { status: 400 });
    }

    if (!MODEL_LIMITS[model]) {
      return NextResponse.json(
        { error: 'Model yang tersedia saat ini hanya Seedance 2.5 dan WAN 3.0.' },
        { status: 400 },
      );
    }

    if (resolution === '4K') {
      return NextResponse.json(
        { error: 'Output 4K belum diaktifkan untuk Seedance 2.5/WAN 3.0 pada workflow ini.' },
        { status: 400 },
      );
    }

    if (!RATIO_MAP[resolution]?.[ratio]) {
      return NextResponse.json({ error: 'Kombinasi resolusi dan aspect ratio tidak valid.' }, { status: 400 });
    }

    const requestedDuration = Number(duration);
    const limits = MODEL_LIMITS[model];
    const safeDuration = Math.min(limits.max, Math.max(limits.min, requestedDuration));

    const payload: Record<string, unknown> = {
      model,
      promptText: String(prompt).slice(0, 15000),
      ratio: RATIO_MAP[resolution][ratio],
      duration: safeDuration,
    };

    // Runway exposes separate generation routes. Seedance 2.5 text-only
    // requests must use /text_to_video; image generations use /image_to_video.
    let runwayEndpoint = RUNWAY_TEXT_URL;

    // IMPORTANT:
    // Do not send `resolution` as a separate field here.
    // For these models the selected output tier is encoded in `ratio`.
    // Do not send promptImage at all for text-to-video.
    if (reference) {
      runwayEndpoint = RUNWAY_IMAGE_URL;
      const ref = String(reference);
      if (!ref.startsWith('data:image/')) {
        return NextResponse.json(
          { error: 'Referensi harus berupa data URI gambar.' },
          { status: 400 },
        );
      }
      if (ref.length > 7_000_000) {
        return NextResponse.json(
          { error: 'Referensi gambar terlalu besar. Gunakan gambar di bawah 5 MB.' },
          { status: 400 },
        );
      }

      payload.promptImage = ref;
    }

    const task = await runwayJson(
      runwayEndpoint,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      process.env.RUNWAYML_API_SECRET,
    );

    return NextResponse.json({
      status: 'Generation queued',
      taskId: task?.id,
      model,
      duration: safeDuration,
      ratio,
      resolution,
    });
  } catch (err: any) {
    console.error('Runway generation error:', err);
    return NextResponse.json(
      { error: err?.message || 'Provider video gagal.' },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const secret = process.env.RUNWAYML_API_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'RUNWAYML_API_SECRET belum diatur di Vercel Environment Variables.' },
        { status: 500 },
      );
    }

    const taskId = new URL(req.url).searchParams.get('taskId');
    if (!taskId) {
      return NextResponse.json({ error: 'taskId wajib diisi.' }, { status: 400 });
    }

    const task = await runwayJson(
      `https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(taskId)}`,
      { method: 'GET' },
      secret,
    );

    const status = String(task?.status || '').toLowerCase();

    if (status === 'succeeded' || status === 'completed') {
      const videoUrl =
        task?.output?.[0] ||
        task?.output?.video ||
        task?.output?.url ||
        null;

      return NextResponse.json({
        status: 'Video selesai',
        taskId,
        videoUrl,
      });
    }

    if (status === 'failed' || status === 'cancelled') {
      const message =
        task?.failure ||
        task?.error ||
        'Runway generation gagal.';
      return NextResponse.json(
        { error: typeof message === 'string' ? message : JSON.stringify(message), taskId },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: task?.status || 'RUNNING',
      taskId,
      videoUrl: null,
    });
  } catch (err: any) {
    console.error('Runway task status error:', err);
    return NextResponse.json(
      { error: err?.message || 'Gagal mengambil status task Runway.' },
      { status: 500 },
    );
  }
}
