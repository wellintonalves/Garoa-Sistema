// Spinner de carregamento
export function LoadingSpinner({ tamanho = 'md' }: { tamanho?: 'sm' | 'md' | 'lg' }) {
  const tamanhos = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };

  return (
    <div className="flex items-center justify-center p-8">
      <div className={`${tamanhos[tamanho]} border-2 border-neutral-700 border-t-amber-400 rounded-full animate-spin`} />
    </div>
  );
}
