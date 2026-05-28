// Spinner de carregamento — âmbar
export function LoadingSpinner({ tamanho = 'md' }: { tamanho?: 'sm' | 'md' | 'lg' }) {
  const tamanhos = { sm: 16, md: 32, lg: 48 };
  const size = tamanhos[tamanho];

  return (
    <div className="flex items-center justify-center p-8">
      <div
        className="spinner"
        style={{
          width: `${size}px`,
          height: `${size}px`,
        }}
      />
    </div>
  );
}
