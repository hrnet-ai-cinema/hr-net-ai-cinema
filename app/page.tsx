'use client';

import { useEffect, useMemo, useState } from 'react';

type Asset = { id: string; name: string; description: string };
type SceneItem = { id: string; title: string; prompt: string; type: 'video' | 'image'; createdAt: string };
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
  const [page, setPage] = useState('Dashboard');
  const [characters, setCharacters] = useState<Asset[]>(emptyAssets);
  const [vehicles, setVehicles] = useState<Asset[]>(emptyAssets);
  const [locations, setLocations] = useState<Asset[]>(emptyAssets);
  const [scenes, setScenes] = useState<SceneItem[]>(emptyScenes);
  const [assetName, setAssetName] = useState('');
  const [assetDescription, setAssetDescription] = useState('');
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

  const modelInfo = MODEL_INFO[model];
  const referenceCount = references.filter(Boolean).length;
  const estimatedCredits = 0;
  const now = Date.now();
  const recentHistory = history.filter(item => {
    const t = new Date(item.createdAt).getTime();
    return Number.isFinite(t) && now - t <= 24 * 60 * 60 * 1000;
  });
  const usedSlots24h = Math.min(12, recentHistory.length);
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
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.projectName) setProjectName(saved.projectName);
      if (Array.isArray(saved.history)) setHistory(saved.history.slice(0, 20));
      if (Array.isArray(saved.characters)) setCharacters(saved.characters);
      if (Array.isArray(saved.vehicles)) setVehicles(saved.vehicles);
      if (Array.isArray(saved.locations)) setLocations(saved.locations);
      if (Array.isArray(saved.scenes)) setScenes(saved.scenes.slice(0, 50));
      if (saved.showGuide === false) setShowGuide(false);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ projectName, history, characters, vehicles, locations, scenes, showGuide }));
    } catch {}
  }, [projectName, history, characters, vehicles, locations, scenes, showGuide]);

  useEffect(() => {
    setGeneratedPrompt('');
  }, [prompt]);

  useEffect(() => {
  }, [model, duration, resolution]);

  function toggleCharacter(name: string) {
    setSelectedCharacters(v => v.includes(name) ? v.filter(x => x !== name) : [...v, name]);
  }

  function addAsset(kind: 'character' | 'vehicle' | 'location') {
    const name = assetName.trim();
    if (!name) { setError('Nama asset wajib diisi.'); return; }
    const asset: Asset = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, description: assetDescription.trim() || 'Belum ada deskripsi.' };
    if (kind === 'character') setCharacters(v => [...v, asset]);
    if (kind === 'vehicle') setVehicles(v => [...v, asset]);
    if (kind === 'location') setLocations(v => [...v, asset]);
    setAssetName(''); setAssetDescription(''); setError(''); setStatus(`${name} ditambahkan ke Library.`);
  }

  function removeAsset(kind: 'character' | 'vehicle' | 'location', id: string) {
    if (kind === 'character') setCharacters(v => v.filter(x => x.id !== id));
    if (kind === 'vehicle') setVehicles(v => v.filter(x => x.id !== id));
    if (kind === 'location') setLocations(v => v.filter(x => x.id !== id));
    setStatus('Asset dihapus dari Library.');
  }

  function saveScene(type: 'video' | 'image') {
    const sourcePrompt = type === 'video' ? prompt : imageGeneratedPrompt;
    const title = (type === 'video' ? sceneTitle : projectName).trim() || (type === 'video' ? 'Untitled Video Scene' : 'Untitled Image Scene');
    if (!sourcePrompt.trim()) { setError('Buat prompt terlebih dahulu.'); return; }
    setScenes(v => [{ id: `${Date.now()}`, title, prompt: sourcePrompt, type, createdAt: new Date().toISOString() }, ...v].slice(0, 50));
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

  async function generate() {
    setGeneratedPrompt(''); setError(''); setVideoUrl(null);
    if (!prompt.trim()) { setError('Isi deskripsi scene terlebih dahulu.'); setStatus('Menunggu prompt'); return; }
    if (provider === 'dola') {
      const copied = await copyPrompt();
      setStatus(copied ? 'Prompt siap ditempel ke Dola AI.' : 'Gunakan kotak salin manual lalu buka Dola AI.');
      return;
    }
    setIsGenerating(true); setStatus('Mengirim ke Runway AI…');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, prompt, duration, ratio, resolution, model, references: references.filter(Boolean), reference: references.find(Boolean) || null, audioReferenceName: audioReferenceName || null, videoReferenceName: videoReferenceName || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat video');
      setGeneratedPrompt(prompt); setVideoUrl(data.videoUrl || null); setStatus(data.status || 'Video selesai');
      setHistory(h => [{ id: `${Date.now()}`, title: sceneTitle || 'Untitled Scene', prompt, model, duration, ratio, resolution, createdAt: new Date().toISOString(), status: 'completed', videoUrl: data.videoUrl || null, estimatedCredits }, ...h].slice(0, 20));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Terjadi kesalahan';
      setError(message); setStatus('Generation gagal');
      setHistory(h => [{ id: `${Date.now()}`, title: sceneTitle || 'Untitled Scene', prompt, model, duration, ratio, resolution, createdAt: new Date().toISOString(), status: 'failed', estimatedCredits }, ...h].slice(0, 20));
    } finally { setIsGenerating(false); }
  }

  function removeHistory(id: string) { setHistory(h => h.filter(x => x.id !== id)); }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="logo"><img className="brand-logo" src="/logo.png" alt="HR-NET — Berkembang Dengan Teknologi!" /></div>
      <div className="side-section">STUDIO</div>
      {['Dashboard','Generate Video','Generate Gambar','Character Library','Vehicle Library','Location Library','Scene Library','Timeline'].map(item =>
        <button key={item} className={`nav-item ${page === item ? 'active' : ''}`} onClick={() => setPage(item)}><span className="nav-icon">{item === 'Generate Video' ? '▣' : item === 'Generate Gambar' ? '▧' : item === 'Timeline' ? '☷' : item.includes('Library') ? '◈' : '⌂'}</span>{item}</button>)}

      <div className="side-section">AI TOOLS</div>
      <button className={`nav-item ${page === 'AI Agent' ? 'active' : ''}`} onClick={() => setPage('AI Agent')}><span className="nav-icon">✦</span>AI Agent <em className="beta-badge">BETA</em></button>

      <div className="side-quota">
        <div className="quota-head"><span>GENERATION</span><b>PRO</b></div>
        <div className="quota-number"><strong>12 / 12</strong><span>slot tersedia</span></div>
        <div className="quota-track"><span style={{width:'100%'}}/></div>
        <small>Reset rolling 24 jam</small>
      </div>

      <div className="side-section">AKUN</div>
      <button className={`nav-item ${page === 'Subscription' ? 'active' : ''}`} onClick={() => setPage('Subscription')}><span className="nav-icon">◆</span>Subscription</button>
      <button className={`nav-item ${page === 'Settings' ? 'active' : ''}`} onClick={() => setPage('Settings')}><span className="nav-icon">⚙</span>Settings</button>
      <button className="nav-item" onClick={() => setShowGuide(true)}><span className="nav-icon">?</span>Bantuan</button>

      <div className="project-card" onClick={() => { clearWorkspace(); setPage('Generate Video'); }}><span>＋</span><div><b>New Project</b><small>Mulai proyek baru</small></div></div>
      <div className="sidebar-bottom"><div className="engine"><span className="dot"/> Engine siap</div><div className="user-mini"><span>H</span><div><b>HR-NET</b><small>Pro • Commercial Beta</small></div></div></div>
    </aside>

    <main className="content">
      <div className="top-banner"><span>🔒 <b>Local Beta:</b> draft dan history tersimpan di browser ini.</span><span className="top-actions"><button onClick={() => setShowGuide(true)}>Panduan</button><button onClick={() => setPage('Subscription')}>Kelola Paket</button></span></div>
      <header className="page-header"><div><div className="crumb">HR-NET AI CINEMA / {projectName.toUpperCase()}</div><h1>{page}</h1><p>{page === 'Generate Video' ? 'Generator video sinematik dengan reference workflow, continuity lock, dan generation history.' : page === 'Dashboard' ? 'Pusat kendali produksi: kuota, aktivitas, project, dan akses cepat ke workflow.' : page === 'AI Agent' ? 'Asisten AI untuk ide, cerita, prompt, storyboard, dan workflow produksi.' : 'Kelola workflow produksi HR-NET AI CINEMA.'}</p></div><div className="header-status"><span className="status-dot"/> Sistem siap</div></header>

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
        <section className="module-card"><div className="asset-form"><input value={assetName} onChange={e=>setAssetName(e.target.value)} placeholder="Nama karakter..."/><input value={assetDescription} onChange={e=>setAssetDescription(e.target.value)} placeholder="Deskripsi singkat..."/><button className="module-primary" onClick={()=>addAsset('character')}>＋ Tambah Karakter</button></div></section>
        <div className="library-grid">{characters.length ? characters.map(a=><article className="library-card" key={a.id}><span>CHARACTER</span><h3>{a.name}</h3><p>{a.description}</p><button onClick={()=>removeAsset('character',a.id)}>Hapus</button></article>) : <div className="library-empty"><b>Belum ada karakter.</b><small>Tambahkan karakter pertama untuk mengaktifkan continuity selection.</small></div>}</div>
      </section> : page === 'Vehicle Library' ? <section className="module-page">
        <div className="module-hero compact"><div><span className="module-kicker">03 / ASSET LIBRARY</span><h2>Vehicle Library</h2><p>Simpan kendaraan dan detail visualnya untuk Vehicle Lock.</p></div></div>
        <section className="module-card"><div className="asset-form"><input value={assetName} onChange={e=>setAssetName(e.target.value)} placeholder="Nama kendaraan..."/><input value={assetDescription} onChange={e=>setAssetDescription(e.target.value)} placeholder="Model, warna, ciri visual..."/><button className="module-primary" onClick={()=>addAsset('vehicle')}>＋ Tambah Kendaraan</button></div></section>
        <div className="library-grid">{vehicles.length ? vehicles.map(a=><article className="library-card" key={a.id}><span>VEHICLE</span><h3>{a.name}</h3><p>{a.description}</p><button onClick={()=>removeAsset('vehicle',a.id)}>Hapus</button></article>) : <div className="library-empty"><b>Belum ada kendaraan.</b><small>Tambahkan kendaraan untuk workflow Vehicle Lock.</small></div>}</div>
      </section> : page === 'Location Library' ? <section className="module-page">
        <div className="module-hero compact"><div><span className="module-kicker">04 / ASSET LIBRARY</span><h2>Location Library</h2><p>Simpan lokasi dan elemen lingkungan agar scene tetap konsisten.</p></div></div>
        <section className="module-card"><div className="asset-form"><input value={assetName} onChange={e=>setAssetName(e.target.value)} placeholder="Nama lokasi..."/><input value={assetDescription} onChange={e=>setAssetDescription(e.target.value)} placeholder="Deskripsi lingkungan..."/><button className="module-primary" onClick={()=>addAsset('location')}>＋ Tambah Lokasi</button></div></section>
        <div className="library-grid">{locations.length ? locations.map(a=><article className="library-card" key={a.id}><span>LOCATION</span><h3>{a.name}</h3><p>{a.description}</p><button onClick={()=>removeAsset('location',a.id)}>Hapus</button></article>) : <div className="library-empty"><b>Belum ada lokasi.</b><small>Tambahkan lokasi untuk workflow Location Lock.</small></div>}</div>
      </section> : page === 'Scene Library' ? <section className="module-page">
        <div className="module-hero compact"><div><span className="module-kicker">05 / SCENE LIBRARY</span><h2>Scene Library</h2><p>Scene tersimpan menjadi sumber kerja ulang untuk video dan gambar.</p></div><button className="module-secondary" onClick={()=>setPage('Generate Video')}>＋ Scene Baru</button></div>
        <div className="scene-library-grid">{scenes.length ? scenes.map(sc=><article className="scene-library-card" key={sc.id}><div><span>{sc.type==='video'?'VIDEO':'IMAGE'}</span><small>{new Date(sc.createdAt).toLocaleString('id-ID')}</small></div><h3>{sc.title}</h3><p>{sc.prompt}</p><div><button onClick={()=>{setAction(sc.prompt);setGeneratedPrompt(sc.prompt);setPage(sc.type==='video'?'Generate Video':'Generate Gambar');setStatus('Scene dimuat dari Scene Library.')}}>Buka</button><button onClick={()=>setScenes(v=>v.filter(x=>x.id!==sc.id))}>Hapus</button></div></article>) : <div className="library-empty"><b>Scene Library masih kosong.</b><small>Simpan scene dari Generate Video atau Generate Gambar.</small></div>}</div>
      </section> : page === 'Timeline' ? <section className="module-page">
        <div className="module-hero compact"><div><span className="module-kicker">06 / PRODUCTION TIMELINE</span><h2>Timeline</h2><p>Urutan kerja project dari scene yang tersimpan dan generation history.</p></div></div>
        <div className="timeline-list">{[...scenes.map(x=>({...x, source:'SCENE'})), ...history.map(x=>({id:x.id,title:x.title,prompt:x.prompt,type:'video' as const,createdAt:x.createdAt,source:'GENERATION'}))].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).map((x,i)=><div className="timeline-item" key={`${x.source}-${x.id}`}><div className="timeline-index">{String(i+1).padStart(2,'0')}</div><div><span>{x.source} • {x.type.toUpperCase()}</span><h3>{x.title}</h3><p>{x.prompt}</p><small>{new Date(x.createdAt).toLocaleString('id-ID')}</small></div></div>)}{!scenes.length && !history.length && <div className="library-empty"><b>Timeline belum memiliki aktivitas.</b><small>Simpan scene atau lakukan generation untuk mengisinya.</small></div>}</div>
      </section> : page === 'Settings' ? <section className="module-page">
        <div className="module-hero compact"><div><span className="module-kicker">07 / WORKSPACE SETTINGS</span><h2>Settings</h2><p>Atur nama project dan preferensi workspace lokal.</p></div></div>
        <section className="module-card settings-card"><label className="module-field"><span>PROJECT NAME</span><input value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="Nama project..."/></label><div className="settings-actions"><button className="module-primary" onClick={()=>{setSettingsMessage('Pengaturan tersimpan di browser ini.');setStatus('Settings tersimpan.')}}>Simpan Pengaturan</button><button className="module-secondary" onClick={()=>{localStorage.removeItem(STORAGE_KEY);location.reload();}}>Reset Workspace</button></div>{settingsMessage && <div className="settings-message">✓ {settingsMessage}</div>}</section>
      </section> : page === 'Generate Video' ? <div className="workspace">
        <section className="main-panel">
          <div className="panel-title"><div><span className="step">01</span><div><h2>Describe your scene</h2><small>Tulis aksi, kamera, karakter, lokasi, dan suasana.</small></div></div><div className="panel-actions"><button className="secondary-btn" onClick={enhancePrompt}>✦ Enhance Prompt</button><button className="clear-btn" onClick={clearWorkspace}>Clear</button></div></div>
          <input className="scene-title-input" value={sceneTitle} onChange={e => setSceneTitle(e.target.value)} placeholder="Judul scene / shot..." />
          <textarea className="prompt-box" value={action} onChange={e => setAction(e.target.value)} placeholder="Contoh: F41 berjalan perlahan di dermaga, kamera tracking dari samping, angin laut menggerakkan pakaian..." />

          <div className="reference-section">
            <div className="reference-header"><div><b>REFERENCE IMAGES</b><small>Seedance 2.5 mendukung hingga 30 image references. Simpan referensi per shot agar continuity mudah dikelola.</small></div><span className="reference-count">{referenceCount}/{referenceSlots}</span></div>
            <div className="reference-grid">{Array.from({ length: referenceSlots }, (_, i) => <label className={`reference-slot ${references[i] ? 'filled' : ''}`} key={i}>
              <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 5 * 1024 * 1024) { setError('Setiap referensi data URI maksimal 5 MB.'); return; } const r = new FileReader(); r.onload = () => { setReferences(v => { const n = [...v]; n[i] = String(r.result); return n; }); setReferenceNames(v => { const n = [...v]; n[i] = f.name; return n; }); setError(''); }; r.readAsDataURL(f); }} />
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
            <div className="field"><label>PROVIDER</label><div className="segmented"><button className={provider === 'dola' ? 'selected' : ''} onClick={() => setProvider('dola')}>Dola <em>WEB</em></button><button className={provider === 'runway' ? 'selected' : ''} onClick={() => setProvider('runway')}>Runway <em>API</em></button></div><a className="dola-link" href="https://www.dola.com/chat/" target="_blank" rel="noopener noreferrer">Buka Dola AI ↗</a></div>
            <div className="field"><label>MODEL</label><select value={model} onChange={e => setModel(e.target.value)} disabled={provider === 'dola'}><option value="seedance2_5">Seedance 2.5</option><option value="wan3">WAN 3.0</option></select><small className="field-note">{modelInfo.desc}</small></div>
            <div className="field"><label>RESOLUTION</label><div className="small-pills">{['480p', '720p', '1080p', '4K'].map(x => <button key={x} className={`${resolution === x ? 'selected' : ''} ${x === '4K' ? 'soon-pill' : ''}`} disabled={x === '4K'} title={x === '4K' ? 'Output 4K akan diaktifkan setelah provider mendukung.' : undefined} onClick={() => setResolution(x)}>{x}</button>)}</div></div>
            <div className="field"><label>ASPECT RATIO</label><div className="small-pills">{['9:16', '16:9', '1:1', '3:4', '4:3', '21:9'].map(x => <button key={x} className={ratio === x ? 'selected' : ''} onClick={() => setRatio(x)}>{x}</button>)}</div></div>
          </div>
          <div className="duration-row"><div><label>DURATION</label><div className="small-pills">{[5, 10, 15, 30].map(x => <button key={x} className={duration === x ? 'selected' : ''} disabled={x < modelInfo.min || x > modelInfo.max} onClick={() => setDuration(x)}>{x}s</button>)}</div></div></div>
          </div>

          <div className="continuity-settings-box">
          <div className="controls-title assets-title"><span className="step">03</span><div><h2>Continuity lock</h2><small>Kunci elemen penting agar scene berikutnya tetap konsisten.</small></div></div>
          <div className="lock-grid">{[["Character Lock", characterLock, setCharacterLock, 'Wajah, pakaian, identitas'], ["Vehicle Lock", vehicleLock, setVehicleLock, 'Bentuk, warna, grafis'], ["Location Lock", locationLock, setLocationLock, 'Tata letak lingkungan'], ["Position Lock", positionLock, setPositionLock, 'Posisi anggota & cargo']].map(([n, v, set, desc]) => <button key={String(n)} className={`lock-card ${v ? 'on' : ''}`} onClick={() => (set as (x: boolean) => void)(!v)}><span className="lock-symbol">{v ? '✓' : '○'}</span><div><b>{String(n)}</b><small>{String(desc)}</small></div></button>)}</div>

          {characters.length || vehicles.length || locations.length ? <div className="asset-grid">{characters.length > 0 && <div className="asset-card"><div className="asset-head"><span>CHARACTERS</span><b>{selectedCharacters.length} dipilih</b></div><div className="chips">{characters.map(c => <button key={c.name} className={selectedCharacters.includes(c.name) ? 'chip active' : 'chip'} onClick={() => toggleCharacter(c.name)}>{c.name}</button>)}</div></div>}{vehicles.length > 0 && <div className="asset-card"><div className="asset-head"><span>VEHICLE</span><b>{selectedVehicle ? 'LOCKED' : 'BELUM DIPILIH'}</b></div><select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}><option value="">Pilih kendaraan...</option>{vehicles.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}</select></div>}{locations.length > 0 && <div className="asset-card"><div className="asset-head"><span>LOCATION</span><b>{selectedLocation ? 'LOCKED' : 'BELUM DIPILIH'}</b></div><select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}><option value="">Pilih lokasi...</option>{locations.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}</select></div>}</div> : <div className="empty-assets"><div><b>Project masih kosong.</b><small>Tambahkan character, vehicle, dan location melalui Library agar workflow continuity dapat digunakan penuh.</small></div><button onClick={() => setPage('Character Library')}>Buka Library →</button></div>}
          </div>

          <div className="scene-row"><div><label>SCENE OUTPUT</label><div className="output-summary"><span>{modelInfo.label}</span><span>{resolution}</span><span>{ratio}</span><span>{duration}s</span><span>{referenceCount} refs</span></div></div><div className="dola-actions"><button className="copy-prompt-btn" onClick={() => saveScene('video')}>＋ SIMPAN SCENE</button>{provider === 'dola' ? <><button className="copy-prompt-btn" onClick={() => { void copyPrompt(); }}>📋 SALIN PROMPT</button><a className="generate-btn dola-generate-link" href="https://www.dola.com/chat/" target="_blank" rel="noopener noreferrer" onClick={() => { void copyPrompt(); }}>↗ BUKA DOLA</a></> : <button className="generate-btn" onClick={generate} disabled={isGenerating}>{isGenerating ? '⏳ GENERATING…' : '▶ GENERATE VIDEO'}</button>}</div></div>
          <div className="status-line"><span className="status-dot"/>{status}{error && <span className="error">{error}</span>}</div>
        </section>

        {showCopyBox && <div className="copy-overlay" onClick={() => setShowCopyBox(false)}><div className="copy-modal" onClick={e => e.stopPropagation()}><div className="copy-modal-head"><div><span className="eyebrow">COPY PROMPT</span><h2>Salin prompt ke Dola</h2></div><button className="copy-close" onClick={() => setShowCopyBox(false)}>×</button></div><p>Klik kotak di bawah, tekan <b>Ctrl+A</b>, lalu <b>Ctrl+C</b>. Setelah itu buka Dola dan tekan <b>Ctrl+V</b>.</p><textarea className="copy-textarea" value={prompt} readOnly autoFocus onFocus={e => e.currentTarget.select()} onClick={e => e.currentTarget.select()} /><div className="copy-modal-actions"><button className="copy-manual" onClick={e => { e.preventDefault(); const el = e.currentTarget.closest('.copy-modal')?.querySelector('textarea') as HTMLTextAreaElement | null; el?.focus(); el?.select(); setStatus('Prompt terseleksi. Tekan Ctrl+C.'); }}>SELECT ALL</button><a className="copy-dola" href="https://www.dola.com/chat/" target="_blank" rel="noopener noreferrer">↗ BUKA DOLA</a></div></div></div>}

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
