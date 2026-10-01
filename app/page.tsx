'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient as createSupabaseClient } from '../lib/supabase/client';

declare global {
  interface Window {
    FFmpeg?: {
      createFFmpeg: (options: { log?: boolean; corePath?: string }) => any;
      fetchFile: (file: File | Blob | string) => Promise<Uint8Array>;
    };
  }
}

type Asset = { id: string; name: string; description: string; reference?: string; referenceName?: string; identityLock?: boolean; visualDetails?: string };
type SceneItem = { id: string; title: string; prompt: string; type: 'video' | 'image'; createdAt: string; characterNames?: string[]; vehicleName?: string; locationName?: string; positionNotes?: string; references?: string[]; referenceNames?: string[]; locks?: { character: boolean; vehicle: boolean; location: boolean; position: boolean } };
type ProjectSummary = { id: string; name: string; notes: string; createdAt: string; updatedAt: string };
type MergeClip = { id: string; file: File; name: string; url: string; durationLabel?: string; sourceScene?: number };
type DolaCloudScene = { name: string; path: string; size: number; updatedAt?: string; signedUrl?: string; sceneNumber?: number };

type LongVideoSegment = {
  index: number;
  total: number;
  duration: number;
  title: string;
  prompt: string;
  status: 'pending' | 'copied' | 'completed';
  videoUrl?: string;
  cloudPath?: string;
  cloudUrl?: string;
  cloudStatus?: 'pending' | 'uploading' | 'uploaded' | 'failed';
};

type HistoryItem = {
  id: string;
  title: string;
  prompt: string;
  model: string;
  duration: number;
  ratio: string;
  resolution: string;
  createdAt: string;
  status: 'completed' | 'failed';
  videoUrl?: string | null;
  videoPath?: string | null;
  estimatedCredits: number;
};

const emptyAssets: Asset[] = [];
const emptyScenes: SceneItem[] = [];
const MODEL_INFO: Record<string, { label: string; desc: string; min: number; max: number }> = {
  seedance2_5: { label: 'Seedance 2.5', desc: 'Reference-driven • 4–30 detik', min: 4, max: 30 },
  wan3: { label: 'WAN 3.0', desc: 'Reference-driven • 2–30 detik', min: 2, max: 30 },
};

const STORAGE_KEY = 'hrnet-ai-cinema-v5';

export default function Home() {
  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [userId, setUserId] = useState('');
  const [cloudSyncMessage, setCloudSyncMessage] = useState('');
  const [videoCloudMessage, setVideoCloudMessage] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState('');
  const [projectManagerMessage, setProjectManagerMessage] = useState('');

  const supabase = useMemo(() => createSupabaseClient(), []);


  useEffect(() => {
    let active = true;

    const loadMember = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user) return;

      setMemberEmail(user.email ?? '');
      setUserId(user.id);

      const fullName =
        typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name
          : '';

      setMemberName(fullName);
    };

    loadMember();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;

      if (!user) {
        setMemberEmail('');
        setMemberName('');
        setUserId('');
        return;
      }

      setMemberEmail(user.email ?? '');
      setUserId(user.id);

      const fullName =
        typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name
          : '';

      setMemberName(fullName);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);
  const [page, setPage] = useState('Dashboard');
  const [characters, setCharacters] = useState<Asset[]>(emptyAssets);
  const [vehicles, setVehicles] = useState<Asset[]>(emptyAssets);
  const [locations, setLocations] = useState<Asset[]>(emptyAssets);
  const [scenes, setScenes] = useState<SceneItem[]>(emptyScenes);
  const [assetName, setAssetName] = useState('');
  const [assetDescription, setAssetDescription] = useState('');
  const [characterReference, setCharacterReference] = useState('');
  const [characterReferenceName, setCharacterReferenceName] = useState('');
  const [characterVisualDetails, setCharacterVisualDetails] = useState('');
  const [characterIdentityLock, setCharacterIdentityLock] = useState(true);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [vehicleReference, setVehicleReference] = useState('');
  const [vehicleReferenceName, setVehicleReferenceName] = useState('');
  const [vehicleVisualDetails, setVehicleVisualDetails] = useState('');
  const [vehicleLockEnabled, setVehicleLockEnabled] = useState(true);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageRatio, setImageRatio] = useState('3:4');
  const [imageResolution, setImageResolution] = useState('1080p');
  const [imageStyle, setImageStyle] = useState('Cinematic Realistic');
  const [imageReference, setImageReference] = useState('');
  const [imageReferenceName, setImageReferenceName] = useState('');
  const [imageGeneratedPrompt, setImageGeneratedPrompt] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [showGuide, setShowGuide] = useState(true);
  const [guideStep, setGuideStep] = useState(1);
  const [projectName, setProjectName] = useState('New Project');
  const [projectNotes, setProjectNotes] = useState('');
  const [sceneTitle, setSceneTitle] = useState('');
  const [action, setAction] = useState('');
  const [duration, setDuration] = useState(5);
  const [ratio, setRatio] = useState('9:16');
  const [resolution, setResolution] = useState('720p');
  const [provider, setProvider] = useState('dola');
  const [model, setModel] = useState('seedance2_5');
  const [characterLock, setCharacterLock] = useState(true);
  const [vehicleLock, setVehicleLock] = useState(true);
  const [locationLock, setLocationLock] = useState(true);
  const [positionLock, setPositionLock] = useState(true);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locationReference, setLocationReference] = useState('');
  const [locationReferenceName, setLocationReferenceName] = useState('');
  const [locationEnvironment, setLocationEnvironment] = useState('');
  const [locationTime, setLocationTime] = useState('');
  const [locationWeather, setLocationWeather] = useState('');
  const [locationElements, setLocationElements] = useState('');
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [references, setReferences] = useState<string[]>(Array(6).fill(''));
  const [referenceNames, setReferenceNames] = useState<string[]>(Array(6).fill(''));
  const [referenceSlots, setReferenceSlots] = useState(6);
  const [audioReference, setAudioReference] = useState<string | null>(null);
  const [audioReferenceName, setAudioReferenceName] = useState('');
  const [videoReference, setVideoReference] = useState<string | null>(null);
  const [videoReferenceName, setVideoReferenceName] = useState('');
  const [status, setStatus] = useState('Siap membuat scene');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showCopyBox, setShowCopyBox] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showPlanDetails, setShowPlanDetails] = useState(false);
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [sceneBuilderTitle, setSceneBuilderTitle] = useState('');
  const [sceneBuilderAction, setSceneBuilderAction] = useState('');
  const [sceneBuilderCharacters, setSceneBuilderCharacters] = useState<string[]>([]);
  const [sceneBuilderVehicle, setSceneBuilderVehicle] = useState('');
  const [sceneBuilderLocation, setSceneBuilderLocation] = useState('');
  const [sceneBuilderPosition, setSceneBuilderPosition] = useState('');
  const [longVideoPlan, setLongVideoPlan] = useState<LongVideoSegment[]>([]);
  const [longVideoQueueIndex, setLongVideoQueueIndex] = useState(0);
  const [mergeClips, setMergeClips] = useState<MergeClip[]>([]);
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [mergeMessage, setMergeMessage] = useState('');
  const [dolaCloudScenes, setDolaCloudScenes] = useState<DolaCloudScene[]>([]);
  const [isLoadingDolaCloud, setIsLoadingDolaCloud] = useState(false);
  const [dolaCloudMessage, setDolaCloudMessage] = useState('');

  const modelInfo = MODEL_INFO[model];
  const referenceCount = references.filter(Boolean).length;
  const estimatedCredits = 0;
  const now = Date.now();
  const recentHistory = history.filter(item => {
    const t = new Date(item.createdAt).getTime();
    return Number.isFinite(t) && now - t <= 24 * 60 * 60 * 1000;
  });
  // A generation slot is consumed only by a successfully completed video.
  // Failed/cancelled generations remain in History for diagnostics but are refunded.
  const usedSlots24h = Math.min(
    12,
    recentHistory.filter(item => {
      const normalizedStatus = String(item.status || '').trim().toLowerCase();
      return ['completed', 'done', 'success', 'succeeded'].includes(normalizedStatus);
    }).length
  );
  const availableSlots = Math.max(0, 12 - usedSlots24h);
  const completedCount = history.filter(item => item.status === 'completed').length;
  const failedCount = history.filter(item => item.status === 'failed').length;
  const seedanceCount = history.filter(item => item.model === 'seedance2_5').length;
  const wanCount = history.filter(item => item.model === 'wan3').length;
  const lastGeneration = history[0] || null;

  const prompt = useMemo(() => {
    const lock = [
      characterLock ? 'CHARACTER LOCK: pertahankan identitas, wajah, rambut, pakaian dan ciri karakter dari referensi.' : '',
      vehicleLock ? 'VEHICLE LOCK: pertahankan model, bentuk, warna, grafis dan posisi kendaraan.' : '',
      locationLock ? 'LOCATION LOCK: pertahankan tata letak dan elemen lokasi dari referensi.' : '',
      positionLock ? 'POSITION LOCK: pertahankan posisi relatif setiap anggota tim dan muatan.' : ''
    ].filter(Boolean).join(' ');
    return [
      sceneTitle,
      action,
      selectedLocation && `Lokasi: ${selectedLocation}.`,
      selectedVehicle && `Kendaraan: ${selectedVehicle}.`,
      selectedCharacters.length ? `Karakter: ${selectedCharacters.join(', ')}.` : '',
      audioReferenceName ? `AUDIO REFERENCE: gunakan ${audioReferenceName} sebagai acuan ritme, ambience, dialog, atau timing audio bila provider mendukung.` : '',
      videoReferenceName ? `VIDEO REFERENCE: gunakan ${videoReferenceName} sebagai acuan gerakan, framing, kamera, blocking, dan timing bila provider mendukung.` : '',
      lock,
      'Gaya cinematic realistis, gerakan natural, kamera stabil, pencahayaan sinematik, detail tinggi, tanpa teleportasi, tanpa redesign karakter/kendaraan, seamless continuity.'
    ].filter(Boolean).join(' ');
  }, [sceneTitle, action, selectedLocation, selectedVehicle, selectedCharacters, characterLock, vehicleLock, locationLock, positionLock]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.projectName) setProjectName(saved.projectName);
        if (typeof saved.projectNotes === 'string') setProjectNotes(saved.projectNotes);
        if (Array.isArray(saved.history)) setHistory(saved.history.slice(0, 20));
        if (Array.isArray(saved.characters)) setCharacters(saved.characters);
        if (Array.isArray(saved.vehicles)) setVehicles(saved.vehicles);
        if (Array.isArray(saved.locations)) setLocations(saved.locations);
        if (Array.isArray(saved.scenes)) setScenes(saved.scenes.slice(0, 50));
        if (Array.isArray(saved.longVideoPlan)) setLongVideoPlan(saved.longVideoPlan);
        if (saved.showGuide === false) setShowGuide(false);
      }
    } catch {}
    setWorkspaceHydrated(true);
  }, []);

  useEffect(() => {
    if (!workspaceHydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          projectName,
          projectNotes,
          history,
          characters,
          vehicles,
          locations,
          scenes,
          longVideoPlan,
          showGuide,
        })
      );
    } catch {}
  }, [workspaceHydrated, projectName, projectNotes, history, characters, vehicles, locations, scenes, longVideoPlan, showGuide]);

  useEffect(() => {
    setGeneratedPrompt('');
    setLongVideoPlan([]);
  }, [prompt]);

  useEffect(() => {
  }, [model, duration, resolution]);

  function exportWorkspace() {
    const payload = {
      format: 'HR-NET-AI-CINEMA-WORKSPACE',
      version: 7,
      exportedAt: new Date().toISOString(),
      projectName,
      projectNotes,
      characters,
      vehicles,
      locations,
      scenes,
      history,
      showGuide,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'hrnet-project'}.hrnet.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setSettingsMessage('Workspace berhasil diekspor ke file HR-NET.');
  }

  function importWorkspace(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const saved = JSON.parse(String(reader.result || '{}'));
        if (saved.format !== 'HR-NET-AI-CINEMA-WORKSPACE') throw new Error('Format file bukan workspace HR-NET.');
        if (typeof saved.projectName === 'string') setProjectName(saved.projectName);
        if (typeof saved.projectNotes === 'string') setProjectNotes(saved.projectNotes);
        if (Array.isArray(saved.characters)) setCharacters(saved.characters);
        if (Array.isArray(saved.vehicles)) setVehicles(saved.vehicles);
        if (Array.isArray(saved.locations)) setLocations(saved.locations);
        if (Array.isArray(saved.scenes)) setScenes(saved.scenes.slice(0, 50));
        if (Array.isArray(saved.history)) setHistory(saved.history.slice(0, 20));
        if (typeof saved.showGuide === 'boolean') setShowGuide(saved.showGuide);
        setError('');
        setSettingsMessage('Workspace berhasil diimpor.');
        setStatus('Workspace HR-NET dimuat dari file.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'File workspace tidak dapat dibaca.');
      }
    };
    reader.readAsText(file);
  }

  function getWorkspacePayload() {
    return {
      projectName,
      projectNotes,
      characters,
      vehicles,
      locations,
      scenes,
      history,
      showGuide,
      exportedAt: new Date().toISOString(),
    };
  }

  function applyWorkspacePayload(saved: Partial<{
    projectName: string;
    projectNotes: string;
    characters: Asset[];
    vehicles: Asset[];
    locations: Asset[];
    scenes: SceneItem[];
    history: HistoryItem[];
    showGuide: boolean;
  }>) {
    if (typeof saved.projectName === 'string') setProjectName(saved.projectName);
    if (typeof saved.projectNotes === 'string') setProjectNotes(saved.projectNotes);
    if (Array.isArray(saved.characters)) setCharacters(saved.characters);
    if (Array.isArray(saved.vehicles)) setVehicles(saved.vehicles);
    if (Array.isArray(saved.locations)) setLocations(saved.locations);
    if (Array.isArray(saved.scenes)) setScenes(saved.scenes.slice(0, 50));
    if (Array.isArray(saved.history)) setHistory(saved.history.slice(0, 20));
    if (typeof saved.showGuide === 'boolean') setShowGuide(saved.showGuide);
  }

  async function refreshCloudProjects() {
    if (!userId) return;
    const { data, error: projectError } = await supabase
      .from('projects')
      .select('id, project_name, project_notes, created_at, updated_at')
      .order('updated_at', { ascending: false });
    if (projectError) {
      setProjectManagerMessage(`Gagal memuat daftar project: ${projectError.message}`);
      return;
    }
    setProjects((data || []).map((row: { id: string; project_name: string; project_notes: string | null; created_at: string; updated_at: string }) => ({
      id: row.id,
      name: row.project_name,
      notes: row.project_notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })));
  }

  useEffect(() => {
    if (userId) void refreshCloudProjects();
    else {
      setProjects([]);
      setActiveProjectId('');
    }
  }, [userId]);

  async function createCloudProject() {
    if (!userId) {
      setProjectManagerMessage('Login diperlukan untuk membuat project cloud.');
      clearWorkspace();
      setProjectName('New Project');
      setProjectNotes('');
      setPage('Generate Video');
      return;
    }
    const nextName = `New Project ${projects.length + 1}`;
    const emptyPayload = {
      projectName: nextName,
      projectNotes: '',
      characters: [],
      vehicles: [],
      locations: [],
      scenes: [],
      history: [],
      showGuide: true,
      exportedAt: new Date().toISOString(),
    };
    const { data, error: createError } = await supabase
      .from('projects')
      .insert({ user_id: userId, project_name: nextName, project_notes: '', payload: emptyPayload })
      .select('id, project_name, project_notes, created_at, updated_at')
      .single();
    if (createError || !data) {
      setProjectManagerMessage(`Gagal membuat project: ${createError?.message || 'Tidak ada data.'}`);
      return;
    }
    clearWorkspace();
    applyWorkspacePayload(emptyPayload);
    setActiveProjectId(data.id);
    setProjectManagerMessage(`✓ Project “${data.project_name}” dibuat.`);
    setStatus('Project baru siap digunakan.');
    await refreshCloudProjects();
    setPage('Generate Video');
  }

  async function openCloudProject(projectId: string) {
    if (!userId) return;
    setProjectManagerMessage('Memuat project...');
    const { data, error: openError } = await supabase
      .from('projects')
      .select('id, project_name, project_notes, payload')
      .eq('id', projectId)
      .single();
    if (openError || !data) {
      setProjectManagerMessage(`Gagal membuka project: ${openError?.message || 'Project tidak ditemukan.'}`);
      return;
    }
    applyWorkspacePayload(data.payload || { projectName: data.project_name, projectNotes: data.project_notes || '' });
    setProjectName(data.project_name);
    setProjectNotes(data.project_notes || '');
    setActiveProjectId(data.id);
    setProjectManagerMessage(`✓ Project “${data.project_name}” aktif.`);
    setStatus(`Project ${data.project_name} dimuat.`);
  }

  async function saveGenerationHistoryToCloud(updatedHistory: HistoryItem[]) {
    if (!userId) return false;
    const payload = {
      ...getWorkspacePayload(),
      history: updatedHistory.slice(0, 20),
      exportedAt: new Date().toISOString(),
    };

    if (activeProjectId) {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ payload, updated_at: new Date().toISOString() })
        .eq('id', activeProjectId)
        .eq('user_id', userId);
      if (updateError) {
        setVideoCloudMessage(`Video tersimpan, tetapi metadata project gagal diperbarui: ${updateError.message}`);
        return false;
      }
    } else {
      const { error: saveError } = await supabase.from('workspaces').upsert({
        user_id: userId,
        project_name: projectName,
        payload,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (saveError) {
        setVideoCloudMessage(`Video tersimpan, tetapi metadata workspace gagal diperbarui: ${saveError.message}`);
        return false;
      }
    }
    return true;
  }

  async function saveVideoToCloud(videoSourceUrl: string, generationId: string) {
    if (!userId) throw new Error('Login diperlukan untuk auto-save video ke cloud.');

    setVideoCloudMessage('☁ Menyimpan video hasil ke Supabase Storage…');
    const response = await fetch(videoSourceUrl);
    if (!response.ok) throw new Error(`Video hasil tidak dapat diambil (${response.status}).`);

    const blob = await response.blob();
    if (!blob.size) throw new Error('Video hasil kosong.');

    const projectFolder = activeProjectId || 'workspace';
    const path = `${userId}/${projectFolder}/${generationId}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from('hrnet-videos')
      .upload(path, blob, {
        contentType: blob.type || 'video/mp4',
        cacheControl: '31536000',
        upsert: true,
      });

    if (uploadError) throw new Error(`Upload video ke cloud gagal: ${uploadError.message}`);

    const { data: signedData, error: signedError } = await supabase.storage
      .from('hrnet-videos')
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    if (signedError || !signedData?.signedUrl) {
      setVideoCloudMessage(`✓ Video sudah tersimpan di Cloud. Preview cloud belum tersedia: ${signedError?.message || 'URL tidak tersedia.'}`);
      return { path, signedUrl: videoSourceUrl };
    }

    setVideoCloudMessage('✓ Video otomatis tersimpan di Supabase Cloud.');
    return { path, signedUrl: signedData.signedUrl };
  }

  async function restoreCloudVideoUrls(items: HistoryItem[]) {
    if (!userId) return;
    const stored = items.filter(item => item.status === 'completed' && item.videoPath);
    if (!stored.length) return;

    const resolved = await Promise.all(stored.map(async item => {
      const { data, error: signedError } = await supabase.storage
        .from('hrnet-videos')
        .createSignedUrl(item.videoPath as string, 60 * 60 * 24 * 7);
      return { id: item.id, url: signedError ? null : data?.signedUrl || null };
    }));

    const byId = new Map(resolved.map(x => [x.id, x.url]));
    setHistory(current => current.map(item => {
      const url = byId.get(item.id);
      return url ? { ...item, videoUrl: url } : item;
    }));
  }

  useEffect(() => {
    if (!workspaceHydrated || !userId || !history.length) return;
    void restoreCloudVideoUrls(history);
  }, [workspaceHydrated, userId, activeProjectId, history.length]);

  async function saveActiveProjectToCloud() {
    if (!userId) {
      setProjectManagerMessage('Login diperlukan untuk menyimpan project cloud.');
      return;
    }
    const payload = getWorkspacePayload();
    const id = activeProjectId || undefined;
    const values = {
      user_id: userId,
      project_name: projectName.trim() || 'New Project',
      project_notes: projectNotes,
      payload,
      updated_at: new Date().toISOString(),
    };
    if (id) {
      const { error: updateError } = await supabase.from('projects').update(values).eq('id', id).eq('user_id', userId);
      if (updateError) {
        setProjectManagerMessage(`Gagal menyimpan project: ${updateError.message}`);
        return;
      }
    } else {
      const { data, error: insertError } = await supabase.from('projects').insert(values).select('id').single();
      if (insertError || !data) {
        setProjectManagerMessage(`Gagal membuat project: ${insertError?.message || 'Tidak ada data.'}`);
        return;
      }
      setActiveProjectId(data.id);
    }
    setProjectManagerMessage('✓ Project tersimpan di Supabase Cloud.');
    setCloudSyncMessage('✓ Project cloud tersimpan.');
    await refreshCloudProjects();
  }

  async function deleteCloudProject(projectId: string) {
    if (!userId) return;
    const target = projects.find(p => p.id === projectId);
    if (!target) return;
    if (!window.confirm(`Hapus project “${target.name}” dari cloud?`)) return;
    const { error: deleteError } = await supabase.from('projects').delete().eq('id', projectId).eq('user_id', userId);
    if (deleteError) {
      setProjectManagerMessage(`Gagal menghapus project: ${deleteError.message}`);
      return;
    }
    if (activeProjectId === projectId) {
      setActiveProjectId('');
      clearWorkspace();
      setProjectName('New Project');
      setProjectNotes('');
    }
    setProjectManagerMessage(`✓ Project “${target.name}” dihapus.`);
    await refreshCloudProjects();
  }

  async function saveWorkspaceToCloud() {
    if (activeProjectId) {
      await saveActiveProjectToCloud();
      return;
    }
    if (!userId) {
      setCloudSyncMessage('Login diperlukan untuk menyimpan workspace ke cloud.');
      return;
    }
    const payload = getWorkspacePayload();
    const { error: saveError } = await supabase.from('workspaces').upsert({
      user_id: userId,
      project_name: projectName,
      payload,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (saveError) {
      setCloudSyncMessage(`Gagal menyimpan cloud: ${saveError.message}`);
      return;
    }
    setCloudSyncMessage('✓ Workspace tersimpan di Supabase Cloud. Buat/buka Project Cloud untuk penyimpanan multi-project.');
  }

  async function loadWorkspaceFromCloud() {
    if (!userId) {
      setCloudSyncMessage('Login diperlukan untuk memuat workspace cloud.');
      return;
    }
    if (activeProjectId) {
      await openCloudProject(activeProjectId);
      setCloudSyncMessage('✓ Project cloud berhasil dimuat.');
      return;
    }
    setCloudSyncMessage('Memuat workspace dari cloud...');
    const { data, error: loadError } = await supabase
      .from('workspaces')
      .select('payload')
      .eq('user_id', userId)
      .maybeSingle();
    if (loadError) {
      setCloudSyncMessage(`Gagal memuat cloud: ${loadError.message}`);
      return;
    }
    if (!data?.payload) {
      setCloudSyncMessage('Belum ada workspace cloud untuk akun ini.');
      return;
    }
    applyWorkspacePayload(data.payload);
    setCloudSyncMessage('✓ Workspace cloud berhasil dimuat.');
    setStatus('Workspace dimuat dari Supabase Cloud.');
  }

  useEffect(() => {
    if (page === 'Dola Studio' && userId) void loadDolaCloudLibrary();
  }, [page, userId, activeProjectId]);

  function toggleCharacter(name: string) {
    setSelectedCharacters(v => v.includes(name) ? v.filter(x => x !== name) : [...v, name]);
  }

  function addAsset(kind: 'character' | 'vehicle' | 'location') {
    const name = assetName.trim();
    if (!name) { setError('Nama asset wajib diisi.'); return; }
    const baseAsset: Asset = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, description: assetDescription.trim() || 'Belum ada deskripsi.' };
    const asset: Asset =
      kind === 'character'
        ? { ...baseAsset, reference: characterReference || undefined, referenceName: characterReferenceName || undefined, identityLock: characterIdentityLock, visualDetails: characterVisualDetails.trim() || undefined }
        : kind === 'vehicle'
          ? { ...baseAsset, reference: vehicleReference || undefined, referenceName: vehicleReferenceName || undefined, identityLock: vehicleLockEnabled, visualDetails: vehicleVisualDetails.trim() || undefined }
          : { ...baseAsset, reference: locationReference || undefined, referenceName: locationReferenceName || undefined, identityLock: locationLock, visualDetails: [locationEnvironment, locationTime, locationWeather, locationElements].filter(Boolean).join(' • ') || undefined };
    if (kind === 'character') setCharacters(v => [...v, asset]);
    if (kind === 'vehicle') setVehicles(v => [...v, asset]);
    if (kind === 'location') setLocations(v => [...v, asset]);
    setAssetName(''); setAssetDescription('');
    if (kind === 'character') {
      setCharacterReference(''); setCharacterReferenceName(''); setCharacterVisualDetails(''); setCharacterIdentityLock(true); setEditingCharacterId(null);
    }
    if (kind === 'vehicle') {
      setVehicleReference(''); setVehicleReferenceName(''); setVehicleVisualDetails(''); setVehicleLockEnabled(true); setEditingVehicleId(null);
    }
    if (kind === 'location') {
      setLocationReference(''); setLocationReferenceName(''); setLocationEnvironment(''); setLocationTime(''); setLocationWeather(''); setLocationElements(''); setLocationLock(true); setEditingLocationId(null);
    }
    setError(''); setStatus(`${name} ditambahkan ke Library.`);
  }

  function editCharacter(asset: Asset) {
    setAssetName(asset.name); setAssetDescription(asset.description); setCharacterReference(asset.reference || ''); setCharacterReferenceName(asset.referenceName || ''); setCharacterVisualDetails(asset.visualDetails || ''); setCharacterIdentityLock(asset.identityLock !== false); setEditingCharacterId(asset.id); setStatus(`Mode edit aktif: ${asset.name}.`);
  }

  function updateCharacter() {
    if (!editingCharacterId) return;
    const name = assetName.trim();
    if (!name) { setError('Nama karakter wajib diisi.'); return; }
    setCharacters(v => v.map(a => a.id === editingCharacterId ? { ...a, name, description: assetDescription.trim() || 'Belum ada deskripsi.', reference: characterReference || undefined, referenceName: characterReferenceName || undefined, identityLock: characterIdentityLock, visualDetails: characterVisualDetails.trim() || undefined } : a));
    setAssetName(''); setAssetDescription(''); setCharacterReference(''); setCharacterReferenceName(''); setCharacterVisualDetails(''); setCharacterIdentityLock(true); setEditingCharacterId(null); setError(''); setStatus(`${name} diperbarui.`);
  }

  function editVehicle(asset: Asset) {
    setAssetName(asset.name);
    setAssetDescription(asset.description);
    setVehicleReference(asset.reference || '');
    setVehicleReferenceName(asset.referenceName || '');
    setVehicleVisualDetails(asset.visualDetails || '');
    setVehicleLockEnabled(asset.identityLock !== false);
    setEditingVehicleId(asset.id);
    setStatus(`Mode edit kendaraan aktif: ${asset.name}.`);
  }

  function updateVehicle() {
    if (!editingVehicleId) return;
    const name = assetName.trim();
    if (!name) { setError('Nama kendaraan wajib diisi.'); return; }
    setVehicles(v => v.map(a => a.id === editingVehicleId ? {
      ...a,
      name,
      description: assetDescription.trim() || 'Belum ada deskripsi.',
      reference: vehicleReference || undefined,
      referenceName: vehicleReferenceName || undefined,
      identityLock: vehicleLockEnabled,
      visualDetails: vehicleVisualDetails.trim() || undefined,
    } : a));
    setAssetName('');
    setAssetDescription('');
    setVehicleReference('');
    setVehicleReferenceName('');
    setVehicleVisualDetails('');
    setVehicleLockEnabled(true);
    setEditingVehicleId(null);
    setError('');
    setStatus(`${name} diperbarui.`);
  }

  function editLocation(asset: Asset) {
    const parts = (asset.visualDetails || '').split(' • ');
    setAssetName(asset.name); setAssetDescription(asset.description);
    setLocationReference(asset.reference || ''); setLocationReferenceName(asset.referenceName || '');
    setLocationEnvironment(parts[0] || ''); setLocationTime(parts[1] || ''); setLocationWeather(parts[2] || ''); setLocationElements(parts.slice(3).join(' • ') || '');
    setLocationLock(asset.identityLock !== false); setEditingLocationId(asset.id); setStatus(`Mode edit lokasi aktif: ${asset.name}.`);
  }

  function updateLocation() {
    if (!editingLocationId) return;
    const name = assetName.trim();
    if (!name) { setError('Nama lokasi wajib diisi.'); return; }
    const visualDetails = [locationEnvironment, locationTime, locationWeather, locationElements].filter(Boolean).join(' • ');
    setLocations(v => v.map(a => a.id === editingLocationId ? { ...a, name, description: assetDescription.trim() || 'Belum ada deskripsi.', reference: locationReference || undefined, referenceName: locationReferenceName || undefined, identityLock: locationLock, visualDetails: visualDetails || undefined } : a));
    setAssetName(''); setAssetDescription(''); setLocationReference(''); setLocationReferenceName(''); setLocationEnvironment(''); setLocationTime(''); setLocationWeather(''); setLocationElements(''); setLocationLock(true); setEditingLocationId(null); setError(''); setStatus(`${name} diperbarui.`);
  }

  function removeAsset(kind: 'character' | 'vehicle' | 'location', id: string) {
    if (kind === 'character') setCharacters(v => v.filter(x => x.id !== id));
    if (kind === 'vehicle') setVehicles(v => v.filter(x => x.id !== id));
    if (kind === 'location') setLocations(v => v.filter(x => x.id !== id));
    setStatus('Asset dihapus dari Library.');
  }

  function buildSceneBuilderPrompt() {
    const chars = sceneBuilderCharacters.map(name => characters.find(c => c.name === name)).filter(Boolean) as Asset[];
    const vehicle = vehicles.find(v => v.name === sceneBuilderVehicle);
    const location = locations.find(l => l.name === sceneBuilderLocation);
    const lockText = [
      characterLock ? 'CHARACTER LOCK: pertahankan identitas, wajah, rambut, pakaian, aksesori, dan ciri khas setiap karakter.' : '',
      vehicleLock ? 'VEHICLE LOCK: pertahankan model, bentuk bodi, warna, grafis, aksesori, dan kondisi kendaraan.' : '',
      locationLock ? 'LOCATION LOCK: pertahankan tata letak, arsitektur, lingkungan, waktu, cuaca, dan elemen penting lokasi.' : '',
      positionLock ? 'POSITION LOCK: pertahankan posisi relatif karakter, kendaraan, kamera, dan blocking dari awal sampai akhir shot.' : '',
    ].filter(Boolean);
    const assetText = [
      chars.length ? `Karakter: ${chars.map(c => `${c.name}${c.description ? ` — ${c.description}` : ''}${c.visualDetails ? ` — ${c.visualDetails}` : ''}`).join('; ')}.` : '',
      vehicle ? `Kendaraan: ${vehicle.name}${vehicle.description ? ` — ${vehicle.description}` : ''}${vehicle.visualDetails ? ` — ${vehicle.visualDetails}` : ''}.` : '',
      location ? `Lokasi: ${location.name}${location.description ? ` — ${location.description}` : ''}${location.visualDetails ? ` — ${location.visualDetails}` : ''}.` : '',
      sceneBuilderPosition.trim() ? `Blocking / posisi: ${sceneBuilderPosition.trim()}.` : '',
    ].filter(Boolean);
    return [
      sceneBuilderTitle.trim(),
      sceneBuilderAction.trim(),
      ...assetText,
      ...lockText,
      'Gaya cinematic realistis, kontinuitas visual ketat, gerakan natural, kamera stabil, pencahayaan sinematik, detail tinggi, tanpa teleportasi, tanpa redesign karakter, kendaraan, atau lokasi.'
    ].filter(Boolean).join(' ');
  }

  function saveSceneFromBuilder() {
    const title = sceneBuilderTitle.trim() || 'Untitled Scene';
    if (!sceneBuilderAction.trim()) { setError('Deskripsi aksi scene wajib diisi.'); return; }
    const finalPrompt = buildSceneBuilderPrompt();
    const builderVehicle = vehicles.find(v => v.name === sceneBuilderVehicle);
    const builderLocation = locations.find(l => l.name === sceneBuilderLocation);
    const builderCharacters = charsForBuilder(sceneBuilderCharacters, characters);
    const refs = [
      ...builderCharacters.map(c => c.reference),
      builderVehicle?.reference,
      builderLocation?.reference,
    ].filter(Boolean).slice(0, 6) as string[];
    const refNames = [
      ...builderCharacters.map(c => c.referenceName || `${c.name} reference`),
      builderVehicle?.referenceName || (builderVehicle ? `${builderVehicle.name} reference` : ''),
      builderLocation?.referenceName || (builderLocation ? `${builderLocation.name} reference` : ''),
    ].filter(Boolean).slice(0, 6) as string[];
    const item: SceneItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      prompt: finalPrompt,
      type: 'video',
      createdAt: new Date().toISOString(),
      characterNames: [...sceneBuilderCharacters],
      vehicleName: sceneBuilderVehicle || undefined,
      locationName: sceneBuilderLocation || undefined,
      positionNotes: sceneBuilderPosition.trim() || undefined,
      references: refs,
      referenceNames: refNames,
      locks: { character: characterLock, vehicle: vehicleLock, location: locationLock, position: positionLock },
    };
    setScenes(v => [item, ...v].slice(0, 50));
    setSceneTitle(title);
    setAction(sceneBuilderAction.trim());
    setSelectedCharacters([...sceneBuilderCharacters]);
    setSelectedVehicle(sceneBuilderVehicle);
    setSelectedLocation(sceneBuilderLocation);
    setReferences([...refs, ...Array(Math.max(0, 6 - refs.length)).fill('')]);
    setReferenceNames([...refNames, ...Array(Math.max(0, 6 - refNames.length)).fill('')]);
    setReferenceSlots(6);
    setGeneratedPrompt(finalPrompt);
    setStatus(`Scene “${title}” disimpan ke Scene Library.`);
    setError('');
  }

  function charsForBuilder(names: string[], source: Asset[]) {
    return names.map(name => source.find(c => c.name === name)).filter(Boolean) as Asset[];
  }

  function resetSceneBuilder() {
    setSceneBuilderTitle(''); setSceneBuilderAction(''); setSceneBuilderCharacters([]); setSceneBuilderVehicle(''); setSceneBuilderLocation(''); setSceneBuilderPosition('');
    setStatus('Scene Builder dikosongkan.'); setError('');
  }

  function saveScene(type: 'video' | 'image') {
    const sourcePrompt = type === 'video' ? prompt : imageGeneratedPrompt;
    const title = (type === 'video' ? sceneTitle : projectName).trim() || (type === 'video' ? 'Untitled Video Scene' : 'Untitled Image Scene');
    if (!sourcePrompt.trim()) { setError('Buat prompt terlebih dahulu.'); return; }
    setScenes(v => [{ id: `${Date.now()}`, title, prompt: sourcePrompt, type, createdAt: new Date().toISOString(), characterNames: [...selectedCharacters], vehicleName: selectedVehicle || undefined, locationName: selectedLocation || undefined, references: references.filter(Boolean).slice(0, 6), referenceNames: referenceNames.filter(Boolean).slice(0, 6), locks: { character: characterLock, vehicle: vehicleLock, location: locationLock, position: positionLock } }, ...v].slice(0, 50));
    setStatus(`Scene ${type === 'video' ? 'video' : 'gambar'} disimpan ke Scene Library.`); setError('');
  }

  function buildImagePrompt() {
    const finalPrompt = [imagePrompt.trim(), `Style: ${imageStyle}.`, `Aspect ratio: ${imageRatio}.`, `Resolution target: ${imageResolution}.`, imageReference ? 'Gunakan reference image sebagai acuan identitas, komposisi, dan kontinuitas; jangan mengubah ciri utama subjek.' : '', 'Photorealistic cinematic image, natural lighting, realistic anatomy, high detail, clean composition, no text, no watermark.'].filter(Boolean).join(' ');
    setImageGeneratedPrompt(finalPrompt); setStatus('Prompt gambar siap digunakan.'); setError('');
    return finalPrompt;
  }

  function clearMediaReference(kind: 'audio' | 'video') {
    if (kind === 'audio' && audioReference) URL.revokeObjectURL(audioReference);
    if (kind === 'video' && videoReference) URL.revokeObjectURL(videoReference);
    if (kind === 'audio') { setAudioReference(null); setAudioReferenceName(''); }
    else { setVideoReference(null); setVideoReferenceName(''); }
  }


  async function compressReferenceImage(file: File): Promise<string> {
    const MAX_DATA_URI_CHARS = 2_800_000;
    const MAX_DIMENSION = 1600;

    const sourceUrl = URL.createObjectURL(file);

    try {
      const image = new Image();
      image.src = sourceUrl;

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Gambar reference tidak dapat dibaca.'));
      });

      const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Browser tidak mendukung pemrosesan gambar reference.');

      ctx.drawImage(image, 0, 0, width, height);

      let quality = 0.82;
      let dataUri = canvas.toDataURL('image/jpeg', quality);

      while (dataUri.length > MAX_DATA_URI_CHARS && quality > 0.45) {
        quality -= 0.07;
        dataUri = canvas.toDataURL('image/jpeg', quality);
      }

      if (dataUri.length > MAX_DATA_URI_CHARS) {
        throw new Error('Reference masih terlalu besar setelah dikompres. Gunakan gambar yang lebih sederhana.');
      }

      return dataUri;
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  function handleMediaReference(kind: 'audio' | 'video', file: File) {
    const maxSize = kind === 'audio' ? 20 * 1024 * 1024 : 40 * 1024 * 1024;
    if (file.size > maxSize) { setError(`${kind === 'audio' ? 'Audio' : 'Video'} reference maksimal ${kind === 'audio' ? '20' : '40'} MB.`); return; }
    const url = URL.createObjectURL(file);
    clearMediaReference(kind);
    if (kind === 'audio') { setAudioReference(url); setAudioReferenceName(file.name); }
    else { setVideoReference(url); setVideoReferenceName(file.name); }
    setError('');
    setStatus(`${kind === 'audio' ? 'Audio' : 'Video'} reference siap digunakan.`);
  }

  function clearWorkspace() {
    clearMediaReference('audio');
    clearMediaReference('video');
    setAction(''); setSceneTitle(''); setSelectedCharacters([]); setSelectedVehicle(''); setSelectedLocation('');
    setReferences(Array(6).fill('')); setReferenceNames(Array(6).fill('')); setReferenceSlots(6);
    setGeneratedPrompt(''); setShowCopyBox(false); setVideoUrl(null); setError(''); setStatus('Workspace dibersihkan.');
  }

  async function copyPrompt(): Promise<boolean> {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setGeneratedPrompt(prompt);
        setStatus('✓ Prompt berhasil disalin.');
        setError('');
        return true;
      }
    } catch {}
    setShowCopyBox(true); setGeneratedPrompt(prompt);
    setStatus('Prompt siap disalin manual.');
    setError('Browser menolak akses clipboard otomatis.');
    return false;
  }

  function enhancePrompt() {
    const extra = ' Cinematic production direction: establish shot, clear subject continuity, motivated camera movement, natural body mechanics, consistent lighting and environment, realistic depth, no flicker, no morphing, no duplicate limbs, no sudden costume or vehicle changes.';
    if (!action.trim()) {
      setAction('Buat adegan sinematik yang realistis dengan subjek utama tetap konsisten dari awal sampai akhir.' + extra);
    } else if (!action.includes('Cinematic production direction')) {
      setAction(action.trim() + extra);
    }
    setStatus('Prompt diperkuat untuk workflow produksi.');
  }


  function buildDolaLongVideoPlan(targetDuration: number) {
    const total = Math.max(1, Math.ceil(targetDuration / 15));
    const base = prompt.trim();
    if (!base) {
      setError('Isi deskripsi scene terlebih dahulu.');
      return [] as LongVideoSegment[];
    }

    const phases = [
      'OPENING / ESTABLISHING: tetapkan lokasi, karakter, kendaraan, blocking, dan kamera secara jelas.',
      'CONTINUATION: lanjutkan langsung dari frame terakhir segmen sebelumnya; jangan mengulang atau mereset adegan.',
      'ESCALATION: lanjutkan aksi utama dengan intensitas yang meningkat secara natural, tetap mempertahankan semua continuity lock.',
      'RESOLUTION: lanjutkan dari frame terakhir menuju beat penutup yang logis dan tetap konsisten.'
    ];

    const segments = Array.from({ length: total }, (_, i) => {
      const phase = phases[Math.min(i, phases.length - 1)];
      const bridge = i === 0
        ? 'Ini adalah segmen pertama.'
        : `Ini adalah segmen ${i + 1} dari ${total}. WAJIB melanjutkan tepat dari akhir segmen ${i}.`;

      return {
        index: i + 1,
        total,
        duration: 15,
        title: `${sceneTitle.trim() || 'Dola Long Video'} — Scene ${i + 1}`,
        status: 'pending',
        prompt: [
          base,
          `DURATION SEGMENT: 15 detik. ${bridge}`,
          phase,
          'CONTINUITY BRIDGE: pertahankan posisi karakter, arah gerak, wajah, rambut, kostum, kendaraan, lokasi, cuaca, pencahayaan, skala objek, dan gaya kamera dari segmen sebelumnya.',
          'Hindari jump cut, teleportasi, morphing, perubahan wajah, perubahan pakaian, perubahan kendaraan, perubahan lokasi, atau perubahan waktu yang tidak diminta.',
          `SEGMENT ${i + 1}/${total}.`
        ].join(' ')
      };
    });

    setLongVideoPlan(segments);
    setGeneratedPrompt(segments[0]?.prompt || base);
    setStatus(`Rangkaian Dola ${targetDuration} detik dibuat: ${total} scene × 15 detik.`);
    setError('');
    return segments;
  }


  function setLongVideoSegmentStatus(index: number, status: LongVideoSegment['status'], videoUrl?: string) {
    setLongVideoPlan(current => current.map(segment =>
      segment.index === index ? { ...segment, status, ...(videoUrl ? { videoUrl } : {}) } : segment
    ));
  }

  async function copyNextDolaSegment() {
    const plan = longVideoPlan.length ? longVideoPlan : buildDolaLongVideoPlan(duration);
    if (!plan.length) return;
    const next = plan.find(segment => segment.status === 'pending') || plan[plan.length - 1];
    try {
      await navigator.clipboard.writeText(next.prompt);
      setLongVideoSegmentStatus(next.index, 'copied');
      setLongVideoQueueIndex(next.index);
      setGeneratedPrompt(next.prompt);
      setStatus(`✓ Scene ${next.index}/${next.total} disalin. Generate scene ini di Dola.`);
    } catch {
      setGeneratedPrompt(next.prompt);
      setShowCopyBox(true);
      setLongVideoQueueIndex(next.index);
      setStatus(`Scene ${next.index}/${next.total} siap disalin manual.`);
    }
  }

  function markCurrentDolaSegmentCompleted() {
    if (!longVideoPlan.length) return;
    const current = longVideoPlan.find(s => s.index === longVideoQueueIndex) || longVideoPlan[0];
    setLongVideoSegmentStatus(current.index, 'completed');
    const next = longVideoPlan.find(s => s.index > current.index && s.status !== 'completed');
    if (next) {
      setLongVideoQueueIndex(next.index);
      setStatus(`Scene ${current.index}/${current.total} selesai. Berikutnya Scene ${next.index}/${next.total}.`);
    } else {
      setStatus(`✓ Semua ${longVideoPlan.length} scene Dola selesai.`);
    }
  }

  async function copyDolaLongVideoPlan() {
    const plan = longVideoPlan.length ? longVideoPlan : buildDolaLongVideoPlan(duration);
    if (!plan.length) return;
    const textToCopy = plan.map(s => `=== ${s.title} | ${s.duration}s ===\n${s.prompt}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(textToCopy);
      setStatus(`✓ ${plan.length} prompt scene Dola disalin sekaligus.`);
    } catch {
      setGeneratedPrompt(textToCopy);
      setShowCopyBox(true);
      setStatus('Rangkaian prompt siap disalin manual.');
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getDolaSegmentClip(index: number) {
    return mergeClips.find(clip => clip.sourceScene === index || clip.id === `dola-scene-${index}`);
  }

  async function loadDolaCloudLibrary() {
    if (!userId) {
      setDolaCloudScenes([]);
      setDolaCloudMessage('Login diperlukan untuk membaca Dola Cloud Library.');
      return;
    }
    setIsLoadingDolaCloud(true);
    setDolaCloudMessage('Memuat Dola Cloud Library…');
    try {
      const projectFolder = activeProjectId || 'workspace';
      const prefix = `${userId}/${projectFolder}/dola-scenes`;
      const { data, error: listError } = await supabase.storage
        .from('hrnet-videos')
        .list(prefix, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
      if (listError) throw new Error(listError.message);
      const files = (data || []).filter((item: any) => item.name && !item.id?.endsWith('/'));
      const results: DolaCloudScene[] = [];
      for (const item of files) {
        const path = `${prefix}/${item.name}`;
        const { data: signedData } = await supabase.storage
          .from('hrnet-videos')
          .createSignedUrl(path, 60 * 60);
        const match = item.name.match(/scene-(\d{2})-/i);
        results.push({
          name: item.name,
          path,
          size: Number(item.metadata?.size || item.metadata?.contentLength || 0),
          updatedAt: item.updated_at || item.created_at,
          signedUrl: signedData?.signedUrl,
          sceneNumber: match ? Number(match[1]) : undefined,
        });
      }
      results.sort((a, b) => (a.sceneNumber || 99) - (b.sceneNumber || 99) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      setDolaCloudScenes(results);
      setDolaCloudMessage(results.length ? `✓ ${results.length} Scene Dola ditemukan di Cloud.` : 'Belum ada Scene Dola di Cloud.');
    } catch (err) {
      setDolaCloudScenes([]);
      setDolaCloudMessage(err instanceof Error ? `Gagal memuat Cloud Library: ${err.message}` : 'Gagal memuat Cloud Library.');
    } finally {
      setIsLoadingDolaCloud(false);
    }
  }

  async function useDolaCloudScene(item: DolaCloudScene) {
    if (!item.signedUrl) {
      setError('Preview Cloud tidak tersedia. Muat ulang Cloud Library.');
      return;
    }
    const response = await fetch(item.signedUrl);
    if (!response.ok) {
      setError(`Video Cloud tidak dapat diambil (${response.status}).`);
      return;
    }
    const blob = await response.blob();
    const file = new File([blob], item.name, { type: blob.type || 'video/mp4' });
    const sceneNumber = item.sceneNumber;
    if (sceneNumber && sceneNumber >= 1 && sceneNumber <= 4) {
      attachDolaSegmentVideo(sceneNumber, file);
    } else {
      addMergeClip(file);
    }
    setPage('Video Merger');
    setStatus(`✓ ${item.name} dipakai ke Video Merger.`);
    setMergeMessage(`Cloud Scene ${sceneNumber ? `0${sceneNumber}` : ''} masuk ke antrean merger.`);
  }

  function addMergeClip(file: File) {
    if (!file.type.startsWith('video/')) { setError('File merger harus berupa video.'); return; }
    if (file.size > 500 * 1024 * 1024) { setError('Maksimal 500 MB per clip untuk merger browser.'); return; }
    const url = URL.createObjectURL(file);
    setMergeClips(current => {
      if (current.length >= 4) { URL.revokeObjectURL(url); return current; }
      return [...current, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, file, name: file.name, url, sourceScene: undefined }];
    });
    setError('');
    setMergeMessage(`${file.name} ditambahkan ke Video Merger.`);
  }

  function attachDolaSegmentVideo(index: number, file: File) {
    if (!file.type.startsWith('video/')) { setError('Scene Dola harus berupa file video.'); return; }
    if (file.size > 500 * 1024 * 1024) { setError('Maksimal 500 MB per scene untuk merger browser.'); return; }
    const id = `dola-scene-${index}`;
    const url = URL.createObjectURL(file);
    setMergeClips(current => {
      const old = current.find(clip => clip.id === id);
      if (old) URL.revokeObjectURL(old.url);
      const next = current.filter(clip => clip.id !== id);
      if (next.length >= 4) { URL.revokeObjectURL(url); return current; }
      next.push({ id, file, name: `Scene ${index} — ${file.name}`, url, durationLabel: '15s', sourceScene: index });
      return next.sort((a, b) => {
        const ai = Number(a.id.replace('dola-scene-', '')) || 99;
        const bi = Number(b.id.replace('dola-scene-', '')) || 99;
        return ai - bi;
      });
    });
    setLongVideoSegmentStatus(index, 'completed', url);
    setLongVideoQueueIndex(index);
    setMergeMessage(`✓ Scene ${index} masuk otomatis ke Video Merger.`);
    setStatus(`Scene ${index} siap di-merger.`);
    setError('');
  }

  async function uploadDolaSegmentToCloud(index: number) {
    if (!userId) {
      setError('Login diperlukan untuk menyimpan Scene Dola ke Cloud.');
      return;
    }

    const clip = getDolaSegmentClip(index);
    if (!clip) {
      setError(`Scene ${index} belum memiliki file video.`);
      return;
    }

    const safeProject = (activeProjectId || 'workspace').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = clip.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
    const path = `${userId}/${safeProject}/dola-scenes/scene-${String(index).padStart(2, '0')}-${Date.now()}-${safeName}`;

    setLongVideoPlan(current => current.map(item => item.index === index ? { ...item, cloudStatus: 'uploading' } : item));
    setVideoCloudMessage(`☁ Mengunggah Scene ${index} ke Supabase Storage…`);

    try {
      const { error: uploadError } = await supabase.storage
        .from('hrnet-videos')
        .upload(path, clip.file, {
          contentType: clip.file.type || 'video/mp4',
          cacheControl: '31536000',
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: signedData, error: signedError } = await supabase.storage
        .from('hrnet-videos')
        .createSignedUrl(path, 60 * 60 * 24 * 7);

      const cloudUrl = signedError ? undefined : signedData?.signedUrl;
      setLongVideoPlan(current => current.map(item => item.index === index ? {
        ...item,
        cloudPath: path,
        cloudUrl,
        cloudStatus: 'uploaded',
        videoUrl: cloudUrl || item.videoUrl,
      } : item));

      setVideoCloudMessage(`✓ Scene ${index} tersimpan di hrnet-videos.`);
      setMergeMessage(`✓ Scene ${index} sudah tersimpan di Cloud.`);

      const updatedPlan = (longVideoPlan.length ? longVideoPlan : []).map(item => item.index === index ? {
        ...item, cloudPath: path, cloudUrl, cloudStatus: 'uploaded' as const, videoUrl: cloudUrl || item.videoUrl,
      } : item);
      if (updatedPlan.length) {
        const payload = { ...getWorkspacePayload(), longVideoPlan: updatedPlan, exportedAt: new Date().toISOString() };
        if (activeProjectId) {
          await supabase.from('projects').update({ payload, updated_at: new Date().toISOString() }).eq('id', activeProjectId).eq('user_id', userId);
        } else {
          await supabase.from('workspaces').upsert({ user_id: userId, project_name: projectName, payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        }
      }
    } catch (err) {
      setLongVideoPlan(current => current.map(item => item.index === index ? { ...item, cloudStatus: 'failed' } : item));
      setError(err instanceof Error ? `Upload Scene ${index} gagal: ${err.message}` : `Upload Scene ${index} gagal.`);
      setVideoCloudMessage('');
    }
  }

  function removeMergeClip(id: string) {
    setMergeClips(current => {
      const item = current.find(x => x.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return current.filter(x => x.id !== id);
    });
    setMergedVideoUrl(current => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  function moveMergeClip(id: string, direction: -1 | 1) {
    setMergeClips(current => {
      const index = current.findIndex(x => x.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function clearMergeClips() {
    mergeClips.forEach(x => URL.revokeObjectURL(x.url));
    setMergeClips([]);
    if (mergedVideoUrl) URL.revokeObjectURL(mergedVideoUrl);
    setMergedVideoUrl(null);
    setMergeProgress(0);
    setMergeMessage('Daftar clip merger dikosongkan.');
  }

  async function ensureFfmpeg() {
    if (window.FFmpeg) return window.FFmpeg;
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-hrnet-ffmpeg="1"]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('FFmpeg WebAssembly gagal dimuat.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js';
      script.async = true;
      script.dataset.hrnetFfmpeg = '1';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Tidak dapat memuat FFmpeg WebAssembly dari CDN.'));
      document.head.appendChild(script);
    });
    if (!window.FFmpeg) throw new Error('FFmpeg WebAssembly belum tersedia di browser.');
    return window.FFmpeg;
  }

  async function mergeVideos() {
    if (mergeClips.length < 2) {
      setError('Tambahkan minimal 2 video untuk digabung.');
      return;
    }
    setIsMerging(true);
    setMergeProgress(5);
    setMergeMessage('Memuat engine Video Merger…');
    setError('');
    try {
      const FFmpegLib = await ensureFfmpeg();
      const ffmpeg = FFmpegLib.createFFmpeg({
        log: false,
        corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.6/dist/ffmpeg-core.js',
      });
      ffmpeg.setProgress?.(({ ratio }: { ratio: number }) => setMergeProgress(Math.max(10, Math.min(95, Math.round(ratio * 100)))));
      if (!ffmpeg.isLoaded()) {
        setMergeMessage('Menyiapkan FFmpeg WebAssembly…');
        await ffmpeg.load();
      }
      setMergeProgress(20);

      const listLines: string[] = [];
      for (let i = 0; i < mergeClips.length; i += 1) {
        const clip = mergeClips[i];
        const filename = `hrnet_clip_${i + 1}.mp4`;
        ffmpeg.FS('writeFile', filename, await FFmpegLib.fetchFile(clip.file));
        listLines.push(`file '${filename}'`);
        setMergeProgress(20 + Math.round(((i + 1) / mergeClips.length) * 25));
      }
      ffmpeg.FS('writeFile', 'concat.txt', new TextEncoder().encode(listLines.join('\n')));
      setMergeMessage('Menggabungkan clip…');
      setMergeProgress(50);

      try {
        await ffmpeg.run('-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', '-movflags', '+faststart', 'merged.mp4');
      } catch {
        setMergeMessage('Format clip berbeda; mencoba mode kompatibilitas…');
        await ffmpeg.run('-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-movflags', '+faststart', 'merged.mp4');
      }

      const data = ffmpeg.FS('readFile', 'merged.mp4');
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      if (mergedVideoUrl) URL.revokeObjectURL(mergedVideoUrl);
      setMergedVideoUrl(url);
      setMergeProgress(100);
      setMergeMessage(`✓ ${mergeClips.length} clip berhasil digabung menjadi satu video.`);
      setStatus('Video Merger selesai.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video Merger gagal.');
      setMergeMessage('Merger gagal. Pastikan browser mengizinkan WebAssembly dan semua clip valid.');
    } finally {
      setIsMerging(false);
    }
  }

  function downloadMergedVideo() {
    if (!mergedVideoUrl) return;
    const a = document.createElement('a');
    a.href = mergedVideoUrl;
    a.download = `${(projectName || 'hrnet-ai-cinema').trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'hrnet-ai-cinema'}-merged.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus('Video hasil merger siap disimpan ke komputer.');
  }

  async function saveMergedVideoToCloud() {
    if (!mergedVideoUrl) { setError('Gabungkan video terlebih dahulu.'); return; }
    const id = `merge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const saved = await saveVideoToCloud(mergedVideoUrl, id);
      const mergedItem: HistoryItem = {
        id,
        title: `${projectName || 'HR-NET'} — Merged Video`,
        prompt: `Merged ${mergeClips.length} video clips menjadi satu output.`,
        model: 'Video Merger',
        duration: mergeClips.reduce((sum, clip) => sum + 15, 0),
        ratio,
        resolution,
        createdAt: new Date().toISOString(),
        status: 'completed',
        videoUrl: saved.signedUrl,
        videoPath: saved.path,
        estimatedCredits: 0,
      };
      const updated = [mergedItem, ...history].slice(0, 20);
      setHistory(updated);
      await saveGenerationHistoryToCloud(updated);
      setVideoUrl(saved.signedUrl);
      setMergeMessage('✓ Video merger tersimpan di hrnet-videos dan masuk History.');
      setStatus('Merged video tersimpan ke Cloud + History.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan merged video ke Cloud.');
    }
  }

  async function finalizeDolaWorkflow() {
    const expected = Math.ceil(duration / 15);
    const ready = mergeClips.filter(c => c.sourceScene).length;
    if (expected < 2) {
      setError('Workflow Dola selesai untuk durasi 15 detik. Tidak diperlukan merger.');
      return;
    }
    if (ready < expected) {
      setError(`Belum selesai: ${ready}/${expected} scene Dola sudah dimasukkan.`);
      setMergeMessage(`Menunggu ${expected - ready} scene Dola lagi.`);
      setPage('Generate Video');
      return;
    }
    setError('');
    setStatus('Finalisasi Dola dimulai…');
    setMergeMessage('Semua scene lengkap. Menjalankan Video Merger…');
    if (!mergedVideoUrl) {
      await mergeVideos();
    }
    setLongVideoPlan(prev => prev.map(item => ({ ...item, status: 'completed' as const })));
    setStatus('✓ Proses Dola selesai: semua scene sudah lengkap dan video final tersedia.');
  }

function sendPromptToDolaExtension(promptText: string): boolean {
  try {
    if (!promptText.trim()) return false;
    window.postMessage(
      {
        source: 'HR-NET-AI-CINEMA',
        type: 'DOLA_SEND_PROMPT',
        prompt: promptText,
      },
      '*'
    );
    return true;
  } catch {
    return false;
  }
}

async function generate() {
  setGeneratedPrompt('');
  setError('');
  setVideoUrl(null);

  if (!prompt.trim()) {
    setError('Isi deskripsi scene terlebih dahulu.');
    setStatus('Menunggu prompt');
    return;
  }

  if (provider === 'dola') {
    if (duration > 15) {
      const plan = buildDolaLongVideoPlan(duration);
      if (plan.length) await copyDolaLongVideoPlan();
      return;
    }
    const copied = await copyPrompt();
    setStatus(copied ? 'Prompt siap ditempel ke Dola AI.' : 'Gunakan kotak salin manual lalu buka Dola AI.');
    return;
  }

  setIsGenerating(true);
  setStatus('Mengirim ke Runway AI…');

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        prompt,
        duration,
        ratio,
        resolution,
        model,
        references: [],
        reference: references.find(Boolean) || null,
        audioReferenceName: audioReferenceName || null,
        videoReferenceName: videoReferenceName || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Gagal membuat video');
    if (!data.taskId) throw new Error('Runway tidak mengembalikan task ID.');

    let finalData: any = data;

    // Poll the task from our server so Vercel never has to hold the
    // initial POST open while Runway renders the video.
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const statusRes = await fetch(`/api/generate?taskId=${encodeURIComponent(data.taskId)}`, {
        cache: 'no-store',
      });
      const statusData = await statusRes.json();

      if (!statusRes.ok) {
        throw new Error(statusData.error || 'Gagal membaca status generation.');
      }

      finalData = statusData;

      if (statusData.videoUrl) break;

      const normalized = String(statusData.status || '').toLowerCase();
      if (normalized === 'failed' || normalized === 'cancelled') {
        throw new Error(statusData.error || 'Runway generation gagal.');
      }

      setStatus(`Runway sedang membuat video… ${Math.min(attempt + 1, 120)}%`);
    }

    if (!finalData.videoUrl) {
      throw new Error('Generation masih berjalan. Coba cek History beberapa saat lagi.');
    }

    const generationId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const completedItem: HistoryItem = {
      id: generationId,
      title: sceneTitle || 'Untitled Scene',
      prompt,
      model,
      duration,
      ratio,
      resolution,
      createdAt: new Date().toISOString(),
      status: 'completed',
      videoUrl: finalData.videoUrl,
      estimatedCredits
    };

    setGeneratedPrompt(prompt);
    setVideoUrl(finalData.videoUrl);
    setStatus(finalData.status || 'Video selesai');

    let savedItem = completedItem;
    if (userId) {
      try {
        const cloudVideo = await saveVideoToCloud(finalData.videoUrl, generationId);
        savedItem = { ...completedItem, videoPath: cloudVideo.path, videoUrl: cloudVideo.signedUrl };
        setVideoUrl(cloudVideo.signedUrl);
        setStatus('✓ Video selesai dan tersimpan di Cloud');
      } catch (cloudError) {
        const cloudMessage = cloudError instanceof Error ? cloudError.message : 'Auto-save video ke cloud gagal.';
        setVideoCloudMessage(`⚠ ${cloudMessage}`);
        setStatus('Video selesai — auto-save cloud gagal, hasil tetap tersedia untuk download.');
      }
    }

    const updatedHistory = [savedItem, ...history].slice(0, 20);
    setHistory(updatedHistory);
    if (userId && savedItem.videoPath) {
      await saveGenerationHistoryToCloud(updatedHistory);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Terjadi kesalahan';
    setError(message);
    setStatus('Generation gagal');

    setHistory(h => [{
      id: `${Date.now()}`,
      title: sceneTitle || 'Untitled Scene',
      prompt,
      model,
      duration,
      ratio,
      resolution,
      createdAt: new Date().toISOString(),
      status: 'failed' as const,
      estimatedCredits
    }, ...h].slice(0, 20));
  } finally {
    setIsGenerating(false);
  }
}


  function removeHistory(id: string) { setHistory(h => h.filter(x => x.id !== id)); }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="logo"><img className="brand-logo" src="/logo.png" alt="HR-NET — Berkembang Dengan Teknologi!" /></div>
      <div className="side-section">STUDIO</div>
      {['Dashboard','Generate Video','Generate Gambar','Character Library','Vehicle Library','Location Library','Scene Builder','Scene Library','Video Merger','Timeline'].map(item =>
        <button key={item} className={`nav-item ${page === item ? 'active' : ''}`} onClick={() => setPage(item)}><span className="nav-icon">{item === 'Generate Video' ? '▣' : item === 'Generate Gambar' ? '▧' : item === 'Timeline' ? '☷' : item.includes('Library') ? '◈' : '⌂'}</span>{item}</button>)}

      <div className="side-section">AI PROVIDERS</div>
      <button className={`nav-item ${page === 'Dola Studio' ? 'active' : ''}`} onClick={() => setPage('Dola Studio')}><span className="nav-icon">D</span>Dola Studio <em className="beta-badge">WEB</em></button>
      <div className="side-section">AI TOOLS</div>
      <button className={`nav-item ${page === 'AI Agent' ? 'active' : ''}`} onClick={() => setPage('AI Agent')}><span className="nav-icon">AI</span>AI Agent <em className="beta-badge">BETA</em></button>

      <div className="side-quota">
        <div className="quota-head"><span>GENERATION</span><b>PRO</b></div>
        <div className="quota-number"><strong>{availableSlots} / 12</strong><span>slot tersedia</span></div>
        <div className="quota-track"><span style={{width:`${(availableSlots / 12) * 100}%`}}/></div>
        <small>Reset rolling 24 jam</small>
      </div>

      <div className="side-section">AKUN</div>
      <button className={`nav-item ${page === 'Subscription' ? 'active' : ''}`} onClick={() => setPage('Subscription')}><span className="nav-icon">◆</span>Subscription</button>
      <button className={`nav-item ${page === 'Settings' ? 'active' : ''}`} onClick={() => setPage('Settings')}><span className="nav-icon">⚙</span>Settings</button>
      <button className="nav-item" onClick={() => setShowGuide(true)}><span className="nav-icon">?</span>Bantuan</button>

      <div className="project-card" onClick={() => { void createCloudProject(); }}><span>＋</span><div><b>New Project</b><small>Mulai proyek baru</small></div></div>
      <div className="sidebar-bottom"><div className="engine"><span className="dot"/> Engine siap</div><div className="user-mini"><span>H</span><div><b>HR-NET</b><small>Pro • Commercial Beta</small></div></div></div>
    </aside>

    <main className="content">
      <div className="top-banner"><span>☁️ <b>Cloud Workspace:</b> {activeProjectId ? 'project aktif tersimpan di Supabase.' : 'gunakan Project Cloud untuk multi-project.'}</span><span className="top-actions"><button onClick={() => setShowGuide(true)}>Panduan</button><button onClick={() => setPage('Subscription')}>Kelola Paket</button></span></div>
      <header className="page-header">
  <div className="crumb">
    HR-NET AI CINEMA / {projectName.toUpperCase()}
    <h1>{page}</h1>
    <p>
      {page === 'Dola Studio' ? <section className="module-page">
        <div className="module-hero"><div><span className="module-kicker">AI PROVIDER / WEB WORKFLOW</span><h2>Dola Studio</h2><p>Panel khusus Dola di HR-NET AI CINEMA untuk menyiapkan prompt, rangkaian scene, continuity, dan membuka Dola AI.</p></div><div className="hero-actions"><a className="module-primary" href="https://www.dola.com/chat/" target="_blank" rel="noopener noreferrer">BUKA DOLA AI ↗</a></div></div>
        <div className="generation-settings-box">
          <div className="controls-title"><span className="step">01</span><div><h2>Dola Quick Setup</h2><small>Gunakan scene aktif HR-NET, lalu salin prompt ke Dola.</small></div></div>
          <div className="control-grid">
            <div className="field"><label>SCENE TITLE</label><input value={sceneTitle} onChange={e => setSceneTitle(e.target.value)} placeholder="Contoh: F41 tiba di pelabuhan Merak" /></div>
            <div className="field"><label>DURATION</label><div className="small-pills">{[15,30,45,60].map(x => <button key={x} className={duration === x ? 'selected' : ''} onClick={() => setDuration(x)}>{x}s</button>)}</div></div>
            <div className="field"><label>ASPECT RATIO</label><div className="small-pills">{['9:16','16:9','1:1'].map(x => <button key={x} className={ratio === x ? 'selected' : ''} onClick={() => setRatio(x)}>{x}</button>)}</div></div>
            <div className="field"><label>RESOLUTION</label><div className="small-pills">{['720p','1080p'].map(x => <button key={x} className={resolution === x ? 'selected' : ''} onClick={() => setResolution(x)}>{x}</button>)}</div></div>
          </div>
        </div>
        <div className="generation-settings-box">
          <div className="controls-title"><span className="step">02</span><div><h2>Prompt Dola</h2><small>Prompt mengikuti Character Lock, Vehicle Lock, Location Lock, Position Lock dan reference aktif.</small></div></div>
          <textarea value={prompt} readOnly rows={8} style={{width:'100%',resize:'vertical'}} />
          <div className="settings-actions">
            <button className="module-primary" onClick={() => { void copyPrompt(); }}>📋 SALIN PROMPT DOLA</button>
            <button className="module-secondary" onClick={() => { buildDolaLongVideoPlan(duration); }}>✦ BUAT RANGKAIAN</button>
            <a className="module-secondary" href="https://www.dola.com/chat/" target="_blank" rel="noopener noreferrer">▶ BUKA DOLA</a>
          </div>
        </div>
        {duration > 15 && <div className="generation-settings-box">
          <div className="controls-title"><span className="step">03</span><div><h2>Dola Long Video Queue</h2><small>{duration} detik = {Math.ceil(duration/15)} scene × 15 detik. Generate tiap scene di Dola, lalu masukkan hasilnya ke Video Merger.</small></div></div>
          <div className="asset-grid">{(longVideoPlan.length ? longVideoPlan : Array.from({length:Math.ceil(duration/15)},(_,i)=>({index:i+1,total:Math.ceil(duration/15),duration:15,title:`Scene ${i+1}`,prompt:'Klik BUAT RANGKAIAN.',status:'pending'}))).map(s => { const clip = getDolaSegmentClip(s.index); return <div className="asset-card" key={s.index}><div className="asset-head"><span>SCENE {String(s.index).padStart(2,'0')}</span><b>{clip ? 'UPLOADED' : s.status === 'completed' ? 'DONE' : s.status === 'copied' ? 'READY' : 'PENDING'}</b></div><small>{s.title}</small>{longVideoPlan.length > 0 && <p style={{fontSize:12,lineHeight:1.5}}>{s.prompt}</p>}<div style={{marginTop:10,padding:10,border:'1px solid rgba(255,255,255,.08)',borderRadius:10}}><small>{clip ? `✓ ${clip.name} • ${formatFileSize(clip.file.size)}${longVideoPlan.find(x => x.index === s.index)?.cloudStatus === 'uploaded' ? ' • ☁ CLOUD' : ''}` : 'Hasil video Dola belum dimasukkan.'}</small><div className="settings-actions" style={{marginTop:8}}><label className="module-secondary" style={{display:'inline-flex',alignItems:'center',cursor:'pointer'}}>＋ MASUKKAN VIDEO<input type="file" accept="video/mp4,video/webm,video/quicktime,video/*" hidden onChange={e=>{const f=e.target.files?.[0]; if(f) attachDolaSegmentVideo(s.index,f); e.currentTarget.value='';}}/></label>{clip && <><button className="module-secondary" onClick={()=>void uploadDolaSegmentToCloud(s.index)}>☁ UPLOAD CLOUD</button><button className="module-secondary" onClick={()=>removeMergeClip(clip.id)}>Hapus</button></>}</div></div></div>})}</div>
          <div className="settings-actions"><button className="module-primary" onClick={() => { buildDolaLongVideoPlan(duration); }}>✦ BUAT RANGKAIAN</button><button className="module-secondary" onClick={() => { void copyNextDolaSegment(); }}>▶ SCENE BERIKUTNYA</button><button className="module-secondary" onClick={() => { void copyDolaLongVideoPlan(); }}>📋 SALIN SEMUA</button>{longVideoPlan.length > 0 && <button className="module-secondary" onClick={markCurrentDolaSegmentCompleted}>✓ TANDAI SELESAI</button>}<button className="module-secondary" onClick={() => setPage('Video Merger')}>🎬 VIDEO MERGER →</button></div>
        </div>}
        {duration > 15 && <div className="generation-settings-box"><div className="controls-title"><span className="step">04</span><div><h2>Dola Result Manager</h2><small>Pastikan semua scene sudah masuk sebelum merger. Scene yang terunggah langsung ditandai dan siap digunakan.</small></div></div><div className="asset-grid"><div className="asset-card"><b>STATUS</b><small>{mergeClips.filter(c => c.sourceScene).length}/{Math.ceil(duration/15)} scene sudah dimasukkan</small></div><div className="asset-card"><b>QUEUE</b><small>{mergeClips.length}/4 clip • urutan merger otomatis berdasarkan Scene</small></div><div className="asset-card"><b>OUTPUT</b><small>{duration}s target • {mergeClips.length === Math.ceil(duration/15) ? 'SIAP MERGER' : 'MENUNGGU SCENE'}</small></div></div><div className="settings-actions" style={{marginTop:10}}><button className="module-primary" onClick={()=>void finalizeDolaWorkflow()}>✓ SELESAIKAN PROSES DOLA</button><button className="module-secondary" onClick={()=>setPage('Video Merger')}>🎬 BUKA VIDEO MERGER</button><button className="module-secondary" onClick={()=>{if(mergeClips.length===Math.ceil(duration/15)) setStatus('✓ Semua hasil Dola siap untuk Video Merger.'); else setStatus(`Masih menunggu ${Math.ceil(duration/15)-mergeClips.length} scene.`);}}>✓ CEK KELENGKAPAN</button></div></div>}
        <div className="generation-settings-box"><div className="controls-title"><span className="step">05</span><div><h2>Dola Cloud Library</h2><small>Scene yang sudah tersimpan di bucket <b>hrnet-videos</b>. Gunakan kembali langsung ke Video Merger.</small></div><button className="module-secondary" onClick={() => void loadDolaCloudLibrary()} disabled={isLoadingDolaCloud}>{isLoadingDolaCloud ? 'MEMUAT…' : '↻ REFRESH CLOUD'}</button></div>
          {!userId ? <div className="library-empty"><b>Login diperlukan.</b><small>Masuk ke akun Supabase untuk melihat Scene Dola yang tersimpan di Cloud.</small></div> : <>
            <div className="asset-grid">{dolaCloudScenes.map(item => <article className="asset-card" key={item.path}>
              <div className="asset-head"><span>{item.sceneNumber ? `SCENE ${String(item.sceneNumber).padStart(2,'0')}` : 'DOLA'}</span><b>☁ CLOUD</b></div>
              {item.signedUrl ? <video src={item.signedUrl} controls muted preload="metadata" style={{width:'100%',borderRadius:12,margin:'8px 0'}} /> : <div className="library-empty" style={{margin:'8px 0'}}><small>Preview signed URL tidak tersedia.</small></div>}
              <small>{item.name}</small><small>{formatFileSize(item.size)}{item.updatedAt ? ` • ${new Date(item.updatedAt).toLocaleString('id-ID')}` : ''}</small>
              <div className="settings-actions" style={{marginTop:8}}><button className="module-primary" onClick={() => void useDolaCloudScene(item)} disabled={!item.signedUrl}>🎬 PAKAI KE MERGER</button></div>
            </article>)}{!dolaCloudScenes.length && <div className="library-empty"><b>Dola Cloud Library kosong.</b><small>Upload Scene dari Dola Studio terlebih dahulu.</small></div>}</div>
            {dolaCloudMessage && <div className="settings-message">{dolaCloudMessage}</div>}
          </>}
        </div>
        <div className="generation-settings-box"><div className="controls-title"><span className="step">06</span><div><h2>Dola Completion</h2><small>Final check: semua scene, merger, Cloud, dan History.</small></div></div><div className="asset-grid"><div className="asset-card"><b>SCENE</b><small>{mergeClips.filter(c => c.sourceScene).length}/{Math.ceil(duration/15)} lengkap</small></div><div className="asset-card"><b>MERGER</b><small>{mergedVideoUrl ? '✓ Video final tersedia' : 'Belum digabung'}</small></div><div className="asset-card"><b>CLOUD</b><small>{history.some(h => h.model === 'Video Merger' && h.status === 'completed') ? '✓ Final tersimpan' : 'Belum disimpan'}</small></div></div><div className="settings-actions" style={{marginTop:10}}><button className="module-primary" onClick={()=>void finalizeDolaWorkflow()}>✓ SELESAIKAN PROSES DOLA</button>{mergedVideoUrl && <button className="module-secondary" onClick={()=>void saveMergedVideoToCloud()}>☁ SIMPAN FINAL KE CLOUD + HISTORY</button>}</div></div><div className="generation-settings-box"><div className="controls-title"><span className="step">06</span><div><h2>Workflow Dola HR-NET</h2><small>1. Buat prompt → 2. Salin ke Dola → 3. Generate → 4. Masukkan hasil per Scene → 5. Cek Result Manager → 6. Video Merger → 7. Simpan Cloud.</small></div></div><div className="asset-grid"><div className="asset-card"><b>REFERENCE</b><small>{referenceCount} image • {audioReference ? 'audio siap' : 'tanpa audio'} • {videoReference ? 'video siap' : 'tanpa video'}</small></div><div className="asset-card"><b>CONTINUITY</b><small>{characterLock && vehicleLock && locationLock && positionLock ? 'Semua lock aktif' : 'Sebagian lock aktif'}</small></div><div className="asset-card"><b>OUTPUT</b><small>{duration}s • {ratio} • {resolution}</small></div></div></div>
      </section> : page === 'Generate Video'
        ? 'Generator video sinematik dengan reference workflow, continuity lock, dan generation history.'
        : page === 'Dashboard'
          ? 'Pusat kendali produksi: kuota, aktivitas, project, dan akses cepat ke workflow.'
          : page === 'AI Agent'
            ? 'Asisten AI untuk ide, cerita, prompt, storyboard, dan workflow produksi.'
            : 'Kelola semua produksi HR-NET AI CINEMA.'}
    </p>
  </div>

  <div className="header-status">
    <span className="status-dot" />
    Sistem siap

   <span
    style={{
      marginLeft: '14px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      color: '#dbeafe',
      fontSize: '12px',
      fontWeight: 600,
    }}
  >
          <span>ID</span>
    <span>{memberName || memberEmail || 'Member'}</span>
  </span>

  <a
    href="/auth/logout"
    style={{
      marginLeft: '12px',
      padding: '7px 14px',
      border: '1px solid rgba(80, 150, 255, 0.35)',
      borderRadius: '7px',
      background: 'rgba(20, 45, 80, 0.8)',
      color: '#dbeafe',
      textDecoration: 'none',
      fontSize: '12px',
      fontWeight: 600,
    }}
  >
    Logout
  </a>
</div>
</header>

      {page === 'Dashboard' ? <section className="dashboard-page">
        <div className="dashboard-hero">
          <div>
            <span className="dashboard-kicker">HR-NET AI CINEMA / COMMAND CENTER</span>
            <h2>Selamat datang di workspace produksi.</h2>
            <p>Pantau kapasitas generation, aktivitas terakhir, dan lanjutkan pekerjaan tanpa membuka modul satu per satu.</p>
          </div>
          <div className="dashboard-hero-actions">
            <button className="dash-primary" onClick={() => setPage('Generate Video')}>＋ Buat Scene</button>
            <button className="dash-secondary" onClick={() => setPage('AI Agent')}>✦ AI Agent</button>
          </div>
        </div>

        <div className="dashboard-stats">
          <article><span>GENERATION / 24 JAM</span><strong>{availableSlots}<small>/ 12</small></strong><div className="dash-meter"><i style={{width:`${(availableSlots / 12) * 100}%`}}/></div><b>{usedSlots24h} slot terpakai</b></article>
          <article><span>TOTAL HISTORY</span><strong>{history.length}</strong><b>{completedCount} berhasil • {failedCount} gagal</b></article>
          <article><span>REFERENCE AKTIF</span><strong>{referenceCount}<small>/ {referenceSlots}</small></strong><b>Siap untuk continuity</b></article>
          <article><span>PROJECT</span><strong>01</strong><b>{projectName}</b></article>
        </div>

        <div className="dashboard-grid">
          <section className="dashboard-card dashboard-activity">
            <div className="dashboard-card-head"><div><span>01</span><div><h3>Aktivitas produksi</h3><p>Generation terakhir di workspace ini.</p></div></div><button onClick={() => setPage('Generate Video')}>Buka Generator →</button></div>
            {history.length === 0 ? <div className="dashboard-empty"><div>▣</div><b>Belum ada generation.</b><small>Buat scene pertama untuk mulai mengisi dashboard.</small><button onClick={() => setPage('Generate Video')}>Mulai Generate</button></div> : <div className="dashboard-history">{history.slice(0,6).map(item => <button className="dashboard-history-row" key={item.id} onClick={() => { setSceneTitle(item.title); setAction(item.prompt); setModel(item.model); setDuration(item.duration); setRatio(item.ratio); setResolution(item.resolution); setGeneratedPrompt(item.prompt); setPage('Generate Video'); setStatus('Scene dimuat dari history.'); }}>
              <div className="history-thumb">{item.videoUrl ? <video src={item.videoUrl} muted /> : <span>▣</span>}</div>
              <div className="history-main"><b>{item.title}</b><small>{item.model} • {item.duration}s • {item.ratio} • {item.resolution}</small><span>{new Date(item.createdAt).toLocaleString('id-ID', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</span></div>
              <em className={item.status === 'completed' ? 'history-ok' : 'history-fail'}>{item.status === 'completed' ? 'DONE' : 'FAIL'}</em>
            </button>)}</div>}
          </section>

          <aside className="dashboard-side">
            <section className="dashboard-card"><div className="dashboard-card-head compact"><div><span>02</span><div><h3>Engine usage</h3><p>Distribusi history per model.</p></div></div></div><div className="engine-bars"><div><label><b>Seedance 2.5</b><span>{seedanceCount}</span></label><div><i style={{width:`${history.length ? (seedanceCount / history.length) * 100 : 0}%`}}/></div></div><div><label><b>WAN 3.0</b><span>{wanCount}</span></label><div><i style={{width:`${history.length ? (wanCount / history.length) * 100 : 0}%`}}/></div></div></div></section>
            <section className="dashboard-card quick-card"><div className="dashboard-card-head compact"><div><span>03</span><div><h3>Akses cepat</h3><p>Masuk langsung ke modul utama.</p></div></div></div><button onClick={() => setPage('Character Library')}>◈ Character Library <b>→</b></button><button onClick={() => setPage('Vehicle Library')}>◈ Vehicle Library <b>→</b></button><button onClick={() => setPage('Location Library')}>◈ Location Library <b>→</b></button><button onClick={() => setPage('Subscription')}>◆ Subscription <b>→</b></button></section>
          </aside>
        </div>

        <section className="dashboard-card dashboard-next"><div className="dashboard-card-head compact"><div><span>04</span><div><h3>Status produksi</h3><p>Ringkasan kondisi workspace saat ini.</p></div></div></div><div className="production-checks"><div><i>✓</i><b>Engine</b><span>Seedance 2.5 / WAN 3.0 siap</span></div><div><i>✓</i><b>Continuity</b><span>Character, Vehicle, Location, Position Lock tersedia</span></div><div><i>✓</i><b>Reference</b><span>{referenceCount ? `${referenceCount} referensi aktif` : 'Belum ada referensi aktif'}</span></div><div><i>{lastGeneration ? '✓' : '—'}</i><b>History</b><span>{lastGeneration ? `Terakhir: ${lastGeneration.title}` : 'Belum ada aktivitas'}</span></div></div></section>
      </section> : page === 'AI Agent' ?
        <section className="agent-page">
        <div className="agent-hero">
          <span className="agent-kicker"><i/> HR-NET AI AGENT</span>
          <h2>Butuh bantuan AI untuk produksi?</h2>
          <p>Gunakan ChatGPT untuk mengembangkan ide, menyusun cerita, memperbaiki prompt, membuat storyboard, dan menyiapkan workflow produksi sebelum kembali ke HR-NET AI CINEMA.</p>
          <a className="chatgpt-open" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Buka ChatGPT ↗</a>
        </div>
        <div className="agent-cards">
          <div><span>01</span><b>IDE & CERITA</b><p>Kembangkan premis, karakter, konflik, dialog, dan struktur adegan.</p></div>
          <div><span>02</span><b>PROMPT CINEMATIC</b><p>Gunakan ChatGPT untuk menyempurnakan prompt sebelum generate.</p></div>
          <div><span>03</span><b>WORKFLOW PRODUKSI</b><p>Rancang storyboard, shot list, continuity, dan urutan scene.</p></div>
        </div>
        <div className="agent-note"><strong>Catatan:</strong> ChatGPT dibuka di tab baru. HR-NET tidak mengambil alih akun atau sesi ChatGPT Anda.</div>
        </section> : page === 'Subscription' ? <section className="subscription-page subscription-v2">
        <div className="subscription-status">
          <div className="status-plan"><span className="status-kicker">PAKET AKTIF</span><strong>PRO</strong><span>Aktif sampai 30 Oktober 2026</span></div>
          <div className="expiry"><small>SISA MASA AKTIF</small><b>30 hari</b><div className="expiry-track"><span style={{width:'78%'}}/></div></div>
        </div>

        <div className="subscription-hero">
          <div><span className="hero-kicker">HR-NET AI CINEMA / MEMBERSHIP</span><h2>Bangun produksi sinematik Anda.</h2><p>Satu paket bulanan untuk workflow video, gambar, reference, project, dan continuity — tanpa tarif per generate.</p></div>
          <div className="hero-meter"><span>GENERATION WINDOW</span><strong>12</strong><small>slot / rolling 24 jam</small><div><i style={{width:'100%'}}/></div><b>12 slot tersedia</b></div>
        </div>

        <div className="subscription-section-head"><div><span className="section-number">01</span><div><h2>Pilih masa produksi</h2><p>Semakin panjang masa aktif, semakin rendah biaya rata-rata per bulan.</p></div></div><span className="design-note">COMMERCIAL DESIGN</span></div>

        <div className="term-list">
          <article className="term-row selected">
            <div className="term-duration"><span>30</span><small>HARI</small></div>
            <div className="term-main"><span className="term-label">MONTHLY / FLEKSIBEL</span><h3>Rp 249.000 <small>/ bulan</small></h3><p>Perpanjang kapan saja • 12 generation / rolling 24 jam</p></div>
            <div className="term-benefit"><b>PAKET SAAT INI</b><span>Seedance 2.5 • WAN 3.0</span></div>
            <button onClick={() => setStatus('Paket 1 bulan dipilih — pembayaran belum terhubung.')}>Perpanjang 30 hari</button>
          </article>
          <article className="term-row">
            <div className="term-duration"><span>180</span><small>HARI</small></div>
            <div className="term-main"><span className="term-label">6 BULAN / HEMAT 20%</span><h3>Rp 1.197.000 <small>total</small></h3><p>Setara Rp 199.500 / bulan • masa aktif 180 hari</p></div>
            <div className="term-benefit"><b>+ PRIORITAS</b><span>Sisa hari tidak hangus • fitur baru</span></div>
            <button onClick={() => setStatus('Paket 6 bulan dipilih — pembayaran belum terhubung.')}>Pilih 6 bulan</button>
          </article>
          <article className="term-row">
            <div className="term-duration"><span>365</span><small>HARI</small></div>
            <div className="term-main"><span className="term-label">TAHUNAN / HEMAT 33%</span><h3>Rp 1.997.000 <small>total</small></h3><p>Setara Rp 166.416 / bulan • masa aktif 365 hari</p></div>
            <div className="term-benefit"><b>+ VALUE</b><span>Sisa hari tidak hangus • fitur baru</span></div>
            <button onClick={() => setStatus('Paket 1 tahun dipilih — pembayaran belum terhubung.')}>Pilih 1 tahun</button>
          </article>
        </div>

        <div className="subscription-section-head compact"><div><span className="section-number">02</span><div><h2>Apa yang termasuk?</h2><p>Hak akses utama yang diterima selama paket aktif.</p></div></div></div>
        <div className="benefit-board">
          <div><span>01</span><b>GENERATION</b><p>12 slot setiap rolling 24 jam. Menyusun prompt dan scene tidak mengurangi kuota.</p></div>
          <div><span>02</span><b>VIDEO ENGINE</b><p>Seedance 2.5 dan WAN 3.0 sebagai engine video utama.</p></div>
          <div><span>03</span><b>REFERENCE</b><p>Workflow reference image untuk karakter, kendaraan, lokasi, dan continuity.</p></div>
          <div><span>04</span><b>PROJECT</b><p>Project, scene, dan generation history tersimpan dalam workspace.</p></div>
          <div><span>05</span><b>CONTINUITY</b><p>Character Lock, Vehicle Lock, Location Lock, dan Position Lock.</p></div>
          <div><span>06</span><b>FAIR USE</b><p>Batas concurrent generation dan storage dapat diterapkan agar layanan stabil.</p></div>
        </div>

        <div className="usage-flow"><div><span>1</span><b>Rancang</b><small>Prompt, character, reference, scene</small></div><div><span>2</span><b>Generate</b><small>Satu klik menggunakan 1 slot</small></div><div><span>3</span><b>Produksi</b><small>Hasil masuk ke history & project</small></div></div>
        <div className="subscription-footer-note">Pembayaran belum terhubung pada tahap desain. Dengan melanjutkan pembayaran, pengguna menyetujui <u>Syarat & Ketentuan</u> dan <u>Kebijakan Privasi</u>.</div>
      </section> : page === 'Generate Gambar' ? <section className="module-page">
        <div className="module-hero"><div><span className="module-kicker">01 / IMAGE STUDIO</span><h2>Generate Gambar</h2><p>Buat prompt gambar yang konsisten untuk character sheet, keyframe, poster, lokasi, dan reference produksi.</p></div><button className="module-primary" onClick={() => { const x = buildImagePrompt(); void navigator.clipboard?.writeText(x); }}>✦ Buat & Salin Prompt</button></div>
        <div className="module-grid two">
          <section className="module-card"><div className="module-card-head"><div><b>DESKRIPSI GAMBAR</b><small>Jelaskan subjek, aksi, kamera, lingkungan, dan suasana.</small></div></div><textarea className="module-textarea" value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="Contoh: portrait sinematik F41 berdiri di pelabuhan saat matahari terbenam, kamera medium full body..." />
            <div className="image-ref-row"><label className="upload-image-mini"><input type="file" accept="image/*" onChange={e => { const f=e.target.files?.[0]; if(!f) return; if(f.size>5*1024*1024){setError('Reference maksimal 5 MB.');return;} const r=new FileReader(); r.onload=()=>{setImageReference(String(r.result));setImageReferenceName(f.name);setError('');};r.readAsDataURL(f); }} /><span>＋</span><div><b>{imageReferenceName || 'Tambah reference image'}</b><small>{imageReferenceName ? 'Reference aktif' : 'Opsional'}</small></div></label>{imageReference && <button className="clear-btn" onClick={() => {setImageReference('');setImageReferenceName('');}}>Hapus</button>}</div>
            {imageGeneratedPrompt && <div className="generated-box"><div className="asset-head"><span>GENERATED IMAGE PROMPT</span><button onClick={() => {void navigator.clipboard?.writeText(imageGeneratedPrompt);setStatus('Prompt gambar disalin.')}}>Copy</button></div><p>{imageGeneratedPrompt}</p></div>}
          </section>
          <aside className="module-card"><div className="module-card-head"><div><b>IMAGE SETTINGS</b><small>Kontrol output sebelum prompt dibuat.</small></div></div><label className="module-field"><span>STYLE</span><select value={imageStyle} onChange={e=>setImageStyle(e.target.value)}><option>Cinematic Realistic</option><option>3D Character</option><option>Concept Art</option><option>Studio Portrait</option><option>Photorealistic</option></select></label><label className="module-field"><span>ASPECT RATIO</span><div className="small-pills">{['1:1','3:4','4:3','9:16','16:9','21:9'].map(x=><button key={x} className={imageRatio===x?'selected':''} onClick={()=>setImageRatio(x)}>{x}</button>)}</div></label><label className="module-field"><span>RESOLUTION</span><div className="small-pills">{['720p','1080p','4K'].map(x=><button key={x} className={imageResolution===x?'selected':''} onClick={()=>setImageResolution(x)}>{x}</button>)}</div></label><button className="module-primary wide" onClick={buildImagePrompt}>Generate Prompt Gambar</button><button className="module-secondary wide" onClick={()=>saveScene('image')}>＋ Simpan ke Scene Library</button></aside>
        </div>
        <div className="module-card module-tip"><b>WORKFLOW</b><span>Prompt gambar → simpan ke Scene Library → gunakan hasil gambar sebagai reference di Generate Video.</span><button onClick={()=>setPage('Generate Video')}>Buka Generate Video →</button></div>
      </section> : page === 'Character Library' ? <section className="module-page">
        <div className="module-hero compact"><div><span className="module-kicker">02 / ASSET LIBRARY</span><h2>Character Library</h2><p>Simpan karakter agar dapat dipilih langsung di continuity workflow.</p></div></div>
        <section className="module-card"><div className="module-card-head"><div><b>{editingCharacterId ? 'EDIT CHARACTER' : 'NEW CHARACTER'}</b><small>Reference image dan Identity Lock disimpan di workspace project ini.</small></div></div><div className="asset-form"><input value={assetName} onChange={e=>setAssetName(e.target.value)} placeholder="Nama karakter..."/><input value={assetDescription} onChange={e=>setAssetDescription(e.target.value)} placeholder="Deskripsi wajah / karakter..."/><textarea className="module-textarea" value={characterVisualDetails} onChange={e=>setCharacterVisualDetails(e.target.value)} placeholder="Detail visual: rambut, pakaian, aksesori, ciri khas..."/><label className="upload-image-mini"><input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0]; if(!f)return; if(f.size>20*1024*1024){setError('Reference karakter maksimal 20 MB.');return;} const r=new FileReader(); r.onload=()=>{setCharacterReference(String(r.result));setCharacterReferenceName(f.name);setError('');setStatus('Reference karakter siap disimpan.');}; r.readAsDataURL(f); e.currentTarget.value='';}}/><span>＋</span><div><b>{characterReferenceName || 'Tambah reference image karakter'}</b><small>{characterReferenceName ? 'Reference aktif' : 'Opsional'}</small></div></label><label className="module-field"><span>IDENTITY LOCK</span><button type="button" className={characterIdentityLock ? 'selected' : ''} onClick={()=>setCharacterIdentityLock(v=>!v)}>🔒 {characterIdentityLock ? 'AKTIF' : 'NONAKTIF'}</button></label><div className="settings-actions"><button className="module-primary" onClick={()=>editingCharacterId ? updateCharacter() : addAsset('character')}>{editingCharacterId ? 'Simpan Perubahan' : '＋ Simpan Karakter'}</button>{editingCharacterId && <button className="module-secondary" onClick={()=>{setEditingCharacterId(null);setAssetName('');setAssetDescription('');setCharacterReference('');setCharacterReferenceName('');setCharacterVisualDetails('');setCharacterIdentityLock(true);}}>Batal</button>}</div></div></section>
        <div className="library-grid">{characters.length ? characters.map(a=><article className="library-card" key={a.id}>{a.reference ? <img src={a.reference} alt={a.name} style={{width:'100%',aspectRatio:'16/10',objectFit:'cover',borderRadius:12,marginBottom:12}}/> : <div className="library-empty" style={{minHeight:120,marginBottom:12}}><small>Belum ada reference image</small></div>}<span>CHARACTER {a.identityLock !== false ? '• IDENTITY LOCK' : ''}</span><h3>{a.name}</h3><p>{a.description}</p>{a.visualDetails && <small style={{display:'block',marginBottom:10}}>{a.visualDetails}</small>}<div className="settings-actions"><button onClick={()=>editCharacter(a)}>Edit</button><button onClick={()=>{toggleCharacter(a.name);setPage('Generate Video');setStatus(`${a.name} dipilih untuk scene.`);}}>Pakai di Scene</button><button onClick={()=>removeAsset('character',a.id)}>Hapus</button></div></article>) : <div className="library-empty"><b>Belum ada karakter.</b><small>Tambahkan karakter pertama untuk mengaktifkan continuity selection.</small></div>}</div>
      </section> : page === 'Vehicle Library' ? <section className="module-page">
        <div className="module-hero compact"><div><span className="module-kicker">03 / ASSET LIBRARY</span><h2>Vehicle Library</h2><p>Simpan reference kendaraan, detail visual, dan Vehicle Lock untuk continuity.</p></div></div>
        <section className="module-card">
          <div className="module-card-head"><div><b>{editingVehicleId ? 'EDIT VEHICLE' : 'NEW VEHICLE'}</b><small>Reference image, detail kendaraan, dan Vehicle Lock disimpan di workspace project ini.</small></div></div>
          <div className="asset-form">
            <input value={assetName} onChange={e=>setAssetName(e.target.value)} placeholder="Nama kendaraan..."/>
            <input value={assetDescription} onChange={e=>setAssetDescription(e.target.value)} placeholder="Model, warna, tipe, dan ciri visual..."/>
            <textarea className="module-textarea" value={vehicleVisualDetails} onChange={e=>setVehicleVisualDetails(e.target.value)} placeholder="Detail visual: bentuk bodi, lampu, velg, grafis, bumper, kaca, aksesori, kondisi kendaraan..."/>
            <label className="upload-image-mini">
              <input type="file" accept="image/*" onChange={e=>{
                const f=e.target.files?.[0];
                if(!f)return;
                if(f.size>20*1024*1024){setError('Reference kendaraan maksimal 20 MB.');return;}
                const r=new FileReader();
                r.onload=()=>{setVehicleReference(String(r.result));setVehicleReferenceName(f.name);setError('');setStatus('Reference kendaraan siap disimpan.');};
                r.readAsDataURL(f);
                e.currentTarget.value='';
              }}/>
              <span>＋</span>
              <div><b>{vehicleReferenceName || 'Tambah reference image kendaraan'}</b><small>{vehicleReferenceName ? 'Reference aktif' : 'Opsional'}</small></div>
            </label>
            <label className="module-field"><span>VEHICLE LOCK</span><button type="button" className={vehicleLockEnabled ? 'selected' : ''} onClick={()=>setVehicleLockEnabled(v=>!v)}>🔒 {vehicleLockEnabled ? 'AKTIF' : 'NONAKTIF'}</button></label>
            <div className="settings-actions">
              <button className="module-primary" onClick={()=>editingVehicleId ? updateVehicle() : addAsset('vehicle')}>{editingVehicleId ? 'Simpan Perubahan' : '＋ Simpan Kendaraan'}</button>
              {editingVehicleId && <button className="module-secondary" onClick={()=>{setEditingVehicleId(null);setAssetName('');setAssetDescription('');setVehicleReference('');setVehicleReferenceName('');setVehicleVisualDetails('');setVehicleLockEnabled(true);}}>Batal</button>}
            </div>
          </div>
        </section>
        <div className="library-grid">
          {vehicles.length ? vehicles.map(a=><article className="library-card" key={a.id}>
            <span>VEHICLE {a.identityLock !== false ? '• LOCK' : ''}</span>
            {a.reference && <img className="library-card-image" src={a.reference} alt={`Reference ${a.name}`} />}
            <h3>{a.name}</h3>
            <p>{a.description}</p>
            {a.visualDetails && <small>{a.visualDetails}</small>}
            <div className="library-card-actions">
              <button onClick={()=>{setSelectedVehicle(a.name);setVehicleLock(a.identityLock !== false);setPage('Generate Video');setStatus(`Kendaraan ${a.name} dipakai di Scene.`);}}>Pakai di Scene</button>
              <button onClick={()=>editVehicle(a)}>Edit</button>
              <button onClick={()=>removeAsset('vehicle',a.id)}>Hapus</button>
            </div>
          </article>) : <div className="library-empty"><b>Belum ada kendaraan.</b><small>Tambahkan kendaraan untuk workflow Vehicle Lock.</small></div>}
        </div>
      </section> : page === 'Location Library' ? <section className="module-page">
        <div className="module-hero compact"><div><span className="module-kicker">04 / ASSET LIBRARY</span><h2>Location Library</h2><p>Simpan reference lokasi, lingkungan, waktu, cuaca, dan elemen yang harus tetap konsisten.</p></div></div>
        <section className="module-card">
          <div className="module-card-head"><div><b>{editingLocationId ? 'EDIT LOCATION' : 'NEW LOCATION'}</b><small>Reference image dan detail lokasi disimpan di workspace project ini.</small></div></div>
          <div className="asset-form">
            <input value={assetName} onChange={e=>setAssetName(e.target.value)} placeholder="Nama lokasi..."/>
            <input value={assetDescription} onChange={e=>setAssetDescription(e.target.value)} placeholder="Deskripsi singkat lokasi..."/>
            <label className="upload-image-mini">
              <input type="file" accept="image/*" onChange={e=>{ const f=e.target.files?.[0]; if(!f)return; if(f.size>20*1024*1024){setError('Reference lokasi maksimal 20 MB.');return;} const r=new FileReader(); r.onload=()=>{setLocationReference(String(r.result));setLocationReferenceName(f.name);setError('');setStatus('Reference lokasi siap disimpan.');}; r.readAsDataURL(f); e.currentTarget.value=''; }}/>
              <span>＋</span><div><b>{locationReferenceName || 'Tambah reference image lokasi'}</b><small>{locationReferenceName ? 'Reference aktif' : 'Opsional'}</small></div>
            </label>
            <textarea className="module-textarea" value={locationEnvironment} onChange={e=>setLocationEnvironment(e.target.value)} placeholder="Lingkungan: desa, pelabuhan, hutan, jalan, bangunan, sungai, tata letak..."/>
            <div className="asset-form"><input value={locationTime} onChange={e=>setLocationTime(e.target.value)} placeholder="Waktu: pagi, siang, sore, malam..."/><input value={locationWeather} onChange={e=>setLocationWeather(e.target.value)} placeholder="Cuaca: cerah, mendung, hujan, berkabut..."/></div>
            <textarea className="module-textarea" value={locationElements} onChange={e=>setLocationElements(e.target.value)} placeholder="Elemen yang harus dipertahankan: jalan, pohon, bangunan, kendaraan, papan nama, posisi objek..."/>
            <label className="module-field"><span>LOCATION LOCK</span><button type="button" className={locationLock ? 'selected' : ''} onClick={()=>setLocationLock(v=>!v)}>🔒 {locationLock ? 'AKTIF' : 'NONAKTIF'}</button></label>
            <div className="settings-actions"><button className="module-primary" onClick={()=>editingLocationId ? updateLocation() : addAsset('location')}>{editingLocationId ? 'Simpan Perubahan' : '＋ Simpan Lokasi'}</button>{editingLocationId && <button className="module-secondary" onClick={()=>{setEditingLocationId(null);setAssetName('');setAssetDescription('');setLocationReference('');setLocationReferenceName('');setLocationEnvironment('');setLocationTime('');setLocationWeather('');setLocationElements('');setLocationLock(true);}}>Batal</button>}</div>
          </div>
        </section>
        <div className="library-grid">{locations.length ? locations.map(a=><article className="library-card" key={a.id}><span>LOCATION {a.identityLock !== false ? '• LOCK' : ''}</span>{a.reference && <img className="library-card-image" src={a.reference} alt={`Reference ${a.name}`} />}<h3>{a.name}</h3><p>{a.description}</p>{a.visualDetails && <small>{a.visualDetails}</small>}<div className="library-card-actions"><button onClick={()=>{setSelectedLocation(a.name);setLocationLock(a.identityLock !== false);setPage('Generate Video');setStatus(`Lokasi ${a.name} dipakai di Scene.`);}}>Pakai di Scene</button><button onClick={()=>editLocation(a)}>Edit</button><button onClick={()=>removeAsset('location',a.id)}>Hapus</button></div></article>) : <div className="library-empty"><b>Belum ada lokasi.</b><small>Tambahkan lokasi untuk workflow Location Lock.</small></div>}</div>
      </section> : page === 'Scene Builder' ? <section className="module-page">
        <div className="module-hero"><div><span className="module-kicker">05 / SCENE BUILDER</span><h2>Scene Builder</h2><p>Gabungkan Character + Vehicle + Location + Position Lock menjadi satu scene yang siap dipakai ulang.</p></div><button className="module-secondary" onClick={resetSceneBuilder}>Reset Builder</button></div>
        <div className="module-grid two">
          <section className="module-card">
            <div className="module-card-head"><div><b>SCENE IDENTITY</b><small>Tentukan judul, aksi utama, dan asset continuity.</small></div></div>
            <label className="module-field"><span>SCENE TITLE</span><input value={sceneBuilderTitle} onChange={e=>setSceneBuilderTitle(e.target.value)} placeholder="Contoh: F41 Tiba di Pelabuhan Merak" /></label>
            <label className="module-field"><span>ACTION / STORY BEAT</span><textarea className="module-textarea" value={sceneBuilderAction} onChange={e=>setSceneBuilderAction(e.target.value)} placeholder="Contoh: F41 turun dari kendaraan, berjalan menuju dermaga, berhenti sejenak dan mengamati kapal di kejauhan..." /></label>
            <label className="module-field"><span>CHARACTERS</span><div className="chips">{characters.length ? characters.map(c=><button key={c.id} type="button" className={sceneBuilderCharacters.includes(c.name) ? 'chip active' : 'chip'} onClick={()=>setSceneBuilderCharacters(v=>v.includes(c.name)?v.filter(x=>x!==c.name):[...v,c.name])}>{c.name}{c.identityLock !== false ? ' 🔒' : ''}</button>) : <small>Belum ada karakter. Tambahkan dari Character Library.</small>}</div></label>
            <label className="module-field"><span>VEHICLE</span><select value={sceneBuilderVehicle} onChange={e=>setSceneBuilderVehicle(e.target.value)}><option value="">Tanpa kendaraan</option>{vehicles.map(v=><option key={v.id} value={v.name}>{v.name}{v.identityLock !== false ? ' • LOCK' : ''}</option>)}</select></label>
            <label className="module-field"><span>LOCATION</span><select value={sceneBuilderLocation} onChange={e=>setSceneBuilderLocation(e.target.value)}><option value="">Pilih lokasi...</option>{locations.map(l=><option key={l.id} value={l.name}>{l.name}{l.identityLock !== false ? ' • LOCK' : ''}</option>)}</select></label>
            <label className="module-field"><span>BLOCKING / POSITION</span><textarea className="module-textarea" value={sceneBuilderPosition} onChange={e=>setSceneBuilderPosition(e.target.value)} placeholder="Contoh: F41 di depan, Joy dan Luqman dua langkah di belakang, kendaraan di sisi kiri frame..." /></label>
          </section>
          <aside className="module-card">
            <div className="module-card-head"><div><b>CONTINUITY LOCK</b><small>Kunci yang akan tertanam di prompt scene.</small></div></div>
            <div className="lock-grid">{[["Character Lock",characterLock,setCharacterLock,'Wajah, pakaian, identitas'],["Vehicle Lock",vehicleLock,setVehicleLock,'Bentuk, warna, grafis'],["Location Lock",locationLock,setLocationLock,'Tata letak lingkungan'],["Position Lock",positionLock,setPositionLock,'Blocking & posisi relatif']].map(([n,v,set,desc])=><button key={String(n)} type="button" className={`lock-card ${v?'on':''}`} onClick={()=> (set as (x:boolean)=>void)(!v)}><span className="lock-symbol">{v?'✓':'○'}</span><div><b>{String(n)}</b><small>{String(desc)}</small></div></button>)}</div>
            <div className="asset-card"><div className="asset-head"><span>SCENE SUMMARY</span><b>{sceneBuilderCharacters.length} CHAR • {sceneBuilderVehicle ? '1 VEH' : '0 VEH'} • {sceneBuilderLocation ? '1 LOC' : '0 LOC'}</b></div><p>{sceneBuilderTitle || 'Judul scene belum diisi.'}</p><small>{sceneBuilderAction || 'Aksi scene belum diisi.'}</small></div>
            <div className="generated-box"><div className="asset-head"><span>SCENE PROMPT PREVIEW</span><button onClick={()=>{const x=buildSceneBuilderPrompt();void navigator.clipboard?.writeText(x);setGeneratedPrompt(x);setStatus('Prompt Scene Builder disalin.')}}>Copy</button></div><p>{buildSceneBuilderPrompt() || 'Isi scene untuk melihat prompt gabungan.'}</p></div>
            <div className="settings-actions"><button className="module-primary" onClick={saveSceneFromBuilder}>＋ Simpan Scene</button><button className="module-secondary" onClick={()=>{if(!sceneBuilderAction.trim()){setError('Isi aksi scene terlebih dahulu.');return;} const x=buildSceneBuilderPrompt(); const bv=vehicles.find(v=>v.name===sceneBuilderVehicle); const bl=locations.find(l=>l.name===sceneBuilderLocation); const bcs=charsForBuilder(sceneBuilderCharacters,characters); const refs=[...bcs.map(c=>c.reference),bv?.reference,bl?.reference].filter(Boolean) as string[]; const names=[...bcs.map(c=>c.referenceName||`${c.name} reference`),bv?.referenceName||(bv?`${bv.name} reference`:''),bl?.referenceName||(bl?`${bl.name} reference`:'')].filter(Boolean) as string[]; setReferences([...refs.slice(0,6),...Array(Math.max(0,6-refs.length)).fill('')]); setReferenceNames([...names.slice(0,6),...Array(Math.max(0,6-names.length)).fill('')]); setReferenceSlots(6); setSceneTitle(sceneBuilderTitle.trim()||'Untitled Scene'); setAction(sceneBuilderAction.trim()); setSelectedCharacters([...sceneBuilderCharacters]); setSelectedVehicle(sceneBuilderVehicle); setSelectedLocation(sceneBuilderLocation); setGeneratedPrompt(x); setStatus('Scene dimuat ke Generate Video, termasuk references.'); setPage('Generate Video');}}>Pakai di Generate Video →</button></div>
          </aside>
        </div>
        <div className="module-card module-tip"><b>WORKFLOW</b><span>Library → Scene Builder → Lock continuity → Simpan Scene → Generate Video/Gambar.</span><button onClick={()=>setPage('Scene Library')}>Buka Scene Library →</button></div>
      </section> : page === 'Scene Library' ? <section className="module-page">
        <div className="module-hero compact"><div><span className="module-kicker">05 / SCENE LIBRARY</span><h2>Scene Library</h2><p>Scene tersimpan menjadi sumber kerja ulang untuk video dan gambar.</p></div><button className="module-secondary" onClick={()=>setPage('Generate Video')}>＋ Scene Baru</button></div>
        <div className="scene-library-grid">{scenes.length ? scenes.map(sc=><article className="scene-library-card" key={sc.id}><div><span>{sc.type==='video'?'VIDEO':'IMAGE'}</span><small>{new Date(sc.createdAt).toLocaleString('id-ID')}</small></div><h3>{sc.title}</h3><p>{sc.prompt}</p><div><button onClick={()=>{setAction(sc.prompt);setGeneratedPrompt(sc.prompt);if(sc.characterNames)setSelectedCharacters(sc.characterNames);if(sc.vehicleName)setSelectedVehicle(sc.vehicleName);if(sc.locationName)setSelectedLocation(sc.locationName);if(sc.locks){setCharacterLock(sc.locks.character);setVehicleLock(sc.locks.vehicle);setLocationLock(sc.locks.location);setPositionLock(sc.locks.position);}if(sc.references){const refs=sc.references.slice(0,6);const names=(sc.referenceNames||[]).slice(0,6);setReferences([...refs,...Array(Math.max(0,6-refs.length)).fill('')]);setReferenceNames([...names,...Array(Math.max(0,6-names.length)).fill('')]);setReferenceSlots(6);}setSceneTitle(sc.title);setPage(sc.type==='video'?'Generate Video':'Generate Gambar');setStatus('Scene dimuat dari Scene Library, termasuk references dan continuity lock.')}}>Buka</button><button onClick={()=>setScenes(v=>v.filter(x=>x.id!==sc.id))}>Hapus</button></div></article>) : <div className="library-empty"><b>Scene Library masih kosong.</b><small>Simpan scene dari Generate Video atau Generate Gambar.</small></div>}</div>
      </section> : page === 'Video Merger' ? <section className="module-page">
        <div className="module-hero compact"><div><span className="module-kicker">06 / VIDEO POST-PRODUCTION</span><h2>Video Merger</h2><p>Gabungkan Scene 1–4 hasil Dola menjadi satu file video panjang tanpa mengubah urutan clip.</p></div></div>
        <section className="module-card">
          <div className="module-card-head"><div><b>MERGE QUEUE</b><small>Masukkan 2–4 file video. Urutan dari atas ke bawah menjadi urutan final.</small></div><span>{mergeClips.length}/4 CLIPS</span></div>
          <div className="settings-actions">
            <label className="module-primary" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>＋ Tambah Video<input type="file" accept="video/mp4,video/webm,video/quicktime,video/*" hidden multiple onChange={e=>{const files=Array.from(e.target.files||[]);files.slice(0, Math.max(0,4-mergeClips.length)).forEach(addMergeClip);e.currentTarget.value='';}}/></label>
            <button className="module-secondary" onClick={clearMergeClips} disabled={!mergeClips.length && !mergedVideoUrl}>Bersihkan</button>
            <button className="module-primary" onClick={()=>void mergeVideos()} disabled={isMerging || mergeClips.length < 2}>{isMerging ? `MERGING ${mergeProgress}%` : '▶ GABUNGKAN VIDEO'}</button>
          </div>
          <div className="asset-grid" style={{marginTop:12}}>
            {mergeClips.map((clip,index)=><article className="asset-card" key={clip.id}>
              <div className="asset-head"><span>SCENE {String(index+1).padStart(2,'0')}</span><b>{index===0?'START':index===mergeClips.length-1?'END':'NEXT'}</b></div>
              <video src={clip.url} controls muted style={{width:'100%',borderRadius:12,marginBottom:8}} />
              <small>{clip.name}</small>
              <div className="settings-actions" style={{marginTop:8}}>
                <button className="module-secondary" disabled={index===0} onClick={()=>moveMergeClip(clip.id,-1)}>↑</button>
                <button className="module-secondary" disabled={index===mergeClips.length-1} onClick={()=>moveMergeClip(clip.id,1)}>↓</button>
                <button className="module-secondary" onClick={()=>removeMergeClip(clip.id)}>Hapus</button>
              </div>
            </article>)}
            {!mergeClips.length && <div className="library-empty"><b>Belum ada clip.</b><small>Upload Scene 1, Scene 2, Scene 3, dan Scene 4 dari hasil Dola.</small></div>}
          </div>
          {isMerging && <div className="settings-message">⏳ FFmpeg WebAssembly sedang menggabungkan video… {mergeProgress}%</div>}
          {mergeMessage && <div className="settings-message">{mergeMessage}</div>}
        </section>
        {mergedVideoUrl && <section className="module-card" style={{marginTop:12}}>
          <div className="module-card-head"><div><b>MERGED OUTPUT</b><small>Output final hasil penggabungan semua clip di queue.</small></div><span>MP4</span></div>
          <video controls src={mergedVideoUrl} style={{width:'100%',maxHeight:620,borderRadius:14,background:'#000'}} />
          <div className="settings-actions" style={{marginTop:12}}>
            <button className="module-primary" onClick={downloadMergedVideo}>⬇ DOWNLOAD MP4</button>
            <button className="module-secondary" onClick={()=>void saveMergedVideoToCloud()} disabled={!userId}>☁ SIMPAN KE CLOUD + HISTORY</button>
          </div>
          {!userId && <small className="field-note" style={{display:'block',marginTop:8}}>Login diperlukan untuk menyimpan hasil merger ke bucket <b>hrnet-videos</b>. Download lokal tetap tersedia.</small>}
        </section>}
      </section> : page === 'Timeline' ? <section className="module-page">
        <div className="module-hero compact"><div><span className="module-kicker">06 / PRODUCTION TIMELINE</span><h2>Timeline</h2><p>Urutan kerja project dari scene yang tersimpan dan generation history.</p></div></div>
        <div className="timeline-list">{[...scenes.map(x=>({...x, source:'SCENE'})), ...history.map(x=>({id:x.id,title:x.title,prompt:x.prompt,type:'video' as const,createdAt:x.createdAt,source:'GENERATION'}))].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).map((x,i)=><div className="timeline-item" key={`${x.source}-${x.id}`}><div className="timeline-index">{String(i+1).padStart(2,'0')}</div><div><span>{x.source} • {x.type.toUpperCase()}</span><h3>{x.title}</h3><p>{x.prompt}</p><small>{new Date(x.createdAt).toLocaleString('id-ID')}</small></div></div>)}{!scenes.length && !history.length && <div className="library-empty"><b>Timeline belum memiliki aktivitas.</b><small>Simpan scene atau lakukan generation untuk mengisinya.</small></div>}</div>
      </section> : page === 'Settings' ? <section className="module-page">
        <div className="module-hero compact"><div><span className="module-kicker">07 / WORKSPACE SETTINGS</span><h2>Settings</h2><p>Atur project lokal, project cloud, dan preferensi workspace.</p></div></div>
        <section className="module-card settings-card">
          <label className="module-field"><span>PROJECT NAME</span><input value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="Nama project..."/></label>
          <label className="module-field"><span>PROJECT NOTES</span><textarea value={projectNotes} onChange={e=>setProjectNotes(e.target.value)} placeholder="Catatan produksi, episode, continuity, atau arahan project..." rows={4}/></label>
          <section className="module-card" style={{marginTop:12}}>
            <div className="module-card-head"><div><b>PROJECT CLOUD</b><small>Kelola beberapa project dalam satu akun tanpa mencampur Character, Vehicle, Location, Scene, dan Timeline.</small></div><button className="module-secondary" onClick={()=>void refreshCloudProjects()}>↻ Refresh</button></div>
            <div className="settings-actions"><button className="module-primary" onClick={()=>void createCloudProject()}>＋ Project Baru</button><button className="module-secondary" onClick={()=>void saveActiveProjectToCloud()}>Simpan Project Aktif</button></div>
            {projects.length ? <div className="library-grid" style={{marginTop:12}}>{projects.map(p=><article className={`library-card ${activeProjectId===p.id?'selected':''}`} key={p.id}><span>PROJECT • {activeProjectId===p.id?'AKTIF':'CLOUD'}</span><h3>{p.name}</h3><p>{p.notes || 'Belum ada catatan project.'}</p><small>Diperbarui: {new Date(p.updatedAt).toLocaleString('id-ID')}</small><div className="settings-actions" style={{marginTop:10}}><button onClick={()=>void openCloudProject(p.id)}>{activeProjectId===p.id?'Muat Ulang':'Buka Project'}</button><button onClick={()=>void deleteCloudProject(p.id)}>Hapus</button></div></article>)}</div> : <div className="library-empty" style={{marginTop:12}}><b>Belum ada project cloud.</b><small>Klik “Project Baru” untuk membuat project pertama.</small></div>}
            {projectManagerMessage && <div className="settings-message">✓ {projectManagerMessage}</div>}
          </section>
          <div className="settings-actions"><button className="module-primary" onClick={()=>{setSettingsMessage('Pengaturan tersimpan di browser ini.');setStatus('Settings tersimpan.')}}>Simpan Pengaturan</button><button className="module-secondary" onClick={saveWorkspaceToCloud}>Simpan ke Cloud</button><button className="module-secondary" onClick={loadWorkspaceFromCloud}>Muat dari Cloud</button><button className="module-secondary" onClick={exportWorkspace}>Export Workspace</button><label className="module-secondary" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>Import Workspace<input type="file" accept="application/json,.json,.hrnet.json" hidden onChange={e=>{const f=e.target.files?.[0];if(f) importWorkspace(f);e.currentTarget.value='';}}/></label><button className="module-secondary" onClick={()=>{localStorage.removeItem(STORAGE_KEY);location.reload();}}>Reset Workspace</button></div>
          <div style={{marginTop:10,fontSize:12,opacity:.85}}>{cloudSyncMessage || (userId ? `Login aktif: ${memberEmail}` : 'Login diperlukan untuk cloud workspace.')}</div><div className="module-tip"><b>WORKSPACE SNAPSHOT</b><span>Export menyimpan project, Library, Scene, Timeline history, dan catatan dalam satu file .hrnet.json. Import dapat digunakan untuk memindahkan workspace ke browser lain.</span></div>
          {settingsMessage && <div className="settings-message">✓ {settingsMessage}</div>}
        </section>
      </section> : page === 'Generate Video' ? <div className="workspace">
        <section className="main-panel">
          <div className="panel-title"><div><span className="step">01</span><div><h2>Describe your scene</h2><small>Tulis aksi, kamera, karakter, lokasi, dan suasana.</small></div></div><div className="panel-actions"><button className="secondary-btn" onClick={enhancePrompt}>✦ Enhance Prompt</button><button className="clear-btn" onClick={clearWorkspace}>Clear</button></div></div>
          <input className="scene-title-input" value={sceneTitle} onChange={e => setSceneTitle(e.target.value)} placeholder="Judul scene / shot..." />
          <textarea className="prompt-box" value={action} onChange={e => setAction(e.target.value)} placeholder="Contoh: F41 berjalan perlahan di dermaga, kamera tracking dari samping, angin laut menggerakkan pakaian..." />

          <div className="reference-section">
            <div className="reference-header"><div><b>REFERENCE IMAGES</b><small>Seedance 2.5 mendukung hingga 30 image references. Simpan referensi per shot agar continuity mudah dikelola.</small></div><span className="reference-count">{referenceCount}/{referenceSlots}</span></div>
            <div className="reference-grid">{Array.from({ length: referenceSlots }, (_, i) => <label className={`reference-slot ${references[i] ? 'filled' : ''}`} key={i}>
              <input type="file" accept="image/*" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 20 * 1024 * 1024) { setError('Reference asli maksimal 20 MB.'); return; } try { setStatus(`Memproses reference image ${i + 1}...`); const compressed = await compressReferenceImage(f); setReferences(v => { const n = [...v]; n[i] = compressed; return n; }); setReferenceNames(v => { const n = [...v]; n[i] = f.name; return n; }); setError(''); setStatus(`Reference image ${i + 1} siap digunakan.`); } catch (err) { setError(err instanceof Error ? err.message : 'Gagal memproses reference image.'); } finally { e.currentTarget.value = ''; } }} />
              {references[i] ? <><img src={references[i]} alt={`Reference ${i + 1}`} /><button type="button" className="reference-delete" aria-label={`Hapus image ${i + 1}`} title="Hapus reference" onClick={e => { e.preventDefault(); e.stopPropagation(); setReferences(v => { const n = [...v]; n[i] = ''; return n; }); setReferenceNames(v => { const n = [...v]; n[i] = ''; return n; }); setError(''); }}>×</button><span className="reference-check">✓</span></> : <><span className="reference-index">IMAGE {i + 1}</span><span className="reference-plus">＋</span></>}
            </label>)}</div>
            <div className="reference-actions">{referenceSlots < 30 && <button className="add-reference" onClick={() => setReferenceSlots(v => Math.min(30, v + 5))}>＋ Tambah 5 slot</button>}{referenceCount > 0 && <button className="remove-ref" onClick={() => { setReferences(Array(6).fill('')); setReferenceNames(Array(6).fill('')); setReferenceSlots(6); }}>Hapus semua</button>}<small>{referenceCount ? `${referenceCount} file siap dipakai sebagai bahan continuity.` : 'Tambahkan referensi karakter, kendaraan, lokasi, atau storyboard.'}</small></div>
          </div>

          <div className="media-reference-section">
            <div className="media-reference-head"><div><b>REFERENCE MEDIA</b><small>Tambahkan audio dan video sebagai acuan suara, ritme, gerakan, kamera, atau kontinuitas.</small></div><span>{audioReference ? 'AUDIO ✓' : ''}{audioReference && videoReference ? ' • ' : ''}{videoReference ? 'VIDEO ✓' : ''}</span></div>
            <div className="media-reference-grid">
              <label className={`media-reference-card ${audioReference ? 'active' : ''}`}>
                <input type="file" accept="audio/*" onChange={e => { const f=e.target.files?.[0]; if(f) handleMediaReference('audio', f); e.currentTarget.value=''; }} />
                <div className="media-reference-icon">♫</div><div><b>{audioReferenceName || 'Audio Reference'}</b><small>{audioReferenceName ? 'Audio siap digunakan sebagai acuan' : 'MP3, WAV, M4A • maks. 20 MB'}</small></div>
                {audioReference ? <button type="button" className="media-remove" onClick={e => { e.preventDefault(); e.stopPropagation(); clearMediaReference('audio'); }}>×</button> : <span className="media-add">＋</span>}
                {audioReference && <audio className="audio-mini-player" controls src={audioReference} onClick={e => e.stopPropagation()} />}
              </label>
              <label className={`media-reference-card ${videoReference ? 'active' : ''}`}>
                <input type="file" accept="video/*" onChange={e => { const f=e.target.files?.[0]; if(f) handleMediaReference('video', f); e.currentTarget.value=''; }} />
                <div className="media-reference-icon">▶</div><div><b>{videoReferenceName || 'Video Reference'}</b><small>{videoReferenceName ? 'Video siap digunakan sebagai acuan' : 'MP4, MOV, WEBM • maks. 40 MB'}</small></div>
                {videoReference ? <button type="button" className="media-remove" onClick={e => { e.preventDefault(); e.stopPropagation(); clearMediaReference('video'); }}>×</button> : <span className="media-add">＋</span>}
                {videoReference && <video className="video-mini-player" controls muted src={videoReference} onClick={e => e.stopPropagation()} />}
              </label>
            </div>
            {(audioReference || videoReference) && <small className="media-reference-note">Reference media tersimpan sementara di browser selama project ini terbuka. Provider API akan menerima metadata nama file; integrasi upload media provider dilakukan di tahap backend.</small>}
          </div>

          <div className="generation-settings-box">
          <div className="controls-title"><span className="step">02</span><div><h2>Generation settings</h2><small>Atur provider, model, kualitas, format, dan durasi sebelum generate.</small></div></div>
          <div className="control-grid">
            <div className="field"><label>PROVIDER</label><div className="segmented"><button className={provider === 'dola' ? 'selected' : ''} onClick={() => { setProvider('dola'); setDuration(v => Math.min(Math.max(v, 15), 60)); }}>Dola <em>WEB</em></button><button className={provider === 'runway' ? 'selected' : ''} onClick={() => { setProvider('runway'); setDuration(v => Math.min(Math.max(v, 5), 30)); }}>Runway <em>API</em></button></div><a className="dola-link" href="https://www.dola.com/chat/" target="_blank" rel="noopener noreferrer">Buka Dola AI ↗</a></div>
            <div className="field"><label>MODEL</label><select value={model} onChange={e => setModel(e.target.value)} disabled={provider === 'dola'}><option value="seedance2_5">Seedance 2.5</option><option value="wan3">WAN 3.0</option></select><small className="field-note">{modelInfo.desc}</small></div>
            <div className="field"><label>RESOLUTION</label><div className="small-pills">{['480p', '720p', '1080p', '4K'].map(x => <button key={x} className={`${resolution === x ? 'selected' : ''} ${x === '4K' ? 'soon-pill' : ''}`} disabled={x === '4K'} title={x === '4K' ? 'Output 4K akan diaktifkan setelah provider mendukung.' : undefined} onClick={() => setResolution(x)}>{x}</button>)}</div></div>
            <div className="field"><label>ASPECT RATIO</label><div className="small-pills">{['9:16', '16:9', '1:1', '3:4', '4:3', '21:9'].map(x => <button key={x} className={ratio === x ? 'selected' : ''} onClick={() => setRatio(x)}>{x}</button>)}</div></div>
          </div>
          <div className="duration-row">
             <div>
               <label>DURATION</label>
               <div className="small-pills">
                 {(provider === 'dola' ? [15, 30, 45, 60] : [5, 10, 15, 30]).map(x =>
                   <button key={x} className={duration === x ? 'selected' : ''} disabled={provider !== 'dola' && (x < modelInfo.min || x > modelInfo.max)} onClick={() => setDuration(x)}>{x}s</button>
                 )}
               </div>
               <small className="field-note">{provider === 'dola' ? '15s = satu scene. 30/45/60s = rangkaian scene 15 detik dengan continuity bridge.' : 'Durasi mengikuti kemampuan model API yang dipilih.'}</small>
             </div>
           </div>
          </div>

          <div className="continuity-settings-box">
          <div className="controls-title assets-title"><span className="step">03</span><div><h2>Continuity lock</h2><small>Kunci elemen penting agar scene berikutnya tetap konsisten.</small></div></div>
          <div className="lock-grid">{[["Character Lock", characterLock, setCharacterLock, 'Wajah, pakaian, identitas'], ["Vehicle Lock", vehicleLock, setVehicleLock, 'Bentuk, warna, grafis'], ["Location Lock", locationLock, setLocationLock, 'Tata letak lingkungan'], ["Position Lock", positionLock, setPositionLock, 'Posisi anggota & cargo']].map(([n, v, set, desc]) => <button key={String(n)} className={`lock-card ${v ? 'on' : ''}`} onClick={() => (set as (x: boolean) => void)(!v)}><span className="lock-symbol">{v ? '✓' : '○'}</span><div><b>{String(n)}</b><small>{String(desc)}</small></div></button>)}</div>

          {characters.length || vehicles.length || locations.length ? <div className="asset-grid">{characters.length > 0 && <div className="asset-card"><div className="asset-head"><span>CHARACTERS</span><b>{selectedCharacters.length} dipilih</b></div><div className="chips">{characters.map(c => <button key={c.name} className={selectedCharacters.includes(c.name) ? 'chip active' : 'chip'} onClick={() => toggleCharacter(c.name)}>{c.name}</button>)}</div></div>}{vehicles.length > 0 && <div className="asset-card"><div className="asset-head"><span>VEHICLE</span><b>{selectedVehicle ? 'LOCKED' : 'BELUM DIPILIH'}</b></div><select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}><option value="">Pilih kendaraan...</option>{vehicles.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}</select></div>}{locations.length > 0 && <div className="asset-card"><div className="asset-head"><span>LOCATION</span><b>{selectedLocation ? 'LOCKED' : 'BELUM DIPILIH'}</b></div><select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}><option value="">Pilih lokasi...</option>{locations.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}</select></div>}</div> : <div className="empty-assets"><div><b>Project masih kosong.</b><small>Tambahkan character, vehicle, dan location melalui Library agar workflow continuity dapat digunakan penuh.</small></div><button onClick={() => setPage('Character Library')}>Buka Library →</button></div>}
          </div>


          {provider === 'dola' && duration > 15 && <div className="generation-settings-box" style={{marginTop:12}}>
            <div className="controls-title"><span className="step">04</span><div><h2>Dola Long Video Plan</h2><small>{duration} detik dibagi menjadi {Math.ceil(duration / 15)} scene × 15 detik.</small></div></div>
            <div className="asset-grid">
              {(longVideoPlan.length ? longVideoPlan : Array.from({length: Math.ceil(duration / 15)}, (_, i) => ({index:i+1,total:Math.ceil(duration/15),duration:15,title:`Scene ${i+1}`,prompt:'Klik BUAT RANGKAIAN untuk menyusun prompt scene.'}))).map(s =>
                <div className="asset-card" key={s.index}>
                  <div className="asset-head"><span>SCENE {String(s.index).padStart(2,'0')}</span><b>{s.status === 'completed' ? 'DONE' : s.status === 'copied' ? 'READY' : '15s'}</b></div>
                  <small>{s.title}</small>
                  {longVideoPlan.length > 0 && <p style={{fontSize:12,lineHeight:1.5}}>{s.prompt}</p>}
                  {longVideoPlan.length > 0 && <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8,flexWrap:'wrap'}}>
                    <label className="module-secondary" style={{cursor:'pointer'}}>📥 MASUKKAN VIDEO SCENE<input type="file" accept="video/*" hidden onChange={e => { const file=e.target.files?.[0]; if(file) attachDolaSegmentVideo(s.index,file); e.currentTarget.value=''; }} /></label>
                    {mergeClips.some(c => c.id === `dola-scene-${s.index}`) && <span className="history-ok">✓ TERHUBUNG KE MERGER</span>}
                  </div>}
                </div>
              )}
            </div>
            <div className="settings-actions">
              <button className="module-primary" onClick={() => { buildDolaLongVideoPlan(duration); }}>✦ BUAT RANGKAIAN</button>
               <button className="module-secondary" onClick={() => { void copyNextDolaSegment(); }}>▶ SCENE BERIKUTNYA</button>
               <button className="module-secondary" onClick={() => { void copyDolaLongVideoPlan(); }}>📋 SALIN SEMUA</button>
               {longVideoPlan.length > 0 && <button className="module-secondary" onClick={markCurrentDolaSegmentCompleted}>✓ TANDAI SELESAI</button>}</div></div>}
        </section>

        <aside className="preview-panel">
          <div className="preview-head"><div><span className="eyebrow">LIVE PREVIEW</span><h2>Scene Preview</h2></div><span className="ratio-badge">{ratio}</span></div>
          <div className={`preview-frame ${ratio === '9:16' ? 'vertical' : ''}`}>{videoUrl ? <video controls src={videoUrl} /> : references.find(Boolean) ? <img src={references.find(Boolean)!} alt="Reference utama" /> : <div className="preview-empty"><div className="camera">▣</div><b>Hasil video akan muncul di sini</b><small>Generate scene untuk melihat preview.</small></div>}</div>
          <div className="preview-info"><div><span>MODEL</span><b>{modelInfo.label}</b></div><div><span>OUTPUT</span><b>{resolution} • {duration}s</b></div><div><span>REFERENCES</span><b>{referenceCount}</b></div></div>
          <div className="prompt-preview"><div className="asset-head"><span>GENERATED PROMPT</span><button onClick={() => { void copyPrompt(); }}>Copy</button></div><p>{generatedPrompt || 'Belum ada prompt baru. Tulis scene lalu Generate atau Salin Prompt.'}</p></div>
          <div className="history-panel"><div className="asset-head"><span>RECENT GENERATIONS</span><b>{history.length}</b></div>{history.length === 0 ? <small className="history-empty">Belum ada generation history.</small> : history.slice(0, 5).map(item => <div className="history-item" key={item.id}><div><b>{item.title}</b><small>{item.model} • {item.duration}s • {item.resolution}</small></div><span className={item.status === 'completed' ? 'history-ok' : 'history-fail'}>{item.status === 'completed' ? 'DONE' : 'FAIL'}</span><button onClick={() => removeHistory(item.id)}>×</button></div>)}</div>
        </aside>
      </div> : <div className="placeholder-panel"><div className="big-icon">✦</div><h2>{page}</h2><p>Modul ini disiapkan sebagai bagian dari roadmap studio komersial HR-NET AI CINEMA. Generator video menjadi core workflow.</p><button onClick={() => setPage('Generate Video')}>Kembali ke Generate Video</button></div>}

      <footer>HR-NET AI CINEMA • Commercial Beta Foundation • Project / Reference / Continuity / Cost / History</footer>
    </main>

    {showGuide && <div className="modal-backdrop"><div className="guide-modal"><div className="guide-progress"><span className={guideStep >= 1 ? 'on' : ''}/><span className={guideStep >= 2 ? 'on' : ''}/><span className={guideStep >= 3 ? 'on' : ''}/></div>{guideStep === 1 && <><div className="guide-icon">✦</div><h2>HR-NET AI CINEMA — Commercial Beta</h2><p>Generator dibuat sebagai fondasi produk: workflow scene, reference images, continuity lock, dan history.</p><div className="guide-cards"><div><b>Production workflow</b><span>Prompt → references → settings → generate → history.</span></div><div><b>Commercial foundation</b><span>Struktur siap dikembangkan ke akun, credits, billing, dan cloud storage.</span></div></div></>}{guideStep === 2 && <><div className="guide-icon">▣</div><h2>Kontrol generator</h2><p>Seedance 2.5 dan WAN 3.0 tersedia sebagai pilihan API. Dola tetap sebagai web workflow.</p><div className="mode-list"><div><b>Seedance 2.5</b><span>4–30s</span></div><div><b>WAN 3.0</b><span>2–30s</span></div></div></>}{guideStep === 3 && <><div className="guide-icon">✓</div><h2>Siap produksi</h2><p>Mulai dari satu shot. Setelah engine API stabil, tahap berikutnya adalah akun pengguna, credit wallet, pembayaran, storage, queue worker, dan admin panel.</p><div className="guide-summary"><b>PRINSIP PRODUK</b><span>Jangan kehilangan prompt, reference, dan history.</span><span>Jangan campur API key provider ke browser.</span></div></>}<div className="guide-actions">{guideStep > 1 ? <button onClick={() => setGuideStep(s => s - 1)}>← Kembali</button> : <button onClick={() => setShowGuide(false)}>Lewati</button>}<button className="guide-next" onClick={() => guideStep < 3 ? setGuideStep(s => s + 1) : setShowGuide(false)}>{guideStep < 3 ? 'Lanjut →' : 'Mulai →'}</button></div></div></div>}
</div>;
}






