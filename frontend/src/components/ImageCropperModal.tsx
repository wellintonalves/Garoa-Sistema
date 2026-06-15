import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Modal } from './Modal';
import getCroppedImg from '../utils/cropImage';

interface ImageCropperModalProps {
  aberto: boolean;
  onFechar: () => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
}

export function ImageCropperModal({ aberto, onFechar, imageSrc, onCropComplete }: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const handleCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, 0);
      if (croppedImage) {
        onCropComplete(croppedImage);
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao cortar imagem');
    }
  };

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Ajustar Foto">
      <div style={{ position: 'relative', width: '100%', height: '400px', background: '#333', borderRadius: '8px', overflow: 'hidden' }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onCropComplete={handleCropComplete}
          onZoomChange={setZoom}
        />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <label className="input-label text-center">Zoom</label>
        <input
          type="range"
          value={zoom}
          min={1}
          max={3}
          step={0.1}
          aria-labelledby="Zoom"
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
        />
      </div>
      <div className="flex gap-4 mt-6">
        <button onClick={onFechar} className="btn-secondary flex-1 justify-center">Cancelar</button>
        <button onClick={handleConfirm} className="btn-primary flex-1 justify-center">Confirmar</button>
      </div>
    </Modal>
  );
}
