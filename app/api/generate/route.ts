import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerSupabaseClient } from '../../../lib/supabase/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Official BytePlus ModelArk endpoint for Southeast Asia. Override via ARK_BASE_URL if your console specifies another region.
const ARK_BASE_URL = (process.env.ARK_BASE_URL || 'https://ark.ap-southeast.bytepluses.com/api/v3').replace(/\/$/, '');
const ARK_MODEL_ID = process.env.ARK_MODEL_ID || 'dreamina-seedance-2-5-260628';
const MAX_DAILY_LIMIT = 6;

const RUNWAY_TEXT_URL = 'https://api.dev.runwayml.com/v1/text_to_video';
const RUNWAY_IMAGE_URL = 'https://api.dev.runwayml.com/v1/image_to_video';
const RUNWAY_TASKS_URL = 'https://api.dev.runwayml.com/v1/tasks';

const RUNWAY_RATIO_MAP: Record<string, Record<string, string>> = {
  '480p': { '9:16': '480:854', '16:9': '854:480', '1:1': '480:480', '3:4': '480:640', '4:3': '640:480', '21:9': '1120:480' },
  '720p': { '9:16': '720:1280', '16:9': '1280:720', '1:1': '720:720', '3:4': '720:960', '4:3': '960:720', '21:9': '1680:720' },
  '1080p': { '9:16': '1080:1920', '16:9': '1920:1080', '1:1': '1080:1080', '3:4': '1080:1440', '4:3': '1440:1080', '21:9': '2520:1080' },
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { return { error: text || `HTTP ${response.status}` }; }
}

function runwayHeaders(secret: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}`, 'X-Runway-Version': '2024-11-06' };
}

async function runwayJson(url: string, init: RequestInit, secret: string) {
  const response = await fetch(url, {
    ...init,
    headers: { ...runwayHeaders(secret), ...(init.headers || {}) },
    cache: 'no-store',
  });
  const data = await readJsonResponse(response);
  if (!response.ok) {
    const message = data?.error?.message || data?.message || (typeof data?.error === 'string' ? data.error : null) || `Runway API error (${response.status})`;
    throw new Error(String(message));
  }
  return data;
}

function dailyLimit() {
  const raw = Number.parseInt(process.env.SEEDANCE_DAILY_LIMIT || '6', 10);
  return Number.isFinite(raw) ? Math.min(MAX_DAILY_LIMIT, Math.max(1, raw)) : MAX_DAILY_LIMIT;
}

function isAllowedBetaUser(userId: string) {
  const ids = (process.env.SEEDANCE_ALLOWED_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (ids.length) return ids.includes(userId);
  return process.env.SEEDANCE_BETA_ALLOW_ALL_AUTHENTICATED === 'true';
}

function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Konfigurasi server belum lengkap: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus tersedia di Environment Variables.');
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getSeedanceContext() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { error: jsonError('Sesi login tidak ditemukan. Silakan login ulang.', 401) } as const;
    if (!isAllowedBetaUser(user.id)) {
      return { error: jsonError('Akses Seedance masih beta tertutup. Tambahkan UUID akun Anda ke SEEDANCE_ALLOWED_USER_IDS di Vercel Environment Variables.', 403) } as const;
    }
    return { supabase, admin: getAdminSupabase(), user } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Konfigurasi server belum lengkap.';
    return { error: jsonError(message, 503) } as const;
  }
}

async function markSeedanceJobFailed(admin: SupabaseClient, id: string, userId: string, message: string) {
  await admin.from('hrnet_generation_jobs')
    .update({ status: 'failed', error_message: message.slice(0, 1000), updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', userId);
}

type ParsedReference = { kind: 'url'; url: string } | { kind: 'data'; mimeType: string; extension: string; bytes: Buffer };
function parseReference(reference: unknown): { value?: ParsedReference; error?: string } {
  if (!reference || typeof reference !== 'string' || !reference.trim()) return {};
  const value = reference.trim();
  if (/^https:\/\//i.test(value)) return { value: { kind: 'url', url: value } };
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return { error: 'Reference harus berupa gambar PNG/JPEG/WEBP atau URL HTTPS publik.' };
  const mimeType = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 4 * 1024 * 1024) return { error: 'Ukuran reference maksimal 4 MB. Kompres gambar lalu coba lagi.' };
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
  return { value: { kind: 'data', mimeType, extension, bytes } };
}

async function createSeedanceTask(request: NextRequest, body: any) {
  const context = await getSeedanceContext();
  if ('error' in context) return context.error;
  const { supabase, admin, user } = context;
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) return jsonError('ARK_API_KEY belum dipasang di Vercel Environment Variables.', 503);

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return jsonError('Prompt tidak boleh kosong.');
  if (prompt.length > 20000) return jsonError('Prompt terlalu panjang (maksimum 20.000 karakter).');

  const duration = Number(body?.duration ?? 30);
  if (!Number.isInteger(duration) || duration < 4 || duration > 30) return jsonError('Seedance 2.5 menerima durasi 4–30 detik.');
  const allowedRatios = new Set(['9:16', '16:9', '1:1', '3:4', '4:3', '21:9', 'adaptive']);
  const ratio = allowedRatios.has(String(body?.ratio)) ? String(body.ratio) : '9:16';
  const resolution = String(body?.resolution || '1080p').toLowerCase();
  if (!['480p', '720p', '1080p'].includes(resolution)) return jsonError('Pilih resolusi 480p, 720p, atau 1080p.');

  const parsed = parseReference(body?.reference);
  if (parsed.error) return jsonError(parsed.error);

  // Reserve the quota atomically before contacting the paid provider.
  const { data: reservationId, error: reserveError } = await supabase.rpc('reserve_generation_slot', { p_daily_limit: dailyLimit() });
  if (reserveError || !reservationId) {
    const message = reserveError?.message || 'Kuota tidak dapat dipesan.';
    if (/DAILY_QUOTA_EXCEEDED/i.test(message)) return jsonError('Kuota harian habis. Coba lagi setelah ada kuota yang kembali dalam 24 jam.', 429);
    if (/AUTH_REQUIRED/i.test(message)) return jsonError('Sesi login berakhir. Silakan login ulang.', 401);
    return jsonError(`Gagal memeriksa kuota. Jalankan migration SQL terlebih dahulu. Detail: ${message}`, 500);
  }

  try {
    const content: any[] = [{ type: 'text', text: prompt }];
    if (parsed.value?.kind === 'url') {
      content.push({ type: 'image_url', image_url: { url: parsed.value.url }, role: 'reference_image' });
    } else if (parsed.value?.kind === 'data') {
      const bucket = process.env.SEEDANCE_REFERENCE_BUCKET || 'hrnet-seedance-references';
      const path = `${user.id}/${reservationId}/reference-${Date.now()}.${parsed.value.extension}`;
      const { error: uploadError } = await admin.storage.from(bucket).upload(path, parsed.value.bytes, {
        contentType: parsed.value.mimeType, upsert: false,
      });
      if (uploadError) throw new Error(`Gagal mengunggah reference. Buat private bucket "${bucket}" di Supabase Storage. Detail: ${uploadError.message}`);
      const { data: signed, error: signedError } = await admin.storage.from(bucket).createSignedUrl(path, 3600);
      if (signedError || !signed?.signedUrl) throw new Error(`Gagal membuat URL reference: ${signedError?.message || 'signed URL tidak tersedia'}`);
      content.push({ type: 'image_url', image_url: { url: signed.signedUrl }, role: 'reference_image' });
    }

    const response = await fetch(`${ARK_BASE_URL}/contents/generations/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: ARK_MODEL_ID,
        content,
        duration,
        ratio,
        resolution,
        output_format: 'mp4',
        generate_audio: true,
        watermark: false,
      }),
      cache: 'no-store',
    });
    const data = await readJsonResponse(response);
    if (!response.ok) {
      const message = data?.error?.message || data?.message || data?.error || `Seedance menolak permintaan (${response.status}).`;
      await markSeedanceJobFailed(admin, reservationId, user.id, String(message));
      return jsonError(`Seedance API: ${String(message)}`, response.status >= 500 ? 502 : 400);
    }

    const upstreamTaskId = String(data?.id || data?.task_id || '');
    if (!upstreamTaskId) {
      await markSeedanceJobFailed(admin, reservationId, user.id, 'Provider tidak mengembalikan task ID.');
      return jsonError('Seedance tidak mengembalikan task ID.', 502);
    }

    const { error: updateError } = await admin.from('hrnet_generation_jobs').update({
      upstream_task_id: upstreamTaskId,
      status: ['running', 'succeeded'].includes(String(data?.status || '').toLowerCase()) ? String(data.status).toLowerCase() : 'queued',
      model: ARK_MODEL_ID,
      prompt,
      duration,
      ratio,
      resolution,
      updated_at: new Date().toISOString(),
    }).eq('id', reservationId).eq('user_id', user.id);

    if (updateError) {
      await markSeedanceJobFailed(admin, reservationId, user.id, `Task dibuat tetapi gagal disimpan: ${updateError.message}`);
      return jsonError('Task dibuat oleh provider, tetapi gagal disimpan di database. Periksa migration Supabase.', 500);
    }

    return NextResponse.json({ taskId: `seedance:${upstreamTaskId}`, status: data?.status || 'queued' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Koneksi ke Seedance gagal.';
    await markSeedanceJobFailed(admin, reservationId, user.id, message);
    return jsonError(`Generation gagal: ${message}`, 502);
  }
}

async function getSeedanceQuota(request: NextRequest) {
  const context = await getSeedanceContext();
  if ('error' in context) return context.error;
  const { admin, user } = context;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.from('hrnet_generation_jobs')
    .select('id,status,created_at')
    .eq('user_id', user.id).gte('created_at', since)
    .in('status', ['reserved', 'queued', 'running', 'succeeded']);
  if (error) return jsonError(`Gagal membaca kuota: ${error.message}. Jalankan migration SQL terlebih dahulu.`, 500);
  const limit = dailyLimit();
  const used = data?.length || 0;
  return NextResponse.json({ quota: { limit, used, remaining: Math.max(0, limit - used), resets: 'rolling-24h' } }, { headers: { 'Cache-Control': 'no-store' } });
}

async function getSeedanceTask(request: NextRequest, rawTaskId: string, wantDownload: boolean) {
  const context = await getSeedanceContext();
  if ('error' in context) return context.error;
  const { admin, user } = context;
  const upstreamTaskId = rawTaskId.slice('seedance:'.length);
  if (!upstreamTaskId) return jsonError('taskId tidak valid.');

  const { data: job, error: jobError } = await admin.from('hrnet_generation_jobs')
    .select('id,upstream_task_id,status,video_url')
    .eq('user_id', user.id).eq('upstream_task_id', upstreamTaskId).maybeSingle();
  if (jobError) return jsonError(`Gagal membaca task: ${jobError.message}`, 500);
  if (!job) return jsonError('Task tidak ditemukan atau bukan milik akun ini.', 404);

  if (wantDownload) {
    if (!job.video_url) return jsonError('Video belum tersedia. Tunggu sampai generation selesai.', 409);
    const videoResponse = await fetch(job.video_url, { cache: 'no-store' });
    if (!videoResponse.ok || !videoResponse.body) return jsonError('Video sumber tidak bisa diunduh. URL mungkin kedaluwarsa; periksa cloud storage atau buat ulang video.', 502);
    const headers = new Headers({
      'Content-Type': videoResponse.headers.get('content-type') || 'video/mp4',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline; filename="hrnet-seedance.mp4"',
    });
    const length = videoResponse.headers.get('content-length');
    if (length) headers.set('Content-Length', length);
    return new Response(videoResponse.body, { status: 200, headers });
  }

  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) return jsonError('ARK_API_KEY belum dipasang di Vercel Environment Variables.', 503);
  try {
    const response = await fetch(`${ARK_BASE_URL}/contents/generations/tasks/${encodeURIComponent(upstreamTaskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store',
    });
    const data = await readJsonResponse(response);
    if (!response.ok) {
      const message = data?.error?.message || data?.message || `Seedance menolak pemeriksaan status (${response.status}).`;
      return jsonError(`Seedance status: ${String(message)}`, response.status >= 500 ? 502 : response.status);
    }

    const providerStatus = String(data?.status || 'queued').toLowerCase();
    const validStatuses = ['queued', 'running', 'succeeded', 'failed', 'cancelled', 'expired'];
    const status = validStatuses.includes(providerStatus) ? providerStatus : 'running';
    const sourceVideoUrl = data?.content?.video_url || data?.video_url || null;
    const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (sourceVideoUrl) update.video_url = sourceVideoUrl;
    if (['failed', 'cancelled', 'expired'].includes(status)) update.error_message = data?.error?.message || `Task ${status}`;
    await admin.from('hrnet_generation_jobs').update(update).eq('id', job.id).eq('user_id', user.id);

    const videoUrl = status === 'succeeded' && sourceVideoUrl
      ? `/api/generate?taskId=${encodeURIComponent(`seedance:${upstreamTaskId}`)}&download=1`
      : null;
    return NextResponse.json({ taskId: rawTaskId, status, videoUrl, error: update.error_message || data?.error?.message || undefined }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memeriksa status task.';
    return jsonError(`Gagal memeriksa status Seedance: ${message}`, 502);
  }
}

export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); }
  catch { return jsonError('Body JSON tidak valid.'); }

  const provider = String(body?.provider || 'runway');
  if (provider === 'dola') return jsonError('Dola digunakan melalui web. Salin prompt dan buka Dola AI.', 400);
  if (provider === 'seedance') return createSeedanceTask(request, body);
  if (provider !== 'runway') return jsonError('Provider tidak dikenal. Pilih Dola, Runway, atau Seedance 2.5.', 400);

  // Keep the existing Runway provider working while Seedance is added.
  const secret = process.env.RUNWAYML_API_SECRET;
  if (!secret) return jsonError('RUNWAYML_API_SECRET belum diatur di Vercel Environment Variables.', 503);
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return jsonError('Prompt kosong.');
  const model = String(body?.model || 'seedance2_5');
  const modelLimits: Record<string, { min: number; max: number }> = { seedance2_5: { min: 4, max: 30 }, wan3: { min: 2, max: 30 } };
  if (!modelLimits[model]) return jsonError('Model Runway tidak valid.');
  const duration = Number(body?.duration ?? 5);
  if (!Number.isFinite(duration)) return jsonError('Durasi tidak valid.');
  const safeDuration = Math.min(modelLimits[model].max, Math.max(modelLimits[model].min, duration));
  const ratio = String(body?.ratio || '9:16');
  const resolution = String(body?.resolution || '720p');
  if (!RUNWAY_RATIO_MAP[resolution]?.[ratio]) return jsonError('Kombinasi resolusi dan aspect ratio tidak valid.');
  if (resolution === '4K') return jsonError('Output 4K belum diaktifkan pada workflow Runway ini.');

  const payload: Record<string, unknown> = {
    model,
    promptText: prompt.slice(0, 15000),
    ratio: RUNWAY_RATIO_MAP[resolution][ratio],
    duration: safeDuration,
  };
  let endpoint = RUNWAY_TEXT_URL;
  if (body?.reference) {
    const reference = String(body.reference);
    if (!reference.startsWith('data:image/')) return jsonError('Referensi Runway harus berupa data URI gambar.');
    if (reference.length > 7_000_000) return jsonError('Referensi gambar terlalu besar. Gunakan gambar di bawah 5 MB.');
    endpoint = RUNWAY_IMAGE_URL;
    payload.promptImage = reference;
  }
  try {
    const task = await runwayJson(endpoint, { method: 'POST', body: JSON.stringify(payload) }, secret);
    return NextResponse.json({ status: 'Generation queued', taskId: task?.id, model, duration: safeDuration, ratio, resolution }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provider video gagal.';
    console.error('Runway generation error:', message);
    return jsonError(message, 502);
  }
}

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('taskId');
  const wantDownload = request.nextUrl.searchParams.get('download') === '1';
  if (!taskId) return getSeedanceQuota(request);
  if (taskId.startsWith('seedance:')) return getSeedanceTask(request, taskId, wantDownload);

  const secret = process.env.RUNWAYML_API_SECRET;
  if (!secret) return jsonError('RUNWAYML_API_SECRET belum diatur di Vercel Environment Variables.', 503);
  try {
    const task = await runwayJson(`${RUNWAY_TASKS_URL}/${encodeURIComponent(taskId)}`, { method: 'GET' }, secret);
    const status = String(task?.status || '').toLowerCase();
    if (status === 'succeeded' || status === 'completed') {
      const videoUrl = task?.output?.[0] || task?.output?.video || task?.output?.url || null;
      return NextResponse.json({ status: 'Video selesai', taskId, videoUrl }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (status === 'failed' || status === 'cancelled') {
      const message = task?.failure || task?.error || 'Runway generation gagal.';
      return NextResponse.json({ error: typeof message === 'string' ? message : JSON.stringify(message), taskId, status }, { status: 500 });
    }
    return NextResponse.json({ status: task?.status || 'RUNNING', taskId, videoUrl: null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil status task Runway.';
    console.error('Runway task status error:', message);
    return jsonError(message, 502);
  }
}
