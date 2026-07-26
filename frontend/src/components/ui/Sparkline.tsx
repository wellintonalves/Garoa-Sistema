interface SparklineProps {
  dados: number[];
  cor: string;
  largura?: number;
  altura?: number;
}

export function Sparkline({ dados, cor, largura = 96, altura = 28 }: SparklineProps) {
  if (!dados || !Array.isArray(dados) || dados.length < 2) {
    return null;
  }

  const padding = 2;
  const min = Math.min(...dados);
  const max = Math.max(...dados);
  const range = max - min;
  const usableHeight = Math.max(1, altura - 2 * padding);
  const n = dados.length;

  const pontos = dados.map((val, i) => {
    const x = (i / (n - 1)) * largura;
    const y = range === 0 ? altura / 2 : padding + usableHeight * (1 - (val - min) / range);
    return { x, y };
  });

  const linhaPath = pontos
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');

  const areaPath = `${linhaPath} L ${pontos[n - 1].x.toFixed(2)},${altura} L ${pontos[0].x.toFixed(2)},${altura} Z`;

  return (
    <svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      className="overflow-visible flex-shrink-0"
      role="img"
      aria-label="Tendência do período"
    >
      <path
        d={areaPath}
        fill={cor}
        fillOpacity={0.1}
        stroke="none"
      />
      <path
        d={linhaPath}
        fill="none"
        stroke={cor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
