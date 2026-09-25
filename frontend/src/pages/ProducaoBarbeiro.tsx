import { useParams } from 'react-router-dom';
import { ProducaoBarbeiros } from '../components/ProducaoBarbeiros';

export function ProducaoBarbeiro() {
  const { barbeiroId } = useParams<{ barbeiroId: string }>();
  return <ProducaoBarbeiros barbeiroId={barbeiroId} />;
}
