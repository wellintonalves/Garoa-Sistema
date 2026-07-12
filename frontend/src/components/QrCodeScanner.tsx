// QR Code Scanner — usa html5-qrcode para ler QR Code via câmera do navegador
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

interface QrCodeScannerProps {
  onResult: (slug: string) => void;
  onClose: () => void;
}

export function QrCodeScanner({ onResult, onClose }: QrCodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(true);
  const containerId = 'qr-reader-container';

  useEffect(() => {
    let mounted = true;

    async function iniciarScanner() {
      try {
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' }, // Câmera traseira
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // Extrai o slug do QR Code
            // Formatos aceitos:
            // - URL completa: https://exemplo.com/b/garoa-barbearia
            // - Slug puro: garoa-barbearia
            // - URL do app: https://exemplo.com/cliente/home?slug=garoa-barbearia
            let slug = decodedText.trim();
            console.log("[QrCodeScanner] QR lido:", slug);

            // Tenta extrair slug de URL /b/:slug
            const matchB = slug.match(/\/b\/([a-zA-Z0-9_-]+)/);
            if (matchB) {
              slug = matchB[1];
            } else {
              // Tenta extrair de query param ?slug=
              const matchQuery = slug.match(/[?&]slug=([a-zA-Z0-9_-]+)/);
              if (matchQuery) {
                slug = matchQuery[1];
              } else {
                // Tenta extrair de URL /cliente/barbearia/:slug
                const matchBarbearia = slug.match(/\/cliente\/barbearia\/([a-zA-Z0-9_-]+)/);
                if (matchBarbearia) {
                  slug = matchBarbearia[1];
                } else {
                  // Remove protocolo e domínio se for uma URL, pegando a última parte
                  const matchUrl = slug.match(/^https?:\/\/[^/]+\/.*\/([a-zA-Z0-9_-]+)$/);
                  if (matchUrl) {
                    slug = matchUrl[1];
                  }
                }
              }
            }

            // Limpa caracteres inválidos e retorna
            slug = slug.replace(/[^a-zA-Z0-9_-]/g, '');
            console.log("[QrCodeScanner] Slug extraído:", slug);

            if (slug) {
              // Para o scanner antes de chamar o callback
              scanner.stop().catch(() => {});
              onResult(slug);
            }
          },
          () => {
            // QR code não detectado neste frame — ignora
          }
        );

        if (mounted) {
          setIniciando(false);
        }
      } catch (err) {
        if (mounted) {
          setIniciando(false);
          if (err instanceof Error) {
            if (err.message.includes('NotAllowedError') || err.message.includes('Permission')) {
              setErro('Permissão da câmera negada. Por favor, permita o acesso à câmera nas configurações do navegador.');
            } else if (err.message.includes('NotFoundError') || err.message.includes('not found')) {
              setErro('Nenhuma câmera encontrada no dispositivo.');
            } else {
              setErro(`Erro ao abrir câmera: ${err.message}`);
            }
          } else {
            setErro('Não foi possível abrir a câmera. Verifique as permissões.');
          }
        }
      }
    }

    iniciarScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onResult]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(0, 0, 0, 0.95)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={18} style={{ color: 'var(--cor-icone)' }} />
          <span style={{
            fontFamily: 'var(--fonte-interface)',
            fontSize: '11px',
            color: 'var(--cor-icone)',
            letterSpacing: '0.15em',
            textTransform: '' as const,
          }}>
            Escanear QR Code
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={20} style={{ color: '#fff' }} />
        </button>
      </div>

      {/* Scanner Container */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '0 20px',
      }}>
        {iniciando && (
          <div style={{
            textAlign: 'center',
            padding: '40px 0',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(255, 140, 0, 0.3)',
              borderTop: '3px solid var(--amber)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }} />
            <p style={{
              fontFamily: 'var(--fonte-interface)',
              fontSize: '14px',
              color: '#fff',
            }}>
              Abrindo câmera...
            </p>
            <p style={{
              fontFamily: 'var(--fonte-interface)',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.5)',
              marginTop: '4px',
            }}>
              Permita o acesso à câmera quando solicitado
            </p>
          </div>
        )}

        {erro && (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
          }}>
            <AlertCircle size={40} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
            <p style={{
              fontFamily: 'var(--fonte-interface)',
              fontSize: '14px',
              color: '#ef4444',
              marginBottom: '16px',
            }}>
              {erro}
            </p>
            <button
              onClick={onClose}
              style={{
                fontFamily: 'var(--fonte-interface)',
                fontSize: '11px',
                color: 'var(--cor-icone)',
                background: 'rgba(var(--cor-primaria-rgb), 0.10)',
                border: '1px solid var(--amber)',
                padding: '10px 24px',
                cursor: 'pointer',
                letterSpacing: '0.1em',
                textTransform: '' as const,
              }}
            >
              Voltar
            </button>
          </div>
        )}

        {/* Div onde o html5-qrcode renderiza o vídeo */}
        <div
          id={containerId}
          style={{
            width: '100%',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        />

        {!erro && !iniciando && (
          <p style={{
            textAlign: 'center',
            fontFamily: 'var(--fonte-interface)',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.6)',
            marginTop: '16px',
            lineHeight: '1.5',
          }}>
            Aponte a câmera para o QR Code da barbearia
          </p>
        )}
      </div>

      {/* CSS animation for spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        #${containerId} video {
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
