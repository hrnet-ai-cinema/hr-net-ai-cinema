'use client';

import { useMemo, useState } from 'react';

type Asset = { name: string; description: string };

const characters: Asset[] = [
  { name: 'F41', description: 'Pemimpin serius dan disiplin; wajah konsisten; rambut pendek; gaya taktis.' },
  { name: 'Maman', description: 'Anggota senior berkacamata; tenang dan fokus.' },
  { name: 'Rudi Aditia', description: 'Pria bergaya militer, rambut pendek.' },
  { name: 'Joy', description: 'Intelijen, pintar dan banyak komentar.' },
  { name: 'Luqman', description: 'Ahli senjata, sangat percaya diri.' },
  { name: 'Nadi', description: 'Pengemudi santai dan suka bercanda.' },
  { name: 'Salman', description: 'Anggota termuda, polos dan sering bertanya.' },
  { name: 'Sobari', description: 'Tubuh besar dan kuat, mudah lapar.' },
  { name: 'Dede S', description: 'Anggota baru tim.' },
  { name: 'Sule', description: 'Operator intelijen.' }
];

const vehicles: Asset[] = [
  { name: 'GranMax HR-NET', description: 'GranMax hitam, grafis merah-kuning, branding HR-NET, bak terbuka.' }
];

const locations: Asset[] = [
  { name: 'Pelabuhan Merak', description: 'Gerbang kendaraan, antrean kapal Ro-Ro, ramp dan area car deck.' },
  { name: 'Desa Kalensari', description: 'Jalan desa Indonesia, rumah warga dan suasana kampung.' },
  { name: 'Kalimantan', description: 'Lingkungan tropis, jalan desa, hutan dan sungai.' }
];

export default function Home() {
  const [sceneTitle, setSceneTitle] = useState('F41 dan TIM tiba di Pelabuhan Merak');
  const [action, setAction] = useState('GranMax HR-NET bergerak perlahan menuju gerbang kendaraan. F41 mengemudi, Maman duduk di tengah kabin, Rudi di sampingnya. Di bak, Sobari, Sule, Dede S di kiri; Nadi, Joy, Salman di kanan; barang tetap di tengah.');
  const [duration, setDuration] = useState(5);
  const [ratio, setRatio] = useState('9:16');
  const [model, setModel] = useState('gen4.5');
  const [characterLock, setCharacterLock] = useState(true);
  const [vehicleLock, setVehicleLock] = useState(true);
  const [locationLock, setLocationLock] = useState(true);
  const [positionLock, setPositionLock] = useState(true);
  const [selectedCharacters, setSelectedCharacters] = useState(['F41','Maman','Rudi Aditia','Sobari','Sule','Dede S','Nadi','Joy','Salman']);
  const [selectedVehicle, setSelectedVehicle] = useState('GranMax HR-NET');
  const [selectedLocation, setSelectedLocation] = useState('Pelabuhan Merak');
  const [reference, setReference] = useState<string | null>(null);
  const [status, setStatus] = useState('Siap membuat scene');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const prompt = useMemo(() => {
    const lock = [
      characterLock ? 'CHARACTER LOCK: pertahankan identitas, wajah, rambut, pakaian dan ciri karakter dari referensi.' : '',
      vehicleLock ? 'VEHICLE LOCK: pertahankan model, bentuk, warna, grafis dan posisi kendaraan.' : '',
      locationLock ? 'LOCATION LOCK: pertahankan tata letak dan elemen lokasi dari referensi.' : '',
      positionLock ? 'POSITION LOCK: pertahankan posisi relatif setiap anggota tim dan muatan.' : ''
    ].filter(Boolean).join(' ');
    return `${sceneTitle}. ${action} Lokasi: ${selectedLocation}. Kendaraan: ${selectedVehicle}. Karakter: ${selectedCharacters.join(', ')}. ${lock} Gaya cinematic realistis, gerakan natural, kamera stabil, pencahayaan sinematik, detail tinggi, tanpa teleportasi, tanpa redesign karakter/kendaraan, seamless continuity.`;
  }, [sceneTitle, action, selectedLocation, selectedVehicle, selectedCharacters, characterLock, vehicleLock, locationLock, positionLock]);

  function toggleCharacter(name: string) {
    setSelectedCharacters(v => v.includes(name) ? v.filter(x => x !== name) : [...v, name]);
  }

  async function generate() {
    setStatus('Mengirim ke engine AI…'); setError(''); setVideoUrl(null);
    try {
      const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ prompt, duration, ratio, model, reference }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat video');
      setStatus(data.status || 'Video selesai');
      if (data.videoUrl) setVideoUrl(data.videoUrl);
    } catch (e) { setError(e instanceof Error ? e.message : 'Terjadi kesalahan'); setStatus('Gagal'); }
  }

  return <main className="shell">
    <header className="topbar"><div><div className="brand">HR-NET AI CINEMA</div><div className="sub">Scene Generator • Character / Vehicle / Location Lock</div></div><span className="pill">MVP 01</span></header>
    <section className="hero"><div><p className="eyebrow">PERJALANAN KE KALIMANTAN</p><h1>Bangun video AI dengan kontinuitas scene.</h1><p className="muted">Upload referensi, kunci karakter/kendaraan/lokasi, susun aksi, lalu generate video.</p></div></section>
    <div className="grid">
      <section className="panel"><h2>1. Scene Builder</h2>
        <label>Judul scene<input value={sceneTitle} onChange={e=>setSceneTitle(e.target.value)} /></label>
        <label>Aksi / blocking<textarea rows={5} value={action} onChange={e=>setAction(e.target.value)} /></label>
        <div className="row"><label>Durasi<select value={duration} onChange={e=>setDuration(Number(e.target.value))}><option value={5}>5 detik</option><option value={10}>10 detik</option><option value={15}>15 detik</option><option value={30}>30 detik*</option></select></label><label>Rasio<select value={ratio} onChange={e=>setRatio(e.target.value)}><option>9:16</option><option>16:9</option><option>1:1</option></select></label><label>Model<select value={model} onChange={e=>setModel(e.target.value)}><option value="gen4.5">Runway Gen-4.5</option><option value="wan3">Runway WAN 3</option></select></label></div>
        <div className="locks">{[['Character Lock',characterLock,setCharacterLock],['Vehicle Lock',vehicleLock,setVehicleLock],['Location Lock',locationLock,setLocationLock],['Position Lock',positionLock,setPositionLock]].map(([n,v,set])=><button key={String(n)} className={v?'lock on':'lock'} onClick={()=> (set as (x:boolean)=>void)(!v)}>🔒 {String(n)}</button>)}</div>
      </section>
      <section className="panel"><h2>2. Asset Library</h2><h3>Karakter</h3><div className="chips">{characters.map(c=><button key={c.name} className={selectedCharacters.includes(c.name)?'chip active':'chip'} onClick={()=>toggleCharacter(c.name)}>{c.name}</button>)}</div><h3>Kendaraan</h3><select value={selectedVehicle} onChange={e=>setSelectedVehicle(e.target.value)}>{vehicles.map(v=><option key={v.name}>{v.name}</option>)}</select><p className="assetdesc">{vehicles.find(v=>v.name===selectedVehicle)?.description}</p><h3>Lokasi</h3><select value={selectedLocation} onChange={e=>setSelectedLocation(e.target.value)}>{locations.map(v=><option key={v.name}>{v.name}</option>)}</select><p className="assetdesc">{locations.find(v=>v.name===selectedLocation)?.description}</p>
        <label>Referensi gambar (opsional)<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>setReference(String(r.result)); r.readAsDataURL(f);}} /></label>
      </section>
      <section className="panel full"><h2>3. Prompt yang akan dikirim</h2><pre>{prompt}</pre><div className="actions"><button className="generate" onClick={generate}>▶ GENERATE VIDEO</button><span className="status">{status}</span></div>{error&&<div className="error">{error}</div>}{videoUrl&&<div className="result"><video controls src={videoUrl}/><a href={videoUrl} target="_blank">Buka hasil video</a></div>}<p className="note">*Durasi yang benar-benar tersedia bergantung pada model/provider. MVP ini menggunakan API server-side agar API key tidak masuk ke browser.</p></section>
    </div>
    <footer>HR-NET AI CINEMA • dibuat untuk workflow cerita dan scene continuity.</footer>
  </main>
}
