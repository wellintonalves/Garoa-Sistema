import React from 'react';
import { Botao } from './Botao';

export interface EstadoVazioProps {
  icone?: React.ReactNode | React.ElementType;
  titulo: string;
  descricao?: string;
  textoBotao?: string;
  onClickBotao?: () => void;
  className?: string;
}

export const EstadoVazio: React.FC<EstadoVazioProps> = ({
  icone,
  titulo,
  descricao,
  textoBotao,
  onClickBotao,
  className = '',
}) => {
  const renderIcone = () => {
    if (!icone) return null;
    if (React.isValidElement(icone)) {
      return (
        <div className="estado-vazio-icone" aria-hidden="true">
          {icone}
        </div>
      );
    }
    const IconeComponente = icone as React.ElementType;
    return (
      <div className="estado-vazio-icone" aria-hidden="true">
        <IconeComponente size={48} strokeWidth={1.75} />
      </div>
    );
  };

  return (
    <div className={`estado-vazio-container ${className}`.trim()}>
      {renderIcone()}
      <h3 className="estado-vazio-titulo">{titulo}</h3>
      {descricao && <p className="estado-vazio-desc">{descricao}</p>}
      {textoBotao && onClickBotao && (
        <Botao variante="primario" onClick={onClickBotao}>
          {textoBotao}
        </Botao>
      )}
    </div>
  );
};
