export interface EventoBase {
  id: string;
  inicioMinutos: number;
  fimMinutos: number;
  tipo: 'AGENDAMENTO' | 'BLOQUEIO';
  original: any;
}

export interface EventoComLane extends EventoBase {
  lane: number;
  totalLanes: number;
  isOverflow: boolean;
  overflowCount?: number;
  grupoCluster?: EventoBase[];
}

export function calcularLanes(eventos: EventoBase[], maxLanes: number): EventoComLane[] {
  if (eventos.length === 0) return [];

  // Ordena por inicio e id para ser deterministico
  const sorted = [...eventos].sort((a, b) => {
    if (a.inicioMinutos !== b.inicioMinutos) return a.inicioMinutos - b.inicioMinutos;
    return a.id.localeCompare(b.id);
  });

  const clusters: EventoBase[][] = [];
  let currentCluster: EventoBase[] = [];
  let clusterEnd = -1;

  for (const evento of sorted) {
    if (currentCluster.length === 0) {
      currentCluster.push(evento);
      clusterEnd = evento.fimMinutos;
    } else {
      if (evento.inicioMinutos < clusterEnd) {
        currentCluster.push(evento);
        clusterEnd = Math.max(clusterEnd, evento.fimMinutos);
      } else {
        clusters.push(currentCluster);
        currentCluster = [evento];
        clusterEnd = evento.fimMinutos;
      }
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const result: EventoComLane[] = [];

  for (const cluster of clusters) {
    const lanes: EventoBase[][] = [];

    for (const evento of cluster) {
      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        const lastEventInLane = lanes[i][lanes[i].length - 1];
        if (lastEventInLane.fimMinutos <= evento.inicioMinutos) {
          lanes[i].push(evento);
          placed = true;
          break;
        }
      }
      if (!placed) {
        lanes.push([evento]);
      }
    }

    const totalLanes = lanes.length;
    const visibleLanes = Math.min(totalLanes, maxLanes);

    let overflowEvents: EventoBase[] = [];
    if (totalLanes > maxLanes) {
      for (let i = maxLanes - 1; i < totalLanes; i++) {
        overflowEvents.push(...lanes[i]);
      }
    }

    for (let i = 0; i < lanes.length; i++) {
      for (let j = 0; j < lanes[i].length; j++) {
        const evento = lanes[i][j];
        if (totalLanes > maxLanes && i >= maxLanes - 1) {
          const isRepresentative = (i === maxLanes - 1 && j === 0);
          result.push({
            ...evento,
            lane: maxLanes - 1,
            totalLanes: visibleLanes,
            isOverflow: true,
            overflowCount: isRepresentative ? overflowEvents.length : undefined,
            grupoCluster: isRepresentative ? cluster : undefined,
          });
        } else {
          result.push({
            ...evento,
            lane: i,
            totalLanes: visibleLanes,
            isOverflow: false,
          });
        }
      }
    }
  }

  return result;
}
