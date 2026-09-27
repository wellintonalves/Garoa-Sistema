// Só é carregado após o clique para iniciar voz. Não grava arquivos.
class ValeriaPcm extends AudioWorkletProcessor {
  constructor() { super(); this.buffer = new Int16Array(2048); this.index = 0; }
  process(inputs) {
    const canal = inputs[0]?.[0];
    if (canal) for (const sample of canal) {
      this.buffer[this.index++] = Math.max(-1, Math.min(1, sample)) * 32767;
      if (this.index === this.buffer.length) {
        this.port.postMessage(this.buffer.buffer, [this.buffer.buffer]);
        this.buffer = new Int16Array(2048); this.index = 0;
      }
    }
    return true;
  }
}
registerProcessor('valeria-pcm', ValeriaPcm);
