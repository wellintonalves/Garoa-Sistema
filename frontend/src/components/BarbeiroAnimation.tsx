import React from 'react';

const BarbeiroAnimation = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="200"
      height="200"
      viewBox="0 0 200 200"
      style={{ shapeRendering: 'crispEdges' }}
    >
      <defs>
        <style>
          {`
            .barbeiro-stroke {
              stroke: #0A0A0A;
              stroke-width: 1.5;
              fill: none;
              stroke-linecap: round;
              stroke-linejoin: round;
            }
            @keyframes armMove {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              50% { transform: translateY(8px) rotate(4deg); }
            }
            @keyframes scissorOpenClose {
              0%, 100% { transform: rotate(0deg); }
              50% { transform: rotate(20deg); }
            }
            #barber-arm-group {
              animation: armMove 1.8s ease-in-out infinite;
              transform-origin: 160px 70px;
            }
            #scissors-group {
              animation: scissorOpenClose 1.8s ease-in-out infinite;
              transform-origin: 125px 55px;
            }
            @keyframes capeWave {
              0%, 100% { transform: rotate(-1deg); }
              50% { transform: rotate(1deg); }
            }
            #client-cape-group {
              animation: capeWave 3s ease-in-out infinite;
              transform-origin: 100px 90px;
            }
            @keyframes headBreathe {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-0.5px); }
            }
            #client-head-group {
              animation: headBreathe 4s ease-in-out infinite;
              transform-origin: 100px 60px;
            }
          `}
        </style>
      </defs>

      <g id="chair-static">
        <path className="barbeiro-stroke" d="M 50,180 L 150,180 M 60,170 L 140,170" />
        <line className="barbeiro-stroke" x1="100" y1="180" x2="100" y2="150" />
        <path className="barbeiro-stroke" d="M 80,150 L 120,150 L 130,120 L 130,80 C 130,70, 110,60, 100,60 C 90,60, 70,70, 70,80 L 70,120 L 80,150 Z" />
      </g>

      <g id="client-group">
        <g id="client-head-group">
          <circle className="barbeiro-stroke" cx="100" cy="60" r="15" />
          <path className="barbeiro-stroke" d="M 100,75 L 100,85" />
        </g>
        <g id="client-cape-group">
          <path className="barbeiro-stroke" d="M 85,85 L 115,85 L 130,110 L 130,150 L 70,150 L 70,110 Z" />
          <path className="barbeiro-stroke" d="M 90,100 L 110,100 M 80,120 L 120,120" />
        </g>
      </g>

      <g id="barber-group">
        <path className="barbeiro-stroke" d="M 160,150 L 160,90 L 150,80" />
        <circle className="barbeiro-stroke" cx="160" cy="70" r="12" />
        <g id="barber-arm-group">
          <line className="barbeiro-stroke" x1="160" y1="90" x2="140" y2="70" />
          <g id="scissors-group">
            <path className="barbeiro-stroke" d="M 125,55 L 105,45 M 105,45 L 110,48" />
            <path className="barbeiro-stroke" d="M 125,55 L 105,65 M 105,65 L 110,62" />
            <circle className="barbeiro-stroke" cx="130" cy="53" r="3" />
            <circle className="barbeiro-stroke" cx="130" cy="57" r="3" />
            <circle cx="125" cy="55" r="1" fill="#0A0A0A" />
          </g>
        </g>
      </g>
    </svg>
  );
};

export default BarbeiroAnimation;
