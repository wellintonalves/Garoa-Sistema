import { useCallback, useEffect, useRef, useState } from 'react';
import type { AxiosInstance } from 'axios';

export function useVozValeria(api: AxiosInstance, caminho: string, conversaId: string,
  receberTexto: (texto: string) => void, aoEncerrar: () => void) {
  const [estado, setEstado] = useState('');
  const [erro, setErro] = useState('');
  const [ativa, setAtiva] = useState(false);
  const limpar = useRef<(() => void) | null>(null);
  const geracao = useRef(0);
  const textoRef = useRef(receberTexto); textoRef.current = receberTexto;
  const fimRef = useRef(aoEncerrar); fimRef.current = aoEncerrar;
  const parar = useCallback(() => {
    const estavaAtiva = Boolean(limpar.current);
    geracao.current++; limpar.current?.(); limpar.current = null; setAtiva(false); setEstado('');
    if (estavaAtiva) fimRef.current();
  }, []);
  useEffect(() => () => { geracao.current++; limpar.current?.(); }, []);

  async function iniciar() {
    if (limpar.current) return;
    const atual = ++geracao.current;
    let stream: MediaStream | undefined, audio: AudioContext | undefined, ws: WebSocket | undefined;
    let node: AudioWorkletNode | undefined, source: MediaStreamAudioSourceNode | undefined;
    let proximoAudio = 0, ouvindo = false, finalizou = false;
    const controller = new AbortController();
    const fontes = new Set<AudioBufferSourceNode>();
    const cleanup = () => {
      if (finalizou) return; finalizou = true; controller.abort();
      stream?.getTracks().forEach(t => t.stop()); node?.disconnect(); source?.disconnect();
      for (const f of fontes) { try { f.stop(); } catch { /* Já terminou. */ } }
      if (ws?.readyState === WebSocket.OPEN) ws.send('{"tipo":"encerrar"}');
      ws?.close(); void audio?.close();
      if (limpar.current === cleanup) limpar.current = null;
    };
    limpar.current = cleanup; setErro(''); setAtiva(true); setEstado('Aguardando microfone');
    try {
      // Somente ação explícita; nenhuma câmera e nenhuma captura ao abrir painel.
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (atual !== geracao.current || finalizou) { stream.getTracks().forEach(t => t.stop()); return; }
      audio = new AudioContext({ sampleRate: 24000 }); await audio.resume();
      await audio.audioWorklet.addModule('/valeria-pcm.js');
      if (atual !== geracao.current || finalizou) { cleanup(); return; }
      setEstado('Conectando');
      const { data } = await api.post<{ ticket: string; url: string }>(`${caminho}/voz/sessoes`, { conversaId }, { signal: controller.signal });
      if (atual !== geracao.current || finalizou) return;
      const destino = new URL(data.url);
      const local = import.meta.env.DEV && destino.protocol === 'ws:' && ['localhost', '127.0.0.1'].includes(destino.hostname);
      if ((!local && destino.protocol !== 'wss:') || destino.pathname !== '/ia/voz/conexao' || destino.search || destino.hash || destino.username || destino.password)
        throw new Error('Endereço da conversa de voz inválido.');
      ws = new WebSocket(data.url);
      ws.onopen = () => ws!.send(JSON.stringify({ ticket: data.ticket }));
      source = audio.createMediaStreamSource(stream); node = new AudioWorkletNode(audio, 'valeria-pcm');
      const mute = audio.createGain(); mute.gain.value = 0;
      source.connect(node); node.connect(mute); mute.connect(audio.destination);
      node.port.onmessage = e => { if (ouvindo && ws?.readyState === WebSocket.OPEN && ws.bufferedAmount < 48000) ws.send(e.data); };
      ws.onmessage = e => {
        if (atual !== geracao.current || finalizou) return;
        const data = JSON.parse(e.data);
        if (data.tipo === 'estado') {
          ouvindo = data.estado === 'ouvindo';
          setEstado(ouvindo ? 'Ouvindo' : data.estado === 'respondendo' ? 'Valéria está respondendo' : 'Encerrando');
        } else if (data.tipo === 'aviso') setEstado(data.texto);
        else if (data.tipo === 'texto') textoRef.current(data.texto);
        else if (data.tipo === 'audio') {
          ouvindo = false; setEstado('Valéria está falando');
          const raw = atob(data.audio), pcm = new DataView(new ArrayBuffer(raw.length));
          for (let i = 0; i < raw.length; i++) pcm.setUint8(i, raw.charCodeAt(i));
          const buffer = audio!.createBuffer(1, raw.length / 2, 24000), out = buffer.getChannelData(0);
          for (let i = 0; i < out.length; i++) out[i] = pcm.getInt16(i * 2, true) / 32768;
          const f = audio!.createBufferSource(); f.buffer = buffer; f.connect(audio!.destination);
          proximoAudio = Math.max(audio!.currentTime, proximoAudio); f.start(proximoAudio); proximoAudio += buffer.duration;
          fontes.add(f); f.onended = () => fontes.delete(f);
        } else if (data.tipo === 'fim') { setEstado(data.texto); cleanup(); setAtiva(false); fimRef.current(); }
      };
      ws.onerror = () => setErro('Não foi possível conectar a conversa de voz. Tente novamente.');
      ws.onclose = () => {
        if (!finalizou && atual === geracao.current) { setEstado('Conversa encerrada.'); cleanup(); setAtiva(false); fimRef.current(); }
      };
    } catch (e) {
      if (atual === geracao.current && !controller.signal.aborted) {
        setErro(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Permita o microfone para conversar com a Valéria.'
          : e instanceof Error ? e.message : 'Não foi possível iniciar a voz.');
        cleanup(); setAtiva(false); setEstado('');
      }
    }
  }
  return { iniciar, parar, ativa, estado, erro };
}
