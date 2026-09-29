import { NextResponse } from 'next/server';
import RunwayML from '@runwayml/sdk';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, duration = 5, ratio = '9:16', model = 'gen4.5', reference } = body;
    if (!prompt) return NextResponse.json({ error: 'Prompt kosong.' }, { status: 400 });
    if (!process.env.RUNWAYML_API_SECRET) return NextResponse.json({ error: 'RUNWAYML_API_SECRET belum diatur di .env.local.' }, { status: 500 });

    const client = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET });
    const safeDuration = [5, 10, 15, 30].includes(Number(duration)) ? Number(duration) : 5;
    const ratioMap: Record<string,string> = { '9:16':'720:1280', '16:9':'1280:720', '1:1':'960:960' };
    const createInput: any = { model, promptText: prompt, ratio: ratioMap[ratio] || '720:1280', duration: safeDuration };
    if (reference) createInput.promptImage = reference;

    const task = await client.imageToVideo.create(createInput).waitForTaskOutput();
    const output = (task as any).output?.[0];
    return NextResponse.json({ status: 'Video selesai', videoUrl: output || null, taskId: (task as any).id });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message || 'Provider video gagal.' }, { status: 500 });
  }
}
